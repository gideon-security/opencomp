-- Tenant is the org: Organization.id becomes the Gideon tenant id.
--
-- What changes and why:
--   * Organization.id loses its generated-CUID default. Gideon owns tenant
--     issuance, so every organization row is created with its Gideon-issued
--     tid as the primary key. No mapping column, no second id.
--   * Organization.gideonTenantId / Session.gideonTenantId (introduced by the
--     uncommitted 20260918120000 migration, never released) are removed.
--   * User.gideonTenantId is added: the login's tenant, refreshed on every
--     Gideon login. Onboarding reads it to stamp new organizations, since a
--     pre-org session has no activeOrganizationId yet.
--
-- Data rewrite: rows whose tid is known (legacy mapping column present) get
-- their PK rewritten to the tid, across all 68 FK references plus the known
-- non-FK org-id columns (Session.activeOrganizationId, IntegrationOAuthError,
-- IntegrationOAuthState, IntegrationResult, RemediationAction,
-- RemediationBatch, vector_embedding). FK constraints are dropped and
-- re-created with identical definitions (read from the catalog), so nothing
-- is lost. Databases that never saw the mapping column (fresh setups) skip
-- the rewrite; orgs with no known tid keep their ids.

DO $$
DECLARE
  fkr  RECORD;
  colr RECORD;
  orgr RECORD;
BEGIN
  -- Fresh databases never had the mapping column: nothing to remap.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Organization'
      AND column_name = 'gideonTenantId'
  ) THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE _org_fk_defs(tbl TEXT, cname TEXT, col TEXT, cdef TEXT) ON COMMIT DROP;

  -- Save every FK pointing at Organization and drop it (PK values cannot be
  -- rewritten while references exist; constraints are NOT deferrable).
  FOR fkr IN
    SELECT c.oid, c.conname, c.conrelid::regclass::TEXT AS tbl,
           (SELECT string_agg(a.attname, ',')
            FROM unnest(c.conkey) AS u(attnum)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum) AS cols
    FROM pg_constraint c
    WHERE c.confrelid = '"Organization"'::regclass AND c.contype = 'f'
  LOOP
    -- All Organization FKs are single-column; refuse to guess on composites.
    IF fkr.cols IS NULL OR position(',' IN fkr.cols) > 0 THEN
      RAISE EXCEPTION 'unexpected composite FK % on %', fkr.conname, fkr.tbl;
    END IF;
    INSERT INTO _org_fk_defs VALUES (fkr.tbl, fkr.conname, fkr.cols, pg_get_constraintdef(fkr.oid));
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fkr.tbl, fkr.conname);
  END LOOP;

  -- Rewrite each mapped org id to its tid, everywhere it is referenced.
  FOR orgr IN
    SELECT id AS old_id, "gideonTenantId" AS new_id
    FROM "Organization"
    WHERE "gideonTenantId" IS NOT NULL AND id <> "gideonTenantId"
  LOOP
    FOR colr IN SELECT tbl, col FROM _org_fk_defs LOOP
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', colr.tbl, colr.col, colr.col)
        USING orgr.new_id, orgr.old_id;
    END LOOP;
    -- Non-FK org-id columns (no constraint, same remap).
    UPDATE "Session" SET "activeOrganizationId" = orgr.new_id WHERE "activeOrganizationId" = orgr.old_id;
    UPDATE "IntegrationOAuthError" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "IntegrationOAuthState" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "IntegrationResult" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "RemediationAction" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "RemediationBatch" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "vector_embedding" SET "organizationId" = orgr.new_id WHERE "organizationId" = orgr.old_id;
    UPDATE "Organization" SET id = orgr.new_id WHERE id = orgr.old_id;
  END LOOP;

  -- Re-create every FK exactly as it was.
  FOR fkr IN SELECT tbl, cname, cdef FROM _org_fk_defs LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', fkr.tbl, fkr.cname, fkr.cdef);
  END LOOP;
END $$;

-- Schema changes. The legacy drops are IF EXISTS so fresh databases (which
-- never had the mapping columns) apply this migration cleanly.
ALTER TABLE "Organization" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "gideonTenantId";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "gideonTenantId";
ALTER TABLE "User" ADD COLUMN "gideonTenantId" TEXT;
