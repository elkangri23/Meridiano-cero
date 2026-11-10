# Instalación y puesta en funcionamiento

Actualizado: 2026-11-10 (lote 4, T6-04/T6-05). Procedimientos verificados
ejecutándolos: instalación independiente desde un clon limpio (2026-11-10,
rama `distribucion-2026-11-10`) y simulacro de desastre con restore aislado
([runbook T6-05](../quality/T6-05-desastre.md)). Estado y bloqueos:
[ESTADO](../plan/ESTADO.md).

## Requisitos

- Node.js 24 y pnpm 12.15.0. El repo invoca `pnpm` dentro de sus scripts:
  tenlo en el PATH (por ejemplo, `corepack enable` con el pnpm fijado en
  `packageManager`, o el ejecutable directo de pnpm). Sin pnpm en el PATH,
  `pnpm db:migrate` falla con `pnpm: not found` aunque el `pnpm` del
  instalador funcione.
- PostgreSQL 16 o superior. Con Docker: `compose.yaml` (solo la base de
  datos de desarrollo). Sin Docker: un PostgreSQL local con los mismos
  roles y puertos (verificado 2026-11-10 con PostgreSQL 16 instalado por
  apt, roles `meridiano_owner`/`meridiano_app`, puerto 15432).
- No usar `docker-compose.yml`: es un stack heredado distinto y no es el
  de este proyecto. Tampoco mezclar sus volúmenes con `compose.yaml`.

## Desarrollo local (instalación independiente verificada)

Secuencia ejecutada el 2026-11-10 desde un clon limpio de la rama
`distribucion-2026-11-10`, sin tocar el VPS:

~~~text
git clone https://github.com/elkangri23/Meridiano-cero.git
cd Meridiano-cero
pnpm install --frozen-lockfile
pnpm setup:local
docker compose -f compose.yaml up -d --wait   # o PostgreSQL local en 15432
pnpm db:migrate
~~~

- `pnpm setup:local` genera `.env` y `.local-secrets/` (contraseñas de
  los roles). No sobrescribir secretos ni compartirlos.
- `pnpm db:migrate` aplica las migraciones con ledger: desde una base
  vacía deja el ledger en 13, con 0 casos y 0 partidas. El catálogo de un
  clon limpio trae solo el caso fijo (`astrolabio-tres-ciudades`); los
  casos generados no viajan con el repo, se crean con el generador.
- `setup:local` genera `REGISTRATION_ENABLED=false`. Para registrarse en
  una instalación local, poner `REGISTRATION_ENABLED=true` en `.env`
  antes de arrancar la API.
- Arranque de desarrollo (API desde fuente + web con proxy a la API):

~~~text
pnpm dev
~~~

- Arranque desde artefactos compilados (verificado 2026-11-10):

~~~text
pnpm --config.verify-deps-before-run=false --filter @meridiano/contracts build
pnpm --config.verify-deps-before-run=false --filter @meridiano/case-schema build
pnpm --config.verify-deps-before-run=false --filter @meridiano/engine build
pnpm --config.verify-deps-before-run=false --filter @meridiano/ai-adapters build
pnpm --config.verify-deps-before-run=false --filter @meridiano/generator build
pnpm --config.verify-deps-before-run=false --filter @meridiano/api build
pnpm --config.verify-deps-before-run=false --filter @meridiano/web build
pnpm --filter @meridiano/api start    # API compilada, puerto API_PORT
pnpm --filter @meridiano/web preview  # web compilada (sin proxy /api)
~~~

  Nunca `pnpm -r build`: los paquetes se compilan por separado. La web
  compilada no proxya `/api`; para jugar contra la API compilada, usar
  la web en desarrollo (`pnpm --filter @meridiano/web dev`) o un proxy
  inverso que sirva la web y reenvíe `/api` a la API.

- Comprobación: API `GET /api/v1/health` y `/api/v1/ready` devuelven 200;
  web 200; `/creditos` 200. Con proveedor mock (`AI_PROVIDER=mock`,
  el valor por defecto sin `AI_PROVIDER`), el proveedor efectivo es
  `mock`/`deterministic-ci` y no hay conexiones personales. Partida
  jugable del caso fijo verificada: crear partida, inspeccionar la sala
  (10 min), inspeccionar la cerradura (30 min), recoger EV-02 en
  inventario y dossier.
- El manual de desarrollo ([DESARROLLO](DESARROLLO.md)) recoge versiones,
  copia segura de `.env` y arranque web/API. [Evaluación IA](IA-LOCAL.md)
  separa mock y proveedor real; el adaptador Ollama actual sigue
  restringido a loopback. El prototipo `/prototype` y la evaluación mock
  funcionan sin modelo real.

## Autoalojamiento con Docker

El Compose de despliegue es `compose.prod.yaml` (API + web + DB, con
healthchecks y volumen persistente), probado en el VPS. Secuencia:

1. Obtener una versión publicada con procedencia e integridad verificables.
2. Leer requisitos/notas y preparar almacenamiento persistente.
3. Copiar `.env.prod.example` a `.env.prod` y definir secretos únicos,
   origen y proveedor. Nunca pegar claves en archivos públicos.
4. Configurar HTTPS si se accede por red.
5. Aplicar migraciones de forma controlada (`pnpm db:migrate` contra la
   base de despliegue; nunca migraciones concurrentes desde cada réplica).
6. Ejecutar arranque Compose y comprobar health/readiness.
7. Crear primer administrador mediante bootstrap de un uso.
8. Mantener registro cerrado o activarlo conscientemente
   (`REGISTRATION_ENABLED`).
9. Ejecutar test de proveedor y caso fijo.
10. Crear backup y probar restauración antes de uso importante
    ([runbook T6-05](../quality/T6-05-desastre.md)).

**Bloqueo de publicación:** nada se publica (ni releases, ni imágenes
públicas, ni registros) hasta que Antonio confirme nombre y marca. El
nombre provisional es A.C.M.E. / Meridiano-cero; ver el estado actual
en [registro F6](../quality/T6-04-distribucion.md).

## Variables

| Variable | Uso | Requisito |
|---|---|---|
| APP_MODE | development, self-hosted o public | Explícita; público rechaza bypass local |
| PUBLIC_ORIGIN | Origen de navegador/API | Verificado; HTTPS en público |
| DATABASE_URL | Conexión PostgreSQL | Privada; mínimos privilegios |
| SESSION_SECRET | Material secreto de sesiones | Único; no ejemplo fijo |
| REGISTRATION_ENABLED | Registro permitido | Desactivado por defecto; true en local para registrarse |
| AI_PROVIDER / AI_MODEL | Proveedor y modelo | Configurados y probados; `mock` por defecto en desarrollo |
| AI_BASE_URL | Endpoint | Política de destinos según modo |
| AI_API_KEY | Credencial si se necesita | Solo servidor |
| Clave de cifrado separada | Cifrado de credenciales guardadas | Requerida solo al habilitar esa capacidad |

La CLI IA actual usa OLLAMA_ORIGIN y --model, no AI_PROVIDER/AI_MODEL.

## VPS público

No desplegarlo antes de fase 7. Requiere cuenta/recuperación, TLS, DB
privada, backups, alertas, límites, proveedor verificado, información de
privacidad y revisión de seguridad. Jugadores no aportan API. Los
endpoints arbitrarios de jugadores permanecen deshabilitados inicialmente.

## Comprobación de independencia

Probar instalación nueva sin acceso al VPS del creador. Configurar
proveedor propio, iniciar/reanudar partida y exportar/importar un caso
validado. Ausencia de cuenta central o telemetría obligatoria. Registrar
versión, entorno y resultados; no darlo por hecho por usar Docker.
Verificado 2026-11-10 (clon limpio, mock): API+web sanas y partida
jugable sin tocar el VPS; resultado en
[registro F6](../quality/T6-04-distribucion.md).

## Lo que acompaña a la primera distribución

URL real del repositorio/release, versiones soportadas, ejemplo sin
secretos, Compose probado, pasos de migración/bootstrap, health,
actualización, backup/restore, licencias y diagnóstico. Licencias:
[NOTICE](../../NOTICE.md), [AUTHORS](../../AUTHORS.md) y créditos en el
juego (`/creditos`).
