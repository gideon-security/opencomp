import { Logger } from '@nestjs/common';
import { db, Prisma } from '@db';

const logger = new Logger('CheckrWebhookDedup');

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** Delete the dedup marker so the next delivery reprocesses the event. */
export async function releaseWebhookDedupMarker(
  eventId: string,
): Promise<void> {
  try {
    // Only release unapplied markers: a reclaimed retry may have applied
    // the event between this worker's failure and the cleanup, and that
    // applied marker must survive so redeliveries keep acking duplicate.
    await db.backgroundCheckWebhookEvent.deleteMany({
      where: { eventId, appliedAt: null },
    });
  } catch (cleanupError) {
    logger.warn('Failed to release webhook dedup marker after error', {
      eventId,
      error:
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
    });
  }
}

/**
 * Mark the dedup marker applied so redeliveries ack duplicate. Used for
 * permanent failures (e.g. tenant mismatch): the payload can never apply,
 * but without this the row stays old, unapplied, and unlinked — exactly
 * the reclaim predicate — and every redelivery reprocesses just to fail
 * again. Best-effort: a cleanup failure must never mask the original error.
 */
export async function ackWebhookDedupMarker(eventId: string): Promise<void> {
  try {
    await db.backgroundCheckWebhookEvent.updateMany({
      where: { eventId, appliedAt: null },
      data: { appliedAt: new Date() },
    });
  } catch (cleanupError) {
    logger.warn('Failed to ack webhook dedup marker after permanent error', {
      eventId,
      error:
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
    });
  }
}
