# T2-04/05: eventos por partida y cierre coherente en motor v2

Fecha: 2026-10-29. Referencia normativa 7962014ec7031c3694f2378d3983a5e488499239; SPEC-001/002/003, ADR-005, BOR-031/032/042 y compatibilidad BOR-024/078. Trabajo en el mismo worktree de continuación, sin commits/push ni integración automática.

## Cambio implementado

Se elimina eventOrdinal mutable de módulo. El estado v2 persiste su propio contador, inicialmente cero; los wrappers de resolve/confirm aplican guardas comunes y asignan los ordinales por operación desde el estado original, sin doble incremento en llamadas internas. Inputs iguales producen outputs iguales entre partidas y después de serializar/reanudar. Los IDs internos de solicitudes son reproducibles por transición y están acotados al ámbito partida/rama; no se usan como identificadores globales de cola.

Las solicitudes se ordenan por vencimiento, sin mutar el array de entrada; los eventos se ordenan por minuto y ordinal. No madura lo situado exactamente en deadline. Cierre por finish/espera/viaje/análisis usa una evaluación compartida de objetivos materializados: partial/complete/incorrect/unresolved no depende del camino de cierre ni de flags achieved prefijados. Un substring de la identidad correcta no la sustituye; recuperar un objeto distinto no completa el objetivo. Esta política todavía cubre el caso fijo y los identificadores conocidos, no un lenguaje de reglas genérico.

Viaje vencido conserva posición y no añade descubrimiento de destino. Confirmar no elude cierre/lote pendiente. El análisis heredado no supera el plazo ni registra efecto terminal al empatar. No se presenta su coste heredado de 30 min como implementación del envío gratuito y resultado +90 de SPEC-003: ese sistema sigue pendiente junto a inspecciones/detención/recuperación.

Se separan las responsabilidades de maduración, confirmación de viaje/análisis y evaluación del informe para mantener funciones nuevas bajo el límite de complejidad. El dispatcher heredado resolveActionInternal sigue fuera del umbral y pendiente de corrección/refactor junto al modelo de acciones; no se desactiva la regla.

## Versionado y datos existentes

EngineVersion pasa a 2, siguiendo ADR-005. No se modifica la definición del caso, su contentVersion, seed ni hash. El estado inicial v2 añade eventOrdinal=0; el registro SQL usa engineVersion del estado real. El formato de definición soportado permanece engineCompatibility=1.

La API compara los estados iniciales v1 mediante un adaptador explícito completo; los muestra sin cambiar su fila ni actualizar versión en segundo plano. V1 con progreso/futuro/desconocido falla cerrado y se conserva. No se ejecutan transiciones v1 en motor v2. Versión/contador inválido lanza EngineStateError sin valores privados; es un fallo operativo, no un impossible narrativo. No hay migración automática de progreso ni importación de snapshots; la compatibilidad completa deberá probarse antes de habilitar esos caminos.

## Pruebas ejecutadas

- Suite general: 207 pruebas correctas, 19 archivos. Veintiuna regresiones nuevas: aislamiento entre partidas, reanudación y ordinales, previews sin reserva, contador inválido/agotado, rechazo v1 en ejecución, siete estados de desenlace, achieved prefijado, límites de viaje, solicitudes antes/exactamente/después del plazo, confirmar tras cierre y análisis interrumpido.
- Integración PostgreSQL/HTTP real: 35 pruebas correctas, cuatro archivos. La prueba añadida verifica almacenamiento v2, lectura de inicio v1 sin reescritura y preservación/rechazo de progreso v1. Se mantienen las pruebas de revocación con barrera, corte TCP tras COMMIT, rollback y saturación anteriores.
- Build y tipos completos correctos. Lint de la política de informe, regresiones y cambios API correcto. En index queda una infracción heredada: resolveActionInternal con complejidad 63. Maduración y confirmación ya no añaden infracciones. Los demás controles globales de calidad de la auditoría no se dan por cerrados. Smoke web/proxy/API correcto, escaneo por patrones sin hallazgos y verificación documental correcta; no equivalen a E2E del caso.

Las pruebas de desenlace usan estados sintéticos controlados; no acreditan las rutas completas ni legitiman insertar conocimiento en el test de aceptación. Los límites de viaje emplean seed=1 para un tramo sin retraso. La semilla 42 del fixture existente sí produce retraso en ese tramo: no se cambia una definición ya usada para fingir la variante base de costes. Definir/verificar variantes de contenido sin sobrescribir la original forma parte de T2-02/06.

Entorno de DB: proyecto meridiano-cero-t3-persistence-test, puerto 15434, volumen propio y perfiles sintéticos; no se modifica la base de 15433 ni WSL. No se ejecutó E2E, proveedor real o backup/restore.

## Pendiente y puerta de avance

AUD-11 queda corregido en su contador global, pero no en el coste de inspección; AUD-13 queda corregido en evaluación al vencer, pero las rutas siguen sin ser una prueba legítima completa. Persisten AUD-12 (suficiencia de orden/acceso), materialización de evidencias/solicitudes, costes reales, posición de llegada normal coherente, contrato de acciones y calidad global. No habilitar acciones HTTP ni cerrar T2/T3 hasta completar esos puntos y probar ACC-008/009 sin inyectar descubrimientos.

## Continuación posterior

La [ejecución v3](T2-evidencias-ordenes-v3.md) añade obtención de evidencias y órdenes seleccionadas; este documento conserva los resultados históricos de v2 y no describe por sí solo la versión actual.
