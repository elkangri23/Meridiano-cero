# Conversaciones: contrato de dominio y persistencia

Revisión: 2026-10-28. Anexo de SPEC-001/002/005/006, GDD §7/8 y ADR-006. Tareas T3-01/T3-02/T3-04. DEC-016/018/019 son obligatorias. Este documento concreta la integración pendiente, sin presentar el servicio actual como conversación completa.

## Autoridad y tiempos

El NPC tiene personalidad, conocimiento limitado y memoria. La definición decide qué sabe y bajo qué condiciones puede decirlo. El motor decide relación, disponibilidad, legalidad y hechos revelados. La IA propone interpretación/selección expresiva limitada; no decide verdad, culpa, cooperación numérica o autorización.

Conversar, leer y pedir aclaración no avanzan minutos. Una consulta puede solicitar después una gestión con duración: es otra acción del motor y requiere el preview correspondiente. Presión o cobertura con consecuencias conocidas se confirma aunque el coste temporal sea cero. Un NPC no actúa autónomamente por tiempo real mientras se espera al proveedor.

No se muestran a la UI valores internos de cooperación ni se interpreta nerviosismo como culpabilidad.

## Política del expediente a materializar

Cada NPC conversable necesita una política versionada y validada antes de jugar. El contrato lógico contiene:

| Campo | Uso |
|---|---|
| npcId, personaPublic | Identidad/persona permitida; sin biografía secreta copiada al prompt |
| topics | Temas identificados con label público cuando se conocen y reglas de disponibilidad |
| knowledgeFactIds | Hechos que el personaje conoce; no equivale a permiso de divulgación |
| disclosureRules | Condiciones declarativas de lugar, hallazgos, relación o gestiones previas |
| allowedActs | Afirmación, reconocimiento, negativa o silencio según tema/estado |
| interactionRules | Efectos explícitos de trato/cobertura/presión y condiciones de riesgo |
| alternativeRouteRefs | Rutas que siguen disponibles ante pérdida de colaboración |
| authoredClaims | Testimonios predefinidos cuando el expediente requiera incertidumbre/error honesto |

No son expresiones ejecutables, prompts de autoridad ni funciones JS importadas. case-schema debe validar referencias y operadores. El fixture actual contiene knowledge/cooperation básicos; no contiene todavía este contrato completo. Ampliar esquema/fixture y pruebas antes de conectarlo. No rellenar silenciosamente reglas faltantes con improvisaciones del modelo.

La intensidad de cooperación, deltas y umbrales son datos del expediente y equilibrio, no valores universales elegidos por el adaptador. Una regla de presión no puede bloquear todas las rutas válidas salvo pérdida legítima ya prevista por plazo/retirada. La simulación comprobará esa condición.

## Intención y ambigüedad

Intención normalizada: npcId, topicId autorizado, interactionKind neutral/question/pressure/cover y referencias públicas necesarias. Estos nombres identifican categorías de dominio, no comandos arbitrarios del proveedor. Las categorías con efectos se habilitan solo si existe una regla de caso para ellas.

Orden con personaje, referente o tema ambiguo: clarification, sin alterar relación, memoria o reloj y sin ejecutar el fragmento claro. La pregunta solo pide el dato ausente; no completa una acusación ni señala cuál prueba sería útil.

El texto del jugador es contenido no confiable. Decir que es administrador o escribir un rol system no le confiere permisos. Una historia de cobertura puede aceptarse como intención narrativa, pero su éxito/efecto lo fija una regla explícita. Si no hay regla compatible se pide aclaración o se describe imposibilidad, sin crear documentos, identidades o evidencias nuevas.

## Construcción del contexto

El contexto se reconstruye en cada petición; no se guarda una sesión opaca del proveedor como autoridad de conocimiento.

1. Cargar partida propia, rama, revisión y estado del NPC.
2. Resolver el tema y calcular hechos divulgables por las reglas de la definición.
3. Intersectar conocimiento del NPC, condiciones de revelación y hechos permitidos para esa interacción.
4. Seleccionar memoria pertinente y volver a filtrar sus IDs según permisos actuales.
5. Adjuntar solo identidad/persona pública, pregunta actual, actos permitidos y textos factuales necesarios.
6. Aplicar presupuesto del modelo/proveedor elegido; si no cabe, reducir historial autorizado o fallar de forma operativa, sin quitar restricciones.

No enviar CaseDefinition completa, solution, todos los NPC, reglas de orden, umbrales de culpabilidad, claves o configuración privada. Un hecho puede ser revelable en esta conversación aunque aún no esté en dossier; no se envían otros hechos futuros por comodidad.

Las referencias a turnos anteriores usan turnId/factIds conocidos de esa rama. Si varios referentes encajan se pregunta. No completar por inferencia recuerdos de otra partida o de una rama abandonada. El contexto corto puede consultar fragmentos del historial persistido autorizado, pero no exige embeddings ni un servicio adicional.

## Hechos, actos y renderizado

El contrato actual de salida del modelo es {act,factIds}. No se acepta texto probatorio libre.

| act | Condición | Texto final |
|---|---|---|
| state | Uno o más IDs únicos autorizados, máximo 16 | Textos factuales del servidor |
| acknowledge | Ningún factId y acto permitido | Reconocimiento neutro, sin pistas |
| decline | Ningún factId y negativa permitida | Negativa sin insinuar culpabilidad |
| silence | Ningún factId y silencio permitido | Descripción neutra del silencio |
| null | Solo resultado operativo del servicio, nunca propuesto por modelo | Error/cancelación; sin turno ficticio |

Acto desconocido, campo extra, hecho oculto o duplicado: salida inválida. No limpiar la salida eliminando solo la parte peligrosa y conservar el resto como si fuera correcta. Usar respaldo autorizado; si no hay acto válido, respuesta operativa sin escribir diálogo.

Una afirmación de una persona no se convierte automáticamente en verdad objetiva ni evidencia admisible. Un testimonio conserva emisor, contexto, método y corroboración conocida; admisibilidad la decide el motor.

El GDD admite equivocaciones honestas e incertidumbre, pero nunca improvisadas por la IA. Para ellas debe existir una afirmación atribuida preescrita, con su creencia/alcance y relación con la verdad dentro de la definición. El primer caso no inventará este mecanismo si no está modelado; las ampliaciones se versionarán antes de habilitarlas. Un NPC puede callar o negarse sin mentir.

Gestos y tono no añaden valor probatorio ni recomendaciones. El equipo A.C.M.E. explica o tramita lo que permite el expediente; no propone la siguiente pista.

## Integración de una intervención

La conversación usa preview/commit de [API-juego](API-juego.md), no un endpoint que ignore versión o autorización.

1. Interpretar la pregunta sin efectos. Leer revisión y preparar de forma privada las opciones de diálogo.
2. Resolver reglas y selección factual antes del commit, si necesita proveedor; no mantener bloqueos de DB durante esa llamada. Si falla, preparar un respaldo permitido o una aclaración/error operativo.
3. El preview público describe hablar/preguntar y riesgos conocidos; no entrega de antemano una respuesta de NPC todavía no confirmada.
4. Al confirmar, revalidar revisión, rama, política y selección. Aplicar conjuntamente efectos de trato y hechos autorizados; persistir turno, memoria, relación, dossier, operación y autoguardado.
5. Renderizar la respuesta con textos autorizados. Cualquier narración posterior solo expresa los eventos ya confirmados y no cambia selección o cooperación.

Una consulta gratuita sin riesgo puede usar commit automático de la UI tras el envío explícito del texto, siguiendo el mismo contrato. Presión, suplantación u otra consecuencia irreversible requieren confirmación visible; la mera petición de preview no aplica sus efectos.

Si cambia la revisión durante la llamada al proveedor, se descarta el borrador para ejecución y se pide nuevo preview. No se aplica el diálogo a otro estado aunque el texto parezca aún razonable.

La implementación actual createDirector.converse devuelve texto/memoria pero no registra una conversación duradera ni aplica reglas del motor. La integración debe respetar estas etapas; no llamar a ese servicio desde HTTP y guardar solo el texto como si el contrato completo estuviera terminado.

## Memoria e historial

ConversationTurn persistido: turnId, runId, branchId, ordinal, operationId, npcId, gameMinute, pregunta privada del jugador, intención validada, acto emitido, factIds/textos autorizados y versión de política. La pregunta privada vive en el guardado de juego, no en logs operativos.

Memoria resumida actual: schemaVersion=1, runId, npcId, treatment y hasta doce turnos de actos/IDs. El resumen no añade hechos. restoreMemory valida datos y converse vuelve a validarlos al entrar.

El historial completo permite reanudar conversación; los doce turnos son un límite de contexto, no autorización para borrar historia del jugador. La memoria no cruza NPC, usuario, partida o rama. Se conserva el trato confirmado por reglas aunque la IA intente devolver otro.

Cargar un guardado restaura memoria, trato e historial de ese instante. El registro de operaciones de la rama anterior permanece fuera del estado jugable por auditoría/idempotencia, no vuelve a enviarse al NPC como recuerdo actual.

## Fallos y efectos

| Momento | Resultado obligatorio |
|---|---|
| Interpretación sin resultado | No hay acción, turno, presión ni avance de reloj |
| Selección factual inválida | Respaldo autorizado o mensaje operativo; nunca nuevo hecho |
| Cancelación antes del commit | Sin turno/memoria/relación nueva |
| Respuesta/error tras cancelación | Descartar para ejecución, incluso si el transporte no respetó aborto |
| Fallo SQL al confirmar | Ningún medio turno ni efecto parcial |
| Respuesta perdida tras commit | Consultar operación/reintentar misma clave; no hablar/presionar otra vez |
| Fallo de narración posterior | Conservar hechos y relación confirmados, mostrar respaldo factual |
| Carga durante una petición IA | Rama/revisión vieja no confirma ni escribe memoria en la actual |
| Proveedor personal falla | No usar claves ajenas ni cambiar al común sin elección explícita |
| NPC no conoce el dato | Silencio/negativa/error honesto solo si el expediente lo permite; no inferirlo de la solución |

## Aceptación de conversación

Casos granulares en [T3-aceptacion-detallada](../quality/T3-aceptacion-detallada.md). Requieren modelo real para juzgar comprensión y estilo, y dobles adversariales para garantizar fronteras. No se acepta una evaluación que apruebe solo porque cada error acaba en una plantilla segura.
