#!/bin/sh
# Backup de PostgreSQL de Meridiano-cero en producción (Fase B).
#
# Uso (en el VPS, desde /opt/meridiano-cero):
#   sh scripts/backup-prod.sh
#
# Vuelca la base `meridiano` con pg_dump dentro del contenedor `db` (el
# acceso local es de confianza por POSTGRES_INITDB_ARGS, sin contraseña en
# este script), comprime el volcado y conserva solo los 7 más recientes,
# como el patrón de retaton. Cron diario en el VPS: 03:00 UTC.
# La restauración se verifica aparte con scripts/restore-verify-prod.sh,
# siempre en una base temporal, nunca contra datos vivos.
set -eu
REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR=${MERIDIANO_BACKUP_DIR:-/opt/meridiano-cero-backups}
KEEP=${MERIDIANO_BACKUP_KEEP:-7}
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/meridiano-$STAMP.sql.gz"
cd "$REPO_DIR"
docker-compose -f compose.prod.yaml exec -T db pg_dump -U meridiano_owner -d meridiano | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
# Rotación: conserva los 7 más recientes y borra el resto.
ls -1t "$BACKUP_DIR"/meridiano-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "Backup creado: $FILE"
ls -1 "$BACKUP_DIR"/meridiano-*.sql.gz | wc -l
