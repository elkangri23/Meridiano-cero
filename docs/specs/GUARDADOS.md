# Guardados, restauración y primer resultado: contrato detallado

Revisión: 2026-10-28. Anexo de SPEC-002/004/008; tareas T3-02/T3-03 y carrera T5-04. DEC-014/017/020/021 confirmadas. Documentación de comportamiento a implementar, no persistencia ya entregada.

## Unidades y límites

Partida de caso significa runId: un propietario y un detective jugador. Cada partida dispone de diez guardados manuales, además del estado actual autoguardado. Los guardados no son archivos que el navegador pueda modificar y subir como estado autoritativo.

Autoguardado significa el último estado durable de cada transición confirmada; no un temporizador del navegador ni una copia periódica que pueda perder acciones. Se actualiza en la misma transacción que la partida. No se necesita una segunda tabla duplicada solo para llamarlo autoguardado.

No se exige un historial de autoguardados en T3. El guardado manual conserva un punto independiente que el usuario puede cargar. No caduca ni se borra para hacer sitio de forma silenciosa; las políticas de eliminación de cuenta/instalación se documentan aparte.

Llegar a diez no impide jugar ni autoguardar. Crear el undécimo responde SAVE_LIMIT_REACHED; la UI ofrece borrar uno o reemplazar uno elegido explícitamente. Reemplazo atómico: si la escritura falla se conserva el guardado anterior.

## Estado restaurable y metadatos permanentes

| Se restaura desde el snapshot | Se conserva fuera del snapshot |
|---|---|
| Minuto, status y posición de la rama | Propietario y permisos |
| Descubrimientos, inventario y admisibilidad | Revisión HTTP creciente |
| Relaciones y memoria NPC | Registro de operaciones e idempotencia |
| Conversación autorizada y evidencias obtenidas | Auditoría de cargas/cierres |
| Solicitudes del juego con dueMinute y resultados ya maduros | Credenciales, proveedor y cuotas operativas |
| Órdenes, detenciones, recuperaciones y lote/cursor pendiente | Perfil/preferencias de UI y controles de accesibilidad |
| Estado reproducible de aleatoriedad y retrasos ya fijados | Primer resultado oficial y recompensas de ese contenido |
| Informe de esa rama solo si el snapshot era cerrado | Guardados manuales existentes y sus metadatos |

El snapshot referencia la definición inmutable por ID/hash y las versiones de esquema/motor; no crea otra solución. Toda información interna permanece en servidor. Al cargar, el PlayerViewDto se reconstruye desde permisos actuales y estado restaurado; no se confía en una proyección pública guardada como sustituto del estado.

## Modelo lógico de persistencia

| Registro | Campos mínimos / integridad |
|---|---|
| Run aggregate | id, ownerId, definitionId/hash, engineVersion, revision HTTP, branchId, engineState, updatedAt |
| ManualSave | id, runId, schemaVersion, name, sourceRevision, sourceBranchId, minute, status, snapshot privado, snapshotHash, engineVersion, createdAt y metadataVersion |
| OperationRecord | id, runId, ownerId, idempotencyKey única, kind, requestDigest, result público, branchId y revision |
| ActionLog | Secuencia monotónica por partida, rama, operación, efectos y versiones internas relevantes |
| OfficialResult | Perfil e identidad canónica del contenido únicos, primer cierre/resultados/consecuencias, versión de regla y operación de origen |

La revisión HTTP pertenece al agregado persistido, separada de la versión interna del motor que pueda restaurarse desde engineState. La proyección pública usa la revisión del agregado. Cada comando nuevo que modifica estado incrementa esa revisión una vez, aunque el motor registre varios pasos internos; guardar/renombrar un manual no cambia el estado narrativo.

Son registros conceptuales para el diseño SQL, no repositorios/clases genéricas obligatorias. Definir FK, restricciones y migración al implementarlos. Diez saves se comprueban bajo bloqueo de run; dos creaciones concurrentes no pueden rebasar el límite.

snapshotHash es SHA-256 del JSON canónico de schemaVersion, engineVersion, definitionHash y snapshot: claves de objetos ordenadas recursivamente, arrays con orden preservado, UTF-8 y sin números no finitos. Nombre/fechas de metadatos no entran en ese digest. Usar la primitiva criptográfica mantenida y una única normalización probada, no la función superficial heredada como garantía sin comprobar.

El hash comprueba integridad frente a corrupción accidental; no demuestra autenticidad por sí solo. No aceptar snapshots externos como manuales mediante este contrato. Importar expedientes pertenece a SPEC-007 y no equivale a importar una partida.

## DTO y endpoints

Todas las rutas están bajo /api/v1 y aplican sesión/ownership/CSRF de SPEC-004.

SaveSummary: saveId, runId, name, createdAt, sourceRevision, cityName público del snapshot, minute, status, metadataVersion y canLoad. No incluye snapshot, solution, factIds ocultos, conversación completa ni conexiones IA.

| Operación | Entrada | Respuesta |
|---|---|---|
| GET /runs/:runId/saves | cursor/limit de API-juego | items de SaveSummary, manualLimit=10, manualCount y nextCursor |
| POST /runs/:runId/saves | name, expectedVersion, idempotencyKey, replaceSaveId opcional | 201 con SaveSummary; reintento 200 replayed=true |
| PATCH /runs/:runId/saves/:saveId | name, expectedSaveVersion, idempotencyKey | SaveSummary y metadataVersion nueva |
| DELETE /runs/:runId/saves/:saveId | expectedSaveVersion, idempotencyKey | 204; repetir misma clave no afecta otros guardados |
| POST /runs/:runId/saves/:saveId/load | expectedVersion, idempotencyKey | 200 con operationId, nuevo branchId/version y PlayerViewDto |

name: trim, 1 a 80 unidades UTF-16, sin controles; nombres repetidos permitidos porque la identidad es saveId. La lista usa createdAt/saveId para orden estable, no el nombre. No aceptar cambios a snapshot mediante PATCH.

Un save ajeno/de otra partida se trata como no encontrado. expectedSaveVersion controla metadatos de renombre/borrado; no obliga a cambiar la revisión del juego por un renombre. Crear un manual comprueba revisión actual, pero no avanza reloj ni revisión de juego por sí solo. Los cambios de metadatos tienen su propia versión.

replaceSaveId debe pertenecer a la misma partida. La transacción genera el snapshot nuevo y después sustituye la referencia elegida, sin ventana de pérdida. No se elige automáticamente el guardado más antiguo.

## Creación manual

1. Autenticar y bloquear partida; resolver idempotencia antes de rechazar una revisión vieja de un reintento.
2. Comprobar expectedVersion y que el snapshot se toma en una transición durable, sin aplicar una acción parcial.
3. Verificar cuota o reemplazo propio, serializar estado/versiones y calcular digest.
4. Insertar el snapshot y registrar la operación atómicamente.
5. Responder solo después del commit; un error deja intactos estado y saves previos.

Se permite guardar durante un lote pausado: incluye cursor y pasos ya aplicados. No se guarda un estado intermedio aún no confirmado. Crear manual mientras llega narración no obliga a guardar prosa no validada ni retrasar la operación del motor.

## Carga atómica y nueva rama

1. Sesión/ownership, bloqueo de partida y resolución de idempotencia.
2. Comprobar expectedVersion, pertenencia, integridad del snapshot y compatibilidad de definición/esquema/motor.
3. Validar el estado completo antes de sustituirlo. No combinar memoria antigua, reloj nuevo o inventario de otra rama.
4. Generar branchId nuevo y revisión HTTP igual a la anterior más uno; no copiar sourceRevision como versión corriente.
5. Restaurar estado de motor y solicitudes del juego, invalidar previews de la rama anterior y persistir un evento de carga.
6. Mantener registros oficiales, operaciones y límites reales de consumo; actualizar el estado autoguardado y confirmar.
7. Abortar cuando sea posible peticiones IA antiguas; cualquier respuesta tardía lleva su branchId y se descarta para la rama actual.

No hay avance por el tiempo real transcurrido desde la creación del save. Una solicitud prevista al minuto 100 y guardada al 40 sigue esperando hasta 100 de juego, aunque hayan pasado días reales. No se recrean llamadas externas ni trabajos reales al copiar una solicitud del motor.

Si el snapshot contiene un lote pausado, conserva sus pasos ya materializados y obliga a un preview nuevo antes de continuar. No reaplicar pasos consumidos ni reutilizar tokens antiguos.

Cargar un save activo después del cierre abre otra rama activa de práctica si ya existe resultado oficial. Cargar uno cerrado mantiene esa rama cerrada; no ejecuta otro cierre para carrera.

## Primer resultado oficial

El primer cierre definitivo confirmado por servidor para perfil+contenido fija carrera/reputación, incluido vencimiento o resultado incorrecto. Cambiar runId, cargar un punto anterior o duplicar una definición con contenido idéntico no da otro primer intento. La identidad canónica se construye como SPEC-008, sin eludir unicidad con IDs nuevos. El servidor asigna la identidad de contenido al validar: usa huella versionada del contenido inmutable, excluyendo ID de transporte y reporte volátil, y procedencia de variante verificada; el cliente/importador no puede elegir libremente esa identidad. No se promete detectar equivalencia semántica arbitraria entre relatos distintos.

Antes de ese primer cierre, cargar un save no fija ni adelanta resultado oficial. Después, todas las resoluciones del mismo contenido son práctica: no mejoran ni empeoran otra vez carrera/reputación y no repiten puntos, medallas o sanciones oficiales.

Dos cierres en partidas distintas del mismo contenido compiten por una restricción única de OfficialResult. El primero confirmado gana; el segundo sigue teniendo informe de práctica. No mantener una respuesta IA ni un cierre no confirmado como resultado oficial.

La carga no oculta al jugador que está en práctica. El informe muestra resultado de esa resolución y cuál es el oficial, sin cambiar este último. El resultado oficial detallado no se inserta como pista durante una rama activa.

## Fallos y recuperación

| Caso | Comportamiento |
|---|---|
| Se pierde respuesta tras crear/cargar | Reintentar misma clave; no crear otro save/rama |
| Falta compatibilidad o snapshot corrupto | 422 SAVE_INCOMPATIBLE; conservar partida y snapshot |
| Otra pestaña actuó antes de cargar | 409 VERSION_CONFLICT; no borrar lo ya confirmado |
| Carga gana a una acción en vuelo | Acción de rama antigua no puede confirmar; nuevo preview |
| Cierre gana a la carga | Resultado oficial permanece; carga posterior válida inicia práctica |
| Falla DB en reemplazo | Ni pérdida del anterior ni creación parcial |
| Borrar el último manual | Autoguardado actual sigue disponible |
| Reinicio con prosa pendiente | Hechos y estado siguen durables; respaldo factual sin reejecución |
| Clave de un save borrado se reintenta | No resucitarlo: devolver resultado histórico con recurso ya no vigente |
| Se cancela el navegador tras commit | Estado aplicado se recupera; no prometer rollback del servidor |

Los errores públicos no incluyen snapshot, hashes privados ni detalles de SQL. No ejecutar pruebas sobre guardados reales del usuario. Aceptación granular en [T3 detallada](../quality/T3-aceptacion-detallada.md).
