# Meridiano-cero

Videojuego de investigación internacional, con nombre A.C.M.E. provisional. Estado: fase 1 en desarrollo. Workspace web/API inicial; todavía no hay partida jugable, base de datos ni sesión implementadas.

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

Los contratos de T1-01 están integrados. T1-02 crea el workspace inicial; el
estado vigente está en BACKLOG. Git y su remoto se conservan, sin reinicializar.

## Desarrollo local de la base

Requisitos: Node 24.22.1 y pnpm 12.15.0. En este equipo están disponibles en
Ubuntu/WSL; el Node 20 global de Windows no satisface el requisito del proyecto.
Trabajar desde el worktree y no mezclar node_modules de Windows y Linux.

```bash
pnpm install --frozen-lockfile --ignore-scripts
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

## Contexto del proyecto

- [Resumen de decisiones, propuestas y pendientes](docs/meridi/CONTEXTO.md)
- [Transcripción literal recuperada](docs/meridi/transcripcion-recuperada.md)
- [Respuesta original de la herramienta](docs/meridi/lectura-original.json)
- [GDD original aportado](docs/meridi/originales/ACME_GDD_v0.1_revision.docx) y [texto extraído](docs/meridi/ACME_GDD_v0.1_revision.txt)
- [TAD original aportado](docs/meridi/originales/ACME_TAD_v1.0_revision.docx) y [texto extraído](docs/meridi/ACME_TAD_v1.0_revision.txt)
- [Integración de los documentos y diferencias entre versiones](docs/meridi/DOCUMENTOS.md)

**Recuperación parcial del chat:** se han obtenido cinco intercambios recientes y el usuario ha aportado los dos Word GDD/TAD, conservados íntegros. Falta únicamente el historial anterior del chat; los documentos no son una transcripción de ese historial.
