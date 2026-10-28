#!/usr/bin/env bash
set -euo pipefail
TOOLS="$HOME/.local/share/meridiano-harness"
export PATH="$TOOLS/tooling/node_modules/.bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export HARNESS_HOME="$TOOLS/state"
export CLAUDE_CONFIG_DIR="$TOOLS/claude-config"
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT"
exec /usr/bin/node "$TOOLS/source/apps/cli/dist/main.js" --project "$PROJECT" "$@"
