# SPEC-005 Integración de IA y fidelidad narrativa

Estado: cerrada para primer caso en T3-01 (2026-10-28). Ollama local como proveedor de referencia (REQ-G16-02); DTOs y presupuestos listos para T3-04.
Fuentes: GDD §4,7,8,16; TAD §6,8–10. ADR-006. ACC-002/005/016/018/038.

## Funciones y adaptadores

Cinco operaciones de dominio: generateCase, validateCase, interpretAction, narrateResult y converse. No obligar a cada proveedor a implementar funciones ficticias: adaptador transporta solicitudes/respuestas y declara capacidades; los servicios de dominio construyen contexto, validan salida y aplican reglas.

Contrato común: providerId, model, función, schemaVersion, contexto autorizado, límites, señal de cancelación y requestId. Respuesta: payload, uso observado o estimado, latencia, finishReason y error normalizado. Nunca introducir APIs de proveedor en engine.

Primer proveedor real: Ollama; doble determinista para CI. LM Studio y endpoint OpenAI-compatible después de comprobar compatibilidad. OpenAI, Anthropic y Gemini se incorporan con pruebas de contrato y sin dependencia de cuenta del creador. FreeLLMAPI se integra únicamente tras verificar protocolo y condiciones.

Roles configurables por instalación: generador, revisor y director. Una misma instancia/modelo puede ejercer varios roles; no exigir modelos distintos por arquitectura.

## Contexto y conocimiento NPC

interpretAction recibe texto, PlayerView y acciones disponibles; no solución completa. converse recibe identidad/persona del NPC, hechos que conoce y puede comunicar, fragmento de conversación pertinente y trato recibido. Un secreto conocido por el NPC no se vuelve automáticamente revelable: aplicar condiciones del expediente.

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
