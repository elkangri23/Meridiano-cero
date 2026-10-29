# T3-03: archivo conectado con sesión y paginación

Fecha: 2026-10-29. Continuación autorizada en worktree. Sin commit, merge, push o despliegue. Referencias: SPEC-004/006/011/012, API-juego y estándares de 7962014ec7031c3694f2378d3983a5e488499239. T3-03 y preparación parcial de T3-07, sin cerrar dependencias ni aceptación del primer caso.

## Funcionalidad entregada

La raíz de Vite sustituye la antigua pantalla de health por el archivo real de la cuenta. Al abrir consulta GET /me, sin crear sesión automáticamente. En desarrollo muestra entrada local explícita; solo funciona si el backend tiene el bootstrap local autorizado por configuración. No hay registro público, contraseña por defecto o login de producción implementados.

Con sesión válida: perfil visible, partidas propias, títulos públicos de catálogo, filtro Todas/Activas/Cerradas, anterior/siguiente y actualización. Sin ficha pública se muestra un texto neutro, no se deduce nombre del estado privado. Se distinguen carga, ausencia de sesión, página vacía y error. No botones que finjan investigación, creación de partidas o guardados disponibles.

La investigación todavía no está conectada. /prototype sigue siendo una muestra de desarrollo separada; sus ventanas/escena no se sustituyen por el archivo ni se presentan como flujo real del caso. Motor v13 y validador 1.4 sin cambios.

## Contratos y privacidad

GET /runs devuelve ahora profileId obtenido en la misma transacción SQL que autoriza filas; cada resumen añade caseTitle público o null. El cliente compara esa cuenta con /me antes de mostrar la página. No envía ownerId como permiso ni confía en un UUID del cliente para autorizar. La política previa de cursores/consulta parametrizada/no-store se conserva.

SessionDto y RunListDto tienen comprobación runtime cerrada en contracts. Se rechazan campos privados adicionales, estado/fecha/cursor inválidos, IDs duplicados o páginas mayores que 100. El transporte usa mismo origen, cookies HttpOnly del navegador, cache no-store, redirecciones rechazadas, timeout de ocho segundos y lectura de respuesta limitada en stream a 131072 bytes antes de JSON.parse. No se incluyen cuerpo de error privado o CSRF en mensajes.

CSRF permanece en la coordinación privada en memoria y se usa solo en cabecera de logout; no se expone en el estado de vista ni DOM ni almacenamiento del navegador. El perfil y lista se ocultan inmediatamente al cerrar; solo 204 confirma éxito. Si la respuesta falla, se permite repetir el cierre y actualizar no reabre datos antes de resolver ese cierre incierto.

Cada operación invalida la generación anterior y aborta su transporte. Incluso si una respuesta ignora abort, no sustituye datos de un filtro, cuenta o sesión nuevos. Desmontar cancela e invalida lecturas y no inicia otras. Una respuesta perdida al abrir sesión no genera autenticaciones automáticas: GET /me recupera la sesión que realmente exista. No se afirma rollback de una autenticación cuyo acuse se perdió.

## Presentación y accesibilidad

Paleta MS-DOS negra/azul/blanca/amarilla/gris, monospace, bordes rectos/dobles y sin tarjetas redondeadas o efectos modernos. No nuevas imágenes, fuentes remotas o dependencias. El archivo es un registro textual; las escenas pixel art siguen en el prototipo/caso pendiente.

Controles nativos con foco visible; títulos, etiquetas, caption y cabeceras de tabla; estado anunciado en región polite. La tabla es una región desplazable con teclado y no obliga a reducir letra hasta volverla ilegible. A 390 px el documento no desborda horizontalmente; la tabla de 640 px se desplaza dentro de su región. No se fuerza foco al llegar respuestas.

## Pruebas automatizadas

model.test.ts incorpora nueve escenarios: lectura sin auto-login, entrada explícita sin CSRF en vista, filtros y respuestas tardías, conexión tardía tras logout, cierre incierto con ocultación/reintento, cuenta distinta rechazada, recuperación de sesión sin reenviar login, historial de cursores y desmontaje/cancelación.

client.test.ts añade trece escenarios: transporte mismo origen/no-store, 401 como sesión ausente, entrada JSON vacía, tres sesiones inválidas con campos adicionales, cinco páginas inválidas, stream excesivo cancelado y logout con CSRF/204. Las muestras de campos extra token/secret usan null; el escáner había detectado sus valores literales sintéticos y se corrigieron las muestras sin relajar reglas ni ocultar credenciales reales.

PostgreSQL mantiene los escenarios previos y añade título null para definición sin ficha; comprueba profileId de la cuenta e items públicos. Son 58 pruebas en seis archivos. El smoke sigue comprobando HTTP/proxy/TSX real y ahora también sirve el módulo del archivo; no se presenta como E2E de investigación.

## Revisión manual de navegador

Revisión mediante herramientas de navegador con API real y PostgreSQL sintético aislado 15434. Se prepararon 28 partidas de prueba para superar una página; algunas filas closed fueron metadata sintética, no resultados obtenidos jugando. Un proxy temporal mantuvo solo la cookie de prueba en memoria, sustituyó la cookie de entrada y retiró Set-Cookie de salida: no se modificaron cookies/credenciales existentes del navegador.

Se verificó sesión ausente, entrada local, lista de 25 y segunda página de tres, filtro Cerradas, cambio de filtro y paginación con teclado, cierre confirmado con retirada de perfil/lista. Se revisó escritorio 1100×800 y móvil 390×844; región de tabla enfocada por teclado, 341 px visibles frente a 640 px de contenido y documento de 375 px (sin desbordar viewport de 390).

Capturas finales de escritorio/móvil guardadas como artefactos de esta conversación, fuera de Git. Se restableció viewport, cerró la sesión de prueba y la pestaña temporal; se detuvo el helper con limpieza confirmada de sus partidas, ledger y sesiones sintéticas. Helper eliminado. No se toca WSL, base preexistente 15433 ni otros proyectos.

No se ha probado lector de pantalla real, toda la matriz de navegadores, fallos de red manuales o E2E de investigación. Las respuestas tardías y fallos de logout se ensayaron con dobles deterministas de la frontera HTTP, no cortando TCP en navegador.

## Verificación ejecutada

- pnpm lint e imports globales correctos: 163 módulos y 460 relaciones sin infracciones; complejidad máxima diez conservada sin excepciones. Render, coordinación y transporte tienen consumidores reales separados, sin nueva dependencia.
- pnpm test: 545 pruebas generales correctas en 37 archivos (22 nuevas del cliente/modelo). Tras ajustar las muestras que activaban el escáner se repitieron las trece pruebas del cliente, correctas; no se suman dos veces a la cifra de suite.
- pnpm test:integration: 58 pruebas correctas en seis archivos; contrato de cuenta/título y caso sin ficha pública verificados en PostgreSQL/HTTP sintéticos.
- pnpm typecheck y pnpm build completos correctos. Revisión manual del texto final después de reiniciar el helper sin caché anterior.
- pnpm smoke correcto con página/TSX del archivo y proxy web/API en loopback; no investigación completa.
- pnpm scan:secrets final sin hallazgos. No se relaja el escáner por sus falsos positivos iniciales de muestras sintéticas.
- scripts/verify_docs.py: 95 Markdown, referencias/grafo válidos y hashes originales DOCX intactos. Integridad documental, no certificación funcional/OWASP.
- git diff --check correcto. Formato global conserva ocho incidencias históricas, sin nuevas ni reescritura de SQL.

Contenedor sintético detenido conservando volumen. Helper, partidas, ledger y sesiones de la revisión manual eliminados con confirmación de su limpieza; pestaña temporal cerrada y viewport restablecido. No cambios en credenciales existentes, WSL, otros proyectos o base preexistente.

## Límites pendientes

T3-03/T3-07 siguen abiertos: creación/reanudación de partida conectada, comandos, proyección de progreso, ventanas movibles/minimizables, acciones/confirmaciones, guardados y recuperación de operaciones. No primer resultado oficial/carrera ni IA real. T2 conserva políticas/reglas generales y solvencia/aceptación pendientes. Sin CI remota, publicación o certificación integral OWASP/ASVS. Ocho incidencias históricas de formato siguen abiertas.
