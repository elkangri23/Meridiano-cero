# Auditoría de implementación frente a 7962014

Fecha: 2026-10-29. Referencia exacta: 7962014ec7031c3694f2378d3983a5e488499239, «Documenta casos límite, resiliencia y observabilidad». Rama de trabajo: codex/t3-02-proyeccion-publica sobre main 5c58a79; incluye cambios sin commit de las continuaciones anteriores. Sin commits, integración nueva, push o despliegue.

## Resultado

**Cumplimiento parcial; no se acepta todavía el hito del primer caso.** Se revisan las rutas activas y las fronteras de todos los subsistemas presentes, las pruebas generales/de integración y las 90 filas del catálogo. Esto no es una revisión formal de cada camino posible ni certificación OWASP. Una fila verificada se limita a las capacidades entregadas; no acredita funciones futuras. Se conserva cada escenario original sin sustituirlo por una prueba más débil.

| Área | Estado constatado | Límite / trabajo pendiente |
|---|---|---|
| Base y sesión local | Configuración cerrada, cookie/CSRF, errores mínimos y PostgreSQL probados | Registro público, recuperación y credenciales personales no entregados |
| Creación/lectura de partidas | Ownership, misma clave sin duplicar, rollback y lectura durable; barrera de revocación real | Solo estado inicial; acciones, guardados, primer resultado y consulta por clave pendientes |
| Motor / expediente | Reglas y pruebas parciales; límites corregidos en esta revisión | Costes de inspección, ordinal persistido, autorización/evidencias y cierre por plazo requieren corregir el motor |
| IA de apps/api | Contexto factual, codec y corpus sintético; deadline y cupo ante transporte hostil | Sin integración de juego, proveedor real, cuotas, breaker o ledger de consumo |
| ai-adapters alternativo | No consumido por API | No extrapolar garantías: devuelve errores libres, uso desconocido como cero y transporte/políticas diferentes |
| UI | Muestra con estética retro y datos públicos | Sin flujo conectado, ventanas completas, recuperación, IME/E2E ni accesibilidad verificada |
| Generación / carrera / distribución / público | Documentación y preparación | Sin worker/generador activo, diez manuales, resultado oficial, backup/restore ensayado o operación pública |
| Calidad global | Build/tipos y suites descritas abajo | Lint/imports/formato globales siguen bloqueando aceptación; no se bajan umbrales ni se excluye código para fingir verde |

## Hallazgos del contraste y correcciones

| ID | Hallazgo | Acción / estado |
|---|---|---|
| AUD-01 | Watchdog de readiness podía liberar single-flight aunque la consulta siguiera pendiente | Corregido: conservar hasta finalizar trabajo; el watchdog no se presenta como cancelación SQL |
| AUD-02 | Pool tenía timeout pero cola sin límite de cantidad | Corregido: cinco conexiones, hasta 25 esperas, rechazo explícito; 32 solicitudes de producto por instancia, sin cola HTTP adicional |
| AUD-03 | Dos caminos cerraban pool y señales repetidas no compartían cierre | Corregido en código: draining, promesa única, cierre del pool solo en onClose, presupuesto 10 s y salida forzada única; pruebas unitarias, falta ensayo operativo completo de señales |
| AUD-04 | Telemetría no conectada | Parcial: eventos request.completed por allowlist, histogramas/contadores de cardinalidad fija, health/readiness separados y descarte ante backpressure/error; stdout local en servidor, sin collector obligatorio |
| AUD-05 | Un transporte que ignora abort dejaba al llamador colgado | Corregido en adaptador consumible de apps/api: deadline independiente; una llamada en curso por instancia y ninguna cola, cupo retenido hasta terminar trabajo real. No se promete cancelar físicamente un transporte hostil |
| AUD-06 | Motor admitía diez pasos y preview revelaba retraso sorteado | Corregidos límite ocho sin ejecutar prefijo y preview independiente de la semilla; efecto real seeded permanece en confirmación |
| AUD-07 | Semillas negativas/enteros grandes podían producir retrasos fuera de rango; versión futura y entradas null aceptadas | Corregidos módulo normalizado, enteros seguros, versiones soportadas y rechazo básico de null/IDs; validación completa de estructura/referencias sigue pendiente |
| AUD-08 | Inspeccionar/conversar desde otra ciudad era posible | Corregida comprobación de ciudad sin efectos. Quedan visibilidad contextual, posesión, reglas y tiempos completos |
| AUD-09 | createValidationReport afirmaba referencias/rutas/simulación no ejecutadas | Corregido: solo acredita escenario structural; el fixture y sus pruebas no se convierten en validación universal |
| AUD-10 | Corte real de conexión tras COMMIT provocó excepción no manejada de pg | Corregido: listener de cliente adquirido, error normalizado y rechazo de query conservado; recuperación por clave tras corte real probada |
| AUD-11 | Inspección local deja minuto en cero; ordinal global cambia según otra partida | Confirmado mediante ejecución sintética; pendiente T2-03/04/06. No habilitar acciones HTTP |
| AUD-12 | request_warrant programa orden aun cuando canIssueWarrant devuelve false | Confirmado mediante ejecución sintética; pendiente T2-05. Las rutas existentes no ofrecen esta acción |
| AUD-13 | Simulaciones inyectan descubrimientos y no prueban costes documentados; vencimiento usa objetivos de definición | Revisión estática: simulation.test añade location:ines al estado; wait evalúa def.objectives. Reabrir T2-05/06 y comprobar rutas solo mediante acciones legítimas |
| AUD-14 | Calidad pendiente y artefacto UI no consumido | Once errores de lint global, dos aristas engine→crypto (fuente/dist) y 15 archivos históricos con formato pendiente; RetroScreen no tiene consumidor y pide datos privados. No conectarlo a web |
| AUD-15 | Presupuestos futuros todavía sin composición extremo a extremo | API inicial tiene timeouts HTTP de 30 s y transporte IA 30/60 s por función; hoy no se llaman desde HTTP. Propagar y medir un deadline restante coherente antes de conectarlos; no declarar T3-08 cerrado |
| AUD-16 | Readiness cerrada no impedía por sí sola usar el catálogo/servicio de partidas | Corregido: gate de esquema en rutas y comprobación del ledger dentro de cada transacción, con lock compartido frente al migrador exclusivo; ensayo de esquema futuro sin escritura |

La admisión HTTP no equivale a cuota por cuenta ni reemplaza las reservas públicas. Las peticiones desconectadas pueden haber confirmado: se mantiene la recuperación con la intención original. La cola nativa DB queda acotada independientemente del estado del socket HTTP. Telemetría no confirma entrega remota ni retención/rotación del supervisor; esas políticas siguen pendientes.

## Verificación y evidencia

- Suite general: 186 pruebas correctas en 18 archivos. Incluye regresiones de límite de lote, preview sin revelar sorteo, versiones/enteros/null y acceso entre ciudades, además de readiness con barrera y dobles de apagado/sink/transporte.
- PostgreSQL real: 34 pruebas correctas en cuatro archivos, sin excepciones no manejadas en el resultado final. Barrera FOR UPDATE/FOR SHARE reproduce revocación entre autorización y mutación. Cinco conexiones ocupadas y 25 esperas prueban admisión finita; cuarenta probes comparten una espera SQL. Test multibyte comprueba 65536 bytes y exceso de un byte, sin escrituras.
- Proxy TCP de prueba corta al recibir CommandComplete COMMIT de PostgreSQL antes de reenviarlo al cliente: la llamada falla y el reintento directo recupera la misma fila confirmada. No es un mock de repositorio. Cubre pérdida del acuse tras commit; no todos los puntos posibles de caída ni restauración de backups.
- Build y tipos completos correctos; smoke web/proxy/API con HTTP real correcto. ESLint de los módulos nuevos/modificados de infraestructura y de sus pruebas correcto; las infracciones globales heredadas siguen abiertas.
- Corpus IA determinista v2: 17 escenarios correctos. No modelo ni credenciales reales, ni evaluación de FreeLLMAPI/Ollama externo.
- Audit de dependencias con umbral high: no alto/crítico reportado; una vulnerabilidad moderada pendiente de revisión. No se actualizan dependencias automáticamente ni se deduce seguridad universal del resultado.
- Escaneo por patrones sin hallazgos y verificador documental correcto (74 Markdown, trazabilidad y originales intactos). El escáner no sustituye revisión de secretos ni certifica ASVS. Se normalizaron espacios/newline solo de cuatro archivos modificados; no se editaron migraciones históricas para hacer pasar formato.

El primer intento del ensayo de corte de conexión encontró AUD-10 y Vitest lo marcó como excepción no manejada aunque sus aserciones pasaran; se corrigió y repitió hasta resultado limpio. La prueba unitaria de readiness se sincroniza con la entrada real al doble antes de avanzar su reloj falso, sin depender de la latencia de lectura de archivos.

La inspección ejecutable final produjo: remoteInspectStatus=impossible; inspectionMinute=0; ordinalsDependOnOtherRuns=true; nullLocationAccepted=false; warrantEvidenceSufficient=false junto a warrantRequestStatus=applied. Son observaciones de datos sintéticos, no acciones sobre partidas de usuario. Los defectos aún abiertos no se cuentan como pruebas aprobadas.

Entorno: proyecto Docker meridiano-cero-t3-persistence-test, puerto 15434 y volumen propio; no se modifica la base preexistente de 15433 ni WSL. Las pruebas eliminan solo sus perfiles/filas y triggers sintéticos. Se conserva el volumen al detener el contenedor.

## Seguimiento de H-01 a H-09

| Hallazgo del commit | Situación actual |
|---|---|
| H-01 / H-02 | Pendientes: consulta por clave y replay reautorizado de cierre tras carga; hoy no hay cierre/carga HTTP |
| H-03 | Parcial: HTTP local sanitizado y métricas fijas; faltan eventos de dominio, proveedor/auditoría y operación completa |
| H-04 | Corregido en alcance actual: single-flight real, watchdog sin reabrir cola y límites nativos/DB probados |
| H-05 | Código corregido y unidades verificadas; ensayo completo de supervisor/señales/acciones y transporte en vuelo pendiente |
| H-06 | Parcial: un esquema activo con partidas/creación y API inicial; histórico src/db conservado sin aplicar, acciones/saves pendientes |
| H-07 / H-08 | Pendientes de sus fases: fencing, reservas, recuperación de jobs, RPO/RTO/restore, privacidad y alertas |
| H-09 | Pendiente: dos contratos/transports siguen coexistiendo; solo apps/api se considera para integración futura |

## Matriz completa del catálogo

V = verificado en el alcance indicado; P = parcial, faltan partes del oráculo; F = pendiente en su fase o función no implementada. Una V no acredita otras rutas futuras ni toda su tarea. Recuento: 4 V, 30 P y 56 F; no son 90 pruebas ejecutadas. Las filas enlazan el catálogo original y preservan su prioridad/responsable. No se han ejecutado E2E ni revisión manual de accesibilidad, proveedor real, alertas o restauración.

| Escenario | Estado | Evidencia actual / falta |
|---|---|---|
| BOR-001 | P | Base HTTP y HTTP inicial: JSON/campos inválidos sin creación; faltan mutaciones futuras. |
| BOR-002 | V | HTTP inicial: 65536 bytes multibyte llega a validación, 65537 devuelve 413; sin efectos. |
| BOR-003 | F | IME, controles y normalización completa pendientes de UI conectada. |
| BOR-004 | P | Run ajeno/inexistente/ID inválido 404; proyección inicial sin secretos, acceso remoto básico corregido; faltan otros recursos. |
| BOR-005 | V | Creación: barrera PostgreSQL entre autenticación y FOR SHARE, revocación confirma primero y no se escribe. |
| BOR-006 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-007 | P | Origin/CSRF y modo local/trustProxy:false probados; falta ensayo público/proxy completo. |
| BOR-008 | V | Dos creaciones por la misma clave, mismo runId, una fila de intención y replay sin segundo efecto. |
| BOR-009 | P | Conflicto de caseId en servicio y ámbito por usuario; faltan distintos tipos de operación/ruta. |
| BOR-010 | P | Catálogo de un caso rechaza cursor no emitido; paginación amplia/filtros futuros pendiente. |
| BOR-011 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-012 | P | Rollback SQL y corte TCP real tras COMMIT con recuperación por misma clave; otros puntos/acciones pendientes. |
| BOR-013 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-014 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-015 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-016 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-017 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-018 | P | Trigger falla al insertar ledger tras crear estado: rollback conjunto; ActionLog de acciones pendiente. |
| BOR-019 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-020 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-021 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-022 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-023 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-024 | P | Hash profundo, versiones/enteros y DTO incompatible fallan cerrados; manuales y carga aún no implementados. |
| BOR-025 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-026 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-027 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-028 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-029 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-030 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-031 | P | Tests de reloj/plazo previos; costes y evaluación de objetivos al vencer siguen sin cumplir el contrato completo. |
| BOR-032 | F | Ordinal global detectado; requiere secuencia reproducible por partida y empate completo. |
| BOR-033 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-034 | P | Enteros seguros, versiones, null/IDs y semillas normalizadas; referencias, grafo y estructura completa pendientes. |
| BOR-035 | P | Director rechaza selección ambigua y más de ocho; lote del motor y confirmación completa pendientes. |
| BOR-036 | P | Pausa/reanudación probadas en motor; no persistencia SQL ni costes completos. |
| BOR-037 | P | Recogida repetida/espera inválida cubiertas parcialmente; análisis repetido y todas las reglas del expediente pendientes. |
| BOR-038 | P | Reloj/retrasos deterministas probados; resultados materiales/rutas completas requieren motor corregido. |
| BOR-039 | P | Hay tests de desenlaces, pero request_warrant omite suficiencia: AUD-12 abierto. |
| BOR-040 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-041 | P | Aclaración del director con ofertas limitadas; referencias contextuales y UI pendientes. |
| BOR-042 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-043 | P | Transporte local sintético, errores normalizados y timeout; matriz DNS/TLS/proveedores externos pendiente. |
| BOR-044 | P | Selección factual y rechazos sintéticos; falta integración del juego/DOM completo. |
| BOR-045 | P | Codec del director sin coerción y límite ocho; API estructurada de acciones pendiente. |
| BOR-046 | P | Fallback factual de servicio IA probado; commit real seguido de narración todavía no integrado. |
| BOR-047 | P | Cancelación tardía y deadline probados; reserva/conciliación de consumo desconocido no implementadas. |
| BOR-048 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-049 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-050 | P | Adaptador apps/api solo literal loopback y sin redirects; endpoints externos/DNS efectivo y adapter alternativo pendientes. |
| BOR-051 | P | Cuerpo/contexto/salida acotados; transporte hostil no cuelga al llamador y retiene un cupo; falta generación/CPU/importación. |
| BOR-052 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-053 | P | Adaptador apps/api máximo dos intentos y cupo uno; no hay SDK/worker conectado; política global futura pendiente. |
| BOR-054 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-055 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-056 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-057 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-058 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-059 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-060 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-061 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-062 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-063 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-064 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-065 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-066 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-067 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-068 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-069 | F | Prototipo responsive, sin ensayo de zoom/ventanas recuperables conforme al oráculo. |
| BOR-070 | P | Diálogo nativo/foco de muestra revisado estáticamente; no ensayo teclado/lector/E2E de eventos. |
| BOR-071 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-072 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-073 | P | React renderiza texto como texto; RTL/traducciones/layout hostil pendientes de ensayo. |
| BOR-074 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-075 | V | PostgreSQL real: cinco conexiones, 25 esperas; rechazo extra, cuarenta probes comparten una espera y recuperan. Watchdog colgado probado aparte en unidad. |
| BOR-076 | P | Draining/readiness/admisión y promesa única/deadline unitarios; proceso/supervisor con señales y commit/IA en vuelo pendiente. |
| BOR-077 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-078 | P | Ledger/checksum/futuro probado: catálogo y creación se bloquean, cero escritura; falta matriz completa de versiones/migración interrumpida/restauración. |
| BOR-079 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-080 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-081 | P | Centinelas ausentes en HTTP, DTO y sink local; falta proxy de despliegue, spans y SDK no consumidos. |
| BOR-082 | P | Sink caído/backpressure sin crecimiento, métricas fijas y lectura HTTP disponible; no exportador remoto ni alertas probadas. |
| BOR-083 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-084 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-085 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-086 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-087 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-088 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-089 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |
| BOR-090 | F | Función/ensayo aún pendiente; aplicar tarea, prioridad y oráculo del catálogo original. |

## Prioridad de continuación

1. Corregir motor/expediente: reglas y costes reales, permisos contextuales, evidencia seleccionada/órdenes, objetivos al vencer y ordinal por partida. Rehacer rutas sin inyectar conocimiento y validar duraciones ACC-008/009. Esto precede a habilitar acciones HTTP.
2. Resolver lint/imports/formato globales y consolidar transporte; no conectar el componente privado no consumido.
3. Implementar preview/commit, operaciones/localizador por clave y DTO general; después diez manuales/ramas y primer resultado oficial, con las barreras y ensayos de T3-06.
4. Integrar UI/IA y ejecutar T3-05/07/08 completos antes de generar casos o declarar aceptación. No hace falta decidir producto de nuevo para estas correcciones técnicas.

## Continuación posterior: ejecución v2

[Entrega de eventos y cierre v2](T2-eventos-plazo-v2.md): corrige el contador global de AUD-11 y la evaluación de vencimiento de AUD-13, conservando los demás hallazgos abiertos. Las observaciones y cifras anteriores son la instantánea de la auditoría, no se reescriben como si ya hubieran pasado. BOR-032/042 tienen ahora cobertura parcial adicional mediante pruebas de aislamiento/secuencia y empate; faltan el resto del motor y el flujo conectado. Pruebas actuales: 207 generales y 35 de integración. Las tareas siguen abiertas.

## Continuación: evidencias y órdenes v3

Se implementan hallazgos físicos/contextuales, procedencia, laboratorio programado (+90), consultas paralelas (+30), órdenes basadas en selección explícita y admisibilidad, y requisitos de presencia/identidad. Ambas rutas del caso se simulan sin insertar pistas en el estado, incluidas variantes que eliminan las pruebas exclusivas de la otra ruta. El motor no consulta la solución para conceder órdenes y limita las solicitudes pendientes a 32. La API crea estados v3 y conserva lectura estricta de inicios v1/v2 sin reescritura.

Esto corrige parte de los hallazgos funcionales de órdenes/rutas, sin cerrar T2-03/04/05/06 ni recalificar toda la matriz BOR. Faltan costes materiales, confirmaciones y lotes completos; ACC-008/009 no se da por aceptado. Continúan pendientes calidad global, DTO de progreso, acciones HTTP, guardados y E2E. El siguiente trabajo es costes/preview/lotes antes de conectar acciones web. Los registros anteriores son instantáneas históricas; [la evidencia v3](../quality/T2-evidencias-ordenes-v3.md) recoge el alcance vigente y las comprobaciones de esta continuación.

## Continuación: costes y confirmaciones v4

Se corrigen costes materiales del caso fijo, confirmación de espera/inspección/detención/recuperación y de lotes costosos. El plazo interrumpe sin aplicar efecto terminal ni resto del lote; reanudar no repite el prefijo. Las rutas naturales acreditan tiempos base A=455/B=485 con semilla 1 y A=482/B=512 con semilla 42, sin cambiar el expediente original. Los inicios antiguos v1/v2/v3 siguen legibles sin reescritura, con nueva ejecución v4.

T2 permanece abierto: lotes de otras acciones/dependencias, extremos de retraso, validación y calidad global aún pendientes. Tampoco están habilitados acciones HTTP, guardados o E2E. La siguiente prioridad es resolver estas fronteras y la calidad antes de conectar progreso web. [Verificación y límites v4](../quality/T2-costes-confirmaciones-v4.md); las notas v2/v3 anteriores son evidencia histórica, no el estado vigente.

## Continuación: validación estructural y puerta de creación

T2-01 amplía validación de campos anidados, referencias, ciclos de procedencia, posición inicial y límites. Se elimina la complejidad 71 del validador, manteniendo máximo diez mediante responsabilidades usadas. Creación nueva valida una copia estable del expediente; rechaza sin partida/intención, conservando replay autorizado antes de disponibilidad. No cambia motor v4, contenido/hash del fixture ni datos guardados.

La tarea sigue en curso: faltan vocabulario/referencias NPC y solución, operadores/payloads declarativos y solvencia general. No se cierra calidad global ni se habilitan acciones HTTP o importación. [Resultados y límites de esta continuación](../quality/T2-validacion-expedientes.md).

## Continuación posterior: adaptadores alternativos

Se corrigen configuración con any, falso determinismo/aprobación del mock, payload de sobre en Ollama y conversión de uso ausente a cero. Comprobaciones de forma y errores normalizados añadidas sin afirmar autorización factual. La latencia operacional usa reloj monotónico. El paquete sigue sin consumirse desde API: SSRF, bytes, presupuesto total, single-flight/watchdog y consolidación con el adaptador activo permanecen pendientes. [Resultados actuales](T3-adaptadores-calidad.md).

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

## Avance parcial T3-06: consulta de creación

El localizador por clave revalida sesión/esquema y propiedad en transacción, usa SQL parametrizado y DTO explícito sin estado privado. Se comparte el validador de claves con creación y rutas, sin dependencias nuevas ni capas vacías. Las barreras PostgreSQL verifican revocación concurrente y 404 provisional antes del commit. [Evidencia y límites](T3-06-localizador-creacion.md). Esta entrega no cierra las obligaciones de operaciones/guardados, UI, retención ni certifica cumplimiento completo de OWASP/ASVS o del commit normativo.

## Avance parcial: intervenciones en lote v9

Detención y recuperación reutilizan resolutores/costes individuales con validación cerrada del paso. Pruebas cubren preview sin efectos, permisos independientes, pausa/serialización y vencimiento; las rutas A/B agrupan la intervención sin inyectar descubrimientos. Nuevo snapshot v9, lectura inicial antigua sin reescritura. [Evidencia y límites](T2-intervenciones-lotes-v9.md). No cierra la auditoría, T2/T3 ni las puertas de aceptación restantes.

## Avance parcial: viajes en lotes v10

Viajes reutilizan resolutor individual, contador persistido y reloj; preview/continuación no consultan seed. Parámetros cerrados, pausas/dependencias/plazo y equivalencia factual A/B se verifican sin habilitar API/UI prematuramente. [Evidencia y límites](T2-viajes-lotes-v10.md). No se cierra auditoría ni T2/T3 por esta entrega.

## Avance parcial: cierre en lotes v11

Cierre a coste cero requiere confirmación, con parámetros cerrados y sin informe prospectivo. Reutiliza resolutor individual y terminación del coordinador; pausa/serialización, dependencias, cancelación y plazo conservan sus límites. Rutas A/B verifican cierre en lote sin inyección de pistas. [Evidencia](T2-cierre-lotes-v11.md). No cierra auditoría ni T2/T3; carrera/resultado oficial permanecen fuera del motor.

## Avance parcial: comunicaciones v12

Se elimina payload abierto recipient/content, se comparte validación cerrada en acción/lote/maduración y se acota texto, solicitudes y snapshots serializados. Texto no se interpreta como autoridad, eventos no contienen texto privado y acuse no inventa hechos. [Evidencia y límites](T2-comunicaciones-v12.md). No cierra auditoría/T2/T3; configuración y respuestas factuales del equipo, API/UI/guardados siguen pendientes.

## Avance parcial: navegabilidad del mapa

La puerta estructural verifica alcance dirigido y entrada accesible por ciudad, sin recursión, cambios al fixture o confiar en el reporte externo. Rechazo de nuevas intenciones sin filas y preservación de replay previo cubiertos por integración. [Evidencia y límites](T2-navegabilidad-mapa.md). No se acredita solvencia, auditoría completa o cierre de T2/T3.

## Avance parcial: referencias de conocimiento/solución

Validador 1.3 exige referencias existentes y unicidad; compatibilidad histórica explícita con perfil de sospechosos compartido con el motor. No nombres inferidos, errores con datos privados o reescritura del fixture. [Evidencia y límites](T2-referencias-conocimiento.md). Condiciones de revelación, vocabulario de reglas y solvencia pendientes; no cierra auditoría/T2/T3.

## Avance parcial: permiso factual de testimonio v13

Se reproduce y corrige revelación de EV-09 tras retirar conocimiento de Lucía. Mismo punto de autorización para acción/lote, sin prueba/procedencia ficticia; rutas materiales A/B sin cooperación/conocimiento conservan solvencia bajo retrasos máximos. [Evidencia](T2-permisos-testimonio-v13.md). Política completa, vocabulario declarativo y aceptación pendientes; no se cierra auditoría/T2/T3.

## Avance parcial: rechazo de contenido ignorado

Validador 1.4 no aprueba reglas arbitrarias ni programación inicial que createInitialRun no consume. Manifiesto histórico explícito, sin evaluar texto; solicitudes de acciones y replay previo conservados. [Evidencia](T2-contenido-ejecutable.md). DSL/políticas generales, solvencia y aceptación pendientes; no cierra auditoría/T2/T3.

## Avance parcial: listado propio paginado

DTO explícito, consultas parametrizadas con cuenta de sesión revalidada, cursor sin autoridad propia y paginación por ancla/fecha precisa en un snapshot. No se serializa motor ni se afirma reanudación compatible por listar metadata. [Evidencia y límites](T3-02-lista-partidas.md). No cierra auditoría/T2/T3; UI, acciones, guardados y aceptación siguen pendientes.

## Avance parcial: archivo web conectado

Vista de consulta MS-DOS con contratos runtime cerrados, transporte acotado, sesión/cuenta coherentes y respuestas tardías descartadas. Logout oculta datos sin afirmar éxito antes de 204; sin credenciales en DOM/storage. Pruebas de frontera/modelo y revisión manual sintética separadas. [Evidencia y límites](T3-03-archivo-conectado.md). No cierra auditoría/T3, accesibilidad completa o recuperación de operaciones del caso.

## Avance parcial: intención de creación web

Persistencia mínima antes del POST, cuenta esperada comparada en transacción y éxito solo tras ledger propio. Recarga/404 no generan clave nueva; abort/logout no se afirman como rollback. Ensayo real sintético: un POST y una partida tras acuse perdido y recarga. [Evidencia y límites](T3-creacion-web-recuperable.md). No cierra auditoría/T3 ni recuperación de otras operaciones, política de retención o aceptación del caso completo.


La [consulta inicial conectada](T3-ficha-inicial-conectada.md) añade decoder público cerrado, lectura acotada sin mutaciones y descarte de respuestas tardías, sin dependencias ni reglas del motor en UI. Es evidencia parcial de programación y aislamiento; no cierra la auditoría integral ni las ocho incidencias históricas de formato.


El [formato cerrado 1.5](T2-formato-cerrado.md) añade rechazo explícito de campos ignorados, errores sin datos suministrados y pruebas de rechazo sin escrituras/replay propio. Sin dependencias, evaluación de código o cambios en transiciones. Acredita ese control parcial, no solvencia general, cierre de fases o cumplimiento OWASP.


El [cierre individual v14](T2-cierre-individual-v14.md) retira la aprobación por campo confirmed, conserva preview sin efectos y unifica el cierre de dominio de individuo/lote. Pruebas de inyección, repetición y compatibilidad documentadas; sin exposición HTTP anticipada o declaración de seguridad integral.
