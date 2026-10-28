# Meridiano-cero

Videojuego de investigación internacional, con nombre A.C.M.E. provisional. Estado: base de fase 1 implementada con PostgreSQL y sesión local. Todavía no hay partida jugable, motor ni IA.

## Implementación

- [Índice del paquete de implementación](docs/README.md)
- [Roadmap por hitos](docs/plan/ROADMAP.md)
- [Backlog preparado y dependencias](docs/plan/BACKLOG.md)
- [Requisitos trazables](docs/plan/REQUISITOS.md)
- [Funcionalidades](docs/plan/FUNCIONALIDADES.md) y [tareas detalladas](docs/plan/TAREAS.md)
- [Uso, desarrollo, instalación y operación](docs/manuales/README.md)
- [Arquitectura](docs/architecture/ARQUITECTURA.md) y [glosario](docs/architecture/GLOSARIO.md)
- [Specs](docs/specs/README.md), [ADR](docs/adr/README.md) y [matriz OWASP](docs/security/OWASP.md)

React/TypeScript, Fastify, PostgreSQL, pnpm y Docker Compose. Motor determinista separado de IA, web y persistencia. KISS, DRY y seguridad verificable son criterios de entrega, no afirmaciones de controles ya implementados.

## Estado de T1 (fase 1)

| Tarea | Estado | Descripción |
|---|---|---|
| T1-01 | ✅ Completada | Contratos de base SPEC-004/009/011 cerrados; sesiones locales, API v1, configuración y migraciones |
| T1-02 | ✅ Completada | Workspace pnpm mínimo: web React/Vite, API Fastify, contratos compartidos, TS strict, lint, guards |
| T1-03 | ✅ Completada | Compose PostgreSQL, Drizzle schema, migración SQL, health/readiness, pool pg |
| T1-04 | ⏳ Pendiente | CI con tipos/lint/imports/pruebas, lockfile congelado, escaneo secretos/dependencias |

## Desarrollo local de la base

Requisitos: Node 24.22.1, pnpm 12.15.0 y Docker Desktop con motor Linux activo.
Usar un worktree. No compartir node_modules entre Windows y Linux.

```text
pnpm install --frozen-lockfile --ignore-scripts
pnpm setup:local
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

setup:local genera .env y secretos únicos sin imprimirlos ni sobrescribir archivos.
No copiar la plantilla encima de una configuración existente. PostgreSQL usa
127.0.0.1:15432 y volumen persistente; la API 127.0.0.1:3000; web en
http://127.0.0.1:5173. No hay registro público. Health acredita proceso; ready,
DB y esquema. La sesión local solo está habilitada en development con origen exacto.

```text
pnpm typecheck
pnpm lint
pnpm check:format
pnpm test
pnpm build
pnpm verify:guards
pnpm smoke
pnpm security:dependencies
pnpm security:secrets --verify-detector
```

Pruebas de integración aisladas (no usar una DB real):

```text
pnpm setup:local --test
docker compose --env-file .env.integration -p meridiano-cero-t1-test up -d --wait
pnpm test:integration
pnpm verify:persistence
docker compose --env-file .env.integration -p meridiano-cero-t1-test down
```

El test usa puerto 15433 y otro volumen. verify:persistence detiene y recrea
únicamente ese contenedor, conservando datos. down no elimina el volumen.
verify:guards genera/retira archivos sintéticos; ejecutarlo sin watchers.
La CI GitHub está definida y fijada por SHA; no se ha ejecutado remotamente ni
se ha hecho push. Hay un aviso moderado de tooling registrado en la evidencia.

Entrega: [T1-03](docs/quality/T1-03-evidencia.md),
[T1-04](docs/quality/T1-04-evidencia.md) y [guía de base](docs/manuales/BASE-LOCAL.md).

### Base de datos (T1-03)

```bash
docker compose up -d db
cp .env.example .env
pnpm --filter @meridiano/api db:migrate
pnpm --filter @meridiano/api dev
```

Health: http://127.0.0.1:3000/api/v1/health (proceso)
Readiness: http://127.0.0.1:3000/api/v1/ready (DB + migración)

## Contexto del proyecto

- [Resumen de decisiones, propuestas y pendientes](docs/meridi/CONTEXTO.md)
- [Transcripción literal recuperada](docs/meridi/transcripcion-recuperada.md)
- [Respuesta original de la herramienta](docs/meridi/lectura-original.json)
- [GDD original aportado](docs/meridi/originales/ACME_GDD_v0.1_revision.docx) y [texto extraído](docs/meridi/ACME_GDD_v0.1_revision.txt)
- [TAD original aportado](docs/meridi/originales/ACME_TAD_v1.0_revision.docx) y [texto extraído](docs/meridi/ACME_TAD_v1.0_revision.txt)
- [Integración de los documentos y diferencias entre versiones](docs/meridi/DOCUMENTOS.md)

**Recuperación parcial del chat:** se han obtenido cinco intercambios recientes y el usuario ha aportado los dos Word GDD/TAD, conservados íntegros. Falta únicamente el historial anterior del chat; los documentos no son una transcripción de ese historial.
