import { db } from '@db/server';
import { logger, schedules, tasks } from '@gideon-defender/trigger-local';

/**
 * Re-executes onboarding work that was deferred on transient LLM failures
 * (Gemini daily quota, network/TLS resets). Runs every 30 minutes; each row's
 * `nextAttemptAt` gates when it becomes due — daily-quota deferrals point at
 * the next midnight-Pacific reset, network failures back off exponentially.
 *
 * Semantics: re-trigger the original task by id and DELETE the row. If the
 * re-run fails transiently again, the generator defers a fresh row (same
 * dedupeKey), so no state can get stuck.
 */
export const onboardingDeferredSweeper = schedules.task({
  id: 'onboarding-deferred-sweeper',
  cron: '*/30 * * * *',
  machine: 'small-1x',
  maxDuration: 1000 * 60 * 5,
  run: async () => {
    const due = await db.onboardingDeferredWork.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: 5,
    });

    if (due.length === 0) {
      logger.info('[onboarding-deferred] nothing due');
      return { retriggered: 0 };
    }

    logger.info(`[onboarding-deferred] re-triggering ${due.length} item(s)`);

    let ok = 0;
    for (const row of due) {
      try {
        await tasks.trigger(row.taskId, row.payload);
        await db.onboardingDeferredWork.delete({ where: { id: row.id } });
        ok += 1;
      } catch (error) {
        // Leave the row in place; the next sweep retries after its delay.
        logger.error(`[onboarding-deferred] failed to re-trigger ${row.dedupeKey}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { retriggered: ok, remaining: due.length - ok };
  },
});
