#!/bin/sh
# Verificación de restauración de un backup de Meridiano-cero (Fase B).
#
# Uso (en el VPS, desde /opt/meridiano-cero):
#   sh scripts/restore-verify-prod.sh /opt/meridiano-cero-backups/meridiano-AAAAmmdd-HHMMSS.sql.gz
#
# Restaura el volcado en una base TEMPORAL `meridiano_restore_test`,
# comprueba que existen las tablas y las migraciones aplicadas, y la borra.
# Nunca toca la base `meridiano` viva.
set -eu
if [ $# -ne 1 ]; then
  echo "Uso: $0 <backup.sql.gz>" >&2
  exit 2
fi
FILE=$1
REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TEST_DB=meridiano_restore_test
cd "$REPO_DIR"
cleanup() {
  docker-compose -f compose.prod.yaml exec -T db psql -U meridiano_owner -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\"" >/dev/null
}
trap cleanup EXIT
docker-compose -f compose.prod.yaml exec -T db psql -U meridiano_owner -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\"" >/dev/null
docker-compose -f compose.prod.yaml exec -T db psql -U meridiano_owner -d postgres -c "CREATE DATABASE \"$TEST_DB\"" >/dev/null
gzip -dc "$FILE" | docker-compose -f compose.prod.yaml exec -T db psql -U meridiano_owner -d "$TEST_DB" -v ON_ERROR_STOP=1 -q >/dev/null
docker-compose -f compose.prod.yaml exec -T db psql -U meridiano_owner -d "$TEST_DB" -v ON_ERROR_STOP=1 -t -c \
  "SELECT 'profiles=' || count(*) FROM profiles;" \
  -c "SELECT 'runs=' || count(*) FROM runs;" \
  -c "SELECT 'migraciones=' || count(*) FROM base_migrations;"
echo "Restauración verificada: $FILE"
