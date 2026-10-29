# T2: costes y confirmaciones, ejecución v4

Fecha: 2026-10-29. Referencia: commit 7962014ec7031c3694f2378d3983a5e488499239; SPEC-001/002/003, ADR-005 y catálogo de bordes. Continuación en worktree, sin commit, merge, push ni despliegue.

## Cambio y criterios

Se implementan inspección general 10, específica 20, detención 15 y recuperación 20 minutos. Preview no devuelve eventos ni hechos prospectivos, ni cambia el estado. Confirmar revalida precondiciones y procesa solicitudes del intervalo antes del efecto terminal. Alcanzar o superar el plazo cierra sin aplicar ese efecto, conserva el prefijo y descarta el resto del lote. Una inspección ya revelada no vuelve a cobrar. Esperar pide confirmación; sumas que desbordan el entero seguro se rechazan sin transición.

Los lotes básicos también consumen esos costes. Validación de forma completa antes de ejecutar, límite ocho; pausa ante imposibilidad contextual; reanudación con preview si consume tiempo y sin repetir lo aplicado. Lectura de JSON persistido comprueba estructura, ordinales, estados y acciones; corrupción es fallo operativo BATCH_STATE_INVALID, sin penalización narrativa ni modificación de entrada.

Se extraen cálculo/preview material y validación del lote persistido en módulos utilizados. No se añade dependencia, capa genérica ni infraestructura. Se mantiene complejidad máxima diez. La ejecución pasa a v4 porque las mismas acciones tienen otra cronología; definición, contenido, semilla y hash permanecen intactos. API persiste v4 y lee inicios v1/v2/v3 vírgenes sin escribir sobre ellos; no ejecuta progreso antiguo.

## Pruebas y alcance

Las rutas de simulation.test encadenan acciones y aprobaciones explícitas de previews, sin modificar CaseRun para introducir conocimiento. La ruta A acredita 455 minutos y la B 485 en semilla sintética 1; semilla 42 acredita 482/512. Ambas siguen resolviéndose al eliminar las pruebas exclusivas de la otra ruta. El laboratorio A registra el resultado a minuto 120 (envío al 30 más 90). Los costes no se obtienen modificando la definición original.

material-time.test cubre previews sin efectos, campo confirmed sin bypass, repetición gratuita, espera, plazo exacto y sobrepasado, detención/recuperación interrumpidas, coste y prefijo de lote, reanudación, forma inválida, JSON corrupto y desbordamiento. Los estados preparados de unidad no se presentan como rutas de aceptación. Los tests previos de comportamiento usan un driver que acepta explícitamente los nuevos previews; las pruebas específicas invocan resolve/confirm por separado para detectar bypass.

Resultados ejecutados:

- pnpm test: 246 pruebas correctas, 22 archivos, incluidas 18 regresiones nuevas de costes/confirmación/lotes; ambas rutas verifican minutos exactos.
- pnpm test:integration: 35 pruebas correctas, cuatro archivos, PostgreSQL/HTTP real en base sintética aislada de puerto 15434. Verifica nueva ejecución v4 y lectura inicial v1/v2/v3 conservando las filas.
- pnpm typecheck y pnpm build correctos. ESLint de todo el motor y los dos archivos API afectados correcto; umbral diez conservado. Las infracciones globales heredadas registradas en la auditoría no se declaran resueltas por este control acotado.
- pnpm smoke: página, TSX y proxy web/API comprobados por HTTP loopback. pnpm scan:secrets sin hallazgos por patrones, sin equivaler a revisión exhaustiva.
- scripts/verify_docs.py: 77 Markdown, enlaces/IDs y grafo válidos; hashes de Word originales intactos. Integridad documental, no aceptación funcional.

Se detuvo únicamente el contenedor meridiano-cero-t3-persistence-test-db-1, conservando su volumen; la base preexistente de 15433 y WSL no se modificaron. No se ejecutaron modelo real, navegador/E2E, restore ni CI remota.

## Límites

No se cierra T2 ni se afirma cumplimiento integral de 7962014/OWASP/GDD. Pendientes: lotes de otras acciones y dependencias explícitas, extremos de retraso, lenguaje de reglas genérico, validador y calidad global. El algoritmo seeded heredado no acredita el máximo documental de +45 por tramo; se registra como pendiente, sin cambiar semántica de azar silenciosamente. ACC-008/009 tienen cobertura adicional de tiempo base, no aceptación completa.

API continúa limitada a la proyección inicial: sin preview/commit HTTP, operaciones de acciones, guardados, carrera oficial, E2E/navegador, proveedor real o backup/restore en esta entrega. Concurrencia y vigencia de un preview deben validarse transaccionalmente al implementar esas rutas; confirmAction solo valida el estado que recibe. No se modifica diseño visual, Word originales, credenciales o WSL.
