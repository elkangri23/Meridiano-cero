# SPEC-009 Desarrollo, instalación y recuperación

Estado: cerrada para base en T1-01; comandos en manuales aún no implementados.
Fuentes: TAD §4/9/13–15; GDD §16/17/19. ADR-004/008.

## Decisiones de cierre T1-01 (2026-10-28)

Estas decisiones cerraron los puntos propuestos de esta spec para la base de fase 1.
No son aprobación histórica; se registran como decisiones de implementación.

| Tema | Decisión tomada | Fundamento |
|---|---|---|
| Versiones de herramientas | Usar las versiones instaladas en el entorno de desarrollo. No se fijan valores concretos hasta que se verifique contra documentación vigente en T1-01. Se conservan en lockfile/manifiestos. | SPEC-009 §L22 |
| Entorno development | Vite + API + PostgreSQL en Compose + Ollama en host (casa, RTX 5080). En trabajo: FreeLLMAPI como proveedor alternativo. | SPEC-009 §L8; DEC-002 |
| PostgreSQL | Crear en Docker Compose como parte de T1-03. No se asume versión previa instalada. | SPEC-009 §L14; BACKLOG T1-03 |
| Modo development | Variable `APP_MODE=development`, binding loopback. Rechazado en configuración pública. | SPEC-009 §L8; SPEC-004 §L10 |
| Proveedor IA | `AI_PROVIDER=ollama` por defecto; `AI_PROVIDER=freellmapi` alternativo. No hardcodear endpoint. | SPEC-009 §L18; DEC-002 |

## Contratos de base T1-01 (cerrados 2026-10-28)

### Compose de desarrollo (fase 1)

`docker-compose.yml` en la raíz, services:

| Service | Image | Puertos | Notas |
|---|---|---|---|
| `db` | `postgres:16` | Solo red interna `app` | Volumen `pgdata` persistente. Credenciales privadas. |
| `api` | Build de `apps/api` | 3000 → loopback | Lee `DATABASE_URL` del entorno. |
| `web` | Build de `apps/web` | No expuesto | Solo red `app` + loopback para desarrollo. |

Variables de entorno del compose:
```
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=app
```

No se exponen puertos de DB al host. No se usa `host.docker.internal` como
candidato universal; se comprueba en Docker Desktop, no se impone a Linux.

### Scripts de superficie (fase 1)

| Script | Comando | Estado |
|---|---|---|
| `pnpm dev` | Inicia API + web en desarrollo | Cerrado |
| `pnpm build` | Build de web y API | Cerrado |
| `pnpm typecheck` | `tsc --noEmit` sin emitir | Cerrado |
| `pnpm lint` | ESLint | Cerrado |
| `pnpm test` | Vitest | Cerrado |
| `pnpm test:e2e` | Playwright | Cerrado |
| `pnpm db:migrate` | Drizzle migrate | Cerrado |
| `pnpm db:seed` | Semillas ficticias development | Cerrado |
| `pnpm db:backup` | Backup cifrado de DB | Cerrado |
| `pnpm db:restore` | Restaurar backup | Cerrado |
| `pnpm health` | `GET /health` | Cerrado |
| `pnpm ready` | `GET /ready` | Cerrado |

### Validación al arrancar

Al iniciar, la API verifica en orden:
1. Variables requeridas presentes (`PUBLIC_ORIGIN`, `DATABASE_URL`, `SESSION_SECRET`).
2. Conexión a DB y migraciones aplicadas.
3. `APP_MODE=development` → binding loopback, `REGISTRATION_ENABLED` configurable.
4. `APP_MODE=production` → rechaza `development`, exige `PUBLIC_ORIGIN` HTTPS,
   `REGISTRATION_ENABLED=false` por defecto.
5. Proveedor IA configurado; no falla el arranque si el proveedor no está
   disponible (solo `/ready` lo refleja).

### Lockfile y versiones

- `pnpm-lock.yaml` congelado en T1-02.
- `package.json` sin dependencias innecesarias. Cada dependencia debe tener
  consumidor demostrado.
- No se usa `latest` en comandos de instalación sin revisión.

## Perfiles

Development: Vite y API en host o Compose, PostgreSQL en Compose y Ollama en host. Solo loopback para servicios de prueba. Perfil de prueba explícito sin credencial universal. Semillas/fixtures ficticios.

Self-hosted: web, API, DB y worker desde fase 4; proxy HTTPS recomendado. Primer administrador por bootstrap de un uso; registro deshabilitado por defecto y activable por administrador. El juego funciona con proveedor propio sin llamar a infraestructura del creador.

Public: proxy TLS, registro obligatorio, cookies seguras, IA de instalación, cuotas, backups y alertas. Rechazar arranque con claves ausentes, modo local o configuración de endpoints inseguros.

No hay worker vacío en fase 1. No hay Kubernetes, Redis ni telemetría obligatoria. No requerir pnpm a quien usa imágenes Docker de distribución.

## Configuración y secretos

Contrato de variables a implementar, no archivo existente: APP_MODE, PUBLIC_ORIGIN, DATABASE_URL, SESSION_SECRET, REGISTRATION_ENABLED, AI_PROVIDER, AI_BASE_URL, AI_MODEL y AI_API_KEY opcional según proveedor. Añadir clave separada de cifrado al guardar credenciales de usuario. Validación al arrancar y valores de ejemplo sin secretos.

AI_BASE_URL local puede apuntar a Ollama en host por política de administrador. En Docker Desktop host.docker.internal es candidato sujeto a comprobación; no imponerlo a Linux. No desactivar controles públicos para soportar localhost privado.

Versiones concretas de Node, pnpm, PostgreSQL, imágenes y dependencias se fijan en fase 1 contra documentación vigente y se conservan en lockfile/manifiestos. Las guías no deben publicar comandos que dependan de latest sin revisión.

## Comandos objetivo

pnpm dev, pnpm build, pnpm typecheck, pnpm lint, pnpm test y pnpm test:e2e se implementarán como superficie coherente. Scripts de migración explícitos, backup/restore y health se documentarán con salidas reales. Docker Compose de distribución deberá arrancar tras configurar secretos/proveedor; no prometer cero configuración.

El setup valida entorno, conexión DB, migraciones, primer administrador y proveedor. Crear el administrador no autoriza automáticamente registro público ni exposición de puertos. README incluirá requisitos, actualización y diagnóstico.

## Datos y migraciones

Volumen persistente PostgreSQL; cambios de esquema versionados y revisados. Copia antes de migración de producción. Una única tarea controlada aplica migraciones; web/API no compiten al arrancar para cambiar esquema.

Actualizar: fijar versión, leer notas, backup, validar compatibilidad de schema/motor, aplicar migración, health y smoke test. Si migración irreversible falla, restaurar copia en instancia separada y comprobar antes de cambiar tráfico. No prometer downgrade binario sobre DB ya migrada.

Backups incluyen DB y referencias a versiones/configuración no secreta; secretos se conservan por canal separado protegido. Backup cifrado, acceso mínimo y prueba periódica de restauración. Retención y RPO/RTO se fijan con recursos reales en fase 6; la prueba debe medirlos, no inventarlos.

## Autoría, licencias y publicación

Antes de distribuir: LICENSE AGPL-3.0-only del código, NOTICE, AUTHORS, CONTRIBUTING, créditos y enlace a código correspondiente. Confirmar atribución exacta. Inventario de dependencias, arte, música y fuentes con licencias; assets originales sin copiar marcas/personajes protegidos. No afirmar que AGPL exige enviar mejoras al repositorio original ni que garantiza créditos idénticos en todos los forks.

## Aceptación

ACC-024/026/032/035/039. Probar instalación en entorno limpio distinto al desarrollo, proveedor propio, sin acceso al VPS creador, reinicio, migración, restauración y claves ausentes. Manuales: [desarrollo](../manuales/DESARROLLO.md), [instalación](../manuales/INSTALACION.md), [operación](../manuales/OPERACION.md).
