#!/usr/bin/env bash
set -euo pipefail
TOOLS="$HOME/.local/share/meridiano-harness"
export PATH="$TOOLS/tooling/node_modules/.bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$TOOLS/source"
pnpm install --frozen-lockfile
pnpm build
