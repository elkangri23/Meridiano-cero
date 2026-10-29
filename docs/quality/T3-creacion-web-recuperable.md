# T3-03/T3-06: selección y creación recuperable desde web

Fecha: 2026-10-29. Continuación autorizada en worktree, sin commit, merge, push o despliegue. Referencias: SPEC-004/006/011/012, API-juego, RESILIENCIA y estándares de 7962014ec7031c3694f2378d3983a5e488499239. Entrega parcial de creación, no investigación completa.

## Flujo de producto

El archivo consulta el catálogo público de la API. Nueva partida permite seleccionar un expediente disponible y crear una partida propia; no manda definición, ownerId o reglas. La selección no crea nada hasta activar Crear partida. Expedientes no disponibles/IDs adivinados no disparan creación desde el modelo web.

Antes del POST se conserva y comprueba lectura de una referencia en sessionStorage: schemaVersion=1, profileId, caseId e idempotencyKey criptográficamente aleatoria. Namespace por aplicación/versión/cuenta, además del origen y pestaña propios de sessionStorage. Máximo 1024 unidades UTF-16 al leer, estructura cerrada, IDs y clave validados. No CSRF, cookie, prompts, conversación o estado del motor. Almacenamiento bloqueado o localizador malformado impide una intención nueva, sin sobrescribirlo por otra clave.

POST /runs puede responder o perder el acuse; ninguna de esas circunstancias basta para sustituir progreso. La web consulta el ledger mediante POST /run-creations/lookup, con clave en cuerpo y contexto de cuenta. Solo un resultado propio committed permite mostrar Creación confirmada y referencia de la partida. Después puede actualizarse el archivo para ver metadata actual. No se usa la vista inicial histórica como si fuera progreso reciente.

404/error de consulta conserva incertidumbre y referencia. Comprobar creación no envía otro POST. Reintentar misma creación consulta antes y únicamente reutiliza caso/clave originales; nunca inventa otra clave por error, timeout, cambio de filtro o recarga. Tras confirmación se verifica el retiro de referencia; si no se puede retirar, se mantiene pendiente de forma conservadora. Preparar otra creación requiere acción explícita posterior a una confirmación.

La recarga reconstruye el pendiente de la cuenta actual sin reenviar creación. Otra cuenta no carga ni elimina ese localizador. Logout elimina solo el namespace de la cuenta actual; no usa clear() ni modifica datos de otros proyectos. Cerrar sesión o abortar transporte no prueba rollback: si una creación enviada terminó, podrá localizarse en el archivo. Cerrar la pestaña termina la persistencia de sessionStorage; no se promete recuperación por clave fuera de ella.

## Precondición de cuenta en servidor

X-Expected-Profile-Id es una precondición opcional para compatibilidad de clientes API previos; la web la incluye en creación y lookup. UUID validado, normalizado y comparado con el dueño obtenido de sesión dentro de la transacción, antes de consultar/escribir ledger. 409 SESSION_CHANGED no entrega datos ni crea filas. El header no elige dueño ni concede permisos; sesión, Origin y CSRF mantienen autoridad.

Se comparte la transacción existente, sin nueva tabla, credencial, firma inventada o llamada externa bajo lock. La validación de caso/ledger/idempotencia conserva su orden; sin contexto opcional los clientes anteriores siguen operando bajo su sesión. Motor v13, validador 1.4, definición y hash originales sin cambios.

## Separación y límites de interfaz

Coordinador de intención usado por el modelo del archivo: persistencia, envío/consulta y resultado discriminado. La vista nunca recibe clave o CSRF. Modelo controla generación/cancelación y evita doble activación; transporte comparte límite de stream/timeout del archivo. DTO de catálogo y lookup tienen validación runtime cerrada.

Presentación MS-DOS con controles nativos y bordes rectos. Referencia confirmada, mensajes de incertidumbre y comprobación/reintento son visibles; no existe botón que finja abrir investigación, ejecutar órdenes o guardar progreso. La creación puede confirmarse aunque la proyección posterior no sea compatible; no se resetea esa partida para hacerla legible.

## Automatización

Quince escenarios nuevos en la suite general: diez del coordinador de creación (referencia antes del POST, acuse perdido confirmado, 404/recarga/reintento con misma clave, otra elección bloqueada, lectura/escritura de storage bloqueadas, localizador inválido, aislamiento de cuenta/namespace, abort y fallo al borrar), dos del modelo (doble activación/clave no visible y caso no disponible), tres del cliente (headers/cuerpo, 404 provisional sin clave en URL y DTO no autorizado rechazado).

PostgreSQL/HTTP añade un escenario de contexto: cuenta esperada distinta devuelve SESSION_CHANGED sin filas ni intención; header inválido devuelve 400; cuenta correcta crea; lookup mismatched no resuelve y correcto recupera el mismo ID. Las pruebas anteriores de revocación, propiedad y pérdida TCP de COMMIT se conservan. No es una certificación integral de concurrencia o seguridad.

## Revisión real de navegador con fallo controlado

API y DB sintéticas aisladas en 15434; la partida se creó mediante la web, no se inyectó en SQL. Proxy temporal solo en el harness: cookies de prueba en memoria, sustitución de cookie de entrada y retirada de Set-Cookie de salida para preservar cookies existentes del navegador.

El proxy destruyó la respuesta POST después de observar 201 (transacción ya confirmada) y la respuesta del primer lookup. La UI mostró pendiente. Tras recargar conservó la intención y mostró una única partida existente en el archivo. Comprobar creación por teclado consultó el registro y confirmó el mismo ID. Una recarga posterior retiró el pendiente, dejó Crear partida deshabilitado sin selección y no envió nada automáticamente.

Métricas del harness al cerrar: posts=1, lookups=2, droppedPost=true, droppedLookup=true, runsCreated=1. No claves, cookies o CSRF en logs/capturas. Esto acredita este ensayo de creación/recarga, no todas las pérdidas posibles del transporte o E2E de investigación.

Revisión a 390 y 320 px: documento 375/305 px respectivamente, sin overflow horizontal. Capturas de pendiente móvil y confirmación escritorio guardadas como artefactos de conversación fuera de Git. Viewport restablecido, logout confirmado, pestaña cerrada. Limpieza del único recurso nuevo/ledger y sesiones del harness confirmada; helper temporal eliminado. Base preexistente 15433, credenciales y WSL sin cambios.

## Pendientes

T3-03/T3-06/T3-07 permanecen en curso: abrir/reanudar progreso, comandos, preview/commit, guardados, primer resultado oficial y recuperación de acciones/cargas/cierre. Errores definitivos de caso no disponible se tratan conservadoramente como intención pendiente; falta su UX completa de reconciliación. No cancelación SQL ni garantía de rollback por abort/logout, cola offline, TTL/purga de operaciones o recuperación tras cerrar pestaña.

T2 conserva reglas/políticas generales y solvencia/aceptación pendientes. Sin proveedor real, registro público, CI remota o certificación OWASP/ASVS. Ocho incidencias históricas de formato siguen abiertas.

## Verificación final

- Suite general: 560 pruebas en 38 archivos; incluye los quince escenarios nuevos de esta entrega.
- Integración PostgreSQL/HTTP: 59 pruebas en seis archivos; incluye la precondición de cuenta esperada.
- Lint y límites de módulos: correctos, 166 módulos y 474 relaciones; complejidad máxima configurada de diez.
- Tipos, compilación, smoke del workspace y escaneo de secretos: correctos.
- Integridad documental: 96 Markdown, enlaces y referencias válidos, grafo de tareas sin ciclos y hashes de los Word originales intactos. Esta comprobación no prueba comportamiento del producto ni cumplimiento OWASP.
- git diff --check: correcto. check:format sigue señalando las ocho incidencias históricas enumeradas en las evidencias anteriores; no se considera una comprobación superada.

La prueba manual de navegador descrita arriba se distingue de las suites automatizadas. No se han realizado commits, integración, push ni despliegue en esta entrega.