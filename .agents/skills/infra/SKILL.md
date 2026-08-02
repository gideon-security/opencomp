---
name: infra
description: "Use when working with packages, dependencies, monorepo structure, or build configuration"
---

Source Cursor rule: `.cursor/rules/infra.mdc`.
Original Cursor alwaysApply: `false`.

# Infrastructure

## Package Manager

**Use `npm`, never bun/yarn/pnpm.**

```bash
npm install              # Install deps
npm install <pkg>        # Add package
npm install -D <pkg>     # Add dev dependency
npm run <script>         # Run script
npx <cmd>                # Execute binary
```

## Monorepo Structure

```
comp/
├── apps/
│   ├── api/             # NestJS backend
│   ├── app/             # Next.js main app
│   └── portal/          # Next.js portal
├── packages/
│   ├── db/              # Prisma (@trycompai/db)
│   ├── ui/              # Legacy UI (@trycompai/ui); prefer @trycompai/design-system
│   └── ...
├── turbo.json
└── package.json
```

## Running Commands

```bash
# Multi-package (via turbo)
npm run build            # Build all
npm run lint             # Lint all
npm run typecheck        # Type check all
npm run dev              # Dev all

# Single package
npm run dev --workspace=apps/app
npm run prisma:generate --workspace=@trycompai/db
turbo build --filter=@trycompai/ui
```

## Importing Between Packages

```tsx
// ✅ Import from package name
import { Button } from '@trycompai/design-system';
import { prisma } from '@trycompai/db';

// ❌ Never relative paths across packages
import { Button } from '../../../packages/ui/src/button';
```

## Adding Dependencies

```bash
# To specific package
npm install axios --workspace=apps/app
npm install -D vitest --workspace=@trycompai/ui

# To root (dev tools only)
npm install -D -w prettier typescript
```

## After Code Changes

**Always run checks:**

```bash
npm run typecheck
npm run lint
```

Fix all errors before committing.

## Common TypeScript Fixes

- **Property does not exist**: Check interface definitions
- **Type mismatch**: Verify expected vs actual type
- **Empty interface extends**: Use `type X = SomeType` instead

## Common ESLint Fixes

- **Unused variables**: Remove or prefix with `_`
- **Any type**: Add proper typing
- **Empty object type**: Use `type` instead of `interface`

## Creating a New Package

```bash
mkdir packages/my-package
```

```json
// packages/my-package/package.json
{
  "name": "@trycompai/my-package",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "typecheck": "tsc --noEmit"
  }
}
```

```json
// packages/my-package/tsconfig.json
{
  "extends": "@trycompai/tsconfig/base.json",
  "include": ["src"]
}
```

## Package Boundaries

**✅ Create packages for:**
- Code used by 2+ apps
- Self-contained, focused functionality

**❌ Don't create packages for:**
- Code only used in one app (colocate instead)
- App-specific business logic
