-- Remember vendor pointers superseded by retry so late webhooks for a prior
-- attempt stay stale while the new report still graduates the row.
-- NOT NULL with an empty-array default: existing rows need no backfill, and
-- Postgres fills the default without rewriting the table.
ALTER TABLE "background_check_requests"
ADD COLUMN IF NOT EXISTS "supersededIdentityBackgroundCheckIds" TEXT[] NOT NULL DEFAULT '{}';
