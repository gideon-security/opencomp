import { Logger } from '@nestjs/common';
import { db, Prisma } from '@db';
import { isUniqueConstraintError } from './background-check-webhook-dedup';

const logger = new Logger('CheckrWebhookClaim');

/**
 * A marker older than this with no appliedAt never finished: the worker
 * crashed between the insert and the commit. Reclaim it instead of acking
 * duplicate. Fresh unapplied markers belong to a worker still in flight.
 */
export const STALE_INFLIGHT_MS = 5 * 60 * 1000;

export type DedupClaim = 'claimed' | 'duplicate' | 'reclaimed';

/**
 * Insert the dedup marker for this delivery. On a unique conflict the event
 * was seen before: ack duplicate, unless the marker proves a crashed worker
 * (old, never applied, never linked) — then delete it and let this delivery
 * reprocess the event instead of acking state that was never written.
 */
export async function claimWebhookDedupMarker({
  eventId,
  eventType,
  reportId,
  rawJson,
}: {
  eventId: string;
  eventType: string;
  reportId: string;
  rawJson: unknown;
}): Promise<DedupClaim> {
  try {
    await db.backgroundCheckWebhookEvent.create({
      data: {
        eventId,
        eventType,
        identityBackgroundCheckId: reportId,
        payload: rawJson as Prisma.InputJsonValue,
      },
    });
    return 'claimed';
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.backgroundCheckWebhookEvent.findUnique({
      where: { eventId },
    });
    const abandoned =
      existing &&
      !existing.appliedAt &&
      !existing.backgroundCheckRequestId &&
      Date.now() - existing.processedAt.getTime() > STALE_INFLIGHT_MS;
    if (!abandoned) {
      // Replay, or a concurrent delivery still in flight: ack without
      // writing so a stale redelivery cannot regress current state.
      return 'duplicate';
    }
    const deleted = await db.backgroundCheckWebhookEvent.deleteMany({
      where: { eventId, appliedAt: null },
    });
    if (deleted.count === 0) {
      // Lost the reclaim race: the original worker applied between the
      // read and the delete. Ack instead of double-applying.
      return 'duplicate';
    }
    // Re-insert the marker under this delivery. Without it the event loses
    // dedup: every future replay would reprocess instead of acking
    // duplicate, and a concurrent delivery could double-apply.
    try {
      await db.backgroundCheckWebhookEvent.create({
        data: {
          eventId,
          eventType,
          identityBackgroundCheckId: reportId,
          payload: rawJson as Prisma.InputJsonValue,
        },
      });
    } catch (createError) {
      if (!isUniqueConstraintError(createError)) throw createError;
      // Lost the reclaim race: a concurrent delivery re-created first and
      // is processing the event. Ack instead of double-applying.
      return 'duplicate';
    }
    logger.warn('Reclaimed an abandoned webhook dedup marker', {
      eventId,
      eventType,
    });
    return 'reclaimed';
  }
}
