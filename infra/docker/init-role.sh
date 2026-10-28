#!/bin/sh
set -eu
app_password="$(cat /run/secrets/app_password)"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$app_password" <<'SQL'
CREATE ROLE meridiano_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE meridiano TO meridiano_app;
SQL
