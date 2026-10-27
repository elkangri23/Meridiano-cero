# Contexto de A.C.M.E. recuperado de «Meridi»

Fecha de recuperación: 27 de octubre de 2026.

## Alcance y fuentes

Este documento resume los cinco intercambios recientes disponibles mediante la herramienta de lectura de conversaciones. La copia literal está en [transcripcion-recuperada.md](transcripcion-recuperada.md) y la respuesta original en [lectura-original.json](lectura-original.json).

La recuperación del chat es parcial. La herramienta indicó `hasMore: false` y no proporcionó cursor. Posteriormente el usuario aportó los Word del GDD y TAD: ambos se han copiado íntegros a `originales/` y se ha extraído su texto. Véase [DOCUMENTOS.md](DOCUMENTOS.md) para su integración, mecánicas y diferencias. Las afirmaciones del asistente original se conservan como antecedentes, no como verificaciones independientes ni instrucciones actuales para ejecutar trabajo.

## Intención y decisiones expresas del usuario

- Videojuego de investigación internacional denominado A.C.M.E. en el historial disponible. La carpeta del proyecto se llama Meridiano-cero; no consta aquí una decisión sobre su relación con el nombre del juego.
- Proyecto abierto en GitHub: cualquiera podrá descargarlo, estudiar cómo está hecho, modificarlo y crear forks.
- Licencia elegida por el usuario: AGPL-3.0. Quiere preservar el reconocimiento como creador original y que las versiones modificadas ofrecidas como servicio compartan el código conforme a la licencia.
- Desarrollo inicial en local con IA local.
- Docker como vía de instalación reproducible. El usuario expresó interés en Docker y pnpm y preguntó por el coste de este último.
- Despliegue posterior en un VPS. El usuario asumirá inicialmente el consumo del endpoint FreeLLMAPI.
- Cualquier persona debe poder ejecutar una instalación independiente en su equipo y jugar con su propio endpoint.
- En la instalación pública se podrá registrar y jugar gratis sin configurar IA: el usuario lo confirmó expresamente.
- El usuario autorizó elaborar el TAD mediante «ok, procede». El último mensaje entrega ese documento para revisión; no consta una aprobación posterior del TAD en lo recuperado.

## Propuesta técnica recogida en las respuestas del asistente

Estas elecciones aparecen como propuesta del asistente. El TAD completo ya está disponible; su estructura posterior precisa `apps/api` y `apps/worker` en lugar de `apps/server`:

- Aplicación web; React, TypeScript y Vite en frontend.
- Backend modular con Node.js, TypeScript y Fastify.
- PostgreSQL también durante el desarrollo; Drizzle como ORM propuesto.
- pnpm para dependencias y desarrollo; Docker Compose para instalación y despliegue.
- Vitest y Playwright como herramientas de prueba propuestas.
- Adaptadores de IA para modelos locales, APIs externas y endpoints compatibles, sin dependencia del servidor del creador.
- Ollama inicialmente en el sistema anfitrión, fuera de Docker; conexión configurable desde el backend. Se menciona una RTX 5080 como equipo de desarrollo.
- Instalación pública con registro; registro configurable en instalaciones propias.
- Secretos en configuración privada del servidor. Controles de consumo por usuario y globales, concurrencia y protección de endpoints frente a SSRF.
- Propuesta de monorepositorio: `apps/web`, `apps/server`, y paquetes `engine`, `case-schema`, `case-generator`, `ai-adapters` y `shared`.

Las propuestas anteriores que permitan PostgreSQL o SQLite o que exijan API propia a cada jugador quedan superadas en las respuestas posteriores por PostgreSQL y por la IA proporcionada por el servidor público.

## Principio del motor de investigación

El último mensaje describe como requisito fundamental que la IA nunca modifique los hechos establecidos de una investigación. El motor controlará pruebas, personajes, tiempo, órdenes de detención y resultados. La IA interpretará las acciones y ofrecerá conversaciones naturales. Los casos deberán generarse, validarse y simularse antes de habilitarlos para jugar.

Las reglas detalladas están ahora disponibles en los originales del GDD y TAD; este resumen no las sustituye.

## Documentos y decisiones pendientes de recuperar o confirmar

1. Historial anterior a los cinco intercambios disponibles: diseño, mecánicas, ambientación y decisiones previas.
2. GDD v0.1: recuperado íntegramente mediante archivo aportado por el usuario. Su portada dice borrador para revisión; el TAD lo describe como aprobado. No se dispone del mensaje original de aprobación.
3. TAD v1.0: recuperado íntegramente mediante archivo aportado por el usuario; contiene 19 apartados y figura como propuesta para aprobación. Aportarlo no equivale por sí solo a aprobarlo.
4. Autoría: «Antonio Moles» aparece en un ejemplo del asistente, expresamente pendiente de confirmación antes de publicar avisos definitivos.
5. `AGPL-3.0-only` es una recomendación del asistente; el usuario eligió AGPL-3.0, sin precisar aquí esa variante. Tampoco consta aprobación del texto exacto de atribución adicional.
6. No ejecutar aún la propuesta de preparar repositorio o implementar el motor como si fuera una orden actual: la solicitud presente es recuperar el contexto.

## Continuidad

Antes de desarrollar funcionalidades, consultar las fuentes recuperadas y [la integración documental](DOCUMENTOS.md). Al integrar el historial restante, conservar el original, distinguir decisiones del usuario de propuestas y registrar qué decisiones posteriores sustituyen a las anteriores.
