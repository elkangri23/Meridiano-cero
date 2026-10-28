# API de juego: contratos detallados de SPEC-004

Revisión: 2026-10-28. Contrato para implementar T3-02/T3-03/T3-04; no endpoints entregados. Amplía SPEC-002/004/005/006, ADR-003/007 y DEC-013 a DEC-021. Los contratos de sesión de SPEC-004 siguen vigentes; este anexo concreta juego, guardados y recuperación.

## Convenciones y validación

Prefijo /api/v1; JSON UTF-8, mismo origen y Cache-Control: no-store. Todas las rutas de este documento exigen sesión. Mutaciones exigen Origin exacto y CSRF. Recurso inexistente y recurso ajeno responden igual: 404 NOT_FOUND. No usar ownerId, rol o permisos aportados por cliente.

| Dato | Contrato |
|---|---|
| IDs públicos | Strings opacos ASCII de 1 a 128 caracteres; letras, dígitos, punto, guion, subrayado y dos puntos; nunca rutas |
| version | Entero seguro positivo, revisión autoritativa de la API |
| branchId | ID opaco generado al crear/restaurar una rama; no lo elige el cliente |
| expectedVersion | Revisión que leyó el cliente; obligatoria en escrituras sobre estado |
| idempotencyKey | String ASCII de 16 a 128 caracteres, nueva por intención de escritura, reutilizada al reintentar |
| text | No vacío tras trim, máximo 4000 unidades UTF-16; sin caracteres de control salvo tabulación/saltos de línea |
| limit/cursor | 25 elementos por defecto, máximo 100; cursor opaco ligado a filtros/ámbito, no SQL |
| Cuerpo | Máximo 65536 bytes antes del parseo; campos adicionales rechazados |
| Fechas operativas | UTC en RFC 3339; no se usan para avanzar minutos del juego |
| Minutos | Enteros no negativos; estimaciones separadas de duración real aplicada |

El límite de lote del primer caso es ocho pasos, tanto en entrada estructurada como en interpretación IA. No truncar un lote largo ni ejecutar sus primeros pasos: pedir dividir/aclarar sin efectos. Las cantidades son límites operativos, no equilibrio del juego.

## Proyección PlayerViewDto v1

La API construye esta proyección explícitamente. No devuelve directamente el PlayerView interno heredado: contiene pendingRequests.payload y carece de nombres y revisión de rama.

| Campo | Tipo / contenido autorizado |
|---|---|
| schemaVersion | Literal 1 |
| runId, branchId, version | Identidad de partida, rama actual y revisión HTTP |
| status | active o closed |
| clock | minute y deadlineMinutes; sin temporizador de pared |
| position | city {id,name,country} y location {id,name,description} visibles |
| cities | Lista de ciudades permitidas por modo/descubrimiento, sin relevancia de pistas |
| locations, objects | Solo elementos visibles; id, nombre y descripción pública |
| dossier | Entradas públicas: id, tipo, texto factual, procedencia y minuto de revelación |
| conversation | Entradas de la rama actual: turnId, npcId, nombre visible, act, texto, factIds ya revelados |
| pendingRequests | id, label público, status pending/ready/failed y dueMinute; sin payload ni resultado prematuro |
| warrants, detentions | IDs y descripciones ya comunicadas; sin culpabilidad o reglas internas |
| batch | null o batchId, estado awaiting_decision, cursor y pasos públicos pendientes |
| finalReport | null mientras la rama esté activa; informe autorizado solo tras cierre |
| officialResult | null o resultado oficial mínimo, fijado al primer cierre, sin verdad oculta adicional |
| saveCapabilities | manualLimit=10, manualCount y permisos de guardar/cargar |
| recovery | Capacidades públicas necesarias para recuperar una operación; nunca prompt o secreto |

Los textos alternativos y labels se proyectan con el mismo permiso que el texto visible. No enviar el catálogo privado para traducir IDs en web. El informe de una rama cerrada no aparece automáticamente al volver a un guardado activo. El resultado oficial mínimo solo informa que ese caso ya contó para carrera.

## Catálogo y partidas

| Método/ruta | Entrada | Resultado |
|---|---|---|
| GET /cases | cursor y limit | items de CaseSummary, nextCursor o null |
| GET /cases/:caseId | ID accesible | CaseSummary, sin definición completa |
| POST /runs | {caseId,idempotencyKey} | 201 con PlayerViewDto inicial; repetición 200 con replayed=true |
| GET /runs | cursor, limit, status opcional active/closed | Resúmenes de partidas propias |
| GET /runs/:runId | Ninguna | 200 con PlayerViewDto actual |
| GET /runs/:runId/report | Ninguna | Informe de rama cerrada; 409 RUN_NOT_CLOSED si sigue activa |

CaseSummary: caseId, title, contentMode, difficulty, explorationMode, deadlineMinutes, contentVersion y canStart. No incluye solution, seed, objetivos secretos ni factIds no descubiertos. Solo se ofrece iniciar un caso validado y compatible. Un caso no disponible públicamente devuelve 404; un caso visible pero temporalmente no iniciable devuelve 409 CASE_NOT_READY al intentar crear partida.

POST /runs no acepta estado, propietario, reloj ni resultados. La elección de detective se resuelve con el perfil autorizado; no crea otro usuario. Varias partidas del mismo usuario no comparten reloj.

## Preview e interpretación

POST /runs/:runId/actions/preview acepta exactamente una alternativa:

~~~json
{
  "expectedVersion": 12,
  "input": { "kind": "text", "text": "Examinar la sala" }
}
~~~

La alternativa estructurada es input {kind:"actions",items:[...]}. Cada item usa una unión cerrada de tipos/params de SPEC-001. No hay params arbitrarios, SQL, expresiones ni instrucciones de herramientas. IDs y precondiciones se vuelven a validar; el cliente no obtiene permisos enviando una acción estructurada.

### Unión pública de acciones

Cada item estructurado contiene exactamente type y params. Campos no listados se rechazan. Los parámetros son solicitudes, no autorización:

| type | params públicos | Comprobación contextual de servidor |
|---|---|---|
| inspect | targetId; elementId opcional | Lugar/elemento conocido y accesible; general no implica recogida |
| collect | evidenceId | Objeto visible y recogible; no inventar posesión |
| talk | npcId, text; topicId opcional si ya es público | Personaje accesible, tema inequívoco y política de diálogo |
| travel | toCityId | Destino permitido y ruta existente; retraso no revelado |
| analyze | evidenceId; methodId opcional si hay varios métodos conocidos | Posesión/acceso y método admitido por caso |
| communicate | channel, recipientId, requestText | Canal/contacto internos disponibles, nunca email/teléfono/URL externos |
| query | topicId, subjectIds opcional (hasta 16 IDs) | Tema y sujetos públicos de consulta permitida |
| wait | minutes | Entero entre 1 y deadlineMinutes; el motor domina el empate y limita al plazo |
| request_warrant | suspectId, evidenceIds (1 a 16 únicos) | Solo prueba elegida y admisible; sin consultar culpabilidad |
| detain | suspectId, warrantId, locationId, mode | Orden, identidad y ubicación acreditadas; mode del caso coordinated/interactive |
| recover | objectId | Acceso/localización materializada según reglas |
| finish | Objeto vacío | Confirmación explícita y cierre por reglas; no acepta confirmed del cliente |

requestText y text tienen el límite general de 4000. channel es call, whatsapp, sms, email o fax, habilitado por la definición; son simulaciones del juego. No hay envío real a personas. mode no puede cambiar la modalidad fijada al generar el caso.

No se admiten type batch anidado ni batch_decision como item: items representa el lote plano; la decisión se tramita en su ruta con batchId. No aceptar dueMinute, duration, admissible, revealedFacts, confirmed, cooperation o cualquier otro efecto calculado por servidor.

La adaptación al motor existente es trabajo pendiente: hoy usa Record<string,unknown>, algunos nombres difieren y no valida todos estos campos. En particular, las pruebas seleccionadas de una orden, políticas de conversación, modo de detención y gestiones deben integrarse sin fingir que basta copiar params. El preview actual de viajes revela retraso seeded; no puede serializarse como el DTO público previsto.

El preview nunca modifica partida, memoria NPC ni reloj. Puede persistir metadatos operativos de la petición o del token. La salida tiene una de estas variantes:

| kind | Campos | Efectos |
|---|---|---|
| ready | runId, branchId, version, confirmationToken, expiresAt, requiresConfirmation, steps, estimate y knownConsequences | Ninguno |
| clarification | runId, branchId, version, question {code,text,options?} | Ninguno; sin token ejecutable |
| impossible | runId, branchId, version, reason {code,text} | Ninguno; explicación segura |
| closed | runId, branchId, version | Ninguno; la UI ofrece archivo/guardados |

Cada step: stepId, ordinal, type, label, target público si procede y estimatedMinutes. estimate: startMinute, minMinutes, maxMinutes, minEndMinute, maxEndMinute y posibles retrasos descritos sin revelar el sorteo. No presentar maxMinutes como tiempo real ya aplicado. Las opciones de aclaración solo nombran referentes ya disponibles; no sugieren sospechosos, evidencia ausente ni acciones recomendadas.

Ambigüedad en cualquier fragmento de la orden: clarification para el conjunto, sin ejecutar la parte clara. Un lote ya confirmado que falla al avanzar conserva los pasos anteriores según SPEC-001; son situaciones distintas.

requiresConfirmation es true ante coste, presión, irregularidad, cierre o consecuencia irreversible conocida. Una consulta gratuita sin esos riesgos puede confirmarse automáticamente por la UI con el token recibido, tras la orden explícita del usuario; el preview sigue siendo de solo lectura.

Token: aleatorio opaco de alta entropía, digest en servidor, ligado a usuario/runId/branchId/version, plan normalizado y versión de política. Caducidad: cinco minutos reales. Su contenido no se reconstruye desde texto remitido en el commit.

## Commit de acciones y secuencias

POST /runs/:runId/actions:

~~~json
{
  "confirmationToken": "TOKEN_OPACO_DE_EJEMPLO",
  "expectedVersion": 12,
  "idempotencyKey": "operacion-sintetica-0001"
}
~~~

Solo se ejecuta el plan persistido del token. No aceptar pasos, costes o hechos nuevos en este cuerpo. Respuesta 200:

~~~json
{
  "operationId": "op-01",
  "runId": "run-01",
  "branchId": "branch-01",
  "version": 13,
  "outcome": "applied",
  "replayed": false,
  "narrativeStatus": "factual",
  "events": [],
  "playerView": {}
}
~~~

playerView debe ser un PlayerViewDto completo: el objeto vacío solo abrevia este ejemplo. outcome: applied, impossible, clarification_required, batch_paused o case_closed. No mezclar un rechazo de validación HTTP con una consecuencia válida del motor. events contiene solo eventos públicos, cada uno con id opaco, sequence estable de servidor, minute, type y texto factual autorizado. No se serializa EngineEvent.payload sin proyección.

Un fallo del mundo en un paso puede dejar batch_paused y una nueva versión por los pasos aplicados; el coste de pasos omitidos es cero. Un comando rechazado sin transición no incrementa la revisión del juego.

POST /runs/:runId/batch-decision acepta batchId, decision cancel_remaining/continue_independent, expectedVersion e idempotencyKey. Cancelar registra la decisión sin volver a ejecutar pasos. Continuar produce un nuevo preview de pasos realmente independientes, sujeto a confirmación; no ejecuta el resto silenciosamente. Si ya no existe ese lote, 409 BATCH_NOT_PENDING.

POST /runs/:runId/finish usa el mismo cuerpo de commit y exige un token cuyo plan sea finish. No es un atajo para cerrar sin confirmación. La detención por sí sola no cierra el caso.

## Transacción, idempotencia y peticiones inciertas

Orden obligatorio en escritura:

1. Validar sesión, Origin/CSRF y forma del cuerpo.
2. Resolver propietario del recurso y bloquear la fila de partida.
3. Consultar la clave de idempotencia única por usuario/partida; el tipo de operación forma parte del digest, no de otro ámbito que permita reutilizar la clave.
4. Si existe: comparar digest canónico de operación/ruta/cuerpo validado; devolver el resultado previo o 409 IDEMPOTENCY_CONFLICT. Este paso precede a rechazar el expectedVersion antiguo o token caducado de un reintento legítimo.
5. Si es una operación nueva: comprobar revisión, rama, token, compatibilidad y precondiciones.
6. Aplicar el motor y persistir estado, eventos, memoria, autoguardado, operación y primer resultado oficial si corresponde en una transacción.
7. Consumir token y confirmar. La narración externa ocurre después de liberar la transacción.

No mantener bloqueos SQL durante IA o llamadas HTTP externas. Un fallo SQL antes del commit no consume el token ni deja un medio estado. Un cierre y una carga concurrentes se ordenan por el mismo bloqueo.

El digest ordena claves de objetos y conserva orden de arrays/valores de texto normalizados por el validador; no incluye CSRF ni cabeceras de transporte. La misma clave con otro tipo de operación no debe eludir la detección de conflicto: se registra también la identidad de operación junto a la clave única por usuario/partida.

GET /runs/:runId/operations/:operationId devuelve el resultado público de una operación propia persistida: estado committed, revision/branch del resultado y si sigue perteneciendo a la rama actual. Sin resultado persistido devuelve 404; no significa que sea seguro reenviar con otra clave. Reintentar con la clave original resuelve esa incertidumbre.

Si se repite una operación antigua después de cargar un guardado: devolver el resultado histórico con replayed=true y branchIsCurrent=false; nunca reaplicar en la rama nueva. La UI no sustituye su vista actual por esa proyección vieja y consulta GET /runs/:runId.

## Narración y recuperación

Una respuesta confirmada siempre contiene hechos públicos utilizables, aunque falle el proveedor. narrativeStatus es factual, generated o unavailable; no impide leer dossier, guardar ni recuperar estado.

La narración se vincula a operationId y branchId. Una respuesta tardía de otra rama puede conservarse en auditoría protegida, pero no modifica la memoria o conversación de la rama actual. No crear un endpoint de reejecución de acciones para recuperar prosa. En T3, el respaldo factual basta tras reinicio; la reproducción persistente de trabajos IA no exige anticipar el worker de fase 4.

## Errores uniformes

Formato: {error:{code,message,requestId,fieldErrors?}}. fieldErrors: lista de {field,code}, sin valores recibidos. No devolver stack, SQL, baseUrl, modelo privado, clave o motivo secreto de un rechazo.

| HTTP/code | Situación | Recuperación |
|---|---|---|
| 400 INVALID_REQUEST | JSON/esquema, exclusividad de input, campo extra o límite lógico | Corregir entrada, sin efectos |
| 401 SESSION_REQUIRED | Sesión ausente/revocada/caducada | Reautenticar; recuperar operación con su identidad original |
| 403 ORIGIN_REJECTED / CSRF_REJECTED | Mutación no autorizada por transporte | Recuperar sesión/CSRF, no reejecutar automáticamente |
| 404 NOT_FOUND | Recurso ausente o ajeno | No exponer diferencias |
| 409 VERSION_CONFLICT | Otra pestaña/acción cambió la revisión | GET actual y nuevo preview; no adaptar acciones automáticamente |
| 409 PREVIEW_EXPIRED / PREVIEW_INVALID | Token viejo, consumido en otra operación o de otra rama | Nuevo preview |
| 409 IDEMPOTENCY_CONFLICT | Misma clave, intención diferente | No reintentar; conservar diagnóstico sin datos privados |
| 409 RUN_NOT_CLOSED / BATCH_NOT_PENDING | Estado incompatible con operación | Refrescar vista |
| 409 SAVE_LIMIT_REACHED | Diez manuales existentes | Elegir borrado/reemplazo explícito |
| 422 SAVE_INCOMPATIBLE | Snapshot/versiones no compatibles | Conservar datos; no restaurar parcialmente |
| 413 PAYLOAD_TOO_LARGE / 415 UNSUPPORTED_MEDIA_TYPE | Transporte no admitido | Corregir petición |
| 429 RATE_LIMITED | Cuota antes de invocar IA/escribir | Retry-After; no cambiar de conexión sin elección |
| 503 AI_UNAVAILABLE / AI_TIMEOUT | Interpretación necesaria sin resultado | Sin token ni efectos; permitir consulta de datos existentes |
| 503 DEPENDENCY_UNAVAILABLE | DB u otro recurso necesario inaccesible | Recuperar misma operación cuando corresponda |
| 500 INTERNAL_ERROR | Fallo redactado inesperado | Estado incierto: consultar/reintentar misma clave |

Clarification/impossible son HTTP 200 en un preview válido, no 422. Un timeout antes del commit no se presenta como éxito. Un fallo de narración después del commit no transforma el resultado aplicado en 503.

## Diferencias respecto al código actual

PlayerViewDto, control de rama/revisión HTTP, ownership de partidas, operaciones persistidas y rutas de juego aún no existen. La API actual solo acredita su base. Los tipos públicos definitivos y validadores se implementarán juntos en contracts sin importar CaseDefinition al bundle. Las pruebas de aceptación del [catálogo detallado](../quality/T3-aceptacion-detallada.md) deberán demostrar estas reglas.

## Idempotencia al crear una partida

POST /runs todavía no tiene runId para bloquear o usar como ámbito. Su registro de creación utiliza unicidad por usuario+idempotencyKey, con kind=create_run y digest del cuerpo validado. En una transacción se reserva esa clave, se crea la partida y se vincula su runId al resultado. Dos solicitudes iguales concurrentes generan una única partida.

Una clave de creación con otro caseId devuelve IDEMPOTENCY_CONFLICT. Reintentar una creación ya confirmada devuelve la identidad de la misma partida; si ha avanzado, la UI consulta GET /runs/:runId para obtener el estado actual y no lo sustituye por la vista inicial histórica. La unicidad de otras operaciones sigue siendo por usuario+partida+idempotencyKey.
