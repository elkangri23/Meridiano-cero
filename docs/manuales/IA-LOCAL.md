# IA local: adaptador y evaluación de T3-04

Estado: servicios de servidor implementados y probados con datos sintéticos. Evaluación real e integración con partidas pendientes. No configura la IA del prototipo visual.

## Comandos disponibles

Usar las versiones Node y pnpm del manifiesto raíz, instalar desde el lockfile y ejecutar desde la raíz:

~~~text
pnpm install --frozen-lockfile
pnpm eval:ai --mock
pnpm eval:ai --probe
pnpm eval:ai --model NOMBRE:ETIQUETA
~~~

Debe elegirse exactamente uno de los modos; argumentos desconocidos, modos mezclados o un --model sin valor se rechazan antes de acceder a la red.

El último comando necesita el nombre exacto de un modelo ya instalado, obtenido con --probe. No instala Ollama ni descarga modelos. El mock conoce las respuestas esperadas: valida contratos y el procedimiento, nunca comprensión de un modelo.

El endpoint predeterminado es http://127.0.0.1:11434. OLLAMA_ORIGIN permite otro puerto en ese mismo host literal; solo un origen HTTP sin ruta ni credenciales. No se aceptan DNS, direcciones externas ni redirecciones. Un Ollama remoto requerirá cerrar su autenticación, política de destinos, protección SSRF y transporte. No introducir su URL en campos del juego ni añadir claves al navegador.

El sondeo consulta versión e inventario con cinco segundos de límite. Un sondeo satisfactorio no ejecuta el corpus ni aprueba el modelo. Sin servicio devuelve JSON con evaluated false y salida 2. La evaluación devuelve salida 0 si pasan todos los escenarios y 1 si falla alguno. Una configuración inválida produce error.

Para obtener JSON sin los mensajes de pnpm:

~~~text
node --experimental-strip-types apps/api/src/ai/evaluate-cli.ts --mock
node --experimental-strip-types apps/api/src/ai/evaluate-cli.ts --model NOMBRE:ETIQUETA
~~~

El operador puede guardar la salida en un archivo nuevo. El informe identifica fecha, runtime, hardware general, modelo/digest, versión Ollama, parámetros, corpus, resultados, latencias y tokens observados cuando se entregan. No incluye prompts, respuestas completas, nombre del equipo ni credenciales. Uso desconocido queda en null, nunca se presenta como cero.

## Servicios y autoridad

createOllamaProvider transporta interpretAction, narrateResult y converse; createDirector prepara el contexto y valida resultados. Generación y revisión de expedientes aún no se implementan. El doble CI se selecciona expresamente y no sustituye silenciosamente al proveedor cuando falla.

La interpretación recibe texto, escena pública y ofertas de acción construidas por el servidor. Devuelve IDs en orden o aclaración; no acepta parámetros libres ni ejecuta acciones. La API futura resolverá esos IDs bajo la misma partida/versión y aplicará preview, autorización, confirmación e idempotencia de SPEC-004. Una selección válida no prueba que la acción sea posible.

La narración recibe únicamente hechos públicos derivados de eventos confirmados. El modelo selecciona IDs y el texto se obtiene de las descripciones autorizadas, sin prosa probatoria libre. Deben aparecer todos los hechos del resultado. Omisiones, JSON inválido, hechos nuevos, timeout o cancelación de narración activan respaldo con los hechos originales. No se vuelve a llamar al motor.

En conversación se intersectan hechos conocidos y revelables del NPC. También se restringen los actos de habla: afirmación factual, reconocimiento de consulta, negativa y silencio. El silencio solo se emite si el servidor lo permite. Una negativa definida por el servidor impide que el respaldo factual revele hechos. Coberturas y presión del jugador son texto no confiable: el modelo no modifica cooperación ni permisos.

## Memoria y reanudación

La memoria versión 1 tiene ámbito partida/NPC, trato decidido por reglas y hasta doce turnos de IDs factuales/actos de habla. No guarda prosa generada, instrucciones del jugador ni resúmenes inventados. Restaurar mediante restoreMemory, nunca mediante una conversión de tipo de JSON desconocido.

Antes de enviarla se vuelven a filtrar sus IDs con los permisos actuales. Cancelar una conversación no añade turno, aunque la respuesta o un error de transporte lleguen después del aborto. Un fallo sin acto autorizado devuelve un mensaje operativo con act null y no inventa diálogo ni añade memoria. converse devuelve memoria nueva; el llamador la guardará transaccionalmente por usuario/partida/NPC. La persistencia PostgreSQL y el historial completo dependen de T3-02 y no se implementan aquí.

## Presupuestos y fallos

- Interpretación: 30 segundos; narración/conversación: 60 segundos, incluidos reintentos.
- Un reintento por fallo de conexión o HTTP 503. Sin reintentos por salida inválida ni corrección automática.
- Hasta 4000 caracteres de orden, 64 ofertas y ocho acciones por interpretación.
- Hasta dieciséis hechos; ID de hasta 128 caracteres y texto de hasta 2000.
- Contexto serializado: 6000 bytes; cuerpo completo: 7168; respuesta: 65536, incluso sin Content-Length.
- Temperatura 0, num_predict 512 y num_ctx 8192. No se recorta contexto: un exceso produce aclaración/respaldo.
- Los límites en bytes son guardas conservadoras, no un contador universal de tokens. Verificar ventana efectiva, tokenización, latencia y fidelidad del modelo real antes de aprobarlo.

Se propaga cancelación al transporte y se cierran temporizadores/lectores. Cancelar no garantiza recuperar consumo iniciado. Errores normalizados no contienen cuerpos de respuesta, prompts ni detalles de red.

## Pendientes para jugar

Completar DTO públicos, sesiones, ownership, preview/commit, persistencia y ActionLog en T3-02; conectar la pantalla en T3-03; evaluar un modelo instalado sobre el caso fijo y ambas rutas. Las pruebas sintéticas no cierran ACC-005/016/018/038 ni el hito 3.

Protocolo consultado: [API chat oficial](https://docs.ollama.com/api/chat) y [salida estructurada oficial](https://docs.ollama.com/capabilities/structured-outputs). Validar estructura no sustituye comprobar IDs y permisos.


## Corpus versión 2 y CI

La evaluación contiene diecisiete escenarios. Añade conversación con memoria serializada/restaurada, referencia al turno anterior y retirada de permisos de revelación. La retirada se aplica tanto a los hechos actuales como a los IDs del historial que viajan al proveedor.

Las pruebas del evaluador exigen que timeouts, proveedor no disponible, salida inválida o aclaración para todas las órdenes claras hagan fallar la evaluación. Un texto factual de respaldo puede ser seguro y, a la vez, significar que el modelo no supera el escenario.

El workflow incluye pnpm eval:ai --mock expresamente, sin modelo ni acceso a un proveedor externo. Configurar ese paso no equivale a haberlo ejecutado en GitHub. El doble continúa siendo un oráculo determinista, sin prueba de calidad de un modelo real.

## Entorno local no significa proveedor obligatorio

Esta guía describe la CLI Ollama implementada, no un requisito universal. DEC-018 aclara Ollama en casa y FreeLLMAPI en trabajo/VPS. Las instalaciones propias podrán escoger proveedor/endpoint, y DEC-019 añade al VPS claves personales opcionales además del proveedor del administrador.

AiProvider ya separa los servicios del transporte; faltan adaptadores externos y resolución de configuración. [Contrato genérico](../specs/IA-proveedores.md). La restricción 127.0.0.1 pertenece al adaptador Ollama actual: no se impone a FreeLLMAPI ni se presenta como soporte remoto ya terminado. No hace falta disponer de Ollama para seguir desarrollando y probando con dobles.
