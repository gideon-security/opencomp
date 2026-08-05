# Secure RDS TLS — Deploy Checklist

## Vercel (apps/app and apps/portal)

**No env var or `outputFileTracingIncludes` config required.** The AWS RDS CA
bundle is inlined as a TypeScript constant (`RDS_CA_BUNDLE`) and passed
directly to the Postgres adapter via `ssl.ca`. This works under both Webpack
and Turbopack since it's just a string the bundler always emits.

Background: `outputFileTracingIncludes` is silently no-op'd under Turbopack
(`next/dist/build/index.js` line ~1537 gates `collectBuildTraces` on
`bundler !== Bundler.Turbopack`). All current Vercel deployments use Turbopack
(metadata `bundler: "turbopack"`), which is why the file-based approach from
PR #2761 failed in production for app-router page routes.

If `NODE_EXTRA_CA_CERTS` is still set as a shared/team Vercel env var,
**unset it** — when the path doesn't exist on the function, Node logs a
`Warning: Ignoring extra certs from … load failed: error:80000002:system
library` for every cold start.

## Background task worker TLS (api + app, staging + prod)

Tasks run in-process (BullMQ on Redis) and inherit the process' `NODE_EXTRA_CA_CERTS`
/ `DATABASE_URL` config. The shared `@gideon-defender/db` client falls through to
verified TLS via the inline RDS bundle either way.

If `PRISMA_ALLOW_INSECURE_TLS` is still set as a leftover from earlier
debugging, remove it from the container/process env and restart.

## API Docker (apps/api)

No action — `apps/api/Dockerfile.multistage` already installs the RDS CA bundle
and sets `NODE_EXTRA_CA_CERTS` at the system level. `apps/api/prisma/client.ts`
still consults the env var, which is the correct path for that runtime.

## Downstream consumers (comp-private/apps/enterprise-api, etc.)

After bumping `@gideon-defender/db` to a version that includes the inline bundle,
consumers that import `resolveSslConfig` from `@gideon-defender/db/ssl-config`
automatically get verified TLS via the inline bundle — no env var required.
They can drop their own `NODE_EXTRA_CA_CERTS` and `outputFileTracingIncludes`
on the new version.

## Regenerating the inlined CA bundle

When AWS rotates the RDS CA, replace the PEM and regenerate:

```bash
# overwrite packages/db/certs/rds-global-bundle.pem with the new bundle
node packages/db/scripts/generate-ca-bundle-ts.mjs
```

This rewrites the inlined `rds-ca-bundle.ts` in `packages/db/src` and in each
app's `prisma/` directory.
