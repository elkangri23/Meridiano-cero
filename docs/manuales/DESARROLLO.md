# Desarrollo y contribución

Actualizado: 2026-10-28. Consultar [estado actual](../plan/ESTADO.md), [backlog](../plan/BACKLOG.md) y evidencia de la tarea antes de trabajar. El proyecto tiene código ejecutable, pero no una investigación completa jugable.

## Estructura existente

- apps/web: React/Vite, comprobación básica de API y prototipo de desarrollo.
- apps/api: Fastify, configuración/pool PostgreSQL y servicios IA en src/ai.
- packages/contracts: contratos consumidos por web/API.
- packages/case-schema: definición y validación del expediente.
- packages/engine: motor, fixture y pruebas sin IA.

Son cinco proyectos de producto más la raíz pnpm. Hay compose.yaml, migrador con ledger y sesiones PostgreSQL. El comando db:migrate existe; faltan API/guardado de partidas conectados. No existen todavía worker, generador, biblioteca UI o paquete ai-adapters independientes.

Las direcciones de dependencias son las de SPEC-012. Los siete fallos de imports heredados, incluidos crypto en engine y la reexportación contracts/case-schema, están registrados como pendientes; no se presentan como arquitectura ya conforme.

## Entorno y primer arranque

Versiones usadas: Node 24.22.1, pnpm 12.15.0 y TypeScript 6.0.3 según manifiestos. Usar dependencias nativas del sistema elegido; no compartir node_modules de Windows y WSL ni modificar WSL como efecto del trabajo de producto.

En PowerShell, desde el worktree:

~~~powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm setup:local
pnpm --filter @meridiano/web... build
pnpm dev
~~~

La compilación inicial de web y sus dependencias prepara case-schema/contracts en un checkout limpio. setup:local crea URLs y secretos propios sin sobrescribirlos. Para DB: docker compose -f compose.yaml up -d --wait y pnpm db:migrate. Si la configuración ya existe, conservarla y seguir [BASE-LOCAL](BASE-LOCAL.md).

Web por defecto: http://127.0.0.1:5173. API: http://127.0.0.1:3000/api/v1/health. La API solo admite modo development, host 127.0.0.1 y registro público desactivado. La sesión local se habilita explícitamente; readiness comprueba DB y ledger de migraciones.

Para revisar solo el prototipo:

~~~text
pnpm --filter @meridiano/web dev --port 5174
~~~

Abrir http://127.0.0.1:5174/prototype. Usa muestras públicas y no requiere Ollama ni una partida. Se excluye de producción. Mantener reglas MS-DOS/pixel art, fuente legible alternativa y accesibilidad de SPEC-006; no convertir el prototipo en motor de reglas.

## Comandos y límites

| Comando | Alcance |
|---|---|
| pnpm dev | Compila contracts y arranca scripts dev de los proyectos que los tienen |
| pnpm build | Compilación del workspace; no afirmar que pasó por tener builds parciales |
| pnpm typecheck | Tipos del workspace; la evidencia T3 acredita el typecheck API |
| pnpm lint | ESLint e imports; actualmente bloqueado por errores heredados |
| pnpm check:imports | Dependency-cruiser; siete infracciones conocidas |
| pnpm test | HTTP base, motor e IA; última suite: 157 pruebas correctas |
| pnpm eval:ai --mock | Corpus v2, diecisiete escenarios con oráculo determinista |
| pnpm eval:ai --probe | Inventario Ollama; no evaluación de calidad |
| pnpm scan:secrets | Detector local de patrones, no auditoría completa |
| python3 scripts/verify_docs.py | Integridad documental y hashes de originales |
| pnpm verify:guards | Pruebas negativas de tipos/imports/ciclos; no revalidadas tras T3 |
| pnpm smoke | Comprobaciones HTTP heredadas; no E2E del juego ni prueba de persistencia |

No ejecutar verify:guards con watchers/build/typecheck concurrentes: crea archivos inválidos temporales. Existen test:integration y verify:persistence para base aislada; no hay backup/restore de producto ni test:e2e del juego. Los comandos futuros se separan en [instalación](INSTALACION.md) y [operación](OPERACION.md).

La base vigente usa compose.yaml: PostgreSQL con secretos por archivos y puerto 15432 de loopback. El archivo docker-compose.yml heredado contiene otro stack y no es el procedimiento integrado recomendado. No mezclar sus volúmenes ni inferir que ambos fueron probados.

[Registro de integración](../quality/INTEGRACION-T3-04.md) separa resultados nuevos de evidencias históricas.

## Flujo de trabajo

1. Trabajar en worktree; consultar BASELINE, ROADMAP, BACKLOG, spec y ADR aplicables.
2. Respetar dependencias o registrar el adelanto parcial expresamente autorizado.
3. Implementar el cambio mínimo con responsabilidades claras, KISS y DRY.
4. Ejecutar controles pertinentes y registrar tanto fallos como límites.
5. Actualizar contratos y evidencia sin dar por aceptada una fase por superar tests parciales.
6. Mensajes de commit en español. Commits, integración, push y despliegue requieren autorización vigente; integración manual.

No modificar originales de docs/meridi, credenciales, instalación WSL ni otros proyectos. Usar datos sintéticos. No crear subagentes sin petición expresa.

## IA y calidad

[IA local](IA-LOCAL.md) explica transporte, memoria y evaluación. Un mock aprobado no acredita comprensión ni ausencia de contradicciones de un modelo real. Sin URL/modelo disponibles no se instala ni descarga nada automáticamente.

[Última evidencia](../quality/T3-04.md): build API, typecheck API, lint IA y 157 pruebas correctos; nueve errores globales de lint, siete de imports y avisos de formato siguen abiertos en la combinación. Sin E2E ni aceptación OWASP completa.

Dependencias nuevas requieren necesidad, mantenimiento y licencia justificados. No crear capas vacías ni criptografía propia. Mantener secretos, prompts y conversaciones fuera de logs y de evidencias públicas.
