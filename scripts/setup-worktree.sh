#!/usr/bin/env bash
# Prepare a freshly created worktree: install deps, generate Prisma client,
# and optionally run the full build. Assumes `.env*` files are already
# linked in (the post-checkout hook does that before calling this script).
#
# Usage:
#   scripts/setup-worktree.sh [target-worktree-path]
#
# Environment toggles:
#   SKIP_WORKTREE_SETUP=1     — skip everything (just link envs)
#   SETUP_WORKTREE_WITH_BUILD=1 — also run `pnpm run build` (slow, minutes;
#                                 unnecessary for `dev`, tests, typechecks)
#
# Defaults to the current working directory.
set -euo pipefail

if [[ "${SKIP_WORKTREE_SETUP:-}" == "1" ]]; then
  echo "setup-worktree: SKIP_WORKTREE_SETUP=1 — skipping install + build" >&2
  exit 0
fi

target="${1:-$(pwd)}"
target=$(cd "$target" && pwd)

# Refuse to run on the main worktree — it already has its own lifecycle.
main=$(git worktree list --porcelain | awk '$1=="worktree"{print $2; exit}')
if [[ "$target" == "$main" ]]; then
  echo "setup-worktree: target is the main worktree — skipping" >&2
  exit 0
fi

cd "$target"

echo "▸ Installing dependencies (pnpm install) in $target"
pnpm install

echo "▸ Applying Prisma migrations (cd packages/db && pnpm run db:migrate)"
(cd packages/db && pnpm run db:migrate)

echo "▸ Generating Prisma client (pnpm run db:generate)"
pnpm run db:generate

if [[ "${SETUP_WORKTREE_WITH_BUILD:-}" == "1" ]]; then
  echo "▸ Building all packages (pnpm run build)"
  pnpm run build
else
  echo "▸ Skipping build — set SETUP_WORKTREE_WITH_BUILD=1 to include it"
fi

echo "✓ Worktree setup complete: $target"
