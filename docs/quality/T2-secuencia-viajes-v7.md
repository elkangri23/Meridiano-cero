# T2-04: viajes repetidos y contador persistido v7

Fecha: 2026-10-29. Referencia: estándares 7962014ec7031c3694f2378d3983a5e488499239, SPEC-001/002, GUARDADOS y ADR-005. El usuario autorizó commit y continuación: se creó c4a86cd con la entrega verificada v6, sin merge/push. Este avance v7 es posterior y queda sin un nuevo commit.

## Defecto y cambio

El índice seeded contaba marcadores travel: de destinos únicos. Tras repetir ciudades, ese número dejaba de crecer y reutilizaba un retraso como si correspondiera al siguiente viaje. No representaba la historia confirmada.

CaseRun v7 persiste tripCount=0 al iniciar. Cada viaje confirmado toma el contador anterior como índice y lo incrementa una vez, también si termina interrumpido por el plazo. Preview e imposibilidad no reservan índice; otras acciones lo conservan. La exploración puede seguir deduplicando destinos sin decidir la aleatoriedad. No se introducen reloj real, azar de proceso o estado global.

Los contadores inválidos fallan con TRAVEL_SEQUENCE_INVALID operativo, sin transición. La capacidad del próximo viaje se comprueba tanto en preview como en confirmación. Un contador agotado no invalida las demás acciones o cierre válidos. No se devuelve una huella de estado reinterpretada ni se cobra por un preview.

Se añade campo al estado y cambia la semántica de visitas repetidas: engineVersion=7. No se modifica CaseDefinition, algoritmo seeded, seed, hash, distribución ni los costes base. API persiste el contador inicial nuevo y reconoce inicios v1–v6 mediante igualdad completa con su forma histórica sin tripCount, sin escribir. Progreso antiguo se conserva y rechaza; no se deduce historial desde descubrimientos.

## Escenarios

Con semilla sintética 86 y cuatro viajes Madrid–París–Madrid–París–Madrid, retrasos [0,0,15,0], total 735 minutos, tripCount=4 y solo dos destinos descubiertos. Antes el índice quedaba en dos y repetía el tercer retraso. Serializar después del segundo viaje produce la misma continuación, eventos y ordinales que no interrumpirla.

También se prueban previews repetidos sin reserva/sorteo visible, reintento con mismo input reproducible, ruta imposible, conversación sin avance de contador, interrupción por plazo sin llegada, contador ausente/negativo/fraccionario/inseguro y agotamiento conservando cierre válido. Los extremos numéricos usan estados de unidad controlados, no rutas reales del caso. Serializar es una prueba del motor, no reinicio de guardados PostgreSQL.

- pnpm test: 396 pruebas correctas en 27 archivos. Doce regresiones adicionales respecto al checkpoint v6: once de secuencia/capacidad de viajes y una de rechazo de progreso v6. Las dos rutas individuales y agrupadas conservan tiempos y desenlace.
- pnpm lint e imports globales correctos; cero infracciones en 135 módulos y 346 relaciones analizadas. Complejidad máxima diez y motor puro conservados.
- pnpm typecheck y pnpm build completos correctos; tras cerrar el borde de capacidad se repiten suite general, tipos y build de API/dependencias, todos correctos.
- pnpm test:integration: 38 pruebas correctas, cuatro archivos, PostgreSQL/HTTP real aislado en 15434. Comprueba contador inicial v7 y lectura de inicios v1–v6 sin escribir; preservación/rechazo de progreso antiguo. No acredita guardado/reanudación de viajes por API, aún sin implementar.
- Smoke real web/TSX/proxy API correcto y escaneo por patrones sin hallazgos. Sin E2E de investigación ni auditoría exhaustiva de secretos.
- scripts/verify_docs.py: 83 Markdown, enlaces/IDs/grafo válidos y hashes originales DOCX intactos. Integridad documental, no certificación de producto o ASVS.

Se detuvo solo meridiano-cero-t3-persistence-test-db-1 conservando volumen y base preexistente. El nuevo código/documentación v7 no se incluyen en c4a86cd: quedan como cambios posteriores sin otro commit, merge o push.

## Límites

No se cierra T2 ni T3. No se implementan aquí lotes de viajes/intervenciones/cierre/comunicaciones ni simulación con el máximo documental de retraso por tramo. Se conserva la función de retrasos anterior; esta corrección no se presenta como prueba de todos sus extremos/distribución. Reglas/vocabularios generales, acciones HTTP, guardados, resultado oficial, UI conectada y E2E siguen pendientes.

Tampoco se normalizan los diez archivos de formato histórico, ni SQL/checksums antiguos, originales Word, credenciales o WSL. No proveedor real, modelo descargado, backup/restore o despliegue. La aceptación no se deriva solo de la suite ni se afirma cumplimiento OWASP completo.
