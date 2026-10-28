#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d /tmp/meridiano-harness-worktree.XXXXXX)"
BASE="$(git -C "$PROJECT" rev-parse HEAD)"
git -C "$PROJECT" worktree add --detach "$WORK" HEAD
python3 "$WORK/scripts/verify_docs.py"
test -z "$(git -C "$WORK" status --porcelain)"
git -C "$PROJECT" worktree remove "$WORK"
test "$BASE" = "$(git -C "$PROJECT" rev-parse HEAD)"
echo 'OK: worktree separado, documentación validada, worktree retirado y HEAD conservado.'
