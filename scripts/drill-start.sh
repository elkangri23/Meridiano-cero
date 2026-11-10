#!/bin/sh
# Arranca la API y la web del simulacro T6-05 (entorno AISLADO del drill).
# API en 127.0.0.1:13000 (desde src, node --experimental-strip-types),
# web vite dev en 127.0.0.1:15173 con proxy /api -> API. Proveedor mock.
# Uso: sh scripts/drill-start.sh   (desde la raíz de la copia del drill)
set -eu
echo "ARRANQUE-INICIO $(date -u +%Y-%m-%dT%H:%M:%S)"
docker run -d --name meridiano-drill-api --network host -v /opt/meridiano-cero-drill:/repo -w /repo/apps/api node:24.22.1 node --env-file-if-exists=../../.env.drill --experimental-strip-types src/server.ts
docker run -d --name meridiano-drill-web --network host -v /opt/meridiano-cero-drill:/repo -w /repo node:24.22.1 bash -c "corepack enable >/dev/null 2>&1; corepack prepare pnpm@12.15.0 --activate >/dev/null 2>&1; pnpm --config.verify-deps-before-run=false --filter @meridiano/web exec vite --host 127.0.0.1 --strictPort --port 15173"
echo "ARRANQUE-FIN $(date -u +%Y-%m-%dT%H:%M:%S)"
i=0
HEALTHY=0
while [ $i -lt 24 ]; do
  if curl -sf -o /dev/null http://127.0.0.1:13000/api/v1/health && curl -sf -o /dev/null http://127.0.0.1:13000/api/v1/ready; then echo "API-SANA $(date -u +%Y-%m-%dT%H:%M:%S)"; HEALTHY=1; break; fi
  i=$((i+1)); sleep 5
done
[ "$HEALTHY" = "1" ] || { echo "ERROR: la API del drill no llegó a sana en 120 s" >&2; docker logs --tail 20 meridiano-drill-api 2>&1 | tail -20; exit 1; }
curl -s -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:15173/
echo "WEB-CHECK $(date -u +%Y-%m-%dT%H:%M:%S)"
