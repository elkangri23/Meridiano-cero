# T3: consulta de ficha inicial desde el archivo

Entrega parcial de T3-03/T3-07, 2026-10-29. Continúa la creación recuperable sin habilitar acciones o presentar una lectura histórica de creación como progreso actual.

## Comportamiento implementado

Cada fila del archivo propio permite Consultar. La selección solo acepta un ID de la página actual; esa comprobación limita la navegación de la interfaz, no sustituye la autorización del servidor. El cliente realiza GET /api/v1/runs/:runId, con cookie de mismo origen, no-store, rechazo de redirects, presupuesto de ocho segundos y lectura de respuesta limitada a 131072 bytes.

La pantalla muestra referencia, revisión, reloj/plazo, ciudad, lugar, descripción pública y ciudades visibles. Solo renderiza los textos autorizados como texto React; no interpreta HTML, URLs, instrucciones o acciones. Conserva la paleta de terminal, tipografía monoespaciada y controles rectangulares MS-DOS. No se incorporan dependencias ni imágenes provisionales ajenas a la estética acordada.

Consultar/cerrar/cancelar no envía mutaciones, no crea otra partida y no avanza el reloj. La lectura inicial disponible sigue restringida a revisión uno sin progreso. Un error o un 503 no se reemplaza por datos de muestra ni por una respuesta previa de POST /runs. El mensaje explica las posibles causas y permite volver a actualizar el archivo, sin afirmar que una causa concreta haya sido diagnosticada.

## Frontera de datos

isInitialPlayerViewDto vive junto al contrato público. Valida la lista cerrada de campos raíz y anidados; UUID de partida/rama; schemaVersion=1, version=1, estado active y minuto cero; plazo entero positivo; colecciones iniciales vacías, informes nulos y capacidades de guardado/recuperación exactas. Las listas geográficas están limitadas a cien entradas, con IDs únicos, textos acotados y posición coherente con las listas. Cada descripción admite hasta 16000 unidades UTF-16; el límite global de transporte continúa aplicándose antes del parseo.

El cliente comprueba además que el runId recibido coincide exactamente con el solicitado. Un replayed adicional de POST de creación, estado privado, progreso o capacidad inesperada se rechaza antes de presentarse. No se importa engine, expediente privado ni DB al frontend. El servidor mantiene autorización y rechazo de progreso anteriores; no cambian semántica del motor v13, validador 1.4, fixture o hashes.

## Coordinación y accesibilidad

La consulta participa en la generación/cancelación del modelo del archivo. Cerrar durante la lectura invalida su ticket y aborta el transporte; una promesa que ignore abort tampoco puede reabrir la ficha. Logout, cambio de filtro y actualización retiran datos seleccionados e invalidan respuestas anteriores. Los fallos no fabrican estado de partida ni reenvían creación.

La ficha es una sección con título accesible, no un diálogo modal ni una ventana completa de investigación. Al abrir se enfoca su título; al cerrar/cancelar se solicita devolver el foco al botón Consultar una vez actualizado el estado. El botón de cancelación está disponible durante la lectura. Los controles nativos conservan foco visible; textos largos pueden partir línea. Esto describe la implementación y su revisión estática: no acredita todavía ensayo manual de teclado, lector, zoom o viewport para esta ficha.

## Pruebas

Dieciocho escenarios generales nuevos: trece del cliente y cinco del modelo. Cubren GET del ID seleccionado, rechazo de campos privados/replay/progreso, capacidades inesperadas, IDs duplicados o posición inconsistente, respuesta de otra partida, fallo de API, intento de manipular ruta sin petición, selección no presente en página, cierre/abort con respuesta tardía, logout, cambio de filtro y error sin fabricar inicio. Los dobles son sintéticos y no sustituyen prueba de navegador.

La integración PostgreSQL/HTTP existente de lectura propia/otra instancia/otro usuario incorpora una comprobación del DTO real con el mismo validador que usa el cliente y verifica no-store. Conserva sus pruebas de 404 indistinguible para otro propietario y de rechazo de progreso. No se añade un endpoint, migración o supuesto permiso nuevo.

## Límites y siguientes pasos

No implementa reanudación de progreso, órdenes, preview/commit, ventanas movibles/minimizables, mapa interactivo, conversación, guardados, resultado oficial o carrera. T3-03/T3-07 permanecen en curso; T2 y las demás dependencias no se consideran cerradas. La consulta inicial sirve para comprobar la frontera real de lectura antes de conectar transiciones.

La siguiente ampliación de juego requiere proyección autorizada de progreso y servicios transaccionales de acciones con versión, rama e idempotencia, además de las puertas pendientes de motor/calidad. No basta ampliar el decoder para aceptar estado interno. Ocho incidencias históricas de formato siguen abiertas y no se declara cumplimiento OWASP/ASVS ni lanzamiento listo.


## Verificación ejecutada

- Suite general: 578 pruebas en 38 archivos, dieciocho escenarios más que la entrega anterior. La primera ejecución restringida falló en el HTTP loopback sintético del adaptador; repetida con acceso local, la suite pasó sin cambiar ese adaptador ni usar un modelo real.
- PostgreSQL/HTTP: 59 pruebas en seis archivos correctas, incluido el contrato inicial real validado desde otra instancia HTTP.
- Lint/imports: correctos, 168 módulos y 481 relaciones, sin relajar complejidad ni dependencias.
- Tipos y compilación: correctos; smoke de web/proxy/API con HTTP loopback y escaneo local de secretos correctos.
- Integridad documental: 97 Markdown, referencias válidas, grafo sin ciclos y Word originales intactos. No acredita controles del producto.
- git diff --check correcto; check:format continúa fallando en los mismos ocho archivos históricos. No se reescriben migraciones para ocultar ese resultado.

Se ha detenido solo PostgreSQL sintético de 15434 conservando el volumen. Sin commits, merges, push o despliegue; no se ha realizado prueba manual de navegador de esta nueva ficha.
