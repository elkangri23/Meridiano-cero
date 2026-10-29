# Backlog de implementación

Fecha de actualización: 2026-10-28. Responsable por defecto: agente implementador de la tarea, con revisión del usuario por hito. F0 es la entrega documental, no código de producto. T1-01 a T1-04 tienen entrega técnica de base incorporada desde main, con evidencia histórica F1; la integración actual conserva esos módulos y distingue controles globales pendientes. T2 figura completada en el registro de origen, con bloqueos globales explícitos. T3-01/T3-03/T3-04 están en curso; T3-02 tiene sesión de base pero espera API de partidas; T3-05 espera E2E/modelo real. [Estado consolidado de este worktree](ESTADO.md). E4–E7 son tareas de preparación de fase; sus tareas de ejecución T4–T7 están desglosadas más abajo y pendientes de cierre técnico. Cada tarea hereda requisitos desde [REQUISITOS](REQUISITOS.md), specs desde el [registro](../specs/README.md) y ADR según su sistema.

Estados: pendiente → preparada (spec cerrada y dependencias satisfechas) → en curso → en revisión → completada; bloqueada exige causa y desbloqueo. Completar requiere evidencia y criterios, no solo archivos existentes.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T1-01 | 1 | Completada | F0 | Cerrar SPEC-004/009 para base: sesión local loopback, API v1, configuración y migraciones; precisar controles SPEC-011 | docs/specs; contratos de base y lista de versiones soportadas | ACC-020/024/039 | BYPASS local nunca en modo público; sin credenciales universales |
| T1-02 | 1 | Completada | T1-01 | Inicializar Git y workspace pnpm mínimo; web/API, contratos públicos y engine solo cuando consumidos; TS strict y límites de imports | manifiestos, configuración TS/lint, README de arranque | ACC-025/040 | No crear worker ni shared sin uso; no commit/push automáticos |
| T1-03 | 1 | Completada | T1-02 | Compose para PostgreSQL y servicios base; Drizzle, primera migración, configuración validada, health/readiness y datos persistentes | infra/configuración y migraciones probadas desde instalación limpia | ACC-024/039 | DB no pública; secretos fuera de Git; no borrar volúmenes existentes |
| T1-04 | 1 | Completada | T1-03 | CI con tipos/lint/imports/pruebas, lockfile, escaneo secretos/dependencias y evidencia de base | workflow reproducible y registro F1 | ACC-025/040 | No afirmar análisis ejecutado si GitHub aún no existe; ejecutar equivalente local |
| T2-01 | 2 | Completada | T1-04 | Implementar contrato de CaseDefinition/CaseRun/PlayerView y validador; cerrar detalles de SPEC-001/002 sin cambiar reglas | case-schema y tipos públicos separados; pruebas negativas | ACC-001/002/015/017 | Nunca exportar definición secreta al bundle web |
| T2-02 | 2 | Completada | T2-01 | Codificar fixture de SPEC-003, condiciones y acciones; validar referencias y ambas rutas | fixture versionado y reporte determinista | ACC-008/009/017 | Cálculos documentales no sustituyen simulaciones; texto seguro |
| T2-03 | 2 | Completada | T2-02 | Resolver inspect/collect/talk y lotes con pausa/cancelación/reanudación; proveniencia y admisibilidad | engine puro y escenarios de inventario/secuencias | ACC-002/004/005/011 | Sin invención ni cobro por omitidas; no red en engine |
| T2-04 | 2 | Completada | T2-03 | Reloj, viajes seeded, solicitudes paralelas y eventos ordenados; preview y vencimiento | reglas de tiempo y tests de borde | ACC-006/007/017 | Plazo gana empate; no usar reloj de pared en partida |
| T2-05 | 2 | Completada | T2-04 | Órdenes sin oráculo de culpa, detención, recuperación y cierre confirmado/informe | reglas y resultados del caso fijo | ACC-010/012/036 | La detención no cierra; no filtrar verdad antes del informe |
| T2-06 | 2 | Completada | T2-05 | Simular dos rutas independientes, error, parcial, vencimiento y retrasos; demostrar motor sin IA | guiones y registro F2 | ACC-008/009/012/017 | Revisar costes reales frente a SPEC-003; ningún test marcado pasado sin ejecutar |
| T3-01 | 3 | En curso | T2-06 | Cerrar SPEC-004/005/006 para primer caso; modelo real del proveedor disponible, errores, wireframes, foco, DTO y presupuestos | specs completas para integración y conjunto de evaluación | ACC-016/018/019/038 | No elegir modelo por test de conexión; confirmar disponibilidad sin instalar a ciegas |
| T3-02 | 3 | En curso | T3-01 | API sesión local, ownership, proyección, preview/commit, transacciones, guardado y ActionLog | servicios API/DB y pruebas con dos usuarios/pestañas | ACC-013/014/015/020/021 | Cliente no manda owner; fallo narración no reejecuta acciones |
| T3-03 | 3 | En curso | T3-02 | Pantalla retro funcional, comandos, mapa 3 ciudades, dossier, comunicaciones/lab, confirmaciones e informe | UI responsive con teclado/foco y preferencias legibles | ACC-003/004/012/019 | Sin píxeles ocultos ni sugerencias de culpable; no inventar catálogo global |
| T3-04 | 3 | En curso | T3-03 | Contrato independiente del proveedor, adaptadores y mock de CI, interpretación y narración limitadas, memoria NPC y fallback factual | integración IA y registro de evaluación real | ACC-005/016/018/038 | No pasar expediente completo; limitar texto libre que contradiga hechos |
| T3-05 | 3 | Pendiente | T3-04, T3-06, T3-07, T3-08 | E2E ambas rutas, guardar/reanudar, keyboard y revisión humana del caso | registro F3 con demostración y límites | ACC-008/009/014/019 | Accesibilidad completa queda fase 5; no presentar hito como v1 |
| E4-01 | 4 | Pendiente | T3-05 | Cerrar SPEC-007 y desglosar generador, jobs, capacidades, import/export y simulación | spec, tareas y reporte de casos aceptados/rechazados | ACC-023/027/029/034 | Worker recuperable; no ejecutar contenido de expedientes |
| E5-01 | 5 | Pendiente | T4-06 | Cerrar SPEC-008 y ampliar SPEC-006; completar GDD y evaluar calidad | tareas por variedad/catálogo/carrera/irregularidades/audio/idiomas/accesibilidad | ACC-003/005/019/029/030/031/036/037 | Sin recortes silenciosos del GDD; licencias de arte verificadas |
| E6-01 | 6 | Pendiente | T5-06 | Cerrar SPEC-009 distribución; setup/admin, proveedores, migraciones, backup/restore y autoría/licencias | instalación independiente y manual operativo probado | ACC-026/032/035 | No publicar avisos con nombre no confirmado; probar restauración |
| E7-01 | 7 | Pendiente | T6-04 | Cerrar SPEC-010; proveedor público verificado, registro/recuperación, consumo, privacidad, alertas y revisión OWASP | tareas de público y registro de preparación para lanzamiento | ACC-020/022/024/025/027/028/033 | Crítico/alto aplicable bloquea; despliegue no automático |

## Desglose de fases 4–7

Las filas E son preparación/cierre de la fase; las T siguientes implementan sus entregables. La fase siguiente espera la última T de la anterior, no solo el documento de preparación.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T4-01 | 4 | Pendiente | E4-01 | Implementar pipeline por etapas con checkpoint y esquema de expediente | servicio generador y validadores de etapa | ACC-001/017/029/034 | No publicar borradores ni usar salida semántica como único validador |
| T4-02 | 4 | Pendiente | T4-01 | Validadores de coherencia, conocimiento, contenido y geografía | reportes por ID y rechazo explícito | ACC-002/029/034 | Sin corrección silenciosa en partida |
| T4-03 | 4 | Pendiente | T4-02 | Simulador de rutas alternativas, error, cooperación y retrasos | suite de solvencia con presupuestos | ACC-008/009/034 | No confundir simulación de rutas con prueba exhaustiva de toda conversación |
| T4-04 | 4 | Pendiente | T4-03 | Worker/cola PostgreSQL con leases, deduplicación, cancelación y recuperación | jobs persistentes con cuotas reservadas | ACC-027/034 | Doble worker no debe publicar duplicado ni exceder presupuesto |
| T4-05 | 4 | Pendiente | T4-04 | Import/export JSON versionado validado y autorización | intercambio con límites y aviso de spoilers | ACC-015/023 | No ejecutar código ni descargar URLs del archivo |
| T4-06 | 4 | Pendiente | T4-05, T4-07 | Probar roles/proveedores y fixture generado de punta a punta | registro F4 y corpus real de generación | ACC-029/034/038 | Cambiar proveedor no altera casos ya fijados |
| T5-01 | 5 | Pendiente | E5-01 | Completar catálogo de parámetros y validación Familiar/General | variedad de delito/dificultad/duración/región/SORPRÉNDEME | ACC-029 | No asumir que más texto aumenta dificultad; medir |
| T5-02 | 5 | Pendiente | T5-01 | Catálogo geográfico verificable, viajes, atlas y modos de exploración | destinos culturales separados de pistas y buscador accesible | ACC-003/019 | No cobertura universal falsa ni datos culturales inventados |
| T5-03 | 5 | Pendiente | T5-02 | Equipo recurrente, canales, archivos y consultas completos | NPC y gestiones con conocimiento/tiempos definidos | ACC-005/007/037 | Ningún compañero sugiere siguiente pista |
| T5-04 | 5 | Pendiente | T5-03 | Cerrar equilibrio e implementar carrera, reputación, irregularidades y repetición | SPEC-008 calibrada, recompensas idempotentes y sanciones recuperables | ACC-030/036/037 | Sin rangos que bloqueen herramientas ni castigo omnisciente |
| T5-05 | 5 | Pendiente | T5-04 | Acabado retro, audio, TTS, traducciones y accesibilidad completa | arte/audio originales y preferencias persistidas | ACC-019/031/035 | Revisar manualmente lector/teclado, no solo herramienta |
| T5-06 | 5 | Pendiente | T5-05, T5-07 | Auditar cada cláusula del GDD y completar evaluación funcional | registro F5 con toda matriz v1 y límites | ACC-001/019/029/030/031/037 | No dar por cubierta una fila compuesta por probar solo una cláusula |
| T6-01 | 6 | Pendiente | E6-01 | Imágenes/Compose, setup/admin y configuración de distribución | instalación nueva sin pnpm ni cuenta central | ACC-024/032/039 | No credenciales universales ni DB pública |
| T6-02 | 6 | Pendiente | T6-01 | Actualización, migraciones y health sobre instalación limpia | runbook probado y compatibilidad de partidas | ACC-014/026/032 | No downgrade ciego de DB migrada |
| T6-03 | 6 | Pendiente | T6-02 | Automatizar backup y restauración, medir RPO/RTO | ensayo en entorno separado y guía operativa | ACC-026 | Archivo backup existente no es evidencia suficiente |
| T6-04 | 6 | Pendiente | T6-03, T6-05 | Cerrar autoría/licencias/créditos y verificar distribución independiente | registro F6, inventario assets/dependencias y manuales verificados | ACC-032/035 | Confirmar nombre y marca antes de publicar |
| T7-01 | 7 | Pendiente | E7-01 | Verificar FreeLLMAPI y fijar límites operativos con medidas | SPEC-010 final con protocolo/cuotas/modelo/costes observados | ACC-027/038 | No inventar compatibilidad ni tarifa |
| T7-02 | 7 | Pendiente | T7-01 | Registro público, recuperación, sesiones y datos personales | flujos cuenta/exportación/borrado y políticas revisadas | ACC-020/033 | Email real solo con configuración autorizada |
| T7-03 | 7 | Pendiente | T7-02 | Cuotas, reservas, corte global, logs y alertas | presupuesto y operación ensayados con fallos | ACC-022/024/027/028 | No permitir nuevas llamadas tras corte |
| T7-04 | 7 | Pendiente | T7-03, T7-05, T7-06 | Staging, revisión OWASP manual/dinámica y puerta de lanzamiento | registro F7 y apertura pública revisable | ACC-020/025/026/028/033 | Críticos/altos aplicables bloquean publicación |

## Regla para ejecutar

## Refuerzo transversal de bordes, resiliencia y observabilidad

Añadido el 2026-10-28 por petición de desarrollo documental. Todas las tareas siguientes están pendientes: contratos propuestos no equivalen a código autorizado para integración ni a pruebas superadas. Se ejecutan dentro de su fase; no se pospone integridad del primer caso hasta el VPS. Referencias: [hallazgos y escenarios](../quality/BORDES-EJECUCION.md), [resiliencia](../specs/RESILIENCIA.md) y [observabilidad/datos](../specs/OBSERVABILIDAD-Y-DATOS.md). Las tareas existentes conservan su estado; estas puertas complementan su aceptación.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T3-06 | 3 | Pendiente | T3-02 | Recuperación incierta, replays autorizados, retención de claves y concurrencia de guardados/cierre | Contrato de consulta por clave, esquema consolidado y pruebas transaccionales | ACC-013/014/015/021; BOR-001/020 y BOR-088 | Sin informe antiguo en rama activa; no persistir tokens en navegador |
| T3-07 | 3 | Pendiente | T3-03, T3-06 | Estados UI ante fallo, orden de respuestas, logout, teclado y reconexión | Flujo conectado de recuperación sin duplicar intención | ACC-019/020/021; BOR-067/072 | No cola offline ni avance por reloj real |
| T3-08 | 3 | Pendiente | T3-04, T3-06 | Presupuestos y cancelación, cierre/probes acotados, telemetría mínima sanitizada | Política de transporte única y señales operativas locales | ACC-018/024/028/038; BOR-043/056 y BOR-075/082 | Sin collector obligatorio ni fallback de credencial |
| T4-07 | 4 | Pendiente | T4-05, T3-08 | Fencing, terminales, reservas, equidad e importación robusta | Recuperación persistente de jobs y pruebas de carreras | ACC-023/027/034; BOR-057/066 y BOR-089 | No nueva infraestructura sin necesidad; sin publicación doble |
| T5-07 | 5 | Pendiente | T5-05, T3-07 | Propiedades del motor, límites de catálogo/carrera y UI completa | Corpus de bordes funcionales y revisión manual accesible | ACC-006/007/019/030/036/037; BOR-030/042 y BOR-073/074 | No fijar equilibrio ni nuevas reglas silenciosamente |
| T6-05 | 6 | Pendiente | T6-03, T4-07 | Desastre, actualización compatible y recursos agotados | Restore aislado con RPO/RTO medidos y runbook ejecutado | ACC-014/024/026/032; BOR-077/079, BOR-085/090 | Nunca sobre volumen sano ni con IA/correo real por defecto |
| T7-05 | 7 | Pendiente | T7-03, T6-05 | SLO/capacidad, corte global, alertas y observación de la observación | Perfil de carga, paneles y ensayo de incidentes | ACC-022/027/028; BOR-055 y BOR-083/087 | Valores propuestos hasta medir; canales externos requieren configuración |
| T7-06 | 7 | Pendiente | T7-02, T6-05 | Residencia, retención, supresiones y rotación de claves | Inventario por proveedor y ciclo de datos probado | ACC-020/024/033; BOR-049/080/086 | No promesas legales ni residencia inferida |

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
