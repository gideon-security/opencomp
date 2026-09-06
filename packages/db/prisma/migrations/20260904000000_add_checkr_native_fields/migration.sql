-- Add native Checkr correlation columns (candidate, invitation, package).
-- All nullable: existing rows need no backfill, and the migration is safe to
-- run while live code reads/writes the table.
ALTER TABLE "background_check_requests"
ADD COLUMN IF NOT EXISTS "checkrCandidateId" TEXT,
ADD COLUMN IF NOT EXISTS "checkrInvitationId" TEXT,
ADD COLUMN IF NOT EXISTS "checkrPackage" TEXT;
