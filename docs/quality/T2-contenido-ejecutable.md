# T2-01: puerta de contenido ejecutable reconocido

Fecha: 2026-10-29. Continuación autorizada en worktree, sin commit, merge, push o despliegue. Mantiene cambios anteriores sin commit. Referencias: SPEC-002, SPEC-012, API-juego y estándares de 7962014ec7031c3694f2378d3983a5e488499239.

## Defecto

Rules aceptaba cualquier string, aunque el motor utiliza resolutores fijos y no interpreta esas cadenas. ScheduledResults de la definición podía contener tipos/payloads arbitrarios y createInitialRun no los incorporaba. Un reporte validated no debe aprobar instrucciones que se van a ignorar ni convertir texto en una acción ejecutable.

## Comportamiento implementado

Para Astrolabio, rules debe contener exactamente el conjunto de tres declaraciones históricas del original. Se rechazan ausencia, duplicado, añadido y alteración, incluso variantes de texto. Se admite otro orden porque se compara el conjunto; el hash sigue conservando orden de arrays. No se parsean esas expresiones: es un manifiesto de compatibilidad con la implementación fija, no un compilador ni un DSL genérico. La tabla de compatibilidad no se expone mediante contratos públicos o PlayerView.

Otros IDs de caso solo admiten rules vacío mientras no exista un formato declarativo soportado. Un caso general estructuralmente válido no pasa por ello a estar disponible en el catálogo: sigue existiendo únicamente el caso fijo. No se elimina del alcance el generador o reglas futuras; requieren versionado, referencias y ejecución verificable.

ScheduledResults inicial debe estar vacío. Se rechaza tanto tipo desconocido como nombres/payloads del runtime, incluso una comunicación aparentemente válida. No se inicializa una cola a partir de datos que el motor no sabía consumir. Solicitudes creadas por acciones (laboratorio, inteligencia, órdenes, comunicaciones) continúan funcionando con sus resolutores/cupos/relojes existentes.

La puerta se integra en validateCaseDefinition y la creación ya usa su copia estable. Nuevas intenciones inválidas producen CASE_NOT_READY sin runs/run_creations; un replay previo propio conserva prioridad sobre disponibilidad actual. Sin ejecución de código, eval, I/O, descarga remota o nuevas dependencias.

## Versionado e integridad

Validador 1.4.0, etapa structural únicamente. Motor sigue v13, sin nueva transición o migración. Formato 1, engineCompatibility=1, contenido/seed/hash del expediente original y originales Word intactos. No se atribuye compilación, solvencia o validación completa de payloads futuros al reporte estructural.

Las pruebas sintéticas de referencias/mapa general usan rules vacío en vez de heredar un manifiesto de otro caso. Se conserva la prueba real de fallo de hash: el BigInt se coloca en una extensión privada sintética no serializable, no en scheduledResults ahora rechazado antes. Sigue comprobando que un fallo real de preparación no bloquea replay autorizado ni deja nueva escritura. No representa una importación JSON ni aprueba extensiones externas; el contrato completo de importación sigue pendiente.

## Escenarios

content-validation.test.ts añade quince escenarios: original intacto y reordenamiento; seis manifiestos inválidos; otro caso sin herencia del manifiesto; cuatro tipos de programación inicial rechazados; payload plausible con instrucciones no aprobado; código/texto privado sin evaluación/reflejo; reporte estructural 1.4.

PostgreSQL añade un escenario con regla desconocida y programación inicial: conserva creación previa propia por su clave, rechaza nuevas intenciones y verifica ausencia de nuevas filas. La prueba separada de fallo real de hash permanece activa. Son datos sintéticos de integración, no E2E, generador o aceptación manual.

## Verificación ejecutada

- pnpm lint e imports correctos: 153 módulos y 425 relaciones sin infracciones. Complejidad máxima diez y motor puro mantenidos.
- pnpm test: 523 pruebas correctas en 35 archivos, quince escenarios adicionales.
- pnpm typecheck y pnpm build completos correctos.
- pnpm smoke correcto con página/TSX y proxy web/API por HTTP real en loopback; no acredita E2E de investigación.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- pnpm test:integration: 48 pruebas correctas en cinco archivos; una adicional con reglas y programación inicial no soportadas. PostgreSQL/HTTP sintético aislado meridiano-cero-t3-persistence-test, puerto 15434. Fallo real de preparación de hash sigue comprobado por separado.
- scripts/verify_docs.py: 93 Markdown, referencias/grafo válidos y hashes originales DOCX intactos. Integridad documental, sin acreditar controles de producto u OWASP.
- git diff --check correcto. pnpm check:format conserva ocho incidencias históricas, sin reescribir migraciones ni relajar el checker.

Base sintética detenida conservando volumen; base preexistente 15433 y WSL sin cambios.

## Límites

No se implementa un DSL, compilador de reglas o programación inicial. Tampoco prueba suficiencia de todos los objetivos o rutas al declarar un manifiesto. T2-01/T2/T3 siguen abiertos por políticas completas de conversación, formato ejecutable general y solvencia/aceptación; API de acciones, guardados, resultado oficial y UI conectada pendientes. Sin proveedor real, CI remota o certificación integral OWASP/ASVS. Ocho incidencias históricas de formato pendientes.
