# OpenComp × Gideon Auth integration plan

**Status:** Milestone 1 done (2026-09-15); Milestone 2 flipped locally (2026-09-18); Milestone 3 cutover-enablement done (2026-09-16), deletion PR pending
**Date:** 2026-09-07 (updated 2026-09-16)
**Goal:** Replace better-auth (including Google/GitHub/Microsoft social, magic link, email OTP) with Gideon Auth as the sole authenticator for OpenComp.

## Milestone map

| Milestone                                           | Scope                                                                                                                                     | Plan steps             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1 — OIDC login via library (dual-run, no deletions) | Done 2026-09-15                                                                                                                           | §4.5 + §5.7, 8, 10, 11 |
| 2 — Session reads off better-auth                   | Flipped locally 2026-09-18 (staging/prod pending)                                                                                         | §8 + §5.9              |
| 3 — Cutover and deletion                            | Cutover-enablement done 2026-09-16 (native sessions/permissions/admin, Gideon-only default, MCP accepts Gideon JWTs); deletion PR pending | §6 + §7                |

## 1. Context

- Gideon Auth is **deployed in AWS** and exposes **OIDC, SAML, and SCIM**.
  No local stand-up is needed on the OpenComp side.
- Gideon is a full **OIDC provider**: `GET /v1/oidc/authorize` (authorization
  code + mandatory PKCE S256), `POST /v1/oidc/token` (code / refresh exchange),
  `GET /v1/oidc/userinfo` (`sub`, `email`, `email_verified`, `name`,
  `entitlements`), `POST /v1/oidc/introspect`, `POST /v1/oidc/revoke`,
  `/.well-known/openid-configuration`, `/.well-known/jwks.json`.
  Reference: `../auth/openapi.yaml`.
- OAuth clients are registered via the Gideon admin API (`createOAuthClient`:
  `display_name`, `redirect_uris`, `allowed_scopes` defaulting to
  `["openid","profile","email"]`, grants `authorization_code` + `refresh_token`,
  `is_public` for PKCE-only clients without a secret).
- Gideon supports **generic upstream OIDC federation** per tenant
  (`src/routes/upstream_federation.rs`), so Google can survive as an upstream
  IdP inside Gideon.
- **SAML**: Gideon acts as a SAML IdP (IdP metadata, IdP-initiated launcher).
  Available but **not** the integration path (see §3).
- **SCIM / JIT** (`/v1/scim/v2/*`, `/v1/jit/users`) in Gideon are **inbound**
  (Gideon receives users from upstream directories). There is no outbound feed
  for OpenComp to consume — do not build a SCIM server in OpenComp.
- Phase 0 already exists on `chore/dead-code-cleanup`:
  `apps/api/src/auth/gideon-jwt.service.ts` (JWKS verification via `jose`,
  shadow mode) wired into `HybridAuthGuard` after `x-api-key` /
  `x-service-token` and before the better-auth session.

## 2. Current state (what better-auth owns)

From `apps/api/src/auth/auth.server.ts`, guards, frontend, and Prisma:

| Concern                                                 | Implementation                                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session cookies (cross-subdomain `.gideondefender.com`) | `Session` table, `getSession` on every guard/page                                                                                                               |
| Social login                                            | Google, GitHub, Microsoft (`socialProviders`, `Account` linking)                                                                                                |
| Passwordless                                            | Magic link + email OTP (`Verification` table, email templates)                                                                                                  |
| Orgs / members / invites / custom roles                 | better-auth `organization` plugin → `Organization`, `Member`, `Invitation`, `OrganizationRole` tables; `activeOrganizationId` set in the session-creation hook  |
| Admin functions                                         | better-auth `admin()` plugin: impersonation, ban/unban, user CRUD (`auth.controller.ts`)                                                                        |
| Hosted MCP (Gram) OAuth                                 | better-auth `mcp` / OIDC-provider plugin → `OauthApplication`, `OauthAccessToken`, `OauthConsent` tables; "Sign in with Google" for MCP                         |
| Token auth                                              | `bearer()` plugin; `multiSession()`; email verification + change-email                                                                                          |
| Frontends                                               | `authClient` (better-auth client) in app + portal; `GoogleSignIn`, `github-sign-in`, `magic-link`, portal `otp-form`; `(public)/auth` pages; invite-accept flow |
| API guard order                                         | `x-api-key` → `x-service-token` → Gideon JWT (shadow) → better-auth session                                                                                     |

## 3. Key decisions

1. **OIDC is the integration protocol.** SAML is available but buys XML,
   cert rotation, and no refresh story for zero gain over the already
   half-wired OIDC path. Keep SAML as a fallback only.
2. **Keep OpenComp sessions (Option A).** On OIDC callback the API mints a
   normal `Session` row + existing cookie. Every guard, `getSession` call,
   `activeOrganizationId`, impersonation, and device-agent session keeps
   working unchanged. Stateless Gideon-JWT-only (Option B) is rejected: too
   much session-dependent code to rework.
3. **No SCIM server in OpenComp.** JIT find-or-create on OIDC callback,
   keyed by verified email → new `User.gideonSub` unique column.
4. **Google story (decision required):** either configure Google as an
   upstream OIDC provider in Gideon (seamless, same emails) or go
   passkey-only and re-enroll users via Gideon recovery. Gates §6 step 12.
5. **One PR per step** (or per phase minimum); dual-run behind flags before
   any deletion PR.

## 4. Phase 0 — Foundations (no OpenComp behavior change)

1. Obtain from the auth team: deployed **issuer URL**, **audience**, OAuth
   client-registration access (confirm whether staging/prod instances differ).
2. Verify reachability **from the OpenComp API network**:
   `curl <host>/.well-known/openid-configuration` and the JWKS URL.
   `GideonJwtService` fails closed without iss/aud binding, so blocked egress
   silently disables Gideon auth — check VPC/security-group egress first.
3. Register one **confidential** OAuth client per environment
   (`is_public: false`) with the API callback redirect URIs. Note: only
   `http://localhost` is accepted for non-HTTPS dev redirects — confirm the
   local-dev arrangement with the auth team.
4. Set env: `GIDEON_IDENTITY_URL=https://<deployed-host>`,
   `GIDEON_JWT_ISSUER`, `GIDEON_JWT_AUDIENCE`
   (already scaffolded in `apps/api/.env.example`).
5. Add `User.gideonSub String? @unique` to
   `packages/db/prisma/schema/auth.prisma` and migrate — the stable
   Gideon-`sub` ↔ OpenComp-user link.
6. Optional enhancement: if the tenant groups employees in Gideon, plan
   Gideon-groups → OpenComp-org-role mapping at first login (needs a groups
   scope/claim — ask the auth team).

## 5. Phase 1 — OIDC login alongside better-auth (dual-run)

> Milestone 1 (done 2026-09-15) implemented steps 7, 8, 10, 11 with
> `openid-client` v6 (ESM-only, loaded via `gideon-oidc-client.ts`; verified
> against the installed 6.8.8 typings — v6 API differs from v5 tutorials).
> Implemented files: `apps/api/src/auth/gideon-oidc.service.ts` (discovery,
> `buildLoginUrl`, `handleCallback`), `gideon-oidc-provisioning.ts` (JIT
> find-or-create + session mint), `gideon-oidc.controller.ts` (`GET
/v1/auth/gideon/login`, `GET /v1/auth/gideon/callback`, `POST
/v1/auth/gideon/logout`), `gideon-oidc-client.ts`, `session-cookie.ts`
> (shares `getCookieDomain()` with `auth.server.ts`), `dto/gideon-oidc.dto.ts`,
> `gideon-oidc.service.spec.ts` (12 tests), migration
> `20260915000000_gideon_oidc_fields` (`User.gideonSub @unique`,
> `Session.gideonRefreshToken`), `GIDEON_OIDC_CLIENT_ID/SECRET/REDIRECT_URI`
> in `apps/api/.env.example`, `GideonSignIn` buttons in app + portal login
> forms. `openid-client` kept in API only (removed from `@gideon-defender/app`;
> frontend uses plain redirects). Outstanding: confidential client values per
> env from the auth team. Step 9 deferred to Milestone 2 (§9).

7. New API module, e.g. `apps/api/src/auth/gideon-oidc.controller.ts`:
   `GET /v1/auth/gideon/login` (authorize URL with PKCE + `state`/`nonce`
   → redirect to Gideon) and `GET /v1/auth/gideon/callback` (validate state,
   exchange code with client secret, fetch userinfo, **require
   `email_verified=true`**).
8. On callback: find-or-create `User` by verified email (or `gideonSub`), set
   `gideonSub`, mint a standard `Session` row + cookie (reuse the existing
   `activeOrganizationId` session-creation hook).
9. (Milestone 2, §8 — flipped locally 2026-09-18) `GideonJwtService` promoted
   from shadow to enforcing second factor in `HybridAuthGuard` behind
   `GIDEON_JWT_ENABLED`, keeping the better-auth session as fallback during
   dual-run. Pre-flip guard patch (2026-09-18): enforce mode 401s only
   tokens presenting as Gideon JWTs (`GideonJwtService.isGideonToken()` —
   JWT-shaped with matching `iss`); opaque session/MCP bearer tokens
   (device-agent, Gram) and foreign JWTs fall through to session auth in
   every mode. Without the patch, enforce mode 401'd all Bearer-session
   callers. Tests: `gideon-jwt.service.spec.ts` (isGideonToken),
   `hybrid-auth.guard.spec.ts` (opaque + foreign-issuer fallthrough in
   enforce). Local env: `GIDEON_JWT_AUDIENCE=gideon-cockpit`,
   `GIDEON_JWT_ENABLED=true` (`apps/api/.env`, gitignored).
10. Sign-in UI: "Continue with Gideon" button on `(public)/auth` and portal
    login → new login endpoint; keep Google/magic-link/OTP until cutover.
    Route invite links (`accept-invite.tsx`) through Gideon login, then resume
    acceptance.
11. Tests: callback spec in the style of `gideon-jwt.service.spec.ts` covering
    state mismatch, unverified email, and unknown-user provisioning.

## 6. Phase 2 — Cutover (Gideon becomes the only authenticator)

12. Flip the default to Gideon login; gate legacy login behind an env
    kill-switch, monitor, then delete `google-sign-in.tsx`,
    `github-sign-in.tsx`, `magic-link.tsx`, portal `otp-form.tsx`/`otp.tsx`,
    and legacy `(public)/auth` handlers.
13. Strip `auth.server.ts`: `socialProviders`, `magicLink`, `emailOTP`
    plugins, `AUTH_*` env vars, `MagicLinkEmail`/`OTPVerificationEmail`/
    `VerifyEmail` templates, account-linking config.
14. Migrate users: backfill `gideonSub` by verified email; unmatched users go
    through Gideon recovery/passkey enrollment. Revoke legacy `Account` and
    `Verification` rows afterwards.
15. Reimplement used admin-plugin features as first-class endpoints
    (impersonation, ban/unban, user CRUD in `auth.controller.ts`). Keep
    `User.banned` / `isPlatformAdmin` columns.
16. Move Gram hosted MCP off better-auth's `mcp`/OIDC-provider plugin:
    register Gram as an OAuth client **in Gideon**, validate MCP tokens
    against Gideon JWKS via `GideonJwtService`, then drop the
    `OauthApplication`/`OauthAccessToken`/`OauthConsent` tables and plugin.
17. Migrate non-human auth: device-agent sessions and browser-extension flows
    to Gideon refresh-token or workload-identity credentials (Gideon supports
    RFC 8693 token exchange). Leave `x-api-key` / `x-service-token` untouched.

## 7. Phase 3 — Cleanup

18. Remove the `better-auth` dependency from `apps/api` (keep only the
    access-control **types** in `packages/auth/permissions.ts`); delete
    `auth.server.ts`, `microsoft-email.ts`, and the `Account` /
    `Verification` / OAuth Prisma models via migration.
19. Delete Phase-0 flags (`GIDEON_JWT_SHADOW_ENABLED`,
    `GIDEON_SHADOW_ENABLED`); enforce `aal>=2` on admin routes (the payload
    field is already surfaced, currently log-only).
20. Purge `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`, `AUTH_MICROSOFT_*`, and the
    better-auth `SECRET_KEY` usage from all `.env.example` files and deploy
    pipelines. Adjust `origin-policy.ts`/CORS only if callback hosts changed.
21. Update tests and mocks: `mockAuth` (`apps/app/src/test-utils`),
    `auth.controller.spec.ts`, e2e `auth-helpers.ts`, plus the
    audit-design-system / audit-hooks lints.

## 8. Milestone 2 — Session reads off better-auth

Goal: no frontend code depends on better-auth session resolution, so the
auth library can be deleted in Milestone 3 without touching UI code.

1. ✅ Done 2026-09-16 — every `authClient.useSession` call replaced with the
   `useAuthMe` SWR hook on `GET /v1/auth/me` (`apps/app/src/hooks/use-auth-me.ts`
   - `use-auth-me.test.tsx`; shared envelope unwrap in `unwrapApiData`,
     `apps/app/src/lib/api-client.ts`). Migrated call sites: `notification-bell.tsx`,
     `FindingDetailSheet.tsx`, `policy-overview.tsx`, `ai/chat.tsx`,
     `ImpersonationBanner.tsx` (all in `apps/app/src`; the banner revalidates via
     `mutate()` after stop-impersonating so it hides immediately). Portal audit:
     zero `useSession()` callers, nothing to migrate. `GET /v1/auth/me` now also
     returns `impersonatedBy`, `authType`, and `hasInactiveMembership`
     (`AuthController.getMe`, surfaced through `@AuthContext()`).
2. ✅ Flipped locally 2026-09-18 — `GideonJwtService` resolves `sub`
   through `User.gideonSub` before the membership check (unlinked subs 401 in
   enforce mode, fall through to session in shadow mode), with 6 new guard
   tests (linked/unlinked × shadow/enforce) plus 2 fallthrough tests
   (opaque bearer, foreign-issuer JWT). Live-verified against the flipped
   local api: opaque bearer → session path (`Invalid or expired session`),
   forged Gideon-shaped JWT → `Invalid Gideon JWT` 401 with JWKS fetched
   from the dev issuer; no shadow-mismatch errors; operator account
   `gideonSub`-linked. Still to do per environment (staging/prod): set
   `GIDEON_JWT_ENABLED=true` with that deployment's `GIDEON_JWT_AUDIENCE`
   (do NOT copy the dev value) on an image containing the `isGideonToken`
   guard patch, keeping the better-auth session as fallback. Monitor
   shadow-mismatch logs (`GideonShadowService`) before proceeding.
3. ⏳ Pending (operational) — dual-run exit check: Gideon logins mint usable
   sessions, `GET /v1/auth/me` resolves for both session types, mismatch logs
   are clean. Local note: full Bearer-JWT end-to-end is not exercisable
   until tenant mapping lands (Gideon `tid` UUID vs OpenComp `org_*` ids —
   cutover §6 territory); covered by unit tests + live forged-token check
   instead.

## 9. Milestone 3 — Cutover and deletion

Gideon becomes the only authenticator; better-auth is removed. Executes §6
(steps 12–17) and §7 (steps 18–21) with the following specifics:

1. Gate legacy login behind an env kill-switch, verify Gideon-only works,
   then delete: `google-sign-in.tsx`, `github-sign-in.tsx`, `magic-link.tsx`,
   portal `otp-form.tsx`/`otp.tsx`, `socialProviders` / `magicLink` /
   `emailOTP` plugins, `AUTH_*` env vars, `MagicLinkEmail` /
   `OTPVerificationEmail` / `VerifyEmail` templates, `microsoft-email.ts`.
2. Backfill `gideonSub` by verified email; unmatched users go through Gideon
   recovery/passkey enrollment. Revoke leftover `Account` / `Verification`
   rows afterwards.
3. Reimplement used admin-plugin features as native endpoints
   (impersonation, ban/unban, user CRUD) — see step 15.
4. Re-point Gram MCP OAuth at Gideon: register Gram as a Gideon OAuth
   client, validate MCP tokens via `GideonJwtService`, then drop the `mcp()`
   plugin and the `OauthApplication` / `OauthAccessToken` / `OauthConsent`
   tables.
5. Remove the `better-auth` + `@thallesp/nestjs-better-auth` dependencies
   (keep access-control **types** in `packages/auth`), delete
   `auth.server.ts`, drop deleted tables via migration, purge all
   `.env.example` files, update `mockAuth` / e2e `auth-helpers.ts`.

## 10. Open inputs needed

- Deployed issuer URL(s) and audience; staging vs prod split.
  (Dev resolved 2026-09-18: issuer `https://api.dev.gideondefender.com`,
  `JWT_AUDIENCE` = `gideon-cockpit` — verified empirically by decoding a live
  dev access token, `aud: ["gideon-cockpit", client_id]`. Staging/prod values
  still required from the auth team; do not reuse the dev value.)
- API→auth-service network reachability confirmation.
- OAuth client-registration access + local-dev redirect arrangement.
  (Still outstanding after Milestone 1: confidential
  `GIDEON_OIDC_CLIENT_ID/SECRET` + registered redirect URIs per env.)
- Google decision (§3.4) and, if kept, upstream-provider setup in Gideon.
- Whether a groups scope/claim is available for org-role mapping (§4.6).
- Gram MCP re-pointing coordination (§6.16).
