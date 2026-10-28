# Meridiano-cero

Videojuego de investigación internacional, con nombre A.C.M.E. provisional. Estado: fase 1 en desarrollo. Workspace web/API con PostgreSQL y migración inicial; todavía no hay partida jugable ni sesión implementada.

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

Requisitos: Node 24.22.1 y pnpm 12.15.0. Trabajar en Windows 10 con Cezar; no mezclar node_modules de Windows y Linux.

```bash
pnpm install --frozen-lockfile
test -e .env || cp .env.example .env
pnpm dev
```

Abrir http://127.0.0.1:5173. La pantalla permite comprobar la API de desarrollo
por el proxy del mismo origen. Health solo acredita proceso HTTP, no DB ni juego.
El ejemplo no contiene credenciales y mantiene sesión/registro desactivados.

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:guards
pnpm smoke
```

`verify:guards` introduce y retira archivos sintéticos para comprobar fallos de
tipos/imports/ciclos; ejecutarlo con los watchers detenidos. Los comandos de DB,
readiness y E2E del juego siguen pendientes de sus tareas. Más detalles en
[la guía de desarrollo](docs/manuales/DESARROLLO.md).

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
