# Meridiano-cero

Videojuego de investigación internacional; A.C.M.E. es el nombre provisional. Estado al 2026-10-28: base parcial, motor implementado y T3 en curso. Hay un prototipo MS-DOS/pixel art y servicios IA probados con dobles; todavía no hay una investigación completa jugable ni guardado de partidas.

## Estado y documentación

- [Estado actual, pruebas y bloqueos](docs/plan/ESTADO.md).
- [Roadmap](docs/plan/ROADMAP.md), [backlog](docs/plan/BACKLOG.md) y [tareas](docs/plan/TAREAS.md).
- [Índice documental](docs/README.md), [requisitos](docs/plan/REQUISITOS.md) y [funcionalidades objetivo](docs/plan/FUNCIONALIDADES.md).
- [Desarrollo](docs/manuales/DESARROLLO.md), [uso del prototipo](docs/manuales/USO.md) y [evaluación IA](docs/manuales/IA-LOCAL.md).
- [Specs](docs/specs/README.md), [ADR](docs/adr/README.md), [arquitectura](docs/architecture/ARQUITECTURA.md) y [matriz OWASP](docs/security/OWASP.md).

React/TypeScript, Fastify, PostgreSQL, pnpm y Docker Compose. Motor separado de interfaz, transporte IA y persistencia. KISS, DRY y seguridad verificable son criterios de entrega.

## Desarrollo disponible

Requisitos: Node 24.22.1 y pnpm 12.15.0. En PowerShell, desde el worktree:

~~~powershell
pnpm install --frozen-lockfile
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
pnpm --filter @meridiano/web... build
pnpm dev
~~~

Configurar DATABASE_URL antes de usar la API. El ejemplo contiene credenciales sintéticas de desarrollo. Compose incluye un servicio db; el procedimiento completo de DB sigue pendiente de cierre. No existe aún el script db:migrate ni la distribución autoalojable terminada.

Web: http://127.0.0.1:5173. El prototipo está en /prototype del puerto de Vite. Para usar 5174, ejecutar la web con pnpm --filter @meridiano/web dev --port 5174; esa vista sintética no requiere conectar API ni modelo. No se sirve en producción.

Health acredita proceso HTTP. Readiness comprueba SELECT 1; no acredita migración aplicada, sesión ni caso jugable.

## Pruebas y evaluación

Última ejecución de producto: 146 pruebas correctas y corpus v2 de 17 escenarios con mock. Tipos/build API y lint IA correctos. Persisten siete errores globales de lint y siete de imports heredados de T2. Véase [evidencia](docs/quality/T3-04.md).

~~~text
pnpm test
pnpm eval:ai --mock
python3 scripts/verify_docs.py
~~~

La evaluación real espera URL/modelo disponibles. Los mocks no aprueban calidad de un modelo real ni el hito 3. El detalle de comandos, requisitos y límites está en los manuales.

## Contexto del proyecto

- [Resumen de decisiones, propuestas y pendientes](docs/meridi/CONTEXTO.md)
- [Transcripción literal recuperada](docs/meridi/transcripcion-recuperada.md)
- [Respuesta original de la herramienta](docs/meridi/lectura-original.json)
- [GDD original aportado](docs/meridi/originales/ACME_GDD_v0.1_revision.docx) y [texto extraído](docs/meridi/ACME_GDD_v0.1_revision.txt)
- [TAD original aportado](docs/meridi/originales/ACME_TAD_v1.0_revision.docx) y [texto extraído](docs/meridi/ACME_TAD_v1.0_revision.txt)
- [Integración de los documentos y diferencias entre versiones](docs/meridi/DOCUMENTOS.md)

**Recuperación parcial del chat:** se han obtenido cinco intercambios recientes y el usuario ha aportado los dos Word GDD/TAD, conservados íntegros. Falta únicamente el historial anterior del chat; los documentos no son una transcripción de ese historial.

## Alcance de esta rama

Esta revisión se basa en fd19321. origin/main avanzó por separado; sus sesiones, migrador y otras rutas aún deben reconciliarse durante la integración manual. Las limitaciones descritas arriba corresponden a este worktree. Véase [estado y contraste con main](docs/plan/ESTADO.md).
