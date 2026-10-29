# SPEC-001 Motor y tiempo

Estado: definido para el caso fijo; revisión 2026-10-27. Requisitos GDD §4,6,7,9–14. ADR-003/005/007. Tareas T2-01 a T2-06.

## Contrato y límites

Motor puro: resolveAction(definition, run, action) devuelve nuevo estado, eventos ordenados y resultado discriminado. No muta entradas. No obtiene hora real, números aleatorios, datos externos ni credenciales. Recibe un expediente ya validado y la versión compatible de motor. Validación estructural pertenece a case-schema; validación contextual y reglas pertenecen al motor.

Acciones iniciales: inspect, collect, talk, travel, analyze, communicate, query, wait, request_warrant, detain, recover y finish. Cada tipo tiene parámetros propios validados, nunca un diccionario arbitrario ejecutable. Los identificadores deben existir y ser accesibles. No desvelar por qué un ID oculto no es accesible.

Estados: active → closed. Una secuencia puede quedar awaiting_decision dentro de una partida activa; no ejecutar otras acciones que muten hasta cancelar/reanudar esa secuencia. El cierre es definitivo dentro de esa rama y el motor no admite acciones posteriores en ella. Cargar un manual anterior puede abrir otra rama mediante el servicio de guardados (DEC-017), sin borrar el primer resultado oficial (DEC-020); repetir desde inicio crea otra partida. Resultado de acción: applied, clarification_required, impossible, confirmation_required o case_closed. Errores técnicos se gestionan fuera del motor y no son consecuencias narrativas.

## Reloj

Tiempo entero en minutos desde inicio, con deadlineMinutes exclusivo para completar efectos. El caso comienza en 0. Pensar, teclear, leer, consultar atlas/dossier y conversar no avanzan el reloj. Acciones de inspección física, desplazamiento, análisis, verificaciones y espera tienen costes explícitos.

Para cada acción: validar precondiciones, obtener preview sin efectos, confirmar si procede y aplicar. Toda acción con coste positivo o irreversible requiere confirmación del jugador; una confirmación puede aprobar un lote completo y sus estimaciones. El coste real de un viaje puede incluir retraso seeded ya fijado; el preview declara esa posibilidad sin revelar el sorteo.

Si endTime >= deadline, avanzar únicamente hasta deadline, procesar eventos anteriores al plazo y cerrar por vencimiento. No aplicar efectos terminales de la acción ni eventos situados exactamente en deadline. Eventos con mismo minuto se ordenan por ordinal persistido; el cierre gana los empates con el vencimiento. No se penaliza dos veces el mismo retraso al reintentar.

Solicitudes programadas no adelantan el reloj por tiempo de pared: analyze/communicate/query encolan resultado con dueMinute; wait o acciones posteriores lo hacen madurar. Enviar una solicitud cuesta 0 minutos salvo tarifa explícita del expediente. El resultado nunca depende de lo que improvise el narrador.

## Secuencias

Validar cada paso contra el estado producido por el anterior. Hallazgos no interrumpen. Al faltar una decisión o ser imposible, persistir pasos ya aplicados y el resto pendiente. Ofrecer cancelar el resto o continuar los pasos independientes viables, con preview actualizado. Nunca saltar silenciosamente ni cobrar acciones omitidas. Las acciones dependientes del paso fallido no se ejecutan. La API asigna IDs por paso e impide duplicar efectos al reanudar.

Si el plazo vence, descartar resto pendiente y cerrar. Reanudar tras reinicio conserva cursor y confirmaciones; una versión distinta obliga a nuevo preview.

## Evidencias y personajes

Inspect general solo revela observaciones visibles; inspect específico evalúa reglas del elemento. Collect exige acción explícita o intención que implique recoger; no confundir descripción con posesión. Evidencias: objeto, observación, testimonio, análisis o registro. Cada una conserva origen, minuto, método, admisibilidad y relaciones sustentadas. Sin capacidad artificial de inventario ni combinaciones no definidas.

Talk solo puede emitir hechos autorizados por conocimiento y condiciones del NPC. La cooperación puede bajar sin bloquear todas las rutas. El motor actualiza conversación/relación; la IA no altera estos valores. Solicitudes al equipo recurrente entregan datos factuales, nunca valoraciones de rumbo.

## Órdenes, detención y cierre

Request_warrant evalúa suficiencia de evidencias admisibles mediante reglas del expediente, sin consultar guilty como criterio de concesión. Denegación no cierra. Detain exige orden activa, identidad confirmada y localización conocida; el modo interactivo requiere presencia del detective. El objetivo queda fijo cuando se satisfacen orden y ubicación; no hay fugas improvisadas. La detención no cierra el caso.

Recover exige posesión/localización accesible del objeto definido. Finish requiere confirmación y evalúa objetivos ya materializados. Resultado: incorrect si hay inocente detenido; complete si todos los objetivos se cumplen sin detenciones erróneas; partial si se logra al menos un objetivo sin error de detención; unresolved en otro caso. El vencimiento usa los mismos criterios sobre efectos logrados antes del plazo, conservando reason=deadline.

Carrera se aplica una sola vez por cierre, fuera de este primer contrato numérico. Partidas repetidas no vuelven a otorgar recompensas de un mismo expediente al mismo perfil.

## Aceptación

ACC-002 a ACC-013 y ACC-017. Comprobar entradas sin mutación, efectos al minuto exacto, eventos simultáneos, ausencia de movimiento en tiempo real, lotes, admisibilidad y replay con la misma semilla. Los costes concretos del fixture están en SPEC-003; el equilibrio global se cierra en SPEC-008.

## Frontera de integración detallada

El [API de juego](API-juego.md) valida una unión cerrada de acciones y adapta al motor; no entrega Record<string,unknown> sin comprobar al dominio. La versión del agregado HTTP y la secuencia de auditoría pueden ser distintas de las versiones/ordinales internos restaurados del motor.

Las políticas de conversación se desarrollan en [CONVERSACIONES](CONVERSACIONES.md). No se permite que el modelo amplíe efectos más allá de la transición validada.

## Revisión de ejecución v2: secuencia y vencimiento

2026-10-29, continuación T2-04/05. engineVersion=2 identifica la implementación corregida; no cambia ni reescribe el formato de definición engineCompatibility=1 ni los hechos/hash del expediente. Las transiciones rechazan una partida de ejecución v1: no la interpretan silenciosamente con reglas v2.

CaseRun v2 incorpora eventOrdinal, entero seguro no negativo, inicialmente cero. Resolve/confirm asignan ordinales consecutivos desde el contador del estado recibido y guardan el último en el estado devuelto. No hay contador mutable de proceso. Repetir el mismo input produce el mismo resultado aunque otras partidas actúen entre llamadas. Un preview/rechazo sin eventos no reserva ordinales. Versión no soportada, desbordamiento o contador inválido producen EngineStateError operativo sin transición; el servicio debe traducirlo a incompatibilidad/indisponibilidad, nunca a una consecuencia del mundo.

Las solicitudes internas reciben identidad determinista derivada de la versión interna de la transición; el ámbito es partida/rama, nunca una clave global de jobs. ActionLog y revisión HTTP siguen siendo registros independientes de la secuencia restaurable del motor. Un snapshot v2 deberá conservar eventOrdinal; una rama nueva conserva la secuencia de su snapshot y la API mantiene su auditoría fuera de él.

Los resultados pendientes se procesan por dueMinute, conservando orden de entrada en empates. Los eventos emitidos se ordenan por minuto y luego reciben ordinal persistible. Al vencer solo maduran solicitudes estrictamente anteriores al plazo; esperar/viajar no materializa un resultado situado exactamente en deadline.

Finish y deadline utilizan una sola evaluación de hechos de la partida. Un inocente detenido prevalece sobre éxitos; la recuperación exige el original del caso fijo, no cualquier string. Los flags achieved de la definición no acreditan acciones del jugador y nunca se mutan. Los alias históricos del caso fijo se resuelven por equivalencia explícita, no por substring de la solución. Objetivos arbitrarios no expresados por el modelo heredado no se consideran logrados por defecto; su vocabulario declarativo sigue pendiente.

Un viaje interrumpido por el plazo consume solo el tiempo restante y no cambia destino/descubrimiento de viaje. Confirmar después del cierre o mientras existe un lote pendiente no elude las mismas precondiciones que resolve. El análisis heredado queda acotado al plazo; esta corrección no implementa todavía el análisis programado de envío gratuito/+90 min ni los costes de inspección/detención/recuperación del fixture.

## Ejecución v3: evidencias y solicitudes del caso fijo

Esta continuación sustituye las limitaciones de análisis y órdenes descritas en la instantánea v2. engineVersion=3 incorpora reglas explícitas del caso fijo; el formato engineCompatibility=1, los hechos y el hash del expediente no cambian. No existe migración automática de progreso v1/v2.

Inspeccionar revela observaciones; recoger exige hallazgo físico visible y presencia en su origen. Solo EV-02 y EV-06 se recogen físicamente en este caso. Analizar EV-02 poseída envía gratis una solicitud de 90 minutos que revela EV-03. Las consultas canónicas de SPEC-003 producen registros a +30 minutos, sin cobrar envío. Solicitudes equivalentes pendientes y resultados ya conocidos no se encolan otra vez. Los vencimientos siguen procesándose en el reloj interno, estrictamente antes del plazo.

Máximo 32 solicitudes pendientes por partida. Alcanzarlo produce EngineStateError REQUEST_CAPACITY_EXCEEDED sin cambiar estado ni imponer castigo narrativo. Una solicitud interna con payload inválido o minuto no seguro produce REQUEST_STATE_INVALID; no se convierte en una prueba, orden o penalización del mundo. El límite acota memoria del motor; no sustituye las cuotas operativas futuras.

request_warrant recibe suspectId y evidenceIds: selección explícita de 1–16 IDs únicos, definidos y conocidos. Campos extra, evidencias ocultas, duplicadas o inexistentes se rechazan sin transición. La selección se copia al solicitar; la suficiencia y admisibilidad se verifican al madurar a +30 minutos. Una selección conocida pero insuficiente produce denegación, sin cerrar el caso. No se consulta culpabilidad ni solución para conceder autoridad. Una selección equivalente pendiente no crea otra solicitud.

Las órdenes no autorizan acceder a L-7 con pruebas omitidas: EV-05 o EV-08 debe estar incluida y ser admisible, además de la suficiencia para Inés. Detener exige orden correspondiente, identidad y ubicación conocidas y presencia exacta. Recuperar exige el original, presencia y acceso autorizado; una marca irregular controlada conserva inadmisibilidad. La acción jugable para entrada irregular con preview aún no está implementada.

**Límites pendientes:** costes de inspección/detención/recuperación, confirmaciones de acciones materiales y contrato completo de lotes. Estas reglas no se exponen todavía como acciones HTTP. La implementación usa módulos concretos del caso fijo; no acredita un lenguaje genérico de reglas para expedientes generados. [Evidencia v3](../quality/T2-evidencias-ordenes-v3.md).

## Ejecución v4: costes materiales y confirmación

Sustituye la limitación de costes de la entrega v3. Para el caso fijo, inspect general cobra 10 minutos; cerradura/caja 20; detain 15; recover 20. Repetir una inspección cuyo hallazgo ya es conocido no cobra de nuevo. Collect y envío de análisis/consultas conservan coste cero. Las estimaciones no convierten datos narrativos en permisos.

Resolve devuelve confirmation_required para acciones materiales con coste, wait y lotes/reanudaciones que consumen tiempo. No cambia estado, reserva ordinales ni devuelve eventos o hallazgos prospectivos. Un campo confirmed dentro de params no elude este protocolo. ConfirmAction revalida sobre el estado recibido, procesa vencimientos del intervalo y solo aplica el efecto material si termina estrictamente antes del plazo. La revisión/rama y vigencia de previews HTTP siguen pendientes del servicio: confirmar en el motor no sustituye su control de concurrencia.

Al interrumpirse una acción por deadline, se conserva el prefijo ya materializado y no su efecto terminal. Se emite action_interrupted con duración efectivamente consumida y se cierra; se descarta el resto del lote. Maduran solo solicitudes estrictamente anteriores al plazo. La procedencia del hallazgo se registra al terminar la inspección, no al empezar.

Los lotes admitidos en esta entrega siguen limitados a inspect/collect/talk, de 1 a 8 pasos, y validan su forma completa antes de aplicar un prefijo. Un paso contextualmente imposible pausa, conserva lo anterior y no cobra lo omitido. Continuar un resto costoso exige otro preview; cancelar no ejecuta el resto. La lectura de pendingBatch valida JSON, acciones, estados y ordinales: corrupción produce BATCH_STATE_INVALID operativo, sin transición. No acredita todavía lotes de viajes/órdenes u otras acciones ni dependencias explícitas entre pasos.

El cambio semántico se registra como engineVersion=4; no modifica el expediente ni su hash. Lectura inicial v1/v2/v3 sin reescribir; progreso antiguo requiere migración explícita. [Evidencia y límites v4](../quality/T2-costes-confirmaciones-v4.md).

## Creación pura con huella preparada

createInitialRun(definition, ownerId, runId, definitionHash) exige huella SHA-256 hexadecimal minúscula de 64 caracteres, calculada por un servicio autorizado sobre la misma definición estable. Una huella ausente/mal formada produce DEFINITION_HASH_INVALID operativo, sin crear estado ni narrar consecuencias. El motor comprueba su forma; no verifica por sí mismo que el valor corresponda al contenido y no admite procedencia del navegador como autoridad. Esa relación corresponde al servicio que prepara/persiste el expediente.

El motor deja de exportar hashDefinition e importar Node crypto. No se introduce proveedor de hashing, contenedor ni algoritmo propio en el dominio. Mismo input de definición/huella produce el mismo estado v4 anterior; la firma interna cambia, el formato/compatibilidad persistida no. [Evidencia de integridad](../quality/T2-motor-puro-integridad.md).

## Contrato interno de dependencias de lotes v5

El lote básico conserva de 1 a 8 acciones inspect/collect/talk. params contiene steps y opcionalmente dependencies, matriz interna de ordinales previos por paso. No es un campo público de API: el servicio debe determinar/validar independencia y aclarar ambigüedad antes de ejecutar. Cada lista tiene índices enteros únicos entre 0 y ordinal-1; referencias futuras, propias, duplicadas o fuera de rango rechazan todo el lote sin aplicar prefijo. Sin matriz, cada paso depende del anterior; lista vacía explícita indica independencia verificada por el servicio, no por una afirmación del modelo o cliente.

El snapshot del lote persiste dependsOn en cada paso. Al continuar, solo se ejecutan pendientes cuyos requisitos estén applied. Dependientes de impossible/skipped se marcan skipped, incluso transitivamente, sin ejecutar/cobrar sus acciones; se emite evento de omisión por ordinal sin datos ocultos. El paso fallido y el prefijo aplicado no se reintentan. Una nueva imposibilidad pausa conservando historial, dependencias y resto. Toda continuación produce un preview y necesita confirmación, incluso si cuesta cero; cancelar no ejecuta nada.

La lectura de lote persistido comprueba acciones y params básicos cerrados, ordinales, dependencias y coherencia de estados antes de continuar/cancelar. Corrupción produce BATCH_STATE_INVALID operativo sin modificación. No confiar en metadata antigua sin esas garantías. Se registra engineVersion=5 porque cambia la ejecución de reanudaciones; inicios v4 vírgenes siguen legibles sin escritura, pero progreso anterior no se ejecuta ni migra automáticamente. Viajes/órdenes y otros tipos de lote siguen pendientes, sin previews que revelen retrasos seeded.

La metadata de lote persistida se acota a ocho registros de hasta 4.096 caracteres cada uno antes de JSON.parse; reason tiene hasta 512 caracteres. No se trunca: exceso o incoherencia falla operativamente. Los tipos/params del lote básico son cerrados, sin efectos o campos extra. La matriz interna no se obtiene de propiedades heredadas. [Pruebas y límites v5](../quality/T2-dependencias-lotes-v5.md).

## Ampliación de lotes programados v6

Se admiten también analyze (evidenceId), query (topicId), wait (minutes entero seguro positivo) y request_warrant (suspectId y selección de 1–16 evidenceIds únicos). Los campos son cerrados; no se aceptan efectos calculados. La forma completa del lote se valida antes de aplicar prefijo y cada paso verifica contexto contra el estado del anterior, con los mismos handlers individuales. No se duplica lógica de maduración, admisibilidad o suficiencia.

Enviar laboratorio/consulta/orden no consume minutos. Esperas explícitas sí avanzan reloj y maduran resultados; el lote no añade esperas implícitas por depender de una solicitud. applied de un paso de solicitud significa enviada, no resultado disponible: si el siguiente requiere ese resultado sin esperar, falla contextualmente y pausa. Al continuar no se reintenta el fallo; se conserva historial y solo pendientes independientes autorizados pueden ejecutarse. Capacidad/estado corrupto siguen siendo fallos operativos sin penalización narrativa.

Los nuevos tipos conservan matriz/dependencias, máximo ocho, metadata acotada, preview antes de costes, confirmación de continuación y empate del plazo. Viajes, detención, recuperación, cierre y comunicaciones siguen fuera del lote en esta entrega. Se registra engineVersion=6 por ampliar las acciones ejecutables del lote; los inicios v1–v5 siguen en lectura estricta sin migrar progreso. Caso/hash y reglas individuales no cambian.

La selección de evidencias usa una comprobación compartida de forma para acción individual, lote y payload persistido: 1–16 IDs ASCII únicos, sin listas dispersas. La disponibilidad/conocimiento/admisibilidad sigue siendo contextual y no se sustituye por esa comprobación.

Versión de partida y ordinal son enteros seguros; una versión inválida o un resultado que desborde/regrese produce RUN_VERSION_INVALID operativo sin devolver transición. La validación se aplica antes de trabajar y al resultado prospectivo antes de ocultarlo detrás de una confirmación, además del resultado final. No es VERSION_CONFLICT HTTP ni una penalización ficticia. [Verificación de solicitudes en lotes](../quality/T2-lotes-solicitudes-v6.md).
