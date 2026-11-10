#!/bin/sh
# Actualización compatible T6-05 (entorno AISLADO).
# Restaura el backup VIEJO (2026-11-09 11:55 UTC, el más viejo que
# conserva la rotación de 7; el de las 08:12 del mismo día ya rotó
# fuera) en una BD desechable y arranca la API ACTUAL de la rama
# contra ella. Las migraciones deben ser no-op y los datos/partidas
# deben seguir intactos.
# Uso: sh scripts/drill-upgrade.sh   (en el VPS, con el drill en marcha)
set -eu
IMG="postgres:18.6@sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4"
DRILL=/opt/meridiano-cero-drill
# Backup más viejo que conserva la rotación (7): 2026-11-09 11:55 UTC, datos
# del día anterior al lote 1. El 08:12 del mismo día ya rotó fuera.
OLD=/opt/meridiano-cero-backups/meridiano-20261109-115523.sql.gz
test -f "$OLD" || { echo "ERROR: no existe el backup viejo: $OLD" >&2; exit 1; }
echo "UPGRADE-INICIO $(date -u +%Y-%m-%dT%H:%M:%S)"
echo "backup viejo: $OLD ($(stat -c %s "$OLD") bytes)"
echo "nivel de migraciones del backup viejo:"
gunzip -c "$OLD" | grep -o "00[0-9][0-9]_[a-z_]*\.sql" | sort -u | tail -3
docker run -d --name meridiano-drill-upgrade-db \
  -e POSTGRES_USER=meridiano_owner -e POSTGRES_DB=meridiano \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/admin_password \
  -e POSTGRES_INITDB_ARGS="--auth-host=scram-sha-256 --auth-local=trust" \
  -v "$DRILL/.drill/admin-password:/run/secrets/admin_password:ro" \
  -v "$DRILL/.drill/app-password:/run/secrets/app_password:ro" \
  -v "$DRILL/infra/docker/init-role.sh:/docker-entrypoint-initdb.d/10-app-role.sh:ro" \
  -v meridiano-drill-upgrade-data:/var/lib/postgresql \
  -p 127.0.0.1:15444:5432 "$IMG"
i=0
while [ $i -lt 24 ]; do
  if docker exec meridiano-drill-upgrade-db pg_isready -U meridiano_owner -d meridiano >/dev/null 2>&1; then echo "upgrade-db healthy"; break; fi
  i=$((i+1)); sleep 5
done
echo "RESTORE-VIEJO-INICIO $(date -u +%Y-%m-%dT%H:%M:%S)"
# Descomprimir a fichero primero: así el código de salida de gunzip se
# comprueba aparte (un tubo roto con psql daría 0 aunque no hubiera backup).
gunzip -c "$OLD" > /tmp/restore-upgrade.sql || { echo "ERROR: gunzip del backup viejo" >&2; exit 1; }
docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -v ON_ERROR_STOP=1 < /tmp/restore-upgrade.sql > /tmp/restore-upgrade.log 2>&1
echo "restore viejo exit=$? (esperado 0)"
echo "RESTORE-VIEJO-FIN $(date -u +%Y-%m-%dT%H:%M:%S)"
CASES=$(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT count(*) FROM generated_cases;' 2>&1)
echo "casos: $CASES"
[ "$CASES" = "12" ] || { echo "ERROR: restore incompleto (casos=$CASES, esperados 12)" >&2; exit 1; }
echo "runs: $(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT id, definition_id FROM runs;' 2>&1)"
echo "migraciones antes de arrancar la API actual: $(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT max(name) FROM base_migrations;' 2>&1)"
echo "perfiles: $(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT count(*) FROM profiles;' 2>&1)"
# Env propia de la API de upgrade: mismo código, BD vieja, puerto propio.
python3 - <<'PYEOF'
import pathlib
root = pathlib.Path('/opt/meridiano-cero-drill')
env = (root / '.env.drill').read_text()
env = env.replace('API_PORT=13000', 'API_PORT=13002')
env = env.replace('PUBLIC_ORIGIN=http://127.0.0.1:15173', 'PUBLIC_ORIGIN=http://127.0.0.1:13002')
env = env.replace('127.0.0.1:15440', '127.0.0.1:15444')
(root / '.env.upgrade').write_text(env)
print('env de upgrade escrita (sin secretos en la salida)')
PYEOF
echo "API-ARRANQUE $(date -u +%Y-%m-%dT%H:%M:%S)"
docker run -d --name meridiano-drill-upgrade-api --network host -v /opt/meridiano-cero-drill:/repo -w /repo/apps/api node:24.22.1 node --env-file-if-exists=../../.env.upgrade --experimental-strip-types src/server.ts
i=0
HEALTHY=0
while [ $i -lt 24 ]; do
  if curl -sf -o /dev/null http://127.0.0.1:13002/api/v1/health && curl -sf -o /dev/null http://127.0.0.1:13002/api/v1/ready; then echo "API-UPGRADE-SANA $(date -u +%Y-%m-%dT%H:%M:%S)"; HEALTHY=1; break; fi
  i=$((i+1)); sleep 5
done
[ "$HEALTHY" = "1" ] || { echo "ERROR: la API de upgrade no llegó a sana en 120 s" >&2; docker logs --tail 20 meridiano-drill-upgrade-api 2>&1 | tail -20; exit 1; }
echo "migraciones tras arrancar la API actual: $(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT max(name) FROM base_migrations;' 2>&1)"
echo "runs tras arrancar: $(docker exec -i meridiano-drill-upgrade-db psql -U meridiano_owner -d meridiano -At -c 'SELECT count(*) FROM runs;' 2>&1)"
echo "UPGRADE-SETUP-FIN $(date -u +%Y-%m-%dT%H:%M:%S)"
