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
