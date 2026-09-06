-- Mark webhook events whose state transition committed. Nullable: existing
-- rows need no backfill, and the migration is safe to run while live code
-- reads/writes the table.
ALTER TABLE "background_check_webhook_events"
ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMPTZ;
