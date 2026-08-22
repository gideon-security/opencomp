#!/usr/bin/env node
// Re-runs the `generate-risk-mitigation` runs that FAILED for an org during the
// last onboarding run, staggered with a delay so the Gemini free-tier quota
// (5 RPM) is not exhausted again. Replays each failed run's stored payload
// verbatim into a fresh QUEUED run + delayed BullMQ job on local-trigger-runs-app.
//
// Usage:
//   ORGANIZATION_ID=org_xxx node retry-failed-mitigations.cjs
//
// Env (defaults target the local compose stack):
//   LOCAL_TRIGGER_REDIS_URL (default redis://comp_service:comp_service_local_dev_password@localhost:6379)
//   LOCAL_TRIGGER_QUEUE_SUFFIX (default app)
//   LOCAL_TRIGGER_DATABASE_URL (default postgres://postgres:postgres@localhost:5432/comp?sslmode=disable)
//   BASE_DELAY_MS (default 900000 = 15 min from now)
//   STAGGER_MS (default 90000 = 90s between runs)

const { Queue } = require('bullmq');
const { Pool } = require('pg');
const crypto = require('node:crypto');

const ORGANIZATION_ID = process.env.ORGANIZATION_ID;
if (!ORGANIZATION_ID) {
  console.error('ORGANIZATION_ID is required');
  process.exit(1);
}

// Only replay failures from the latest onboarding window (created after this).
const SINCE = process.env.SINCE || '2026-08-10T16:40:00Z';

const REDIS_URL =
  process.env.LOCAL_TRIGGER_REDIS_URL ||
  'redis://comp_service:comp_service_local_dev_password@localhost:6379';
const QUEUE_SUFFIX = process.env.LOCAL_TRIGGER_QUEUE_SUFFIX || 'app';
const DATABASE_URL =
  process.env.LOCAL_TRIGGER_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/comp?sslmode=disable';
const BASE_DELAY_MS = Number(process.env.BASE_DELAY_MS || 900000);
const STAGGER_MS = Number(process.env.STAGGER_MS || 90000);

const TASK_ID = 'generate-risk-mitigation';
const QUEUE_NAME = `local-trigger-runs-${QUEUE_SUFFIX}`;
const RETRY_ATTEMPTS = 5;

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

  const failed = await pool.query(
    `SELECT id, payload FROM local_trigger_runs
      WHERE task_identifier = $1 AND status = 'FAILED'
        AND payload->>'organizationId' = $2
        AND created_at >= $3
      ORDER BY created_at`,
    [TASK_ID, ORGANIZATION_ID, SINCE],
  );

  if (failed.rows.length === 0) {
    console.log(`No failed ${TASK_ID} runs for ${ORGANIZATION_ID}`);
    await pool.end();
    return;
  }

  const queue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } });
  const created = [];

  for (let i = 0; i < failed.rows.length; i += 1) {
    const originalId = failed.rows[i].id;
    const payload = failed.rows[i].payload;
    const runId = `run_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();
    const delay = BASE_DELAY_MS + i * STAGGER_MS;

    await pool.query(
      `INSERT INTO local_trigger_runs
         (id, task_identifier, status, payload, output, error, metadata, tags, attempt, created_at, started_at, finished_at)
       VALUES ($1, $2, 'QUEUED', $3, NULL, NULL, '{}'::jsonb, '[]'::jsonb, 0, $4, NULL, NULL)`,
      [runId, TASK_ID, JSON.stringify(payload), now],
    );

    await queue.add(
      TASK_ID,
      {
        payload,
        metadata: {},
        tags: [],
        concurrencyKey: null,
        lastError: null,
      },
      {
        jobId: runId,
        attempts: RETRY_ATTEMPTS,
        backoff: { type: 'exponential', delay: 1000 },
        delay,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 2000 },
      },
    );

    created.push({ runId, originalId, delay: Math.round(delay / 1000) });
  }

  await queue.close();
  await pool.end();

  console.log(`Scheduled ${created.length} ${TASK_ID} re-runs for ${ORGANIZATION_ID}:`);
  for (const c of created) {
    console.log(`  ${c.runId}  (retry of ${c.originalId}, +${c.delay}s)`);
  }
}

main().catch((err) => {
  console.error('Failed to schedule mitigation re-runs:', err);
  process.exit(1);
});
