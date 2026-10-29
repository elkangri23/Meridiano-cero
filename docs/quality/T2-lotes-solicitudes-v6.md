# T2: solicitudes y esperas en lotes v6

Fecha: 2026-10-29. Referencia: 7962014ec7031c3694f2378d3983a5e488499239; SPEC-001/002/003, API-juego, GUARDADOS y ADR-005. Worktree de continuación, sin commit, merge, push ni despliegue.

## Implementación

Los lotes aceptan analyze/query/wait/request_warrant, además de inspect/collect/talk. Validación de forma completa y cerrada antes de aplicar prefijo; máximo ocho y mismo grafo conservador de dependencias. El coordinador usa los resolutores individuales: no copia reglas de maduración, admisibilidad, suficiencia, cupo 32 o reloj.

Envío de solicitudes gratuito; esperas explícitas con preview/confirmación y vencimientos del reloj interno. applied del paso significa enviado, no resultado conocido. Pedir una orden sin las pruebas maduras pausa; continuar no reintenta el fallo, pero una espera independiente autorizada puede madurar resultados ya enviados. Solicitudes duplicadas no reservan otro hueco. Un error operativo de capacidad/estado descarta el cálculo prospectivo sin mutar entrada ni inventar castigo o guardado.

La selección de evidencias se valida en un helper compartido por acción individual, lote y payload de orden persistido: 1–16 IDs ASCII únicos, sin listas dispersas. Conocimiento, selección ofrecida y admisibilidad siguen verificándose en dominio; no se concede autoridad por validar forma.

Se añaden guardas de versión interna segura/no regresiva antes y después del trabajo, incluido el resultado prospectivo del preview. Un contador inválido/desbordado produce RUN_VERSION_INVALID sin transición; es un fallo técnico, distinto del conflicto HTTP. No se oculta el fallo detrás de una confirmación exitosa.

## Versión y alcance

EngineVersion=6 por ampliar semántica de lotes y validación. La definición sigue en formato 1, sin modificar fixture, seed ni hash. API crea v6 y reconoce inicios vírgenes v1–v5 por igualdad completa sin actualizar filas; progreso antiguo se conserva y rechaza. No hay migración de snapshots ni acciones HTTP nuevas.

No se añaden dependencias, capas ni servicios; se conserva motor puro y complejidad diez. Viajes, detención, recuperación, cierre y comunicaciones siguen como acciones individuales, evitando fingir un preview de viaje seguro en lotes que aún no existe.

## Pruebas y resultados

Rutas A/B se ejecutan en lotes y acciones individuales con semillas 1 y 42, eliminando evidencias exclusivas de la otra ruta. Coinciden minutos, posición, hallazgos/posesión, procedencia, admisibilidad, órdenes, detenciones, recuperación e informe. No se fuerza igualdad de revisión/ordinal porque el control del lote tiene eventos propios. No se introducen pistas directamente en CaseRun.

Los bordes cubren laboratorio/registro paralelos, tiempos exactos, falta de espera, duplicados, juzgado tras esperas explícitas, empate del plazo, formas manipuladas, huecos en selección y capacidad agotada. Los contadores extremos y saturación usan estados sintéticos de unidad, no rutas de aceptación. El preview conserva el estado recibido y no devuelve eventos prospectivos.

- pnpm test: 384 pruebas correctas, 26 archivos. Son 28 regresiones adicionales respecto a v5, incluidas cuatro rutas agrupadas equivalentes, selección dispersa, rechazo de progreso v5 y bordes de solicitudes/contadores.
- pnpm lint: ESLint e imports globales correctos, motor puro y complejidad máxima diez, sin relajar controles. Cero infracciones en 134 módulos y 342 relaciones analizadas.
- pnpm typecheck y pnpm build completos correctos. No se añaden dependencias ni infraestructura.
- Smoke de página/TSX/proxy web/API por HTTP real correcto; escaneo por patrones sin hallazgos. No equivalen a E2E de investigación ni auditoría exhaustiva de secretos.
- pnpm test:integration: 38 pruebas correctas, cuatro archivos, PostgreSQL/HTTP real. Verifica creación v6, lectura de inicios v1–v5 sin reescritura y rechazo/preservación de progreso antiguo. Proyecto meridiano-cero-t3-persistence-test, puerto 15434, datos sintéticos y volumen propio.
- scripts/verify_docs.py: 82 Markdown, enlaces/IDs/grafo válidos y hashes de DOCX originales intactos.

No se modifica la base preexistente de 15433, WSL, credenciales ni originales Word. La verificación documental comprueba integridad/trazabilidad, no certifica controles de producto o ASVS.

## Pendientes

No se cierra T2 ni se declara cumplimiento integral GDD/OWASP. Faltan lotes de otros tipos, máximos de retraso, vocabulario NPC/solución y reglas genéricas; adaptación API/IA de dependencias, revisión/rama/tokens, guardados y primer resultado oficial, UI conectada y E2E. Los diez archivos con formato histórico pendiente conservan su control; no se modifica SQL antiguo para silenciarlo.

No modelo real, descargas, credenciales, backup/restore, publicación o despliegue en esta entrega. Las pruebas HTTP de partidas iniciales no son E2E de investigación o guardados.

Se detuvo únicamente meridiano-cero-t3-persistence-test-db-1 conservando el volumen, sin tocar la base preexistente. Sin commits, merges ni push.
