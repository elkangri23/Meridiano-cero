# T2-01: navegabilidad estructural del mapa

Fecha: 2026-10-29. Continuación autorizada en worktree, sin commit, merge, push o despliegue. Referencias: SPEC-002, SPEC-003, SPEC-012 y estándares de 7962014ec7031c3694f2378d3983a5e488499239. Mantiene cambios anteriores v9–v12 sin commit.

## Defecto y comportamiento

La validación previa resolvía IDs y posición inicial, pero aceptaba ciudades aisladas o sin lugar accesible. Un reporte externo validated no debía convertir ese mapa en jugable. La validación estructural ahora exige un lugar accessible=true por ciudad y alcance de todas las ciudades declaradas desde la primera usando las rutas dirigidas de travelDurations.

No se infieren viajes inversos ni se exige retorno al inicio. Una cadena unidireccional que alcanza todas es válida. Lugares cerrados pueden coexistir con un acceso abierto en la misma ciudad. La política se aplica a ciudades declaradas del expediente jugable, no a futuros puntos decorativos o mapas con desbloqueos todavía no modelados.

El algoritmo usa una cola iterativa y un conjunto de visitadas, sin recursión. Solo ciudades declaradas y aristas con identificadores/costes positivos enteros válidos participan; un puente por un ID inexistente no conecta ciudades. Las colecciones mantienen sus cotas anteriores: 20 ciudades, 100 lugares y límite de entradas de rutas. Ciclos no provocan bucles infinitos. Errores estáticos, sin reproducir IDs, nombres, solución o datos privados de entrada.

No muta expediente ni modifica rutas, minutos, reportes o hash para hacerlos válidos. No red, IA, dependencia nueva ni reglas duplicadas en API. validateCaseDefinition incorpora la comprobación; createValidationReport identifica validador 1.2.0 y conserva solo escenario structural. Reporte previo del fixture permanece intacto: no se reescribe un original para atribuirle esta ejecución.

## Puerta de creación y compatibilidad

El servicio de creación ya validaba una copia estable. Ahora rechaza también mapa desconectado con CASE_NOT_READY antes de insertar partida/ledger. Una creación previa propia, con misma intención, sigue recuperándose antes de decidir la disponibilidad actual; un mapa que se vuelva inválido no borra ni bloquea el replay autorizado existente.

No hay nueva versión de motor: ejecución v12, formato de definición engineCompatibility=1 y esquema 1 sin cambios. Contenido, seed=42, hash original y partidas existentes se conservan. Esta mejora de aceptación de nuevas definiciones no migra progreso ni anuncia importación/generador disponibles.

## Pruebas

map-validation.test.ts añade catorce escenarios puros con datos sintéticos: original intacto, cadena sin retorno, ciudad aislada, inversa ausente y ciclo separado, acceso abierto alternativo a lugar cerrado, ciudad sin lugares, puente por referencia inexistente, cinco costes inválidos que no conectan, mapa de una ciudad sin viajes, errores sin centinela privado y reporte estructural 1.2.

runs.integration.test.ts añade un escenario PostgreSQL real: crear intención válida previa, intentar mapa desconectado, recuperar el mismo replay original y rechazar nueva intención sin aumentar runs ni insertar run_creations. No equivale a simulación de investigación o aceptación manual. El resto de las rutas A/B se conserva en la suite general, sin alterar el fixture original.

## Verificación ejecutada

- pnpm lint e imports correctos: 144 módulos y 396 relaciones sin infracciones, manteniendo complejidad máxima diez y límites del motor puro.
- pnpm test: 475 pruebas correctas en 32 archivos, catorce escenarios adicionales.
- pnpm typecheck y pnpm build completos correctos.
- pnpm smoke correcto con página/TSX y proxy web/API por HTTP real en loopback; no acredita E2E de investigación.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- pnpm test:integration: 46 pruebas correctas en cinco archivos, una adicional; base PostgreSQL/HTTP sintética aislada meridiano-cero-t3-persistence-test en 15434.
- scripts/verify_docs.py: 90 Markdown, referencias/grafo válidos y hashes originales DOCX intactos; integridad documental, sin acreditar controles de producto u OWASP.
- git diff --check correcto. pnpm check:format sigue señalando los mismos nueve archivos históricos; no se reescriben migraciones ni se relaja el checker.

Base sintética detenida conservando volumen. Base preexistente en 15433 y WSL sin cambios.

## Límites

Conectividad no acredita solución, dos rutas de investigación independientes, retorno desde cualquier lugar ni coste total bajo plazo. Conocimientos NPC/solución heredados, vocabulario de reglas/payloads y solvencia general continúan pendientes. T2/T3 siguen abiertos; API de acciones, DTO de progreso, guardados/resultado oficial y UI conectada pendientes. No importación, proveedor real, CI remota, E2E o certificación integral OWASP/ASVS. Formato histórico pendiente en nueve archivos.
