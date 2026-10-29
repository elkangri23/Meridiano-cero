# T2-01: validación estructural y referencias de expedientes

Fecha: 2026-10-29. Referencia: estándares de 7962014ec7031c3694f2378d3983a5e488499239, SPEC-002/007 y puerta de creación de SPEC-004/API-juego. Trabajo en el worktree de continuación, sin commits, merges, push o despliegue.

## Implementado

Se sustituye el validador monolítico de complejidad 71 por comprobaciones cohesionadas de campos, entidades y referencias, todas bajo el umbral diez. No se agrega dependencia ni se rebaja el control. Booleanos/enteros/tipos anidados estrictos; arrays de objetos no aceptan null o arrays como entradas; IDs globales únicos; referencias de ciudad/origen/procedencia/viajes; relaciones sin duplicación ni ciclos. Recorrido iterativo del grafo, sin recursión de profundidad controlada por el expediente.

Posición inicial consistente con el contrato actual del motor, rutas no repetidas ni de ciudad a sí misma, tiempos de viaje positivos. Se aplican los límites documentados de tamaño de listas/textos antes de iterar, con rechazo completo. Los mensajes no reproducen contenido privado recibido. Un reporte validated no evita las comprobaciones locales. El reporte producido copia errores y solo afirma la etapa structural.

El catálogo usa validación para canStart; createStoredRun valida una copia estable antes de esperar SQL y solo la persiste si es válida. Conserva sesión, lock de esquema, deduplicación y recuperación de una creación previa autorizada antes de disponibilidad actual. Un expediente inválido no deja partida ni intención huérfana. Cambiar el objeto del llamador después de iniciar la operación no cambia hash/estado persistido.

Motor sigue v4: no cambia semántica de ejecución, fixture, seed, versión/hash de contenido ni se reescriben guardados. Los reportes históricos del fixture permanecen intactos; el nuevo helper de reporte usa versión de validador 1.1.0.

## Pruebas y resultados

- pnpm test: 284 pruebas correctas, 23 archivos. Incluye 38 regresiones nuevas de estructura/referencias; las rutas del motor siguen pasando. Repetición focal de esas 38 tras renombrar el centinela sintético, correcta.
- pnpm test:integration: 37 pruebas correctas, cuatro archivos, PostgreSQL real aislado en 15434. Dos nuevas prueban rechazo sin partida/intención, replay previo autorizado ante nueva invalidez y persistencia de copia estable mientras el llamador modifica el original.
- Tipos y build completos correctos. ESLint del validador, tests nuevos y archivos API afectados correcto; complejidad máxima diez conservada.
- Revisión global: cuatro errores de lint restantes (any y dos funciones complejas en ai-adapters alternativo, sintaxis de RetroScreen no consumido); dos aristas engine→crypto en fuente/dist. No se declara quality gate global aprobado ni se cambian exclusiones/umbrales.
- Smoke HTTP web/proxy/API correcto. El escaneo inicial señaló la variable llamada secret del test con un valor explícitamente sintético; se renombra a privateSentinel sin excluir el archivo ni modificar el escáner. Repetición final de pnpm scan:secrets sin hallazgos; no equivale a una auditoría exhaustiva.
- verify_docs.py: 78 Markdown, referencias y grafo válidos, hashes originales DOCX intactos. Integridad documental, sin certificar producto/OWASP.

Se detuvo solo el contenedor meridiano-cero-t3-persistence-test-db-1, conservando su volumen. La base preexistente 15433, WSL y datos del usuario no se modificaron. No proveedor real, navegador/E2E, restauración ni CI remota en esta continuación.

## Límites explícitos

Esto no certifica un caso generado/importado ni permite activarlo mediante su reporte. Se validan tipos de knowledge y solution, pero sus referencias siguen usando vocabularios heredados distintos de facts/IDs NPC; resolverlos requiere evolución explícita de contenido/contrato. No se altera silenciosamente el caso original para ocultarlo.

Rules sigue siendo texto, sin ejecutar expresiones. ScheduledResult tiene forma comprobada, pero payload desconocido necesita contratos cerrados por tipo antes de admitir expedientes externos. No se verifica conectividad/solvencia completa de viajes ni coherencia semántica, geografía auténtica, condiciones de objetivos o rutas universales. Las dos rutas del caso fijo tienen sus pruebas independientes, no una aprobación universal del generador.

Los topes de listas/textos limitan esta etapa sobre objetos ya parseados; no acreditan tamaño en bytes/profundidad del futuro importador. No importador, worker ni catálogo dinámico nuevo. Sin E2E, proveedor real, restauración o seguridad pública completa. Calidad global y T2 permanecen abiertos.
