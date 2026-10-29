# Meridiano-cero

Videojuego de investigación internacional; A.C.M.E. es el nombre provisional. Estado de desarrollo al 2026-10-29: base PostgreSQL con migrador y sesión local, motor, archivo web conectado MS-DOS, prototipo pixel art separado y frontera IA independiente del proveedor. No hay todavía investigación completa conectada, guardados manuales ni evaluación real del modelo.

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

La raíz web permite consultar partidas propias, filtrar activas/cerradas y navegar páginas. En desarrollo, Entrar en desarrollo local solicita explícitamente la sesión cuando está habilitada en backend; al abrir no crea ninguna. Actualizar recupera la sesión existente y Cerrar sesión retira los datos. Nueva partida permite elegir un expediente disponible y crear una partida. Si se pierde la respuesta conserva su referencia en la pestaña para comprobar/reintentar la misma creación; no abre todavía la investigación. [Archivo](docs/quality/T3-03-archivo-conectado.md) y [creación recuperable](docs/quality/T3-creacion-web-recuperable.md).

El prototipo de desarrollo está en /prototype del puerto Vite; para 5174: pnpm --filter @meridiano/web dev --port 5174. Usa datos sintéticos, sin IA ni partidas conectadas, y se excluye de producción.

## Verificación e integración

~~~text
pnpm build
pnpm typecheck
pnpm test
pnpm eval:ai --mock
python3 scripts/verify_docs.py
~~~

[Registro de integración](docs/quality/INTEGRACION-T3-04.md): resultados del merge, controles pendientes y alcance exacto. El corpus mock no acredita calidad de un proveedor real ni E2E del juego.

## Contexto del proyecto

- [Resumen de decisiones, propuestas y pendientes](docs/meridi/CONTEXTO.md)
- [Transcripción literal recuperada](docs/meridi/transcripcion-recuperada.md)
- [Respuesta original de la herramienta](docs/meridi/lectura-original.json)
- [GDD original aportado](docs/meridi/originales/ACME_GDD_v0.1_revision.docx) y [texto extraído](docs/meridi/ACME_GDD_v0.1_revision.txt)
- [TAD original aportado](docs/meridi/originales/ACME_TAD_v1.0_revision.docx) y [texto extraído](docs/meridi/ACME_TAD_v1.0_revision.txt)
- [Integración de los documentos y diferencias entre versiones](docs/meridi/DOCUMENTOS.md)

**Recuperación parcial del chat:** se han obtenido cinco intercambios recientes y el usuario ha aportado los dos Word GDD/TAD, conservados íntegros. Falta únicamente el historial anterior del chat; los documentos no son una transcripción de ese historial.


Desde el archivo también puedes consultar la ficha inicial de una partida propia, sin avanzar su reloj. La reanudación con progreso y las órdenes siguen pendientes. [Entrega y límites de lectura](docs/quality/T3-ficha-inicial-conectada.md).
