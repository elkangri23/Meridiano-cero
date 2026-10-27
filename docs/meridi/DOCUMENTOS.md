# Documentos recuperados de Meridi

El 27 de octubre de 2026 el usuario identificó estos dos archivos de Descargas como los documentos de la conversación anterior. Se conservan copias binarias sin cambios en `originales/` y extracciones de texto UTF-8 para consulta y búsquedas. Los Word son la fuente de referencia; las extracciones recorren párrafos y celdas en orden documental, pero no conservan el diseño ni la estructura visual de las tablas.

## Fuentes y estado

- [GDD v0.1 original](originales/ACME_GDD_v0.1_revision.docx): 19 apartados, fechado el 27 de octubre de 2026. Portada: borrador de diseño para revisión. [Texto](ACME_GDD_v0.1_revision.txt).
- [TAD v1.0 original](originales/ACME_TAD_v1.0_revision.docx): 19 apartados, misma fecha. Portada: propuesta para aprobación, diseño técnico sin implementación. Describe al GDD como aprobado. [Texto](ACME_TAD_v1.0_revision.txt).

Se ha comprobado igualdad SHA-256 entre cada archivo de Descargas y su copia:

| Archivo | SHA-256 |
|---|---|
| GDD | `9C78CE106D62950F3B69744A9A09376E407DC24D3243C0EEA86D7A2254C2D44E` |
| TAD | `47C6884D45747274F264664433CD988451910BBCD92A396E1EAC927C864EBD6B` |

La entrega de estos documentos recupera el contexto. Sus planes y menciones a aprobación o agentes se registran como contenido histórico, no como órdenes actuales para implementar, delegar o publicar.

## Diseño de juego recuperado del GDD

- Investigación internacional educativa y rejugable, estética MS-DOS y pixel art, órdenes en lenguaje natural. Nombre comercial definitivo pendiente; A.C.M.E. es el nombre utilizado en los documentos.
- Casos situados en el presente, incluidos misterios sobre hechos históricos. Parámetros: delito, dificultad, exploración guiada/libre, duración, región y contenido Familiar/General; opción SORPRÉNDEME.
- Expediente completo fijado antes de jugar: solución, cronología, motivaciones, personajes y conocimientos, escenarios, pruebas, análisis, registros, eventos y condiciones de resolución. Validación y simulación obligatorias antes de habilitar el caso. Sin pruebas ni escenarios investigables nuevos durante la partida.
- Libertad para equivocarse y viajar a destinos erróneos, sin avisos de rumbo correcto/incorrecto ni ayudas automáticas. Ciudades investigables finitas y destinos culturales separados; catálogo geográfico verificable.
- Inspecciones generales y específicas, recogida explícita o implícita en una orden, evidencias con procedencia y corroboración. Acciones encadenadas con coste acumulado; una imposibilidad pausa la secuencia y requiere decidir cómo continuar.
- NPC con personalidad, memoria y conocimiento limitado. Pueden callar, negarse o equivocarse honestamente, pero no inventar hechos, mentiras deliberadas o acusaciones falsas. Rutas alternativas evitan bloqueos por pérdida de cooperación.
- Equipo recurrente provisional: Margaret Sullivan, Dr. Samuel Richter, Elena Vázquez, David Nakamura y Clara Beaumont. Apoyo factual y operativo sin revelar culpables ni sugerir la siguiente pista.
- Reloj interno avanza solo por acciones con coste. Pensar, escribir, conversar, leer y consultar expediente o atlas no consumen tiempo. Tareas simultáneas progresan cuando avanza el reloj. Vencimiento estricto incluso a mitad de una acción; viajes con estimación y confirmación, retrasos ocasionales previstos en validación.
- Comunicaciones, laboratorio e inteligencia usan contactos, datos, resultados y tiempos fijados previamente. Orden de detención basada en suficiencia de pruebas, sin garantía de culpabilidad; posible inadmisibilidad por obtención irregular.
- Detenciones sin combate ni persecuciones violentas. Ubicación estable una vez existe orden válida y se conoce al sospechoso. Detener no finaliza el caso: cierre manual confirmado o por vencimiento, evaluación automática e informe completo.
- Carrera y reputación recuperable, todas las herramientas desde el inicio, autoguardado, varios casos independientes, reanudación y repetición sin explotación de puntos.
- Modo Familiar por defecto; General admite asuntos más serios sin violencia gráfica. Sin delitos sexuales, gore ni combates. Acciones irregulares con consecuencias proporcionales, sin sistema de salud ni muerte permanente.
- Audio retro, TTS opcional, traducción, teclado, lector de pantalla, contraste, daltonismo, escala y reducción de movimiento. Objetivo WCAG 2.2 AA.
- Importación/exportación de expedientes autocontenidos y validados desde la primera versión. Archivo comunitario y épocas históricas jugables fuera del alcance inicial.

## Arquitectura recuperada del TAD

- Backend autoritativo: el navegador recibe únicamente hechos revelados; la solución completa permanece en servidor. Respuestas IA no confiables, validadas por esquema y hechos autorizados.
- React + TypeScript + Vite; API Node.js LTS + Fastify; motor TypeScript puro; Zod/JSON Schema; PostgreSQL + Drizzle; Vitest/Playwright; pnpm y Docker Compose.
- Monorepositorio propuesto: `apps/web`, `apps/api`, `apps/worker`; paquetes `engine`, `case-schema`, `case-generator`, `ai-adapters`, `shared`, `ui`. Cola persistente inicialmente en PostgreSQL.
- Definición de caso inmutable separada de partida; versiones, hash, registro secuencial de acciones, transacciones, control de concurrencia e idempotencia.
- Flujo: texto → intención IA estructurada → validación → motor determinista → persistencia → narración limitada a hechos permitidos.
- Generación por etapas, validación dura, revisión semántica y simulación de rutas; intentos acotados y rechazo de expedientes incompletos.
- Adaptadores y modelos por función; Ollama/LM Studio y proveedores externos. FreeLLMAPI sujeto a verificar su protocolo. Desarrollo local con Ollama preferentemente fuera de Docker.
- Instancia pública gratuita con registro e IA del administrador; autoalojamiento independiente sin cuenta central, telemetría obligatoria ni llamadas al VPS del creador.
- Secretos fuera del frontend, políticas de destinos contra SSRF, cuotas, métricas, cancelación, límites globales, sesiones seguras, backups y restauración.
- Licencia objetivo del documento AGPL-3.0-only; avisos y créditos, atribución exacta y licencias de recursos pendientes de cierre.
- Fases propuestas: base, motor sin IA, caso fijo jugable, generador, experiencia y lanzamiento. El documento no demuestra que estén implementadas.

## Diferencias y continuidad

| Tema | GDD v0.1 | TAD y conversación posterior | Lectura para continuar |
|---|---|---|---|
| Plataforma | PWA instalable | Web responsiva sin exigir PWA | PWA no es requisito obligatorio posterior |
| IA de desarrollo | FreeLLMAPI por defecto | Desarrollo local con Ollama/LM Studio; FreeLLMAPI para el VPS público | Seguir la decisión posterior del usuario de desarrollar con IA local |
| Estructura | Módulos conceptuales; chat propone apps/server | apps/api y apps/worker | Usar el TAD como propuesta técnica más concreta |
| Licencia | Sin especificación equivalente | Usuario elige AGPL-3.0; TAD concreta AGPL-3.0-only | Conservar ambas procedencias; texto legal y atribución pendientes |
| Aprobación | Portada dice borrador | TAD llama aprobado al GDD; TAD se presenta para aprobación | No inventar el mensaje de aprobación ni considerar aprobado el TAD por la entrega del archivo |

El TAD declara que el GDD gobierna las mecánicas. Las diferencias técnicas anteriores se registran sin modificar ninguno de los originales. Permanecen abiertas las reglas numéricas, catálogo inicial, esquema detallado, modelos de referencia, protocolo/cuotas de FreeLLMAPI, autoría definitiva, licencias de assets y políticas de privacidad. El historial anterior del chat continúa pendiente; estos documentos recuperan diseño y arquitectura, no cada mensaje hablado.
