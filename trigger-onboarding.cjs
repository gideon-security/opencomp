#!/usr/bin/env node
// Re-triggers the `onboard-organization` local-trigger task for an org from the
// host. Replicates what runtime.createRun() + queues.addRunJob() do so the task
// does not need to be imported/registered in this process: insert the QUEUED
// run row in Postgres, then enqueue the BullMQ job on local-trigger-runs-app
// where the app container's worker picks it up.
//
// Usage:
//   ORGANIZATION_ID=org_xxx node trigger-onboarding.cjs
//
// Env (defaults target the local compose stack):
//   LOCAL_TRIGGER_REDIS_URL (default redis://comp_service:comp_service_local_dev_password@localhost:6379)
//   LOCAL_TRIGGER_QUEUE_SUFFIX (default app)
//   LOCAL_TRIGGER_DATABASE_URL (default postgres://postgres:postgres@localhost:5432/comp?sslmode=disable)

const { Queue } = require('bullmq');
const { Pool } = require('pg');
const crypto = require('node:crypto');

const ORGANIZATION_ID = process.env.ORGANIZATION_ID;
if (!ORGANIZATION_ID) {
  console.error('ORGANIZATION_ID is required');
  process.exit(1);
}

const REDIS_URL =
  process.env.LOCAL_TRIGGER_REDIS_URL ||
  'redis://comp_service:comp_service_local_dev_password@localhost:6379';
const QUEUE_SUFFIX = process.env.LOCAL_TRIGGER_QUEUE_SUFFIX || 'app';
const DATABASE_URL =
  process.env.LOCAL_TRIGGER_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/comp?sslmode=disable';

const TASK_ID = 'onboard-organization';
const QUEUE_NAME = `local-trigger-runs-${QUEUE_SUFFIX}`;

async function main() {
  const runId = `run_${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date().toISOString();
  const payload = { organizationId: ORGANIZATION_ID };

  const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

  await pool.query(
    `INSERT INTO local_trigger_runs
       (id, task_identifier, status, payload, output, error, metadata, tags, attempt, created_at, started_at, finished_at)
     VALUES ($1, $2, 'QUEUED', $3, NULL, NULL, '{}'::jsonb, '[]'::jsonb, 0, $4, NULL, NULL)`,
    [runId, TASK_ID, JSON.stringify(payload), now],
  );

  const queue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } });
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
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 2000 },
    },
  );
  await queue.close();

  await pool.query(
    `UPDATE "Onboarding" SET "triggerJobId" = $1, "triggerJobCompleted" = false WHERE "organizationId" = $2`,
    [runId, ORGANIZATION_ID],
  );
  await pool.end();

  console.log(`Triggered ${TASK_ID} run ${runId} for ${ORGANIZATION_ID}`);
}

main().catch((err) => {
  console.error('Failed to trigger onboarding:', err);
  process.exit(1);
});
