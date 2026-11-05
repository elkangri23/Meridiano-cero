#!/bin/sh
# Entrypoint de la API en producción (Fase B): espera a PostgreSQL, aplica
# las migraciones (incluida la 0004 de la Fase A y la 0005 de la Fase B) y
# arranca el servidor. Las migraciones corren con DATABASE_MIGRATION_URL
# (rol propietario); el servidor usa DATABASE_URL (rol meridiano_app).
set -eu
cd /app
node apps/api/dist/database/wait-db.js
node apps/api/dist/database/migrate-cli.js
exec node apps/api/dist/server.js
