# SPEC-006 Interfaz, mapa y accesibilidad

Estado: contrato de UI desarrollado y prototipo parcial. Ventanas movibles/minimizables, flujo conectado y revisión de foco/accesibilidad pendientes de T3-03.
Fuentes: GDD §1–3,5,6,8–15; TAD §12. ACC-003/019/031.

## Pantalla y navegación

Pantalla principal: cabecera con detective, caso, ciudad, reloj/plazo; escenario central con descripción accesible; herramientas laterales; consola narrativa y campo de órdenes inferior. Diseño retro MS-DOS legible, sin depender de una fuente pixelada para textos largos.

Paneles: mapa, dossier/maletín, laboratorio, comunicaciones, inteligencia, perfil/carrera, configuración y archivo. Ventanas movibles/minimizables en escritorio; en móvil se convierten en panel de ancho disponible con navegación clara. No reproducir ventanas fuera de pantalla; recuperar posición o restablecer distribución. Posición visual no determina acceso a datos.

Primer caso usa escenas/avatares provisionales identificados como tales en documentación del hito, no carteles técnicos en el flujo de juego. No exigir assets definitivos para validar motor.

## Órdenes y confirmaciones

Texto libre con historial; comandos no se ejecutan al escribir. Enviar produce interpretación/preview. Confirmaciones muestran acción, destino, tiempo estimado y hora prevista, más consecuencias conocidas. Botones confirmar/cancelar accesibles; evitar doble envío; un timeout permite recuperar el resultado, no repetir con nueva clave.

Lotes muestran orden de pasos. Una imposibilidad explica qué decisión falta y ofrece cancelar restantes o continuar independientes. No resaltar un hallazgo como señal de que el jugador va bien. Mensajes técnicos de error describen recuperación sin añadir pistas.

La inspección general describe lo visible; ningún objeto interactivo debe exigir ver un píxel minúsculo. Una descripción accesible no revela prueba que el jugador aún no descubrió.

## Herramientas

Mapa con ciudades admitidas y buscador textual equivalente; guiado muestra investigables sin importancia relativa, libre incorpora descubrimientos sin prohibir buscar otros destinos admitidos. Separar atlas informativo sin coste de visita física. Mostrar origen/destino/duración antes del viaje. No inventar ciudades disponibles ni rutas reales en el fixture.

Dossier agrupa evidencias por tipo, procedencia, minuto, legalidad/corroboración visible sin calificar culpabilidad. No mostrar porcentajes secretos de resolución. Maletín sin cuadrícula limitada ni puzzles de combinaciones absurdas.

Laboratorio y comunicaciones muestran solicitudes pendientes y hora de respuesta del juego; no confundir espera real con progreso interno. Registrar documentos, testimonios y análisis. Canales disponibles según expediente: llamada, WhatsApp, SMS, correo y fax; son simulaciones internas, no mensajes a terceros.

Órdenes requieren sospechoso y pruebas elegidas. Detención presenta identificación y coordinación, sin combate. Finalizar pide confirmación; informe final explica verdad y omisiones solo tras cierre.

## Accesibilidad

Objetivo WCAG 2.2 AA para interfaz. Teclado completo, orden de foco estable, foco visible y sin trampas; cerrar panel devuelve foco a quien lo abrió. Ventanas accesibles con nombres/roles; diálogos de confirmación controlan y devuelven foco.

Contraste y tamaño de texto ajustables; fuente legible, escala, alto contraste y paletas de protanopia/deuteranopia/tritanopia. Ningún estado depende solo de color. Respetar reducción de movimiento. Narrativa nueva anunciada de forma moderada para lectores, sin releer todo ni anunciar secretos.

Texto alternativo de escenas limitado a información visible; mapa dispone de alternativa lista/buscador. Evitar arrastrar como única forma de mover/cerrar paneles. Información persistente de reloj sin anuncios continuos.

## Audio, TTS e idiomas

Música retro MIDI/sintetizada y ambiente, con volumen general y controles independientes de música, efectos y narración. Nada relevante solo por sonido. TTS opcional del navegador/sistema: voz, velocidad, lectura manual/automática, repetir, pausar; aplicable a diálogo, documentos y narración. Si no hay voz compatible, texto disponible y opción deshabilitada explicada.

Interfaz preparada para traducciones desde primer hito; español inicial. El idioma de juego no depende de nacionalidad del NPC. Traductor A.C.M.E. explica la convención narrativa; no cambia pistas ni identidades.

Preferencias persisten por usuario; aplicar al inicio sin parpadeos que impidan lectura. Móvil, zoom, teclado y lector se revisan manualmente además de herramientas automáticas.

## Estados y errores

Carga inicial, solicitud en curso, proveedor caído, conexión perdida, conflicto de versión, partida cerrada y reanudación tienen pantallas/mensajes recuperables. No bloquear el acceso al dossier porque la IA esté caída. Acciones no enviadas se conservan localmente como borrador de texto sin guardar secretos.

La UI no calcula resultados de investigación: recibe PlayerView y eventos. Reproducir una animación o cambiar panel no ejecuta acción de motor.

## Alcance obligatorio del primer caso jugable

DEC-015 confirma ventanas movibles y minimizables desde el primer caso jugable, con estética MS-DOS/pixel art. Su funcionalidad no se pospone a T5-05. En móvil se mantiene la adaptación prevista, sin exigir arrastre como único control; teclado, foco y recuperación de ventanas deben formar parte de T3-03.

DEC-014 incluye autoguardado y guardados manuales en esa entrega. La UI deberá distinguir guardado en curso, confirmado y fallido; no anunciar éxito antes de confirmación del servidor. DEC-017 permite cargar puntos anteriores del mismo caso para cambiar decisiones; DEC-021 fija diez manuales por partida además del autoguardado, sin borrado automático de manuales.

DEC-016: una ambigüedad se presenta como pregunta antes de actuar; no avanza reloj ni realiza acciones parciales. DEC-013: cada partida se juega por un único detective de su usuario propietario, sin controles de multijugador.


## Contrato de estados de UI para T3

Estados de entrada: idle, interpreting, clarification, preview, committing, recovering y error. Solo una intención mutante en vuelo por partida desde la misma vista; las demás pestañas se controlan por versión de servidor. El borrador sigue editable mientras no confirme otro texto; una respuesta vieja nunca sustituye una vista de branchId/version más reciente.

clarification conserva la orden original y presenta la pregunta; no ejecuta nada. preview muestra pasos, coste/rango y hora prevista, consecuencias conocidas y confirmar/cancelar. committing deshabilita doble envío y conserva idempotencyKey. Si la respuesta se pierde, recovering consulta la operación/reintenta la misma clave; no inventa una nueva acción. Un 409 refresca estado y exige nuevo preview para confirmar cambios.

Guardado: idle, saving, saved o failed. saved solo tras confirmación del servidor. El listado muestra nombre, ciudad/minuto y fecha; diez manuales además del autoguardado. Al alcanzar el límite se elige cuál borrar/reemplazar, sin borrado automático. Cargar muestra confirmación de que se volverá a ese punto y perderá el progreso posterior de la rama actual, manteniendo el primer resultado oficial. No se implica que desaparezca la auditoría del servidor.

### Ventanas y foco

Cada herramienta tiene windowId estable y estado closed, open o minimized. Abrir desde la barra crea/restaura la misma ventana, no duplicados. Minimizar mantiene contenido/borrador y añade un control de restauración visible. Cerrar devuelve foco al botón que abrió la herramienta; restaurar vuelve al último control útil o al título.

En escritorio se puede mover por arrastre y por un control Mover del título: flechas cambian posición, Enter termina y Escape cancela el movimiento. El modo de movimiento no atrapa el foco ni aplica atajos globales que interfieran con escritura o lector. No arrastrar es un camino completo y equivalente.

Mantener título y controles dentro de la superficie visible. Al cambiar zoom, escala, viewport o fuente, normalizar posiciones; Restablecer distribución recupera todas las ventanas. En móvil se presenta un panel de ancho disponible por herramienta con navegación explícita, sin coordenadas de escritorio que escondan controles.

Un cambio de posición/minimización no invoca motor, IA ni guardado de partida. La selección de herramienta no expone catálogos privados. El reloj/plazo y acceso a consola permanecen alcanzables en todos los modos. No mover foco al llegar resultados de polling; anunciar novedades de forma moderada.

### Preferencias separadas de snapshots

GET /me entrega settingsVersion y preferencias; PATCH /settings acepta expectedSettingsVersion y changes validado. Campos de presentación: fontMode retro/accessible, textScale (100 a 200), palette de catálogo, reducedMotion y windowLayout. No aceptar CSS/HTML arbitrarios.

windowLayout solo contiene windowIds permitidos, estado y posiciones relativas finitas normalizadas al área. Una revisión de settings no modifica version del juego. Las preferencias se aplican por usuario y no retroceden al cargar un save. Contraste/paletas, TTS/audio e idiomas se amplían en sus fases sin perder compatibilidad del objeto de preferencias.

Accesibilidad y aspecto MS-DOS/pixel art se verifican con los subcasos UI del [catálogo detallado](../quality/T3-aceptacion-detallada.md). El prototipo actual aún no implementa este contrato completo.

## Bordes y funcionamiento ante fallos

El [contrato de resiliencia](RESILIENCIA.md) y el [plan de observabilidad y residencia de datos](OBSERVABILIDAD-Y-DATOS.md) desarrollan las condiciones de fallo y medidas aplicables. El [catálogo de bordes](../quality/BORDES-EJECUCION.md) asigna pruebas y tareas por fase. Son contratos propuestos pendientes de implementación y verificación.

## Archivo conectado de consulta: entrega T3-03

La raíz web muestra el archivo real de la sesión: estado anónimo, entrada local de desarrollo explícita solo en build dev, carga, lista vacía, listado, filtro activo/cerrado/todos, anterior/siguiente y errores operativos. Permite selección/creación recuperable según el contrato de creación web; no ejecuta órdenes; no presenta investigación, guardados o registro público como disponibles. La ruta /prototype conserva la muestra separada de desarrollo.

Presentación MS-DOS de paleta limitada, monospace, bordes rectos/dobles, sin tarjetas redondeadas ni efectos modernos. Tabla con título público del expediente, referencia, estado y fecha; si no hay ficha de catálogo se informa sin inventar nombre. Controles nativos, foco visible y desplazamiento de tabla en pantalla estrecha. No muestra CSRF, secretos, estado privado, versión del motor o metadatos internos no útiles al jugador.

El cliente valida respuestas HTTP antes de usarlas. Listado incluye profileId de la sesión SQL y caseTitle público/null para vincular página a la cuenta y evitar hardcodear títulos. Respuestas tardías se descartan por generación y cancelación; cambiar filtro, refrescar, cerrar sesión o desmontar invalida petición anterior. Sin polling o reintentos automáticos de autenticación. No credenciales, CSRF o estado de partida en localStorage/sessionStorage; se admite el localizador mínimo de creación por cuenta en sessionStorage según API-juego.

Cerrar sesión oculta inmediatamente perfil/lista, usa CSRF solo en memoria y no anuncia éxito si falla la respuesta. Un fallo de cierre permite reintentar sin mostrar datos anteriores. Un fallo al abrir sesión no se reenvía automáticamente: refrescar GET /me permite recuperar el resultado. La cuenta que acompaña una página debe coincidir con /me, o se descarta la página.

[Pruebas y límites del archivo conectado](../quality/T3-03-archivo-conectado.md).

## Selección y creación recuperable

Nueva partida usa catálogo público validado. Selección obligatoria y acción explícita; no disponibilidad/ID desconocido no dispara POST. Durante envío bloquea doble activación. Referencia pendiente sobrevive a recarga de pestaña: Comprobar solo consulta y Reintentar misma creación conserva caso/clave. No ofrece otra clave o partida por deducción de un 404. Después de confirmación, Actualizar obtiene metadata actual; Preparar otra creación es una nueva decisión explícita.

El estado visible no contiene clave o CSRF; el localizador mínimo por cuenta no representa un guardado. Fallo de storage bloquea intención nueva. Logout limpia solo esa referencia de cuenta, sin implicar cancelación de una escritura que ya se envió. [Pruebas y límites](../quality/T3-creacion-web-recuperable.md).


## Consulta inicial conectada, entrega parcial T3

El archivo ofrece Consultar sobre cada partida de la página propia. GET inicial autorizado muestra referencia, revisión, ubicación, descripción y ciudades públicas; ninguna consulta avanza tiempo. La ficha rechaza progreso no soportado y no reutiliza la respuesta histórica de creación. Cancelar/cerrar invalida consultas tardías; logout/cambio de filtro retiran la selección. Foco al título al abrir y devolución al botón de origen al cerrar, sin modal ni comandos ficticios. Contrato y límites en [evidencia de ficha inicial](../quality/T3-ficha-inicial-conectada.md). No sustituye las ventanas de investigación exigidas para el primer caso jugable.
