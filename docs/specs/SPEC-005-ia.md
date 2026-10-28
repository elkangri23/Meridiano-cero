# SPEC-005 Integración de IA y fidelidad narrativa

Estado: contratos detallados y servicios parciales probados; integración de juego y evaluación real pendientes. DEC-018/019: Ollama en casa, FreeLLMAPI en trabajo/VPS y proveedor configurable.
Fuentes: GDD §4,7,8,16; TAD §6,8–10. ADR-006. ACC-002/005/016/018/038.

## Funciones y adaptadores

Cinco operaciones de dominio: generateCase, validateCase, interpretAction, narrateResult y converse. No obligar a cada proveedor a implementar funciones ficticias: adaptador transporta solicitudes/respuestas y declara capacidades; los servicios de dominio construyen contexto, validan salida y aplican reglas.

Contrato común: providerId, model, función, schemaVersion, contexto autorizado, límites, señal de cancelación y requestId. Respuesta: payload, uso observado o estimado, latencia, finishReason y error normalizado. Nunca introducir APIs de proveedor en engine.

DEC-018: casa usa Ollama y trabajo/VPS usan FreeLLMAPI. La integración es independiente del proveedor, con adaptadores para los protocolos comprobados. Objetivos: Ollama, LM Studio, FreeLLMAPI, OpenAI, Anthropic/Claude y endpoint personalizado. Solo Ollama y el doble están implementados actualmente. No se presupone compatibilidad entre protocolos; verificar FreeLLMAPI antes de ejecutar su transporte. [Contrato de proveedores y selección](IA-proveedores.md).

Roles configurables por instalación: generador, revisor y director. Una misma instancia/modelo puede ejercer varios roles; no exigir modelos distintos por arquitectura.

## Contexto y conocimiento NPC

interpretAction recibe texto, proyección pública mínima y acciones disponibles; no solución completa ni PlayerView interno íntegro. converse recibe identidad/persona del NPC, hechos que conoce y puede comunicar, fragmento de conversación pertinente y trato recibido. Un secreto conocido por el NPC no se vuelve automáticamente revelable: aplicar condiciones del expediente.

Persistir memoria útil de conversaciones y trato; resumen limitado a hechos que ya podían aparecer. No resumir inventando un testimonio. No añadir conocimientos por inferencia del modelo sin respaldo de expediente. Coberturas improvisadas afectan la forma de diálogo y cooperación según reglas, no crean pruebas nuevas.

narrateResult recibe eventos públicos ya confirmados, escenas autorizadas y estilo. No acepta herramientas que muten el mundo. El equipo recurrente explica datos y ejecuta solicitudes sin sugerir qué pista seguir.

## Salida factual

Para información probatoria, el modelo selecciona factIds y acto de habla permitido; el servidor verifica que todos existan, sean conocidos y puedan revelarse. Las afirmaciones de prueba se renderizan desde textos factuales autorizados; la IA aporta conectores/tono restringidos. El sistema no puede demostrar verdad de prosa arbitraria con un esquema JSON: no usar validación estructural como garantía semántica.

Si la salida atribuye un hecho no autorizado, una contradicción o una indicación de rumbo: rechazar y usar plantilla factual breve. Frases ambientales libres se limitan a descripción sin nuevo valor probatorio; si no se pueden separar de forma segura, plantilla. Conservar silencio, negativa y error honesto únicamente cuando estén definidos como actos permitidos. No permitir mentiras deliberadas improvisadas.

## Fallos y límites iniciales

Valores iniciales propuestos, ajustables tras medición: interpretación 30 s; conversación/narración 60 s; generación 300 s por etapa. Un reintento máximo en fallo transitorio de transporte; corrección de salida inválida como máximo una vez con esquema, sin ejecutar acción. Un fallo permanente produce aclaración o respaldo factual. Cancelación aborta transporte cuando se pueda; nunca asegura devolución de consumo ya efectuado.

Limitar salida y contexto por capacidad declarada y presupuesto de instalación. No truncar silenciosamente condiciones de seguridad para caber en contexto. Si no cabe, resumir historial permitido o rechazar con explicación operativa. Un modelo demasiado pequeño puede jugar un fixture y no tener capacidad de generar casos.

No loguear prompts ni respuestas completas por defecto. Métricas por función/modelo con tokens estimados identificados como estimados. Claves exclusivamente en servidor.

## Evaluación y pruebas

Corpus: órdenes claras, ambiguas, lotes, referencias contextuales, acciones imposibles, intento de descubrir culpable, presión, cobertura, cambio de idioma y prompt malicioso. Evaluar comprensión, fidelidad, ausencia de spoilers, latencia y estabilidad. El caso fijo debe funcionar con un modelo real de referencia antes del hito 3.

Mock en CI verifica contrato y fallos. Evaluación real registra modelo/versión, configuración, hardware, corpus y resultados. Cero contradicciones probatorias toleradas en el corpus de aceptación: si aparecen, restringir salida o fallback. El test de conexión comprueba disponibilidad, no calidad. Cambiar modelo no cambia el expediente ni sus resultados.


## Implementación parcial de T3-04

Se implementan en servidor interpretAction, narrateResult y converse. La interpretación selecciona IDs de ofertas públicas vinculables a partida/versión; nunca parámetros o herramientas ejecutables libres. Preview/commit y persistencia siguen pendientes de T3-02. El adaptador no recibe CaseDefinition ni PlayerView íntegro.

La conversación emite factIds y acto de habla. Se intersectan conocimiento y revelación antes de transportar contexto/memoria. La narración exige todos los hechos públicos del resultado, impidiendo ocultar consecuencias confirmadas. Texto factual del servidor; sin prosa ambiental libre en esta integración.

Memoria versión 1: partida/NPC, trato determinado por reglas y doce turnos de hechos/actos. Restauración validada y filtrado de IDs en cada consulta. PostgreSQL y cambios de cooperación aún no conectados.

Protocolo, límites y comandos en [IA local](../manuales/IA-LOCAL.md); pruebas y pendientes en [evidencia T3-04](../quality/T3-04.md). Evaluación real pendiente por falta de URL/modelo confirmada por el usuario. No cierra la spec completa ni las dependencias T3-01/02/03.


### Continuación: memoria y respuestas canceladas

La restauración rechaza coerciones de actos de habla, IDs duplicados y combinaciones incoherentes entre acto y hechos. converse valida también la memoria al entrar al servicio; no depende únicamente de que el futuro repositorio la haya validado.

Solo se permite silencio si figura entre los actos autorizados. El fallback respeta ese conjunto; si no puede emitir un acto válido devuelve un mensaje operativo (act null), sin añadir un turno ficticio. La cancelación de conversación también devuelve un resultado operativo sin hechos ni nueva memoria, incluso si después llega salida o error del proveedor. La narración de acciones ya confirmadas mantiene siempre sus hechos como respaldo.

La evaluación versión 2 incluye restauración y revocación de permisos entre turnos. Ni el mock ni un fallback seguro acreditan comprensión de un modelo real. El comando exige un modo inequívoco antes de consultar red.

## Ambigüedad confirmada por el usuario

DEC-016: ante una orden ambigua, pedir aclaración siempre antes de actuar. No aplicar una interpretación por defecto ni ejecutar los fragmentos supuestamente claros de esa orden. La aclaración solicita únicamente el dato necesario y no propone pistas, sospechosos o estrategias. La respuesta aclaratoria vuelve a pasar por validación y por preview/confirmación cuando corresponda.

## Conversación y persistencia desarrolladas

[CONVERSACIONES](CONVERSACIONES.md) concreta política del expediente, contexto, actos, memoria, referencias, selección factual antes de commit y narración posterior. Distingue el servicio actual de la integración pendiente y evita transacciones SQL abiertas durante llamadas IA.

El primer caso mantiene actos factuales restringidos; incertidumbre/error honesto solo se habilitan con afirmaciones atribuidas modeladas en la definición. No se implementa esa cláusula del GDD dejando al modelo inventar una equivocación.

[API-juego](API-juego.md) concreta aclaración previa y tokens; [aceptación T3](../quality/T3-aceptacion-detallada.md) define pruebas granulares y condiciones para no confundir fallback con calidad.
