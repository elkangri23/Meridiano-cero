#!/bin/sh
# Preparación del simulacro de desastre T6-05 (entorno AISLADO).
# Crea secretos propios del drill (nunca los de producción), la
# configuración del drill (proveedor mock, sin correo real, sin red
# freellmapi) y arranca SOLO la base de datos del drill en su propio
# volumen. No toca /opt/meridiano-cero, ni su volumen, ni su red.
# Uso: sh scripts/drill-setup.sh   (desde la raíz del repo, en una COPIA
# del repo dedicada al drill, nunca en el checkout de producción:
# si existe .env.prod, el script se niega a continuar).
set -eu
cd "$(dirname -- "$0")/.."  # scripts/ -> raíz del repo
if [ -f .env.prod ]; then
  echo "ERROR: este directorio parece producción (.env.prod presente); el drill solo corre en una copia aparte." >&2
  exit 1
fi
if [ ! -f compose.drill.yaml ]; then
  echo "ERROR: falta compose.drill.yaml en la raíz del repo." >&2
  exit 1
fi
mkdir -p .drill
# Secretos propios del drill (nunca se imprimen). El directorio queda 0700
# (solo ubuntu en el host); dentro del contenedor los ficheros van a 0644
# porque el init de postgres los lee como usuario postgres (uid 999), igual
# que en producción, donde el montaje efectivo también es 0644.
if [ ! -f .drill/admin-password ]; then openssl rand -hex 32 > .drill/admin-password; fi
if [ ! -f .drill/app-password ]; then openssl rand -hex 32 > .drill/app-password; fi
chmod 700 .drill
chmod 644 .drill/admin-password .drill/app-password
python3 - <<'PYEOF'
import pathlib
root = pathlib.Path('.drill')
admin = (root / 'admin-password').read_text().strip()
app = (root / 'app-password').read_text().strip()
env = (
    'APP_MODE=development\n'
    'API_HOST=127.0.0.1\n'
    'API_PORT=13000\n'
    'PUBLIC_ORIGIN=http://127.0.0.1:15173\n'
    'LOCAL_DEV_AUTH_ENABLED=true\n'
    'REGISTRATION_ENABLED=true\n'
    'AI_PROVIDER=mock\n'
    f'DATABASE_URL=postgresql://meridiano_app:{app}@127.0.0.1:15440/meridiano\n'
    f'DATABASE_MIGRATION_URL=postgresql://meridiano_owner:{admin}@127.0.0.1:15440/meridiano\n'
)
(root / 'env.drill').write_text(env)
pathlib.Path('.env.drill').write_text(env)
print('configuracion del drill escrita (sin secretos en la salida)')
PYEOF
# La web (vite) lee API_PORT del .env de la raíz: solo se crea si no
# existe, para no sobrescribir jamás la configuración de un checkout.
if [ ! -f .env ]; then
  printf 'API_PORT=13000\n' > .env
  echo ".env creado solo con API_PORT=13000 (no existía)"
else
  echo "AVISO: .env ya existe y no se toca; comprobar que API_PORT=13000"
fi
docker-compose -f compose.drill.yaml -p meridiano-drill up -d --wait db
echo "drill-db en marcha (puerto 127.0.0.1:15440, volumen propio)"
docker ps --filter name=meridiano-drill-db --format '{{.Names}} {{.Status}}'
