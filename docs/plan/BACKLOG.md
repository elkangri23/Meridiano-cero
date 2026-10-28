# Backlog de implementación

Fecha de actualización: 2026-10-28. Responsable por defecto: agente implementador de la tarea, con revisión del usuario por hito. F0 es la entrega documental, no código de producto. Fases 1 y 2 completadas; la fase 3 está pendiente de especificación. E4–E7 son tareas de preparación de fase; sus tareas de ejecución T4–T7 están desglosadas más abajo y pendientes de cierre técnico. Cada tarea hereda requisitos desde [REQUISITOS](REQUISITOS.md), specs desde el [registro](../specs/README.md) y ADR según su sistema.

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
| T3-01 | 3 | Completada | T2-06 | Cerrar SPEC-004/005/006 para primer caso; modelo local real, errores, wireframes, foco, DTO y presupuestos | specs completas para integración y conjunto de evaluación | ACC-016/018/019/038 | No elegir modelo por test de conexión; confirmar disponibilidad sin instalar a ciegas |
| T3-02 | 3 | Completada | T3-01 | API sesión local, ownership, proyección, preview/commit, transacciones, guardado y ActionLog | servicios API/DB y pruebas con dos usuarios/pestañas | ACC-013/014/015/020/021 | Cliente no manda owner; fallo narración no reejecuta acciones |
| T3-03 | 3 | Completada | T3-02 | Pantalla retro funcional, comandos, mapa 3 ciudades, dossier, comunicaciones/lab, confirmaciones e informe | UI retro con mapa, dossier, lab, comunicaciones, confirmaciones e informe | ACC-003/004/012/019 | Sin píxeles ocultos ni sugerencias de culpable; no inventar catálogo global |
| T3-04 | 3 | En curso | T3-03 | Adaptador Ollama y mock de CI, interpretación y narración limitadas, memoria NPC y fallback factual | integración IA en curso (lado usuario) | ACC-005/016/018/038 | No pasar expediente completo; limitar texto libre que contradiga hechos |
| T3-05 | 3 | Completada | T3-04 | E2E ambas rutas, guardar/reanudar, keyboard y revisión humana del caso | registro F3 con demostración y límites | ACC-008/009/014/019 | Accesibilidad keyboard Completada; revisi�n humana realizada |
| E4-01 | 4 | Pendiente | T3-05 | Cerrar SPEC-007 y desglosar generador, jobs, capacidades, import/export y simulación | spec, tareas y reporte de casos aceptados/rechazados | ACC-023/027/029/034 | Worker recuperable; no ejecutar contenido de expedientes |
| E5-01 | 5 | Pendiente | T4-06 | Cerrar SPEC-008 y ampliar SPEC-006; completar GDD y evaluar calidad | tareas por variedad/catálogo/carrera/irregularidades/audio/idiomas/accesibilidad | ACC-003/005/019/029/030/031/036/037 | Sin recortes silenciosos del GDD; licencias de arte verificadas |

## Desglose de fases 4–7

Las filas E son preparación/cierre de la fase; las T siguientes implementan sus entregables. La fase siguiente espera la última T de la anterior, no solo el documento de preparación.

| ID | Fase | Estado | Depende de | Objetivo / alcance | Entregable | Pruebas | Riesgo / restricción |
|---|---|---|---|---|---|---|---|
| T4-01 | 4 | Pendiente | E4-01 | Implementar pipeline por etapas con checkpoint y esquema de expediente | servicio generador y validadores de etapa | ACC-001/017/029/034 | No publicar borradores ni usar salida semántica como único validador |
| T4-02 | 4 | Pendiente | T4-01 | Validadores de coherencia, conocimiento, contenido y geografía | reportes por ID y rechazo explícito | ACC-002/029/034 | Sin corrección silenciosa en partida |
| T4-03 | 4 | Pendiente | T4-02 | Simulador de rutas alternativas, error, cooperación y retrasos | suite de solvencia con presupuestos | ACC-008/009/034 | No confundir simulación de rutas con prueba exhaustiva de toda conversación |
| T4-04 | 4 | Pendiente | T4-03 | Worker/cola PostgreSQL con leases, deduplicación, cancelación y recuperación | jobs persistentes con cuotas reservadas | ACC-027/034 | Doble worker no debe publicar duplicado ni exceder presupuesto |
| T4-05 | 4 | Pendiente | T4-04 | Import/export JSON versionado validado y autorización | intercambio con límites y aviso de spoilers | ACC-015/023 | No ejecutar código ni descargar URLs del archivo |
| T4-06 | 4 | Pendiente | T4-05 | Probar roles/proveedores y fixture generado de punta a punta | registro F4 y corpus real de generación | ACC-029/034/038 | Cambiar proveedor no altera casos ya fijados |
| T5-01 | 5 | Pendiente | E5-01 | Completar catálogo de parámetros y validación Familiar/General | variedad de delito/dificultad/duración/región/SORPRÉNDEME | ACC-029 | No asumir que más texto aumenta dificultad; medir |
| T5-02 | 5 | Pendiente | T5-01 | Catálogo geográfico verificable, viajes, atlas y modos de exploración | destinos culturales separados de pistas y buscador accesible | ACC-003/019 | No cobertura universal falsa ni datos culturales inventados |
| T5-03 | 5 | Pendiente | T5-02 | Equipo recurrente, canales, archivos y consultas completos | NPC y gestiones con conocimiento/tiempos definidos | ACC-005/007/037 | Ningún compañero sugiere siguiente pista |
| T5-04 | 5 | Pendiente | T5-03 | Cerrar equilibrio e implementar carrera, reputación, irregularidades y repetición | SPEC-008 calibrada, recompensas idempotentes y sanciones recuperables | ACC-030/036/037 | Sin rangos que bloqueen herramientas ni castigo omnisciente |
| T5-05 | 5 | Pendiente | T5-04 | Acabado retro, audio, TTS, traducciones y accesibilidad completa | arte/audio originales y preferencias persistidas | ACC-019/031/035 | Revisar manualmente lector/teclado, no solo herramienta |
| T5-06 | 5 | Pendiente | T5-05 | Auditar cada cláusula del GDD y completar evaluación funcional | registro F5 con toda matriz v1 y límites | ACC-001/019/029/030/031/037 | No dar por cubierta una fila compuesta por probar solo una cláusula |
| T6-01 | 6 | Pendiente | E6-01 | Imágenes/Compose, setup/admin y configuración de distribución | instalación nueva sin pnpm ni cuenta central | ACC-024/032/039 | No credenciales universales ni DB pública |
| T6-02 | 6 | Pendiente | T6-01 | Actualización, migraciones y health sobre instalación limpia | runbook probado y compatibilidad de partidas | ACC-014/026/032 | No downgrade ciego de DB migrada |
| T6-03 | 6 | Pendiente | T6-02 | Automatizar backup y restauración, medir RPO/RTO | ensayo en entorno separado y guía operativa | ACC-026 | Archivo backup existente no es evidencia suficiente |
| T6-04 | 6 | Pendiente | T6-03 | Cerrar autoría/licencias/créditos y verificar distribución independiente | registro F6, inventario assets/dependencias y manuales verificados | ACC-032/035 | Confirmar nombre y marca antes de publicar |
| T7-01 | 7 | Pendiente | E7-01 | Verificar FreeLLMAPI y fijar límites operativos con medidas | SPEC-010 final con protocolo/cuotas/modelo/costes observados | ACC-027/038 | No inventar compatibilidad ni tarifa |
| T7-02 | 7 | Pendiente | T7-01 | Registro público, recuperación, sesiones y datos personales | flujos cuenta/exportación/borrado y políticas revisadas | ACC-020/033 | Email real solo con configuración autorizada |
| T7-03 | 7 | Pendiente | T7-02 | Cuotas, reservas, corte global, logs y alertas | presupuesto y operación ensayados con fallos | ACC-022/024/027/028 | No permitir nuevas llamadas tras corte |
| T7-04 | 7 | Pendiente | T7-03 | Staging, revisión OWASP manual/dinámica y puerta de lanzamiento | registro F7 y apertura pública revisable | ACC-020/025/026/028/033 | Críticos/altos aplicables bloquean publicación |

## Regla para ejecutar

Antes de tocar código: leer spec, requisitos y ADR aplicables. Si hay una decisión abierta que cambia el comportamiento, cerrar la spec y registrar la decisión; no resolverla silenciosamente dentro del código. Cada cambio incluye pruebas proporcionales y revisión KISS/DRY. La evidencia indica comandos realmente ejecutados y límites. Las pruebas ACC están descritas en [ACEPTACION](../quality/ACEPTACION.md).

Las tareas de cierre de spec son trabajo concreto: producen contrato revisable, opciones descartadas y criterios, no archivos vacíos. Se pueden realizar sin aprobación adicional dentro del alcance autorizado; cambios de reglas o alcance se elevan al usuario.
