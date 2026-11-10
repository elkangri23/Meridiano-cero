#!/bin/sh
# Compilación del código del drill (rama distribucion-2026-11-10) en el
# contenedor node:24.22.1, con el repo montado. Paquetes por separado con
# --config.verify-deps-before-run=false, nunca `pnpm -r build`. Después
# verifica que los dist traen el código de la rama (créditos) y no código
# de otra rama (B2 SKELETON_BY_DURATION).
# Uso: sh scripts/drill-build.sh   (desde la raíz del repo, en la copia del drill)
set -eu
cd "$(dirname -- "$0")/.."  # scripts/ -> raíz del repo
docker run --rm --network host -v "$PWD:/repo" -w /repo node:24.22.1 bash -c '
set -eu
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@12.15.0 --activate >/dev/null 2>&1 || true
pnpm install --frozen-lockfile --ignore-scripts
pnpm --config.verify-deps-before-run=false --filter @meridiano/contracts build
pnpm --config.verify-deps-before-run=false --filter @meridiano/case-schema build
pnpm --config.verify-deps-before-run=false --filter @meridiano/engine build
pnpm --config.verify-deps-before-run=false --filter @meridiano/ai-adapters build
pnpm --config.verify-deps-before-run=false --filter @meridiano/generator build
pnpm --config.verify-deps-before-run=false --filter @meridiano/api build
pnpm --config.verify-deps-before-run=false --filter @meridiano/web build
'
echo "--- verificación de dists ---"
grep -r "credits.pageTitle" packages/contracts/dist/ | head -n 2
if grep -rq "SKELETON_BY_DURATION" packages/*/dist apps/api/dist 2>/dev/null; then echo "ERROR: código B2 en dist" && exit 1; else echo "sin código B2 en dists (correcto)"; fi
grep -o "Créditos y licencias" apps/web/dist/assets/*.js | head -n 1
echo "compilación del drill completada"
