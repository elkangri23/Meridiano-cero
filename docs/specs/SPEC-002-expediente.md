# SPEC-002 Expediente, partida y proyección

Estado: definido para caso fijo; 2026-10-27. ADR-003/007/009. Tareas T2-01/T2-02/T3-02.

## Tres representaciones

CaseDefinition: id, schemaVersion, engineCompatibility, contentVersion, seed, contentMode, difficulty, explorationMode, catalogVersion, deadlineMinutes, solution, objectives, cities, locations, NPCs, facts, evidence, rules, travelDurations, scheduledResults y validationReport. Secretos de solución y conocimientos no revelados solo en servidor.

CaseRun: id, ownerId, definitionId y hash, engineVersion, version creciente, minute, status, position, discoveries, inventory, admissibility, NPC relations, conversation records, pendingRequests, warrants, detentions, recoveredObjects, pendingBatch y finalReport. Dos partidas del mismo usuario no comparten reloj ni evidencias.

PlayerView: id de partida, version, reloj/plazo, posición, ciudades visibles, lugares/objetos descubiertos, dossier, conversación autorizada, solicitudes visibles, órdenes y resultado si está cerrada. Construcción por lista explícita; no serializar CaseDefinition ni eliminar campos después. Un ID interno o un texto de error tampoco revela hechos ocultos.

## Datos y reglas

IDs internos estables en ASCII, referencias resueltas antes de jugar, sin scripts, expresiones eval, URLs descargables o SQL dentro del expediente. Condiciones y efectos se expresan mediante un vocabulario cerrado (tiene evidencia, está en lugar, conoce hecho, solicitud terminada; revelar, recoger, solicitar, emitir orden, detener, recuperar). El importador rechaza operadores desconocidos. Nada de interpretar código proveniente de IA.

Hash SHA-256 sobre JSON canónico de la definición completa sin hash ni reporte volátil, con claves ordenadas y orden de arrays preservado. El hash detecta cambios; no demuestra procedencia confiable. Sin metadatos de tiempo real en el contenido hasheado. Una definición usada por partidas no se actualiza: nueva contentVersion crea otra definición.

Versión de esquema inicial 1, entera. Rechazar versiones futuras; las migraciones de datos son explícitas y no reescriben hechos de una partida activa. Si un motor no soporta una versión, error operativo y conservación del guardado, nunca reinterpretación silenciosa.

## Validación inicial

Antes de crear partida: estructura; IDs únicos; referencias; fechas no negativas; costes finitos enteros; grafo de lugares; conocimientos NPC referenciados; objetivos; existencia de dos rutas alternativas; rutas simulables bajo plazo incluso con retrasos previstos. El reporte identifica versión de validador, escenarios y errores. Solo status=validated permite jugar. Un fixture manual atraviesa las mismas puertas deterministas.

Separar revisión semántica de aprobación estructural: la IA no puede aprobar por sí sola un expediente.

## API mínima que SPEC-004 debe concretar

- Crear/reanudar partida desde definición autorizada.
- Obtener PlayerView y preview de acciones.
- Confirmar/ejecutar una acción o lote con expectedVersion e idempotencyKey.
- Cancelar o reanudar lote pendiente.
- Finalizar con confirmación y obtener informe.

La identidad viene de la sesión, nunca del ownerId enviado por el cliente. Comparar owner y versión en la misma transacción de escritura. Repetir clave y misma carga devuelve resultado persistido; misma clave con otra carga produce conflicto. Un fallo de narración no revierte ni duplica la transacción.

ActionLog conserva runId, ordinal, versión anterior/posterior, intención normalizada, coste, eventos, resultado y engineVersion. Guardar estado y log atómicamente. Conversaciones privadas fuera de logs operativos. El proveedor no recibe credenciales ni el expediente entero cuando solo necesita un contexto local.

## Importación y exportación

SPEC-007 definirá formato completo. Límite inicial propuesto para diseño: JSON UTF-8, sin archivos ejecutables ni descargas remotas. El dueño puede exportar conscientemente un expediente con solución: mostrar aviso de spoilers. Esa operación no es GET normal del juego y no permite exportar contenido ajeno. No prometer ocultación criptográfica al propietario del servidor.

## Aceptación

ACC-001/002/014/015/017/021/023/024. Comprobar proyección con un objeto centinela secreto, referencias rotas, versión futura, hash alterado, dos usuarios, dos partidas y reinicio. El validador documental actual no implementa estos controles.

## Aclaraciones de propiedad y guardado confirmadas

El usuario se registra, selecciona un caso y juega en solitario. Cada CaseRun tiene un único propietario y un solo detective jugador; no hay cooperación o competición multijugador, ni local ni en VPS. Esta regla no limita el número de cuentas de una instalación ni obliga a una sola partida por cuenta.

El primer caso jugable tendrá autoguardado y guardado manual. Ambos deben conservar el estado completo necesario para reanudar: reloj, descubrimientos, solicitudes, conversación/memoria NPC, órdenes, lotes y versión del motor/expediente. Crear un guardado no consume tiempo del juego ni cambia la verdad del caso. No se aceptan estados arbitrarios enviados por el cliente como guardados válidos.

DEC-017 confirma cargar puntos manuales anteriores para probar otras decisiones. DEC-021 fija diez manuales por partida además del estado actual autoguardado; no se borran manuales automáticamente. DEC-020 fija el primer resultado para carrera/reputación. Estas decisiones no se dan por resueltas por confirmar que existen ambos modos. Referencia: DEC-013/014 en BASELINE; tareas T3-02/T3-03 y aceptación ACC-014/021.

### Carga de un punto anterior confirmada

Un guardado manual permite restaurar el estado del mismo caso a ese instante y continuar tomando otras decisiones. Se restauran también reloj, pendientes y memoria NPC; no se conserva conocimiento de la rama abandonada dentro de esos estados. La definición y su hash permanecen iguales.

El retroceso narrativo no rebobina la versión de concurrencia del servidor ni elimina la auditoría operativa. La carga debe invalidar previews antiguos y protegerse frente a acciones en vuelo. El registro de recompensas ya otorgadas no se elimina al cargar un punto anterior. DEC-020 confirma que carrera y reputación conservan el primer resultado definitivo; el registro oficial no se restaura desde un guardado ni cambia por una resolución posterior.

## Persistencia detallada para T3

[GUARDADOS](GUARDADOS.md) define la unidad de autoguardado, límites, registros, endpoints y carga atómica. No hace falta crear copias periódicas para el autoguardado: cada transición confirmada ya deja durable el último estado. Los snapshots manuales son independientes e inmutables salvo sus metadatos.

[API-juego](API-juego.md) define PlayerViewDto público con rama/revisión del agregado, nombres autorizados y solicitudes sin payload interno. No equivale a serializar el tipo PlayerView heredado. El esquema actual requiere adaptación antes de conectar la UI; los anexos no certifican esa integración.

## Compatibilidad de ejecución v2

El estado de motor v2 contiene eventOrdinal y registra engineVersion=2; la definición inmutable continúa en formato engineCompatibility=1. El servicio persiste la versión real del estado creado, no copia el número del formato de definición a engineVersion.

Las partidas iniciales v1 existentes tienen un adaptador de lectura explícito: solo se acepta igualdad completa con el estado virgen conocido (revisión/versión inicial, minuto cero, sin progreso y sin contador v2). La lectura no escribe, migra ni reinicia ese registro. Un estado v1 con progreso o versión desconocida se conserva y falla cerrado. Antes de habilitar acciones sobre una partida v1 deberá existir migración/transición de versión probada; no restaurar puntos antiguos por eliminación de campos.

[Pruebas y límites de esta entrega](../quality/T2-eventos-plazo-v2.md). El contrato de guardado deberá incluir contador/versión en snapshot y digest, además de los campos anteriores.

## Compatibilidad y procedencia en ejecución v3

El estado nuevo usa engineVersion=3 y conserva eventOrdinal. evidenceRecords es un mapa opcional por ID revelado con revealedMinute, origin y method; collectedMinute aparece al recoger físicamente. El primer hallazgo conserva su procedencia, sin reescribirla al repetir una acción. Una derivación no convierte una fuente marcada inadmisible en prueba válida. Los registros son estado privado: no deben serializarse por defecto en HTTP.

La lectura inicial admite v1 y v2 únicamente cuando el registro completo coincide con su estado virgen conocido, sin reescribirlo. El progreso de esas versiones permanece conservado y no se ejecuta con v3. Versiones desconocidas o estados iniciales alterados fallan cerrado. La proyección HTTP sigue siendo InitialPlayerViewDto; no hay proyección general ni guardados conectados. [Evidencia v3](../quality/T2-evidencias-ordenes-v3.md).

## Compatibilidad de ejecución v4

La forma del estado inicial no cambia respecto a v3, salvo engineVersion=4. Los registros iniciales v1/v2/v3 se reconocen por igualdad completa con su forma virgen conocida, sin actualización SQL ni reinicio. El motor rechaza ejecutarlos directamente; progreso y snapshots antiguos necesitan migración probada. Los tiempos de procedencia se materializan al terminar acciones confirmadas. [Evidencia v4](../quality/T2-costes-confirmaciones-v4.md).

## Validador estructural 1.1 y creación de partidas

La implementación comprueba metadatos/versiones, campos anidados, enteros seguros y booleanos sin coerción; IDs únicos globales de entidades; ciudades de lugares/NPC y viajes; origen de evidencias (ciudad o lugar); referencias de procedencia y ausencia de ciclos; rutas no duplicadas ni hacia la misma ciudad. Exige ciudades, lugares y objetivos no vacíos. El punto inicial heredado es primera ciudad/primera localización: deben coincidir y ser accesibles. No se infiere una posición alternativa silenciosamente.

Límites aplicados antes de recorrer las colecciones: 20 ciudades, 100 lugares, 100 NPC y 1.000 evidencias, conforme a SPEC-007; máximo interno 2.048 entradas en las demás listas y 16.384 caracteres por string textual. IDs ASCII de 1–128 caracteres. Esto acota el trabajo de esta etapa sobre datos ya parseados; no implementa aún límite de archivo 2 MiB ni profundidad 32 del importador futuro. Un límite excedido es rechazo técnico, sin recortar contenido.

Los errores usan nombres de campo, sin reproducir solución, textos privados o IDs suministrados. El reporte externo requiere estructura coherente y cero errores, pero no sustituye estas comprobaciones. createValidationReport usa validatorVersion=1.1.0, copia el array de errores y solo acredita structural: no añade rutas o simulación no ejecutadas.

La API calcula validación sobre una copia privada estable antes de esperar SQL. Una creación nueva falla con CASE_NOT_READY si es inválida; no crea partida ni intención. La autorización/deduplicación transaccional se conserva: un replay autorizado de creación ya confirmada se resuelve antes de exigir disponibilidad actual del expediente. El catálogo comprueba esta validación para canStart. No hay importador ni catálogo dinámico activo.

**Alcance pendiente:** NPC knowledge y solution usan vocabularios heredados que no equivalen todos a facts o IDs NPC; no se afirma que sus referencias estén cerradas. Falta migración explícita del formato/contenido para normalizarlas, sin reescribir el caso original. Rules sigue siendo texto no ejecutado por este validador, y scheduledResults.payload requiere contratos por tipo antes de admitir expedientes externos. Conectividad/solvencia completa del grafo de viajes, operadores declarativos, coherencia semántica y aprobación por simulación no se certifican. [Verificación y pendientes](../quality/T2-validacion-expedientes.md).

## Integridad en una entrada exclusiva de servidor

hashDefinition se importa desde @meridiano/case-schema/server, sin reexportarla por la raíz pura ni por engine. Conserva exactamente canonicalización y SHA-256 nativo anteriores: orden recursivo de claves, orden de arrays preservado y exclusión de validationReport volátil. El hash del fixture original se fija en una regresión contra su valor anterior al cambio.

La API calcula una sola huella sobre su copia estable antes de esperar SQL, la usa en estado/fila y revalida la igualdad al proyectar un inicio almacenado. El navegador no suministra la definición ni esta autoridad de integridad. Un hash válido no es firma de procedencia ni aprobación de solvencia. No se modifica contenido, seed, hash, versión de ejecución o registros antiguos; inicios v1/v2/v3 mantienen su lectura estricta sin reescritura. [Pruebas](../quality/T2-motor-puro-integridad.md).

Si no puede prepararse la huella actual, el servicio conserva primero la recuperación autorizada por clave; solo una intención nueva falla operativamente, sin escritura. No se calcula otra huella sobre una definición modificada después de validar.

## Compatibilidad de ejecución v5

Estado nuevo engineVersion=5; la definición mantiene engineCompatibility=1 y su hash original. La forma del estado inicial solo cambia en la versión. La API reconoce inicios vírgenes v1/v2/v3/v4 mediante comparación completa y no actualiza sus filas; progreso antiguo se conserva y rechaza. Metadata de lote v5 incluye dependencias verificables, estados/ordinales y motivos acotados; no se reconstruye desde prosa o reglas improvisadas al cargar. [Pruebas y límites](../quality/T2-dependencias-lotes-v5.md).

## Compatibilidad de ejecución v6

Estado nuevo engineVersion=6; formato de definición sigue engineCompatibility=1 y hash original. Se añade lectura estricta de inicios v5 a las de v1–v4 sin actualizar filas; progreso antiguo se conserva/rechaza. Metadata de lote conserva dependencias/estados y admite los cuatro nuevos tipos con parámetros cerrados. Una solicitud applied representa envío, no disponibilidad de su resultado; el snapshot debe preservar por separado los pendientes y sus vencimientos. [Pruebas v6](../quality/T2-lotes-solicitudes-v6.md).

## Estado de viajes v7

CaseRun añade tripCount entero seguro no negativo, inicialmente cero y persistido con el reloj/contador de eventos. Cuenta salidas confirmadas y no destinos distintos. La capacidad de incrementar se comprueba antes de preview/confirmación de un viaje; agotar viajes no impide cerrar el caso mediante otras reglas válidas.

La definición y su hash original no cambian. Los inicios v1–v6 no tenían este campo: lectura compara su forma completa histórica sin tripCount y no lo rellena en DB. Un progreso antiguo no se reetiqueta como v7 ni deduce contador de marcadores de ciudades. [Verificación](../quality/T2-secuencia-viajes-v7.md).

## Compatibilidad de tiempos en v8

Un hash de definición y una semilla no identifican por sí solos una secuencia temporal entre versiones del motor. La persistencia conserva engineVersion=8 junto a definición/hash; cambiar el mezclador no cambia hechos del caso ni autoriza reinterpretar progreso v7. API solo reconoce inicios v1–v7 en su forma virgen conocida, manteniendo tripCount de v7 y sin añadirlo a v1–v6. La lectura no escribe ni migra. [Verificación](../quality/T2-retrasos-maximos-v8.md).
