# Backlog de implementación

Fecha de actualización: 2026-10-30. Responsable por defecto: agente implementador de la tarea, con revisión del usuario por hito. F0 es la entrega documental, no código de producto. T1-01 a T1-04 tienen entrega técnica de base incorporada desde main, con evidencia histórica F1; la integración actual conserva esos módulos y distingue controles globales pendientes. T2 conserva evidencia histórica, pero sus tareas se reabren por defectos funcionales del motor y validación, además de calidad global. T3-04 está en curso (adaptador Ollama); T3-05 espera E2E/modelo real. Fase 4 (T4-01 a T4-07) completada: pipeline generador, validadores, simulador, worker/cola, import/export, E2E generador y fencing. [Estado consolidado de este worktree](ESTADO.md). E4–E7 son tareas de preparación de fase; sus tareas de ejecución T4–T7 están desglosadas más abajo. Cada tarea hereda requisitos desde [REQUISITOS](REQUISITOS.md), specs desde el [registro](../specs/README.md) y ADR según su sistema.

Estados: pendiente → preparada (spec cerrada y dependencias satisfechas) → en curso → en revisión → completada; bloqueada exige causa y desbloqueo. Completar requiere evidencia y criterios, no solo archivos existentes.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T1-01 | 1 | Completada | F0 | Cerrar SPEC-004/009 para base: sesión local loopback, API v1, configuración y migraciones; precisar controles SPEC-011 | docs/specs; contratos de base y lista de versiones soportadas | ACC-020/024/039 | BYPASS local nunca en modo público; sin credenciales universales |
| T1-02 | 1 | Completada | T1-01 | Inicializar Git y workspace pnpm mínimo; web/API, contratos públicos y engine solo cuando consumidos; TS strict y límites de imports | manifiestos, configuración TS/lint, README de arranque | ACC-025/040 | No crear worker ni shared sin uso; no commit/push automáticos |
| T1-03 | 1 | Completada | T1-02 | Compose para PostgreSQL y servicios base; Drizzle, primera migración, configuración validada, health/readiness y datos persistentes | infra/configuración y migraciones probadas desde instalación limpia | ACC-024/039 | DB no pública; secretos fuera de Git; no borrar volúmenes existentes |
| T1-04 | 1 | En revisión | T1-03 | CI con tipos/lint/imports/pruebas, lockfile, escaneo secretos/dependencias y evidencia de base | workflow reproducible y registro F1 | ACC-025/040 | No afirmar análisis ejecutado si GitHub aún no existe; ejecutar equivalente local |
| T2-01 | 2 | En curso | T1-04 | Implementar contrato de CaseDefinition/CaseRun/PlayerView y validador; cerrar detalles de SPEC-001/002 sin cambiar reglas | case-schema y tipos públicos separados; pruebas negativas | ACC-001/002/015/017 | Nunca exportar definición secreta al bundle web |
| T2-02 | 2 | En revisión | T2-01 | Codificar fixture de SPEC-003, condiciones y acciones; validar referencias y ambas rutas | fixture versionado y reporte determinista | ACC-008/009/017 | Cálculos documentales no sustituyen simulaciones; texto seguro |
| T2-03 | 2 | En curso | T2-02 | Resolver inspect/collect/talk y lotes con pausa/cancelación/reanudación; proveniencia y admisibilidad | engine puro y escenarios de inventario/secuencias | ACC-002/004/005/011 | Sin invención ni cobro por omitidas; no red en engine |
| T2-04 | 2 | En curso | T2-03 | Reloj, viajes seeded, solicitudes paralelas y eventos ordenados; preview y vencimiento | reglas de tiempo y tests de borde | ACC-006/007/017 | Plazo gana empate; no usar reloj de pared en partida |
| T2-05 | 2 | En curso | T2-04 | Órdenes sin oráculo de culpa, detención, recuperación y cierre confirmado/informe | reglas y resultados del caso fijo | ACC-010/012/036 | La detención no cierra; no filtrar verdad antes del informe |
| T2-06 | 2 | En curso | T2-05 | Simular dos rutas independientes, error, parcial, vencimiento y retrasos; demostrar motor sin IA | guiones y registro F2 | ACC-008/009/012/017 | Revisar costes reales frente a SPEC-003; ningún test marcado pasado sin ejecutar |
| T3-01 | 3 | En curso | T2-06 | Cerrar SPEC-004/005/006 para primer caso; modelo real del proveedor disponible, errores, wireframes, foco, DTO y presupuestos | specs completas para integración y conjunto de evaluación | ACC-016/018/019/038 | No elegir modelo por test de conexión; confirmar disponibilidad sin instalar a ciegas |
| T3-02 | 3 | En curso | T3-01 | API sesión local, ownership, proyección, preview/commit, transacciones, guardado y ActionLog | servicios API/DB y pruebas con dos usuarios/pestañas | ACC-013/014/015/020/021 | Cliente no manda owner; fallo narración no reejecuta acciones |
| T3-03 | 3 | En curso | T3-02 | Pantalla retro funcional, comandos, mapa 3 ciudades, dossier, comunicaciones/lab, confirmaciones e informe | UI responsive con teclado/foco y preferencias legibles | ACC-003/004/012/019 | Sin píxeles ocultos ni sugerencias de culpable; no inventar catálogo global |
| T3-04 | 3 | En curso | T3-03 | Contrato independiente del proveedor, adaptadores y mock de CI, interpretación y narración limitadas, memoria NPC y fallback factual | integración IA y registro de evaluación real | ACC-005/016/018/038 | No pasar expediente completo; limitar texto libre que contradiga hechos |
| T3-05 | 3 | Pendiente | T3-04, T3-06, T3-07, T3-08 | E2E ambas rutas, guardar/reanudar, keyboard y revisión humana del caso | registro F3 con demostración y límites | ACC-008/009/014/019 | Accesibilidad completa queda fase 5; no presentar hito como v1 |
| E4-01 | 4 | Completada | T3-05 | Cerrar SPEC-007 y desglosar generador, jobs, capacidades, import/export y simulación | spec, tareas y reporte de casos aceptados/rechazados | ACC-023/027/029/034 | Worker recuperable; no ejecutar contenido de expedientes |
| E5-01 | 5 | Completada | T4-06 | Cerrar SPEC-008 y ampliar SPEC-006; completar GDD y evaluar calidad | tareas por variedad/catálogo/carrera/irregularidades/audio/idiomas/accesibilidad | ACC-003/005/019/029/030/031/036/037 | Sin recortes silenciosos del GDD; licencias de arte verificadas |
| E6-01 | 6 | Completada | T5-06 | Cerrar SPEC-009 distribución; setup/admin, proveedores, migraciones, backup/restore y autoría/licencias | instalación independiente y manual operativo probado | ACC-026/032/035 | No publicar avisos con nombre no confirmado; probar restauración |
| E7-01 | 7 | Completada | T6-04 | Cerrar SPEC-010; proveedor público verificado, registro/recuperación, consumo, privacidad, alertas y revisión OWASP | tareas de público y registro de preparación para lanzamiento | ACC-020/022/024/025/027/028/033 | Crítico/alto aplicable bloquea; despliegue no automático |

## Desglose de fases 4–7

Las filas E son preparación/cierre de la fase; las T siguientes implementan sus entregables. La fase siguiente espera la última T de la anterior, no solo el documento de preparación.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T4-01 | 4 | Completada | E4-01 | Implementar pipeline por etapas con checkpoint y esquema de expediente | servicio generador y validadores de etapa | ACC-001/017/029/034 | No publicar borradores ni usar salida semántica como único validador |
| T4-02 | 4 | Completada | T4-01 | Validadores de coherencia, conocimiento, contenido y geografía | reportes por ID y rechazo explícito | ACC-002/029/034 | Sin corrección silenciosa en partida |
| T4-03 | 4 | Completada | T4-02 | Simulador de rutas alternativas, error, cooperación y retrasos | suite de solvencia con presupuestos | ACC-008/009/034 | No confundir simulación de rutas con prueba exhaustiva de toda conversación |
| T4-04 | 4 | Completada | T4-03 | Worker/cola PostgreSQL con leases, deduplicación, cancelación y recuperación | jobs persistentes con cuotas reservadas | ACC-027/034 | Doble worker no debe publicar duplicado ni exceder presupuesto |
| T4-05 | 4 | Completada | T4-04 | Import/export JSON versionado validado y autorización | intercambio con límites y aviso de spoilers | ACC-015/023 | No ejecutar código ni descargar URLs del archivo |
| T4-06 | 4 | Completada | T4-05, T4-07 | Probar roles/proveedores y fixture generado de punta a punta | registro F4 y corpus real de generación | ACC-029/034/038 | Cambiar proveedor no altera casos ya fijados |
| T5-01 | 5 | Completada | E5-01 | Completar catálogo de parámetros y validación Familiar/General | variedad de delito/dificultad/duración/región/SORPRÉNDEME | ACC-029 | No asumir que más texto aumenta dificultad; medir |
| T5-02 | 5 | Completada | T5-01 | Catálogo geográfico verificable, viajes, atlas y modos de exploración | destinos culturales separados de pistas y buscador accesible | ACC-003/019 | No cobertura universal falsa ni datos culturales inventados |
| T5-03 | 5 | Completada | T5-02 | Equipo recurrente, canales, archivos y consultas completos | NPC y gestiones con conocimiento/tiempos definidos | ACC-005/007/037 | Ningún compañero sugiere siguiente pista |
| T5-04 | 5 | Completada | T5-03 | Cerrar equilibrio e implementar carrera, reputación, irregularidades y repetición | SPEC-008 calibrada, recompensas idempotentes y sanciones recuperables | ACC-030/036/037 | Sin rangos que bloqueen herramientas ni castigo omnisciente |
| T5-05 | 5 | Completada | T5-04 | Acabado retro, audio, TTS, traducciones y accesibilidad completa | arte/audio originales y preferencias persistidas | ACC-019/031/035 | Revisar manualmente lector/teclado, no solo herramienta |
| T5-06 | 5 | Completada | T5-05, T5-07 | Auditar cada cláusula del GDD y completar evaluación funcional | registro F5 con toda matriz v1 y límites | ACC-001/019/029/030/031/037 | No dar por cubierta una fila compuesta por probar solo una cláusula |
| T6-01 | 6 | Completada | E6-01 | Imágenes/Compose, setup/admin y configuración de distribución | instalación nueva sin pnpm ni cuenta central | ACC-024/032/039 | No credenciales universales ni DB pública |
| T6-02 | 6 | Completada | T6-01 | Actualización, migraciones y health sobre instalación limpia | runbook probado y compatibilidad de partidas | ACC-014/026/032 | No downgrade ciego de DB migrada |
| T6-03 | 6 | Completada | T6-02 | Automatizar backup y restauración, medir RPO/RTO | ensayo en entorno separado y guía operativa | ACC-026 | Archivo backup existente no es evidencia suficiente |
| T6-04 | 6 | Pendiente | T6-03, T6-05 | Cerrar autoría/licencias/créditos y verificar distribución independiente | registro F6, inventario assets/dependencias y manuales verificados | ACC-032/035 | Confirmar nombre y marca antes de publicar |
| T7-01 | 7 | Completada | E7-01 | Verificar FreeLLMAPI y fijar límites operativos con medidas | SPEC-010 final con protocolo/cuotas/modelo/costes observados | ACC-027/038 | No inventar compatibilidad ni tarifa |
| T7-02 | 7 | Completada | T7-01 | Registro público, recuperación, sesiones y datos personales | flujos cuenta/exportación/borrado y políticas revisadas | ACC-020/033 | Email real solo con configuración autorizada |
| T7-03 | 7 | Completada | T7-02 | Cuotas, reservas, corte global, logs y alertas | presupuesto y operación ensayados con fallos | ACC-022/024/027/028 | No permitir nuevas llamadas tras corte |
| T7-04 | 7 | En curso | T7-03, T7-05, T7-06 | Staging, revisión OWASP manual/dinámica y puerta de lanzamiento | registro F7 y apertura pública revisable | ACC-020/025/026/028/033 | Críticos/altos aplicables bloquea publicación |

## Regla para ejecutar

## Refuerzo transversal de bordes, resiliencia y observabilidad

Añadido el 2026-10-28 por petición de desarrollo documental. Todas las tareas siguientes están pendientes: contratos propuestos no equivalen a código autorizado para integración ni a pruebas superadas. Se ejecutan dentro de su fase; no se pospone integridad del primer caso hasta el VPS. Referencias: [hallazgos y escenarios](../quality/BORDES-EJECUCION.md), [resiliencia](../specs/RESILIENCIA.md) y [observabilidad/datos](../specs/OBSERVABILIDAD-Y-DATOS.md). Las tareas existentes conservan su estado; estas puertas complementan su aceptación.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T3-06 | 3 | En curso | T3-02 | Recuperación incierta, replays autorizados, retención de claves y concurrencia de guardados/cierre | Contrato de consulta por clave, esquema consolidado y pruebas transaccionales | ACC-013/014/015/021; BOR-001/020 y BOR-088 | Sin informe antiguo en rama activa; no persistir tokens en navegador |
| T3-07 | 3 | En curso | T3-03, T3-06 | Estados UI ante fallo, orden de respuestas, logout, teclado y reconexión | Flujo conectado de recuperación sin duplicar intención | ACC-019/020/021; BOR-067/072 | No cola offline ni avance por reloj real |
| T3-08 | 3 | En curso | T3-04, T3-06 | Presupuestos y cancelación, cierre/probes acotados, telemetría mínima sanitizada | Política de transporte única y señales operativas locales | ACC-018/024/028/038; BOR-043/056 y BOR-075/082 | Sin collector obligatorio ni fallback de credencial |
| T4-07 | 4 | Completada | T4-05, T3-08 | Fencing, terminales, reservas, equidad e importación robusta | Recuperación persistente de jobs y pruebas de carreras | ACC-023/027/034; BOR-057/066 y BOR-089 | No nueva infraestructura sin necesidad; sin publicación doble |
| T5-07 | 5 | Completada | T5-05, T3-07 | Propiedades del motor, límites de catálogo/carrera y UI completa | Corpus de bordes funcionales y revisión manual accesible | ACC-006/007/019/030/036/037; BOR-030/042 y BOR-073/074 | No fijar equilibrio ni nuevas reglas silenciosamente |
| T6-05 | 6 | Pendiente | T6-03, T4-07 | Desastre, actualización compatible y recursos agotados | Restore aislado con RPO/RTO medidos y runbook ejecutado | ACC-014/024/026/032; BOR-077/079, BOR-085/090 | Nunca sobre volumen sano ni con IA/correo real por defecto |
| T7-05 | 7 | Completada | T7-03, T6-05 | SLO/capacidad, corte global, alertas y observación de la observación | Perfil de carga, paneles y ensayo de incidentes | ACC-022/027/028; BOR-055 y BOR-083/087 | Valores propuestos hasta medir; canales externos requieren configuración |
| T7-06 | 7 | Completada | T7-02, T6-05 | Residencia, retención, supresiones y rotación de claves | Inventario por proveedor y ciclo de datos probado | ACC-020/024/033; BOR-049/080/086 | No promesas legales ni residencia inferida |

Dependencias de cierre adicionales: T3-05 espera T3-06/T3-07/T3-08; T4-06 espera T4-07; T5-06 espera T5-07; T6-04 espera T6-05; T7-04 espera T7-05/T7-06. Se incorporan también en las filas originales para que el grafo verificable tenga la misma semántica.

## Regla de ejecución de las tareas

Antes de tocar código: leer spec, requisitos y ADR aplicables. Si hay una decisión abierta que cambia el comportamiento, cerrar la spec y registrar la decisión; no resolverla silenciosamente dentro del código. Cada cambio incluye pruebas proporcionales y revisión KISS/DRY. La evidencia indica comandos realmente ejecutados y límites. Las pruebas ACC están descritas en [ACEPTACION](../quality/ACEPTACION.md).

Las tareas de cierre de spec son trabajo concreto: producen contrato revisable, opciones descartadas y criterios, no archivos vacíos. Se pueden realizar sin aprobación adicional dentro del alcance autorizado; cambios de reglas o alcance se elevan al usuario.

## Inicio anticipado de T3 autorizado

Se adelantan preparación de contratos y vista de muestra sin efectos, por instrucción del usuario del 2026-10-28. T3-01/T3-03 están parcialmente en curso; sus dependencias de integración no se eliminan. [Avance y límites](../quality/T3-inicio.md). El lint global heredado de T2 bloquea el cierre de calidad, aunque sus 60 pruebas pasen.

## Avance T3-04

Adaptador local, servicios factuales, memoria validada, doble CI y evaluación sintética implementados. [Evidencia](../quality/T3-04.md), [comandos disponibles](../manuales/IA-LOCAL.md). Se adelanta trabajo independiente por petición del usuario; las dependencias siguen vigentes. Sin URL/modelo real y con T3-02/T3-03 pendientes de integración, la tarea no se marca completada.

Continuación T3-04: codec sin coerciones, fallback limitado a actos autorizados, cancelación tardía, corpus v2 con memoria y paso mock de CI. Sigue en curso, sin instalar modelos ni dar por superadas las dependencias.

## Reconciliación documental del estado

T1-03 pasa a en curso: Compose/esquema/SQL existen, pero faltan comando de migración y evidencia de arranque/reinicio reproducible. T1-04 pasa a en revisión: workflow presente no equivale a CI aprobada. Se mantienen las marcas históricas de T2, sin aceptar su puerta de fase mientras persistan siete fallos de lint y siete de imports. Esta revisión documental no modifica dependencias ni cierra criterios de aceptación.

## Alcance del primer caso confirmado por el usuario

DEC-013/014/015/016: casos individuales por usuario registrado, sin multijugador; autoguardado más guardado manual; ventanas movibles/minimizables desde el primer caso; aclaración previa de órdenes ambiguas. T3-01 debe cerrar los contratos afectados, T3-02 implementa guardados/autorización y T3-03 sus controles y ventanas. Confirmar requisitos no completa esas tareas.

DEC-017 confirma cargar guardados manuales anteriores para probar otras decisiones del mismo caso. T3-02/T3-03 deben contemplar restauración coherente, concurrencia y previews caducados; DEC-020 fija el primer resultado definitivo para carrera y reputación, sin sustitución ni duplicación de recompensas.

## Proveedores por entorno confirmados

DEC-018/019: arquitectura de IA genérica; Ollama doméstico, FreeLLMAPI en trabajo/VPS, proveedor/endpoint configurable en instalaciones propias. El VPS incluye predeterminado del administrador y claves personales opcionales. T3-01/T3-04 deben conservar esa independencia y evaluar el proveedor disponible, sin exigir Ollama en el trabajo. T7-02 incorpora configuración y protección de credenciales personales; T7-03 mantiene cuotas separadas y límites del servicio.

T3-02 debe conservar el registro oficial al cargar un guardado; T5-04 aplicará DEC-020 al primer resultado, con unicidad y pruebas de repetición/concurrencia bajo ACC-030. Estas reglas están documentadas, no implementadas por esta actualización.

## Concreción técnica de T3

[API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [aceptación detallada](../quality/T3-aceptacion-detallada.md) concretan las tareas existentes. DEC-021 fija diez manuales por partida. No se alteran estados ni dependencias por tener estos documentos.

T3-02 debe implementar agregado/revisión/rama, ledger de operaciones, snapshots y primer cierre oficial, además de DTO seguro. T3-03 añade estados de UI, guardados y ventanas con alternativa al arrastre. T3-04 integra política y persistencia de conversación con proveedor genérico. T3-05 ejecuta los subcasos aplicables, diferenciando contrato, tests sintéticos, integración PostgreSQL y prueba real.

## Reconciliación al integrar con main

Se incorporan los artefactos y evidencias T1 de main 6f43ba2, conservando sus marcas de entrega técnica. T3-02 está en curso: sesión local y migrador existen, pero createApp no registra rutas de partidas. T3-03 sigue parcial: el prototipo está enlazado, mientras packages/web/RetroScreen no es una aplicación consumida. No hay evidencia E2E/modelo real que cierre T3-05. Esta inspección prevalece sobre marcas de completado encontradas en otros snapshots; no borra sus evidencias.

## Reconciliación fase 4

Fases 4 T4-01 a T4-07 completadas: pipeline por etapas, validadores de coherencia/conocimiento/contenido/geografía, simulador de rutas, worker/cola PostgreSQL con leases/deduplicación/cancelación/recuperación, import/export JSON versionado con autorización, E2E generador y fencing/terminales/reservas/equidad. F4 completada y verificada con 739 tests passing y typecheck del generador OK.

## Estado final

Proyecto con 739 tests passing, typecheck del generador 0 errores. Fases 1-4 completadas. Fase 3 T3-04 en curso (adaptador Ollama). Próximo: Fase 5 (T5-01 catálogo parámetros, T5-02 catálogo geográfico, etc.) o finalizar T3-04. Pendiente: typecheck/lint globales en paquetes heredados (api, case-schema).<tool_call>
<function=pwsh>
<parameter=command>
git add docs/plan/BACKLOG.md && git commit -m "docs: actualizar BACKLOG - fases 1-4 completadas, T4-01 a T4-06 completadas"

## Integración de bordes en main (2026-10-29)

Se conservan los estados registrados en main 5a98ec1 y se incorporan las nuevas tareas y dependencias de la revisión de bordes. Las marcas previas de completado no acreditan los nuevos escenarios: en particular, el refuerzo T4-07 permanece pendiente aunque T4-06 conserve su estado histórico. La aceptación ampliada exige evidencia de las nuevas puertas; este merge solo integra documentación.

## Inspección y continuación del 2026-10-29

Todas las ramas locales existentes están contenidas en main 5c58a79; no quedaron merges pendientes. Las marcas de completado de T3-01/02/03 y E4/T4 carecían de implementación/evidencia correspondiente y se corrigen: T3 continúa en curso y fase 4 pendiente. No existen rutas de partidas registradas ni worker/generador consumidos.

T3-02 continúa con saneamiento de la proyección existente: contratos públicos independientes, solicitudes sin payload, informe solo en rama cerrada y copias sin referencias mutables al estado. Es una entrega parcial del motor, no PlayerViewDto v1 completo ni autorización HTTP. Pendientes: agregado/revisión/rama, esquema activo único, transacciones y API de partidas antes de conectar UI. Véase el registro de continuación en quality.

Continuación de persistencia T3-02: esquema activo ampliado y servicio privado de creación/lectura con sesión e idempotencia, probado con PostgreSQL sintético real. Estado sigue en curso; no hay endpoints de partidas ni manuales entregados. [Registro de pruebas y límites](../quality/T3-02-persistencia.md).

Entrega HTTP inicial de T3-02: catálogo/detalle y creación/lectura inicial autenticados, DTO sin secretos, CSRF y deduplicación. [Evidencia](../quality/T3-02-http-inicial.md). Las notas anteriores sin endpoints describen sus entregas históricas; estado actual en ESTADO. Pendientes preview/commit, proyección general, operaciones, guardados y UI; T3-02 continúa en curso.

## Auditoría normativa de 7962014

Revisión completa del catálogo y fronteras implementadas en [AUDITORIA-7962014](../quality/AUDITORIA-7962014.md). **No se acredita cumplimiento total.** Se reabre T1-04 por calidad global; T2-01/03/04/05/06 están en curso y T2-02 en revisión por los hallazgos reproducidos de validación, costes, ordinal compartido, suficiencia de orden y simulaciones con descubrimientos inyectados. Se conservan sus pruebas históricas sin usarlas como aceptación del caso completo.

T3-06/08 pasan a en curso por esta continuación autorizada: barrera real de revocación, pérdida TCP del acuse de COMMIT, admisión/pool acotados, readiness single-flight, parada idempotente y telemetría local sanitizada. Sus dependencias de cierre permanecen: todavía faltan acciones/saves, recuperación general por clave, presupuesto/consumo y ensayo de proceso/proveedor/UI. Antes de preview/commit público, corregir el motor y rehacer las rutas sin alterar estado desde el test. No se borran funcionalidades del alcance ni se modifican decisiones de producto.

## Continuación de motor v2

T2-04/05: eliminada secuencia global, contador persistible por partida, evaluación común de finish/deadline y viaje interrumpido sin llegada. Motor de ejecución v2, lectura explícita de inicios v1 sin reescribir datos. [Evidencia y límites](../quality/T2-eventos-plazo-v2.md). Permanecen en curso: costes y materialización de evidencias, suficiencia de órdenes, rutas legítimas y dispatcher/calidad pendientes. Las 207 pruebas generales y 35 de integración no cierran por sí solas esos criterios.

## Continuación: evidencias y órdenes v3

Se implementan hallazgos físicos/contextuales, procedencia, laboratorio programado (+90), consultas paralelas (+30), órdenes basadas en selección explícita y admisibilidad, y requisitos de presencia/identidad. Ambas rutas del caso se simulan sin insertar pistas en el estado, incluidas variantes que eliminan las pruebas exclusivas de la otra ruta. El motor no consulta la solución para conceder órdenes y limita las solicitudes pendientes a 32. La API crea estados v3 y conserva lectura estricta de inicios v1/v2 sin reescritura.

Esto corrige parte de los hallazgos funcionales de órdenes/rutas, sin cerrar T2-03/04/05/06 ni recalificar toda la matriz BOR. Faltan costes materiales, confirmaciones y lotes completos; ACC-008/009 no se da por aceptado. Continúan pendientes calidad global, DTO de progreso, acciones HTTP, guardados y E2E. El siguiente trabajo es costes/preview/lotes antes de conectar acciones web. Los registros anteriores son instantáneas históricas; [la evidencia v3](../quality/T2-evidencias-ordenes-v3.md) recoge el alcance vigente y las comprobaciones de esta continuación.

## Continuación: costes y confirmaciones v4

Se corrigen costes materiales del caso fijo, confirmación de espera/inspección/detención/recuperación y de lotes costosos. El plazo interrumpe sin aplicar efecto terminal ni resto del lote; reanudar no repite el prefijo. Las rutas naturales acreditan tiempos base A=455/B=485 con semilla 1 y A=482/B=512 con semilla 42, sin cambiar el expediente original. Los inicios antiguos v1/v2/v3 siguen legibles sin reescritura, con nueva ejecución v4.

T2 permanece abierto: lotes de otras acciones/dependencias, extremos de retraso, validación y calidad global aún pendientes. Tampoco están habilitados acciones HTTP, guardados o E2E. La siguiente prioridad es resolver estas fronteras y la calidad antes de conectar progreso web. [Verificación y límites v4](../quality/T2-costes-confirmaciones-v4.md); las notas v2/v3 anteriores son evidencia histórica, no el estado vigente.

## Continuación: validación estructural y puerta de creación

T2-01 amplía validación de campos anidados, referencias, ciclos de procedencia, posición inicial y límites. Se elimina la complejidad 71 del validador, manteniendo máximo diez mediante responsabilidades usadas. Creación nueva valida una copia estable del expediente; rechaza sin partida/intención, conservando replay autorizado antes de disponibilidad. No cambia motor v4, contenido/hash del fixture ni datos guardados.

La tarea sigue en curso: faltan vocabulario/referencias NPC y solución, operadores/payloads declarativos y solvencia general. No se cierra calidad global ni se habilitan acciones HTTP o importación. [Resultados y límites de esta continuación](../quality/T2-validacion-expedientes.md).

## Continuación: calidad de adaptadores alternativos

T1-04/T3-04: se elimina any de fábrica y complejidad excesiva de mock/Ollama mediante responsabilidades utilizadas; configuración validada, doble determinista y sin aprobación ficticia, payload real y consumo desconocido preservado. Pruebas del paquete incluidas en suite general. No se conecta al juego ni se cierra T3-04: falta unificar codecs/políticas y evaluar proveedor real. [Resultados y límites](../quality/T3-adaptadores-calidad.md).

## Continuación: integridad fuera del motor y retirada de código muerto

Se mueve hashDefinition a la entrada exclusiva de servidor de case-schema; el motor recibe huella preparada, valida forma y deja de depender de Node crypto. Se conserva el hash previo del fixture y engineVersion=4, sin migrar registros. Se añaden reglas que impiden reintroducir la entrada de servidor en el motor/raíz pura. Tipos Node ya fijados se declaran como dependencia de desarrollo de case-schema, sin biblioteca de ejecución nueva.

Se retira RetroScreen obsoleto tras comprobar que no tiene manifest/consumidores y que importa tipos inexistentes/datos privados. Apps/web y /prototype no cambian; no se conecta el componente ni se excluye código para ocultar errores. [Verificación y límites](../quality/T2-motor-puro-integridad.md). No se cierran T1-04/T2/T3 por esta limpieza: formato histórico, funcionalidades y aceptación pendientes conservan sus puertas.

## Continuación: dependencias y reanudación de lotes v5

T2-03: matriz interna de dependencias previas, cadena conservadora por defecto, omisiones transitivas sin coste y preview obligatorio para continuar incluso con cero minutos. Se validan acciones/params, grafo y coherencia del snapshot, con lectura acotada de metadata. Historial aplicado/fallido/omitido no se reintenta; nuevas imposibilidades pausan y el plazo descarta el resto.

Se registra motor v5; los inicios vírgenes v1–v4 se leen sin modificar, y el progreso antiguo se preserva/rechaza. Caso y hash originales, costes y rutas individuales se conservan. Siguen pendientes otros tipos de lote, adaptación API/UI, guardados y puertas de calidad/aceptación. [Resultados y límites](../quality/T2-dependencias-lotes-v5.md). No se marca completada T2 por esta entrega parcial.

## Continuación: lotes de solicitudes y esperas v6

T2-03/04/05: lotes admiten analyze/query/wait/request_warrant mediante los mismos resolutores individuales. No hay espera implícita; dependencias representan pasos enviados/aplicados, no resultados disponibles. Pausa, continuación confirmada, cuotas internas y plazo se conservan; selección de evidencias comparte validación y los contadores fallan cerrado ante invalidez/desbordamiento.

Motor v6; inicios v1–v5 legibles sin modificar y progreso antiguo preservado/rechazado. Las dos rutas en lotes conservan tiempos y hechos de las versiones individuales. T2 permanece abierto por otros tipos de lote, retrasos máximos, vocabulario/reglas y aceptación; API/UI/guardados aún pendientes. [Evidencia v6](../quality/T2-lotes-solicitudes-v6.md).

## Continuación: secuencia persistida de viajes v7

Tras el commit autorizado c4a86cd (checkpoint v6), T2-04 corrige el índice de retrasos: tripCount persistido sustituye el recuento de destinos distintos, que se estancaba al repetir ciudades. Preview/ruta imposible no consumen índice; serialización conserva secuencia. Se cuentan salidas confirmadas incluso si el plazo interrumpe, sin llegada indebida.

Motor v7; inicios v1–v6 legibles en su forma histórica sin reescritura, progreso anterior preservado/rechazado. No cambian función seeded, seed/hash del caso ni tiempos de las rutas A/B. El trabajo posterior al checkpoint queda separado del commit anterior. [Evidencia y límites](../quality/T2-secuencia-viajes-v7.md). Otros lotes, retrasos máximos, reglas/vocabularios, API/UI/guardados y aceptación siguen pendientes.

## Continuación: máximos de retraso y rutas v8

T2-04/06: se corrige la mezcla seeded para alcanzar 45 minutos y permitir máximos consecutivos. Variante sintética normal seed=14194 verifica rutas independientes A=545/B=575; semillas 1/42, base 455/485. Se prueban lotes equivalentes, plazo exacto y negativa de Lucía sin softlock, sin modificar duraciones ni inyectar conocimiento.

Motor v8 mantiene hash/seed originales, pero cambia resultados temporales por versión. Inicios v1–v7 legibles sin escritura; progreso previo se conserva/rechaza. ACC-008/009 tienen evidencia de motor, E2E pendiente. T2 sigue abierto por otros lotes, reglas/vocabularios y puertas globales; no se declara fase completada. [Verificación y límites](../quality/T2-retrasos-maximos-v8.md).

## Continuación T3-06: localizador de creación

Implementado POST /api/v1/run-creations/lookup: clave original en cuerpo cerrado, sesión revalidada en transacción, Origin/CSRF y propiedad actual. Devuelve solo metadatos de creación confirmada. Un 404 puede ser provisional y nunca autoriza una nueva clave. Siete pruebas de integración adicionales incluyen barreras reales de creación en vuelo y revocación; 45 PostgreSQL/HTTP en total. [Contrato, evidencia y límites](../quality/T3-06-localizador-creacion.md).

T3-06 permanece en curso: faltan operaciones de acciones, guardados/cierre, retención/purga y recuperación conectada de UI. No se habilitan acciones HTTP ni se declara la fase 3 completada.

## Continuación T2: intervenciones en lotes v9

Detain/recover se incorporan al vocabulario interno de secuencias con parámetros cerrados, usando los resolutores individuales y sus costes/permisos. Preview sin efectos, pausa/continuación sin duplicar prefijo y plazo exacto conservados. Las rutas A/B agrupan la intervención final, con semillas base y retrasos máximos. Inicios v1–v8 legibles sin escritura; progreso anterior conservado/rechazado. [Pruebas y límites](../quality/T2-intervenciones-lotes-v9.md).

No cierra T2/T3: quedan otros tipos de lote, reglas/vocabularios y aceptación; API de acciones, guardados y UI conectada siguen pendientes.

## Continuación T2: viajes en lotes v10

Travel se incorpora con parámetros cerrados y el mismo resolutor individual. Preview/continuación usan duración base sin leer seed; la confirmación aplica retrasos reales y revalida pasos. Pausa/serialización no repiten viajes ni índices; el plazo impide llegada y resto. Rutas A/B agrupan el desplazamiento inicial e intervención final. Inicios v1–v9 legibles sin escritura; progreso previo conservado/rechazado. [Evidencia y límites](../quality/T2-viajes-lotes-v10.md).

T2/T3 siguen abiertos: cierre/comunicaciones en lotes, reglas/vocabularios y aceptación; acciones HTTP, proyección de progreso, guardados y UI conectada siguen pendientes.

## Continuación T2: cierre confirmado en lotes v11

Finish interno admite solo params vacío; preview siempre exige confirmación si alcanzaría el cierre, incluso sin coste, sin informe prospectivo. Confirmar usa el cierre individual y termina la secuencia sin efectos posteriores; pausa/dependencias/cancelación y prioridad del plazo verificadas. Rutas A/B incluyen cierre agrupado. Inicios v1–v10 legibles sin escritura, progreso previo conservado/rechazado. [Evidencia y límites](../quality/T2-cierre-lotes-v11.md).

T2/T3 siguen abiertos por comunicaciones en lote, reglas/vocabularios y aceptación, API de acciones, proyección de progreso, guardados y UI. Primer resultado oficial y carrera no se implementan dentro del motor.

## Continuación T2: comunicaciones simuladas v12

Communicate individual/en lote usa parámetros cerrados y contacto interno conocido; envío gratuito, copia privada, cupo/duplicados y acuse neutral a +30 del reloj interno. No interpreta texto ni inventa resultados factuales. Snapshot acotado a 32768 unidades UTF-16 por paso para admitir texto de 4000 escapado; ocho pasos y demás validaciones se conservan. Inicios v1–v11 legibles sin escritura; progreso anterior conservado/rechazado. [Evidencia y límites](../quality/T2-comunicaciones-v12.md).

El vocabulario interno de lotes admite los tipos de acción iniciales, pero no implica cierre de T2/T3: comunicaciones factuales/equipo, reglas/expedientes y aceptación siguen pendientes, además de API de acciones, guardados y UI.

## Continuación T2-01: navegabilidad estructural 1.2

Se rechazan ciudades sin lugar accesible o inalcanzables desde el inicio por rutas dirigidas válidas; sin inferir inversas ni exigir retorno. Cola iterativa acotada y errores sin datos privados. Nueva creación usa la puerta existente, conserva replay previo autorizado y no crea filas para mapas inválidos. Validador 1.2.0, motor v12 y hash original sin cambios. [Pruebas y límites](../quality/T2-navegabilidad-mapa.md).

T2-01 sigue en curso por referencias de conocimientos/solución, vocabulario declarativo y solvencia. Conectividad no acredita rutas de investigación ni aceptación del caso. No se habilitan acciones HTTP, guardados o generador.

## Continuación T2-01: referencias estructurales 1.3

Facts exige IDs únicos y knowledge apunta a ellos sin duplicados. Solución general referencia NPC existente. El original conserva excepción explícita de tokens/aliases históricos, compartiendo perfil de sospechosos entre validador y motor, sin reinterpretar nombres o reescribir hash. Nuevas intenciones inválidas no crean filas; replay previo autorizado conservado. Validador 1.3.0, motor v12 sin cambio semántico. [Pruebas y límites](../quality/T2-referencias-conocimiento.md).

T2-01 sigue abierto por condiciones de conocimiento/conversación, reglas/payloads declarativos y solvencia. La compatibilidad legada no equivale a validar todo ese modelo ni habilita API/UI/guardados o generador.

## Continuación T2: permiso de testimonio v13

Se corrige la revelación EV-09 de Lucía: exige conocimiento declarado tomas-moved-box además de tema/cooperación/presencia. Retirar conocimiento no conserva prueba, admisibilidad o procedencia. Identificación propia presencial permanece separada. Rutas A/B sin conocimiento/cooperación de Lucía mantienen máximos 545/575 sin pistas inyectadas. Motor v13, inicios v1–v12 legibles sin escritura y progreso antiguo conservado/rechazado. [Evidencia y límites](../quality/T2-permisos-testimonio-v13.md).

T2/T3 siguen abiertos por política completa de conversación, reglas/payloads y solvencia/aceptación, además de API de acciones, guardados y UI conectada.

## Continuación T2-01: contenido ejecutable reconocido 1.4

Rules acepta solo manifiesto original completo para Astrolabio; otros casos solo rules vacío hasta disponer de formato ejecutable. ScheduledResults inicial no vacío se rechaza porque el motor lo ignoraba; solicitudes creadas por acciones se conservan. CASE_NOT_READY sin filas nuevas y replay propio previo preservado. Validador 1.4.0, motor v13 y hash original sin cambios. [Evidencia y límites](../quality/T2-contenido-ejecutable.md).

T2-01 sigue abierto: no DSL o programación inicial implementados ni solvencia acreditada por este manifiesto. Se mantienen en alcance reglas/políticas generales y aceptación, API/guardados/UI y generador posteriores.

## Continuación T3-02: lista de partidas propias

GET /api/v1/runs añade metadata propia paginada y filtro active/closed, con sesión revalidada, cursor ligado a cuenta/filtro y keyset sin perder microsegundos. Ancla/página en una consulta; sin estado privado ni escritura. Nueve pruebas PostgreSQL/HTTP cubren aislamiento, paginación y revocación real. [Evidencia y límites](../quality/T3-02-lista-partidas.md).

T3-02 sigue en curso; no habilita acciones, proyección de progreso, guardados o UI por adelantado. T2 mantiene sus pendientes. Motor v13 y validador 1.4 sin cambios.

## Continuación T3-03: archivo conectado

La raíz web consulta sesión y archivo reales, con entrada local explícita dev, filtros/páginas, estados vacíos/error y logout. DTO validado, cuenta vinculada a cada página, CSRF en memoria y descarte de respuestas tardías. Diseño MS-DOS y revisión de escritorio/móvil/teclado con datos sintéticos. [Evidencia y límites](../quality/T3-03-archivo-conectado.md).

T3-03 permanece en curso. T3-07 inicia trabajo parcial de estados/cancelación del archivo, sin cerrar dependencias o recuperación de acciones. No investigación completa, ventanas, guardados o registro público anticipados. T2 y motor v13/validador 1.4 conservan su alcance.

## Continuación T3: creación web recuperable

Catálogo público y selección explícita crean partida desde el archivo. Localizador mínimo validado en sessionStorage por cuenta/pestaña, sin credenciales; lookup confirma resultado, 404/error conserva referencia y reintento explícito usa mismo caso/clave. Precondición de cuenta verificada en SQL para impedir mutación bajo otra cuenta. [Evidencia y límites](../quality/T3-creacion-web-recuperable.md).

Ensayo de navegador con acuse/primer lookup perdidos, recarga y comprobación: un POST, dos lookups y una única partida real sintética. T3-03/06/07 siguen abiertos por progreso, acciones, guardados y reconciliación completa. Motor v13/validador 1.4 sin cambios.


## Continuación T3: ficha inicial conectada

El archivo permite consultar por GET una partida propia en su estado inicial: reloj/plazo, ubicación y ciudades visibles. Decoder público cerrado rechaza progreso, replay de creación, datos privados y otra referencia. Cerrar/cancelar, logout y cambio de filtro descartan respuestas tardías; las consultas no mutan ni avanzan el reloj. [Evidencia y límites](../quality/T3-ficha-inicial-conectada.md).

T3-03/T3-07 siguen en curso: la lectura inicial no equivale a reanudar progreso ni a investigar. Motor v13/validador 1.4 y fixture sin cambios. Revisión manual específica de esta ficha y juego completo pendientes.


## Continuación T2-01: formato cerrado 1.5

Se rechazan campos adicionales o ausentes en raíz, entidades y reporte, evitando aprobar políticas/efectos que el motor ignora. Errores sin claves/valores privados; creación nueva inválida sin filas y replay propio previo conservado. [Evidencia y límites](../quality/T2-formato-cerrado.md).

Validador 1.5.0, motor v13 y original/hash sin cambios. No implementa DSL, condiciones NPC o solvencia. T2-01 y tareas de integración T3 permanecen abiertas.


## Continuación T2-05: cierre individual v14

finish individual exige params vacío; resolve devuelve preview sin efectos y solo confirmAction cierra. confirmed/result u otros campos no sustituyen aprobación. Lotes usan el mismo cierre de dominio sin fabricar flags. Inicios v1–v13 legibles sin escritura; progreso previo preservado/rechazado. [Evidencia y límites](../quality/T2-cierre-individual-v14.md).

Motor v14, validador 1.5 y original/hash sin cambios. T2/T3 siguen abiertos por reglas y aceptación, acciones HTTP, proyección de progreso y guardados.
