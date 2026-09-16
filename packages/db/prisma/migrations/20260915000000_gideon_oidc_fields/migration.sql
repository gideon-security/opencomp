-- Gideon OIDC login (Milestone 1, dual-run): stable Gideon `sub` ↔ user link
-- plus per-session refresh-token store for renewal/revocation.
-- Both columns are nullable so existing rows need no backfill.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gideonSub" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_gideonSub_key'
  ) THEN
    CREATE UNIQUE INDEX "User_gideonSub_key" ON "User"("gideonSub");
  END IF;
END $$;

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "gideonRefreshToken" TEXT;
