# SPEC-007 Generación, simulación e intercambio

Estado: detallada propuesta; cerrar antes de fase 4. Fuentes: GDD §3–5,16–18; TAD §8/9/13.
ADR-004/006/009. ACC-001/017/023/027/029/034.

## Parámetros y pipeline

Entrada: tipo de delito o aleatorio, dificultad, exploración, duración corta/media/larga, región o aleatorio y Familiar/General. SORPRÉNDEME selecciona valores admitidos y los muestra sin revelar trama. Todos los casos ocurren en el presente. Historia antigua puede ser objeto de investigación, no viaje a época histórica.

Estados de definición: draft → validating → validated o rejected. Solo validated y guardado íntegro permite crear CaseRun. Borradores y reportes secretos nunca se exponen como caso jugable.

Pipeline:
1. Fijar delito, objetivos, verdad y motivaciones.
2. Seleccionar geografía desde catálogo verificable, no aceptar ciudades inventadas.
3. Definir NPC, conocimiento, relaciones y cronología.
4. Construir lugares investigables y grafo de pistas con rutas alternativas.
5. Fijar pruebas, resultados de laboratorio/registros, tiempos y eventos.
6. Normalizar JSON declarativo y validar estructura/referencias.
7. Ejecutar coherencia determinista y revisión semántica independiente.
8. Simular rutas, errores y presupuestos temporales.
9. Persistir versión/hash/reporte y publicar metadatos jugables.

No generar contenido probatorio adicional durante la partida. Si falta un dato necesario, rechazar antes de jugar; no pedir a otro modelo que improvise la respuesta en ejecución.

## Puertas duras y semánticas

Duras: IDs únicos/referencias, tipos y límites, objetivos alcanzables, acceso legal o consecuencias definidas, pruebas admisibles suficientes, varios caminos, eventos ordenables, tiempo suficiente con retrasos previstos y sin softlocks. Comprobar que cierre/informe puede calcularse sin inferencia del modelo.

## T4-08 — Diseño real de la conexión (2026-11-06, autorizado por Antonio)

La generación se conecta de punta a punta: generar → validar → jugar. Decisiones cerradas aquí (no resueltas silenciosamente en el código):

1. **Lista canónica de delitos (reconciliación de las tres listas).** Unión de GDD §3, `ALLOWED_CRIME_TYPES` de T5-01 y `CrimeType` del generador: robo, desaparición, fraude, espionaje, sabotaje, misterio histórico, extorsión, contrabando, corrupción, falsificación, homicidio, secuestro (12). `aleatorio` sigue siendo modo de selección, no delito. Homicidio y secuestro solo se admiten en contenido General (GDD §14); el resto admite Familiar.
2. **Mecánica genérica en la definición, sin tocar el astrolabio.** `CaseDefinition` gana dos campos opcionales: `mechanics` (inspeccionables, consultas, análisis, evidencias por conversación, sospechosos con combinaciones de orden, recuperación) y `texts` (textos de evidencias, conocimiento, saludos y negativas); `NPC` gana `role` y `persona` opcionales. El fixture del astrolabio queda byte-idéntico (su `definitionHash` no cambia y la partida existente de Antonio sigue cargando); el motor usa la vía fija cuando no hay `mechanics` y la genérica cuando la hay. Los casos generados emiten siempre los objetivos `obj-detener` y `obj-recuperar` con las descripciones del expediente, así el informe final y el panel de objetivos funcionan sin cambios.
3. **Proveedor de generación: el defecto del administrador (FreeLLMAPI en el VPS).** Generar debe funcionar para cualquier usuario registrado sin clave propia; el coste lo asume el servidor (FreeLLMAPI gratuito). La conexión personal del usuario sigue mandando para jugar, no para generar. Límites anti-abuso: 1 job activo por usuario, máx. 3 jobs/día por usuario, 1 job concurrente por instalación, máx. 3 intentos por etapa, máx. 8 llamadas LLM por job, 30 min de pared por job.
4. **Worker dentro del proceso de la API (sin contenedor aparte).** El VPS corre una sola réplica de la API; el reclamo por lease en PostgreSQL impide el doble reclamo si algún día hay dos réplicas. El job se recupera desde el último checkpoint validado al expirar el lease.
5. **Pipeline: 6 llamadas LLM como máximo + etapas deterministas.** Premisa (delito, verdad, solución, motivaciones, objetivos, intro), NPC, red de pistas y textos en DOS llamadas —4a mundo (lugares, evidencias, textos) y 4b reglas (mecánica y ruta dorada, con los ids exactos de 4a en el contexto)—, revisión semántica independiente, y una reparación opcional si la revisión falla. La etapa 4 era una sola salida y el modelo fallaba cada vez en un detalle distinto (un id de lugar de 7 letras, consultas sin `requires`…) sin que los reintentos convergieran; dividirla en mundo y reglas fue el arreglo estructural. Cuando la ruta dorada no es jugable, la reparación recibe un diagnóstico determinista (`diagnoseGoldenPathFailure`): el primer paso rechazado explicado con los ids y el arreglo, en vez del error escueto del motor («Consulta no disponible»). Normalizar/validar (validador v1.5 + validación de mecánica), simular y persistir son deterministas. La simulación ejecuta la ruta dorada declarada por el generador a través del motor real y verifica el presupuesto; además verifica cierre parcial, no resuelto y detención errónea.
6. **Persistencia: `generation_jobs` (borradores y progreso) y `generated_cases` (catálogo publicado), migración 0008.** Solo un expediente validado entra en el catálogo; los borradores inválidos se rechazan con motivo y no se ofrecen.
7. **Textos en la definición y en la vista del jugador.** Los textos de un caso generado viajan con su definición y se sirven en `PlayerViewDto` (igual que hoy los del astrolabio van en el bundle web: mismo nivel de exposición; el juego no defiende al jugador de leer su propio cliente).
8. **Formulario: la dificultad va primera** (estaba bajo el pliegue y Antonio no la veía); selector de expediente cuando hay varios para el mismo delito+contenido; General se habilita cuando hay expediente General para el delito elegido; SORPRÉNDEME sortea entre todo lo disponible, incluidos los generados. La dificultad también se ve dentro de la partida, en la cabecera junto al reloj («Normal · 48 horas» / «Difícil · 24 horas» / «Fácil · 96 horas»), porque la vista del jugador la expone (`PlayerViewDto.difficulty`).
9. **Contenido Familiar/General.** Familiar: sin asesinatos ni temas perturbadores (el validador rechaza términos marcados); General: temas serios permitidos, sin detalle explícito ni gore. El control se aplica en el prompt y en el validador, no solo en uno.
10. **La dificultad de generación es `normal` con duración elegida (corta/media/larga).** La dificultad de la PARTIDA (fácil/normal/difícil, factor sobre el plazo) se sigue eligiendo al crearla, independiente del exp

**Verificación T4-08 (2026-11-06, local).** El diseño real coincide con los 10 puntos: proveedor de generación = defecto del administrador; worker dentro del proceso de la API con reclamo por lease; `generation_jobs` + `generated_cases` (migración 0008); puerta = validador v1.5 + contenido Familiar/General + simulación por el motor real (ruta dorada, cierre en minuto 0, detener sin orden, recuperar sin acceso); formulario con dificultad primera y selector de expediente. Typecheck limpio en los 8 paquetes/apps; unitarios 931/931; integración 109/109 (7 nuevos de jobs); suite web 23/24 (solo el preexistente del prototipo, primer-caso.spec.ts); lint cero errores nuevos frente a main. El motor unifica la vía fija y la generada en detención, recuperación, costes de inspección y ofertas, sin cambiar reglas; el fixture del astrolabio queda byte-idéntico y su `definitionHash` no cambia.

**Verificación T4-08 (2026-11-06, producción — smoke).** Job 1dfd99b9 (desaparición/Familiar/media, cuenta de prueba gen11) completó las 9 etapas en 126,2 s: etapas 1-3 en ~33 s, etapa 4 (4a mundo + 4b reglas) en ~78 s, revisión semántica y publicación en ~15 s; 6 llamadas LLM en total (premisa, NPC, 4a, 4b, revisión, sin reparación). La etapa 4 incluye la comprobación de jugabilidad por el motor real: la ruta dorada se ejecuta paso a paso y el job se rechaza si cualquier acción es imposible (detener sin identificar al sospechoso, consultar fuera de su lugar o sin su requisito, recuperar sin `warrant:access`). El caso publicado es generado-1dfd99b9 («Caso: desaparición en el Meridiano-cero»), visible en `GET /api/v1/cases` con `canStart: true`; una partida creada sobre él (Normal) muestra los dos objetivos y la inspección inicial revela EV-01. El smoke necesitó 31 intentos: 2 fallos transitorios MODEL_UNAVAILABLE de FreeLLMAPI (su proxy agota upstreams con timeout de 60 s y claves Cloudflare 401) y el resto, fallos de etapa 4 corregidos con prompt + validación + test (origen de EV-03, ids de lugar de 3-12 letras, identificar antes de detener, elementId '' en la sala, consulta en su lugar y tras su requisito, evidencia de acceso en la orden). La causa del error del proveedor se conserva ahora en el error del job (`unavailable (MODEL_UNAVAILABLE)`) en vez de un seco `unavailable`.

Semánticas: plausibilidad de delito, motivaciones, relaciones, geografía, tono y conocimiento individual. Modelo revisor produce hallazgos referidos a IDs; no basta «caso correcto». Un veredicto IA favorable no ignora fallo duro.

Simulación: mínimo dos rutas de éxito con pruebas decisivas independientes, un cierre parcial, uno no resuelto y, si aplica detención, una ruta errónea. Repetir con retrasos máximos y cooperación reducida. No afirmar garantía exhaustiva para todo texto posible: validar rutas y bloquear acciones fuera del vocabulario.

Calibración de dificultad/duración real exige sesiones de juego. Duración objetivo no se obtiene convirtiendo minutos reales en reloj interno de manera directa.

## Worker y cola

Jobs persistentes en PostgreSQL. Estados queued, running, succeeded, failed, cancelled. Reclamo atómico con lease y heartbeat; al expirar, recuperar de forma idempotente desde último checkpoint validado. Clave de deduplicación por solicitud de generación. Un resultado final se publica una sola vez.

Valores iniciales propuestos: un job de generación concurrente por instalación local; tres intentos completos por solicitud; dos recuperaciones de transporte por etapa como máximo. Presupuesto de tokens/tiempo validado antes de empezar y reducido en cada etapa. Configurables por administrador con límite global; no reintentos infinitos.

Cancelación: marcar intención persistente, abortar próxima operación segura, conservar diagnóstico mínimo y no publicar definición. No prometer reintegro de consumo ya realizado. Reintentar caso rechazado crea nuevo intento registrado.

## Intercambio

Formato previsto: un documento JSON UTF-8 con formatVersion=1, definition, catalogSnapshot de destinos usados y metadatos de procedencia/licencia. Sin ejecutables, operadores abiertos, assets remotos descargados automáticamente ni código de validación proporcionado por el archivo.

Límites iniciales: 2 MiB por archivo, profundidad JSON 32, 20 ciudades investigables, 100 localizaciones, 100 NPC y 1.000 evidencias. Son límites de seguridad de importación propuestos; ajustar mediante pruebas y cambio de spec, no según deseo del modelo.

Importar: comprobar tamaño antes de parsear, estructura, operadores, referencias, versión, hash y validaciones/simulaciones. No confiar en validated del archivo. Si referencia contenido geográfico no verificable, rechazar con explicación. Persistir solo tras aprobación; nunca alterar definición existente por colisión de ID.

Exportar: dueño autorizado confirma que contiene solución. Aviso de spoilers; no revelar datos personales de partidas, claves o conversaciones. El exportador no es proyección normal. Hash no es firma ni garantía de autoría. Versiones futuras se rechazan; migraciones futuras explícitas.

## Aceptación

T4-01 a T4-06. Probar caso bueno, insoluble, referencia rota, geografía inventada, tono no permitido, presupuesto agotado, reinicio durante etapa, lease vencido, cancelación, importación maliciosa y exportación autorizada. Todos los fallos deben impedir jugar y dejar estado operativo recuperable.

## Bordes y funcionamiento ante fallos

El [contrato de resiliencia](RESILIENCIA.md) y el [plan de observabilidad y residencia de datos](OBSERVABILIDAD-Y-DATOS.md) desarrollan las condiciones de fallo y medidas aplicables. El [catálogo de bordes](../quality/BORDES-EJECUCION.md) asigna pruebas y tareas por fase. Son contratos propuestos pendientes de implementación y verificación.

## Reutilización parcial del validador 1.1

T2 incorpora comprobaciones de tipos/referencias y aplica los límites de 20 ciudades, 100 lugares, 100 NPC y 1.000 evidencias antes de recorrerlos. Las demás listas se acotan internamente a 2.048 y los textos a 16.384 caracteres; rechazar, nunca truncar. No existe importador activo: tamaño bruto, profundidad JSON, operadores, geografía, simulación, publicación y jobs siguen pendientes. El reporte incluido por el archivo no concede aprobación y la revisión IA no sustituye los controles deterministas. [Evidencia](../quality/T2-validacion-expedientes.md).
