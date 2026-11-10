#!/bin/sh
# Pruebas de fallo del restore T6-05 (entorno AISLADO, BDs desechables).
# BOR-079: backup corrupto/incompleto -> el restore falla aislado, la
# instalación sana queda intacta y no se anuncia éxito. Lección medida
# (segunda ejecución, 2026-11-10): el restore fallido deja una BD
# PARCIAL (12 casos pero 0 runs y 0 profiles); hay que descartarla
# (DROP DATABASE), nunca fiarse de un contenido parcial.
# BOR-077: disco lleno -> el restore falla sin falso éxito; tras liberar
# espacio, la recuperación correcta es DROP + CREATE de la BD vacía +
# restore (el reintento ingenuo sobre el esquema parcial falla con
# `function "delete_run" already exists`, porque el dump no lleva
# --clean). PGDATA real de postgres:18: /var/lib/postgresql/18/docker.
# El volcado es diminuto (~2 MB): con unos pocos MB libres el restore
# PASA (cabe en WAL reciclado); el intento solo es válido con 0 MB libres.
# Uso: sh scripts/drill-failures.sh   (en el VPS, con el drill en marcha)
set -eu
IMG="postgres:18.6@sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4"
DRILL=/opt/meridiano-cero-drill
PGDATA=/var/lib/postgresql/18/docker
GOOD=$(ls -t /opt/meridiano-cero-backups/meridiano-*.sql.gz | head -1)
test -n "$GOOD" || { echo "ERROR: no hay backups en /opt/meridiano-cero-backups" >&2; exit 1; }
echo "backup bueno: $GOOD ($(stat -c %s "$GOOD") bytes)"

wait_healthy() {
  name="$1"
  i=0
  while [ $i -lt 24 ]; do
    if docker exec "$name" pg_isready -U meridiano_owner -d meridiano >/dev/null 2>&1; then echo "$name healthy"; return 0; fi
    i=$((i+1)); sleep 5
  done
  echo "ERROR: $name no llegó a healthy" >&2; return 1
}

mkdb() {
  name="$1"; port="$2"; extra="$3"; volume="$4"
  if [ -n "$volume" ]; then volarg="-v $volume:/var/lib/postgresql"; else volarg=""; fi
  # shellcheck disable=SC2086
  docker run -d --name "$name" $extra $volarg \
    -e POSTGRES_USER=meridiano_owner -e POSTGRES_DB=meridiano \
    -e POSTGRES_PASSWORD_FILE=/run/secrets/admin_password \
    -e POSTGRES_INITDB_ARGS="--auth-host=scram-sha-256 --auth-local=trust" \
    -v "$DRILL/.drill/admin-password:/run/secrets/admin_password:ro" \
    -v "$DRILL/.drill/app-password:/run/secrets/app_password:ro" \
    -v "$DRILL/infra/docker/init-role.sh:/docker-entrypoint-initdb.d/10-app-role.sh:ro" \
    -p "127.0.0.1:$port:5432" "$IMG"
}

counts() {
  docker exec -i "$1" psql -U meridiano_owner -d meridiano -At -c "SELECT (SELECT count(*) FROM generated_cases), (SELECT count(*) FROM runs), (SELECT count(*) FROM profiles);" 2>&1
}

echo "=== BOR-079: backup corrupto ==="
echo "CORRUPTO-INICIO $(date -u +%Y-%m-%dT%H:%M:%S)"
cp "$GOOD" /tmp/drill-corrupt.sql.gz
SZ=$(stat -c %s /tmp/drill-corrupt.sql.gz)
truncate -s $((SZ / 2)) /tmp/drill-corrupt.sql.gz
echo "backup bueno: $SZ bytes; corrupto (truncado al 50%): $(stat -c %s /tmp/drill-corrupt.sql.gz) bytes"
if gzip -t /tmp/drill-corrupt.sql.gz 2>/tmp/gzip-err.txt; then
  echo "ERROR: gzip -t NO detectó la corrupción"; exit 1
else
  echo "gzip -t detecta la corrupción (esperado): $(cat /tmp/gzip-err.txt)"
fi
docker rm -f meridiano-drill-corrupt-db >/dev/null 2>&1 || true
mkdb meridiano-drill-corrupt-db 15442 "" meridiano-drill-corrupt-data
wait_healthy meridiano-drill-corrupt-db
set +e
gunzip -c /tmp/drill-corrupt.sql.gz | docker exec -i meridiano-drill-corrupt-db psql -U meridiano_owner -d meridiano -v ON_ERROR_STOP=1 > /tmp/restore-corrupt.log 2>&1
RC=$?
set -e
echo "restore corrupto exit=$RC (esperado distinto de 0)"
grep -i -m 2 -E "ERROR|unexpected end|invalid" /tmp/restore-corrupt.log || echo "(sin línea de error visible en el log)"
echo "casos,runs,profiles en la BD del intento corrupto: $(counts meridiano-drill-corrupt-db) (esperado parcial, p. ej. 12,0,0: sin éxito parcial)"
echo "casos en el drill sano: $(docker exec -i meridiano-drill-db psql -U meridiano_owner -d meridiano -At -c 'SELECT count(*) FROM generated_cases;' 2>&1) (esperado 12: intacto)"
curl -s -o /dev/null -w "API del drill sano: %{http_code} (esperado 200)\n" http://127.0.0.1:13000/api/v1/health
echo "--- descartar la BD parcial (lección BOR-079) ---"
docker exec -i meridiano-drill-corrupt-db psql -U meridiano_owner -d postgres -c 'DROP DATABASE meridiano;' -c 'CREATE DATABASE meridiano OWNER meridiano_owner;'
echo "CORRUPTO-FIN $(date -u +%Y-%m-%dT%H:%M:%S)"

echo "=== BOR-077: disco lleno ==="
echo "DISCO-INICIO $(date -u +%Y-%m-%dT%H:%M:%S)"
docker rm -f meridiano-drill-diskfull-db >/dev/null 2>&1 || true
mkdb meridiano-drill-diskfull-db 15443 "--tmpfs /var/lib/postgresql:size=128m" ""
wait_healthy meridiano-drill-diskfull-db
docker exec meridiano-drill-diskfull-db sh -c 'FREE=$(df -m /var/lib/postgresql | tail -1 | awk "{print \$4}"); dd if=/dev/zero of=/var/lib/postgresql/18/docker/fill.bin bs=1M count=$FREE 2>/dev/null || true; echo "tras llenar:"; df -m /var/lib/postgresql | tail -1'
AVAIL=$(docker exec meridiano-drill-diskfull-db sh -c 'df -m /var/lib/postgresql | tail -1 | awk "{print \$4}"')
echo "MB libres tras el llenado: $AVAIL (el intento solo es válido con 0)"
set +e
gunzip -c "$GOOD" | docker exec -i meridiano-drill-diskfull-db psql -U meridiano_owner -d meridiano -v ON_ERROR_STOP=1 > /tmp/restore-diskfull.log 2>&1
RC=$?
set -e
echo "restore con disco lleno exit=$RC (esperado distinto de 0 con 0 MB libres)"
grep -i -m 2 "No space left" /tmp/restore-diskfull.log || echo "(sin 'No space left' literal en el log; ver tail)"
tail -2 /tmp/restore-diskfull.log
echo "casos,runs,profiles en la BD con disco lleno: $(counts meridiano-drill-diskfull-db) (esperado error o 0: sin éxito parcial)"
echo "casos en el drill sano: $(docker exec -i meridiano-drill-db psql -U meridiano_owner -d meridiano -At -c 'SELECT count(*) FROM generated_cases;' 2>&1) (esperado 12: intacto)"
curl -s -o /dev/null -w "API del drill sano: %{http_code} (esperado 200)\n" http://127.0.0.1:13000/api/v1/health
echo "--- recuperación: liberar espacio y restaurar sobre BD vacía (DROP + CREATE) ---"
docker exec meridiano-drill-diskfull-db rm -f $PGDATA/fill.bin
if ! docker exec meridiano-drill-diskfull-db pg_isready -U meridiano_owner -d meridiano >/dev/null 2>&1; then
  echo "postgres cayó por el disco lleno (sin falso éxito); reiniciando contenedor..."
  docker restart meridiano-drill-diskfull-db >/dev/null
  wait_healthy meridiano-drill-diskfull-db
fi
docker exec -i meridiano-drill-diskfull-db psql -U meridiano_owner -d postgres -c 'DROP DATABASE meridiano;' -c 'CREATE DATABASE meridiano OWNER meridiano_owner;'
gunzip -c "$GOOD" | docker exec -i meridiano-drill-diskfull-db psql -U meridiano_owner -d meridiano -v ON_ERROR_STOP=1 > /tmp/restore-diskfull-retry.log 2>&1
echo "restore tras DROP + CREATE exit=$? (esperado 0)"
echo "casos,runs,profiles tras la recuperación: $(counts meridiano-drill-diskfull-db) (esperado 12,1,164)"
echo "DISCO-FIN $(date -u +%Y-%m-%dT%H:%M:%S)"
echo "=== FIN PRUEBAS DE FALLO ==="
