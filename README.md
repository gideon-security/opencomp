<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/gideon-security/opencomp">
   <img src="https://www.gideondefender.com/gideon.png" alt="Logo" width="10%">
  </a>

  <h3 align="center">Gideon Defender OpenComp </h3>

  <p align="center">
    The open-source compliance platform.
    <br />
    <a href="https://gideondefender.com"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://gideondefender.com">Website</a>
    ·
    <a href="https://gideondefender.com/docs">Documentation</a>
    ·
    <a href="https://github.com/gideon-security/opencomp/issues">Issues</a>
    ·
    <a href="https://gideondefender.com/roadmap">Roadmap</a>
  </p>
</p>

<p align="center">
   <a href="https://github.com/gideon-security/opencomp/stargazers"><img src="https://img.shields.io/github/stars/gideon-security/opencomp" alt="Github Stars"></a>
   <a href="https://github.com/gideon-security/opencomp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-purple" alt="License"></a>
   <a href="https://github.com/gideon-security/opencomp/pulse"><img src="https://img.shields.io/github/commit-activity/m/gideon-security/opencomp" alt="Commits-per-month"></a>
   <a href="https://github.com/gideon-security/opencomp/issues"><img src="https://img.shields.io/badge/Help%20Wanted-Contribute-blue"></a>
</p>

## About

### AI that handles compliance for you in hours.

OpenComp is the fastest way to get compliant with frameworks like SOC 2, ISO 27001, HIPAA and GDPR. OpenComp automates evidence collection, policy management, and control implementation while keeping you in control of your data and infrastructure.

### Built With

- [Next.js](https://nextjs.org/?ref=gideondefender.com)
- [Prisma](https://prisma.io/?ref=gideondefender.com)
- [Tailwind CSS](https://tailwindcss.com/?ref=gideondefender.com)

## Contact us

Contact our team at info@gideondefender.com to learn more about how we can help you achieve compliance.

## Stay Up-to-Date

Get access to the cloud hosted version of [OpenComp](https://www.gideondefender.com).

## Getting Started

To get a local copy up and running, please follow these simple steps.

### Prerequisites

Here is what you need to be able to run OpenComp.

- Node.js (Version: >=22.x)
- npm (Version: >=10.x)
- Docker (Version: >=24.x) or Podman (Version: >=5.x)
- Postgres with PgVector (Version: >=15.x)
- A Gemini API key (for AI-powered onboarding — free tier works, but has a low daily request cap)

## Development

To get the project working locally with all integrations, follow these extended development steps

### Setup

## Add environment variables and fill them out with your credentials

```sh
cp apps/app/.env.example apps/app/.env
cp apps/portal/.env.example apps/portal/.env
cp packages/db/.env.example packages/db/.env
```

## Get code running locally

1. Clone the repo

```sh
git clone https://github.com/gideon-security/opencomp.git
```

2. Navigate to the project directory

```sh
cd opencomp
```

3. Install dependencies using npm

```sh
npm install
```

4. Get Database Running

```sh
cd packages/db
npm run docker:up # Spin up docker container
npm run db:migrate # Run migrations
```

5. Generate Prisma Types for each app

```sh
cd apps/app
npm run db:generate
cd ../portal
npm run db:generate
cd ../api
npm run db:generate
```

6. Run all apps in parallel from the root directory

```sh
npm run dev
```

---

### Environment Setup

Create the following `.env` files and fill them out with your credentials

- `opencomp/apps/app/.env`
- `opencomp/apps/portal/.env`
- `opencomp/apps/api/.env`
- `opencomp/packages/db/.env`

You can copy from the `.env.example` files:

### Linux / macOS

```sh
cp apps/app/.env.example apps/app/.env
cp apps/portal/.env.example apps/portal/.env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
```

### Windows (Command Prompt)

```cmd
copy apps\app\.env.example apps\app\.env
copy apps\portal\.env.example apps\portal\.env
copy apps\api\.env.example apps\api\.env
copy packages\db\.env.example packages\db\.env
```

### Windows (PowerShell)

```powershell
Copy-Item apps\app\.env.example -Destination apps\app\.env
Copy-Item apps\portal\.env.example -Destination apps\portal\.env
Copy-Item apps\api\.env.example -Destination apps\api\.env
Copy-Item packages\db\.env.example -Destination packages\db\.env
```

Additionally, ensure the following required environment variables are added to `.env` in `opencomp/apps/app/.env`:

```env
AUTH_SECRET=""                  # Use `openssl rand -base64 32` to generate
DATABASE_URL="postgresql://user:password@host:port/database"
REDIS_URL="redis://localhost:6379"  # Shared by the kv layer and BullMQ
GOOGLE_GENERATIVE_AI_API_KEY="" # Gemini — powers AI onboarding (https://ai.google.dev/api-keys)
RESEND_API_KEY="" # Resend (https://resend.com/api-keys) - Resend Dashboard -> API Keys
NEXT_PUBLIC_PORTAL_URL="http://localhost:3002"
REVALIDATION_SECRET=""         # Use `openssl rand -base64 32` to generate
```

> ✅ Make sure you have all of these variables in your `.env` file.
> If you're copying from `.env.example`, it might be missing the last two (`NEXT_PUBLIC_PORTAL_URL` and `REVALIDATION_SECRET`), so be sure to add them manually.

Some environment variables may not load correctly from `.env` — in such cases, **hard-code** the values directly in the relevant files (see Hardcoding section below).

---

### Cloud & Auth Configuration

#### 1. Google OAuth

- Go to [Google Cloud OAuth Console](https://console.cloud.google.com/auth/clients)
- Create an OAuth client:
  - Type: Web Application
  - Name: `comp_app` # You can choose a different name if you prefer!
- Add these **Authorized Redirect URIs**:

  ```
  http://localhost
  http://localhost:3000
  http://localhost:3002
  http://localhost:3000/api/auth/callback/google
  http://localhost:3002/api/auth/callback/google
  http://localhost:3000/auth
  http://localhost:3002/auth
  ```

- After creating the app, copy the `GOOGLE_ID` and `GOOGLE_SECRET`
  - Add them to your `.env` files
  - If that doesn’t work, hard-code them in:
    ```
    opencomp/apps/portal/src/app/lib/auth.ts
    ```

#### 2. Redis

Redis is configured via the `REDIS_URL` environment variable (regular Redis —
no Upstash required):

```
REDIS_URL="redis://localhost:6379"
```

The `@gideon-defender/kv` package and the local BullMQ trigger runtime both
read this variable. Optional hardening: `LOCAL_TRIGGER_REDIS_URL` points at a
full-access (`comp_service`) Redis role for BullMQ, falling back to
`REDIS_URL` when unset.

---

### Languages (i18n)

The app ships with English and Spanish locales. The locale is resolved from
the `NEXT_LOCALE` cookie; clear that cookie to fall back to English. All UI
strings live in `apps/app/messages/en.json` and `apps/app/messages/es.json`
— keep both files in sync when adding keys.

---

### Testing

```sh
# App unit tests (Vitest)
cd apps/app && npx vitest run

# API unit tests (Jest) — loads apps/api/.env automatically
cd apps/api && npx jest --forceExit

# API e2e tests — needs a local Postgres + migrations applied
cd apps/api && npm run test:e2e

# App e2e tests (Playwright) — boots the full stack; see .github/workflows/e2e.yml
cd apps/app && npx playwright test --project=chromium
```

---

### Database Setup

Start and initialize the PostgreSQL database using Docker:

1. Start the database:

   ```sh
   cd packages/db
   npm run docker:up
   ```

2. Default credentials:
   - Database name: `comp`
   - Username: `postgres`
   - Password: `postgres`

3. To change the default password:

   ```sql
   ALTER USER postgres WITH PASSWORD 'new_password';
   ```

4. If you encounter the following error:

   ```
   HINT: No function matches the given name and argument types...
   ```

   Run the fix:

   ```sh
   psql "postgresql://postgres:<your_password>@localhost:5432/comp" -f ./packages/db/prisma/functionDefinition.sql
   ```

   Expected output: `CREATE FUNCTION`

   > 💡 `comp` is the database name. Make sure to use the correct **port** and **database name** for your setup.

5. Apply schema and seed:

```sh
 # Generate Prisma client
 npm run db:generate

 # Push the schema to the database
 npm run db:push

 # Optional: Seed the database with initial data
 npm run db:seed
```

Other useful database commands:

```sh
# Open Prisma Studio to view/edit data
npm run db:studio

# Run database migrations
npm run db:migrate

# Stop the database container
npm run docker:down

# Remove the database container and volume
npm run docker:clean
```

---

### Start Development

Once everything is configured:

```sh
npm run dev
```

Or use the Turbo repo script:

```sh
npx turbo dev
```

> 💡 Make sure you have Turbo installed. If not, you can install it using npm:

```sh
npm install -g turbo
```

🎉 Yay! You now have a working local instance of Gideon Defender OpenComp! 🚀

### Full Stack with Docker Compose

The monorepo ships a Docker-based local stack that runs everything with `node:22` + npm. It builds and starts the API, app, and portal along with Postgres, Redis, and LocalStack (AWS S3). Podman works too (`alias docker=podman`, or `podman-compose`):

```sh
# Build and start the whole stack (app on :3000, portal on :3002, api on :3333)
docker-compose up -d --build

# Run database migrations and seed data
docker-compose run --rm migrator
docker-compose run --rm seeder

# Tail logs for a service (e.g. the app)
docker-compose logs -f app

# Stop everything
docker-compose down
```

Services: `localstack` (S3/SES emulation), `postgres` (pgvector), `migrator` (Prisma migrate), `seeder`, `api` (NestJS), `redis`, `app` (Next.js frontend), `portal` (employee portal), `email-worker` (SQS email consumer), `embeddings` (self-hosted BAAI/bge-m3 via Ollama).

> 💡 **Note:** each service's container env overrides the matching `.env` file
> entries for in-container hostnames (e.g. the portal gets
> `DATABASE_URL=…@postgres:5432` while host-side tooling uses `localhost:5432`).

## Deployment

### Docker

Steps to deploy OpenComp on Docker are coming soon.

## 📦 Package Publishing

This repository uses semantic-release to automatically publish packages to npm when merging to the `release` branch. The following packages are published:

- `@gideon-defender/db` - Database utilities with Prisma client
- `@gideon-defender/email` - Email templates and components
- `@gideon-defender/kv` - Key-value store utilities using Redis
- `@gideon-defender/ui` - UI component library with Tailwind CSS

### Setup

1. **NPM Token**: Add your npm token as `NPM_TOKEN` in GitHub repository secrets
2. **Release Branch**: Create and merge PRs into the `release` branch to trigger publishing
3. **Versioning**: Uses conventional commits for automatic version bumping

### Usage

```bash
# Install a published package
npm install @gideon-defender/ui

# Use in your project
import { Button } from '@gideon-defender/ui/button'
import { client } from '@gideon-defender/kv'
```

### Development

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@gideon-defender/ui

# Test packages locally
npm run release:packages -- --dry-run
```

## License

OpenComp is an open-source software, licensed under [AGPLv3](https://opensource.org/license/agpl-v3)

> [!TIP]
> We work closely with the community and always invite feedback about what should be open and what is fine to be commercial. This list is not set and stone and we have moved things from commercial to open in the past. Please open a [discussion](https://github.com/gideon-security/opencomp/discussions) if you feel like something is wrong.
