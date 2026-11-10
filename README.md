# Meridiano-cero

Videojuego de investigación internacional; A.C.M.E. es el nombre provisional (pendiente de confirmación antes de publicar). Estado de desarrollo al 2026-11-10 (lote 4): base PostgreSQL con migrador y sesión local, motor, archivo web conectado, prototipo pixel art separado y frontera IA independiente del proveedor. La investigación completa está conectada (escena, acciones, laboratorio forense, terminal de inteligencia, central de comunicaciones, objetivos e informe final), los guardados manuales persisten y la evaluación real del modelo existe (FreeLLMAPI cableado en el VPS, LLM configurable por usuario). El juego está desplegado y es jugable en producción en meridianocero.laurafernandezenfermeria.com, con registro público, en español, inglés y francés, con generador de casos e intérprete de texto libre. La estética actual es de archivo estilo MS-DOS; el rediseño moderno (A2, maqueta aprobada como referencia de aspiración) está pendiente de implementar.

## Estado y contratos

- [Estado integrado y límites](docs/plan/ESTADO.md).
- [Roadmap](docs/plan/ROADMAP.md), [backlog](docs/plan/BACKLOG.md) y [tareas](docs/plan/TAREAS.md).
- [Índice documental](docs/README.md), [requisitos](docs/plan/REQUISITOS.md) y [funcionalidades](docs/plan/FUNCIONALIDADES.md).
- [Base local](docs/manuales/BASE-LOCAL.md), [desarrollo](docs/manuales/DESARROLLO.md) y [evaluación IA](docs/manuales/IA-LOCAL.md).
- [API](docs/specs/API-juego.md), [guardados](docs/specs/GUARDADOS.md), [conversaciones](docs/specs/CONVERSACIONES.md) y [proveedores](docs/specs/IA-proveedores.md).

## Desarrollo local

Requisitos: Node 24.22.1, pnpm 12.15.0 y Docker Desktop con motor Linux. Desde el worktree:

~~~text
pnpm install --frozen-lockfile
pnpm setup:local
docker compose -f compose.yaml up -d --wait
pnpm db:migrate
pnpm dev
~~~

setup:local genera configuración privada sin sobrescribirla ni imprimir claves. Si ya existe, conservarla y revisar el manual. No copiar la plantilla sobre secretos propios.

La base vigente usa compose.yaml (solo PostgreSQL en 127.0.0.1:15432); API y Vite se ejecutan en host. docker-compose.yml es un archivo heredado distinto, sin validación del stack completo; no usarlo como sustituto de este procedimiento ni mezclar volúmenes.

Web: http://127.0.0.1:5173. API: http://127.0.0.1:3000/api/v1/health. Readiness comprueba DB y migraciones esperadas. Sesión de desarrollo solo en loopback, sin registro público ni contraseñas por defecto.

La raíz web permite consultar partidas propias, filtrar activas/cerradas y navegar páginas. En desarrollo, Entrar en desarrollo local solicita explícitamente la sesión cuando está habilitada en backend; al abrir no crea ninguna. Actualizar recupera la sesión existente y Cerrar sesión retira los datos. Nueva partida permite elegir un expediente disponible y crear una partida. Si se pierde la respuesta conserva su referencia en la pestaña para comprobar/reintentar la misma creación. Al entrar en una partida se abre la investigación (escena, acciones y ventanas de juego). Desde el archivo también puedes consultar la ficha inicial de una partida propia, sin avanzar su reloj, y reanudarla con progreso (resumen al retomar); las órdenes funcionan (solicitud, concesión, detención y recuperación). [Archivo](docs/quality/T3-03-archivo-conectado.md), [creación recuperable](docs/quality/T3-creacion-web-recuperable.md) y [entrega y límites de lectura](docs/quality/T3-ficha-inicial-conectada.md).

El prototipo de desarrollo está en /prototype del puerto Vite; para 5174: pnpm --filter @meridiano/web dev --port 5174. Usa datos sintéticos, sin IA ni partidas conectadas, y se excluye de producción.

## Verificación e integración

~~~text
pnpm build
pnpm typecheck
pnpm test
pnpm eval:ai --mock
python3 scripts/verify_docs.py
~~~

Verificación actual (2026-11-10, lote 4): 1321 pruebas unitarias, 153 de integración y E2E efectiva re-ejecutada en el stack de desarrollo del VPS, con smoke en producción; la evaluación con proveedor real ya se ha hecho en producción (generación en pausa por colapso de FreeLLMAPI). [Registro del lote](docs/quality/T6-04-distribucion.md): inventario de licencias, clon limpio verificado y simulacro de desastre medido.

## Contexto del proyecto

- [Resumen de decisiones, propuestas y pendientes](docs/meridi/CONTEXTO.md)
- [Transcripción literal recuperada](docs/meridi/transcripcion-recuperada.md)
- [Respuesta original de la herramienta](docs/meridi/lectura-original.json)
- [GDD original aportado](docs/meridi/originales/ACME_GDD_v0.1_revision.docx) y [texto extraído](docs/meridi/ACME_GDD_v0.1_revision.txt)
- [TAD original aportado](docs/meridi/originales/ACME_TAD_v1.0_revision.docx) y [texto extraído](docs/meridi/ACME_TAD_v1.0_revision.txt)
- [Integración de los documentos y diferencias entre versiones](docs/meridi/DOCUMENTOS.md)

**Origen:** los documentos GDD/TAD los aportó el usuario y se conservan íntegros; el historial anterior del chat no se recuperó y los documentos no son una transcripción de ese historial. Ver [CONTEXTO.md](docs/meridi/CONTEXTO.md).
