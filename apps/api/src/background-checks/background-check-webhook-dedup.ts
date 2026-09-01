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
    await db.backgroundCheckWebhookEvent.deleteMany({
      where: { eventId },
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
