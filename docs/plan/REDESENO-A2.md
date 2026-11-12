# Rediseño visual A2 de la pantalla de juego (2026-11-10)

Nota de diseño del rediseño aplicado en la rama de trabajo del mismo día.
Solo presentación: no cambia lógica de juego, motor, API, reglas ni
textos de narración. La partida en curso del autor no se toca.

## Base

- Maqueta A2 clara aprobada como referencia visual.
- Tokens: papel `#F8F7F4`, tinta `#101828`, dorado `#C9A227` (como texto
  se usa su variante oscura `#7A5E06`), teal `#0E7C7B` (viajes).
- Tipografías: Playfair Display para títulos, Plus Jakarta Sans para el
  cuerpo, IBM Plex Mono para reloj y datos; con reservas del sistema si
  no hay conexión a las fuentes.
- Nada de aspecto MS-DOS: fuera fondo negro, panel azul, botones con
  relieve y monoespaciada en toda la pantalla. El modo oscuro queda
  para una fase posterior.

## Alcance

### Fase 1 (hecha): juego y ajustes de IA
Puesto de Mando, escena, interrogatorio, tablero de evidencias (ventana
del dossier) y ajustes, incluida la sección de conexiones de IA.

### Fase 2 (hecha): toda la web + landing nueva
Antonio vio la web mezclada (juego nuevo, resto antiguo) y no le gustó:
esta fase deja TODA la web con un solo aspecto. Se restilan con los
mismos tokens el archivo (ahora en `/archivo`), el acceso
(registro/login/verificar/recuperar), el glosario, los créditos, el
prototipo (solo tokens mínimos: sigue siendo la maqueta antigua con
datos sintéticos) y las preferencias. Se crea una landing pública nueva
en `/` (ver abajo). El arte pixel-art SVG de escenas y retratos se
queda como está en esta fase: no hay fotos ni arte nuevo salvo el
retrato de Inés, ya usado en el interrogatorio. (La fase 3 cambia esto
solo para el caso fijo; ver abajo.)

### Fase 3 (hecha): imágenes del caso fijo — escenas y retratos
Estilo aprobado por Antonio 2026-11-11: foto para retratos,
ilustración cinematográfica para escenas, tonos cálidos
papel/dorado/azul oscuro, coherentes con la web A2 clara. Solo el caso
fijo (`astrolabio-tres-ciudades`); el resto sigue con SVG procedural.

- Escenas (`apps/web/src/game/scene-art.tsx`, `SCENE_ART_IMAGES`):
  Madrid, sala de embalaje (`MAD-SALA` → `/images/madrid-sala.webp`,
  1920×1280, 384 KB); París, archivo de conservación (`PAR-ARCH` →
  `/images/paris-archivo.webp`, 1920×1280, 542 KB); Lisboa, almacén de
  depósito (`LIS-ALM` → `/images/lisboa-almacen.webp`, 1920×1280,
  640 KB). Localizaciones desconocidas siguen cayendo en Madrid, como
  antes. El `<div>` mantiene `role="img"`, `aria-label` con la
  descripción existente (`sceneArt.*`, sin spoilers) y `data-location`.
- Retratos (`apps/web/src/game/portraits.ts`, `FIXED_PHOTO_PORTRAITS`;
  `apps/web/src/game/portrait.tsx`): foto solo cuando la semilla es
  `astrolabio-tres-ciudades:<npc>` — Inés Valera
  (`/images/ines-retrato.jpg`, ya existía), Tomás Ríos
  (`/images/retrato-tomas.webp`), Lucía (`/images/retrato-lucia.webp`),
  Émile (`/images/retrato-emile.webp`) y Marta
  (`/images/retrato-marta.webp`); todas 1280×1920, 260–386 KB. El
  componente `Portrait` las muestra en escena, chat (antes solo Inés
  tenía foto, y por id sin caso: ahora el mapeo es por semilla
  `caso:npc`) y contactos. Los NPC de casos generados y el equipo
  A.C.M.E. siguen con el retrato SVG procedural por semilla
  (`photoPortraitFor` devuelve `null` → fallback).
- Desviación menor anotada: la foto de Marta se parece bastante a
  Lucía (moño oscuro, blusa azul), aunque la cara es distinta; no se
  regeneró. Pendiente de decisión de Antonio si quiere distinguirla más.
- Arreglo 2026-11-11 (decisión de Antonio: quedarse con esta Marta y
  arreglar lo de «pixel-art»): las descripciones accesibles `sceneArt.*`
  (es/en/fr) ya no dicen «pixel-art»: «Ilustración cinematográfica
  de…» / «Cinematic illustration of…» / «Illustration
  cinématographique de…» (`packages/contracts/src/locales/{es,en,fr}.ts`,
  3 claves × 3 idiomas). Solo cambió ese adjetivo; el resto de cada
  descripción sigue igual.
- Verificación en navegador (2026-11-11, con cuenta de prueba
  eliminada después): 15/15 comprobaciones en Playwright contra
  producción — las 3 escenas muestran su ilustración, las 5 fotos
  aparecen en escena/chat (Tomás a 48 px en chat) y el equipo
  A.C.M.E. y un caso generado (Fraude, Bilbao) siguen con SVG
  procedural (0 fotos); la «Lucía Vargas» del caso generado no
  hereda la foto de la Lucía del caso fijo. Capturas en
  `~/workspace/redeseno-a2/shots-fase3/`.

### Fase 4 (hecha): la escena reorganizada como la maqueta
Las fases 1–3 solo cambiaron la piel: la vista real seguía con la
estructura antigua (tira del expediente, fila de pestañas, botones en
píldora, consola, caja de texto). Esta fase reorganiza la escena para
seguir la ORGANIZACIÓN de la maqueta A2, no solo sus colores
(`apps/web/src/game/GameScreen.tsx`, `game.css`,
`scene-offers.ts`; 26 claves nuevas `game.scene.*` en es/en/fr).

- Héroe: la ilustración de la escena a todo lo ancho, con encima el
  chip «Escena de investigación activa», el nombre del lugar, la
  ciudad y el país, y «Localización 01»; debajo, la descripción del
  lugar. `SceneArt` se mantiene (`role="img"` + `aria-label`).
- Columna izquierda, grupos con cabecera numerada: A. Inspeccionar
  (tarjetas ricas: icono, título con la etiqueta del motor, el
  detalle del motor cuando lo trae, estado «● Disponible» y botón
  «Inspeccionar →»); B. Interrogar (tarjeta por NPC: retrato, nombre
  + rol, un botón por tema con su etiqueta; la sospechosa con su nota
  de conducta — la negativa real del caso, «No voy a declarar sobre
  el robo.»); D. Viajes (tarjetas con el tiempo real del motor, p.
  ej. «180 min», botón «Viajar →»); E. Otras acciones (recoger,
  consultar, órdenes, detención, irregulares, esperar, recuperar y
  el cierre del caso, como tarjetas con su detalle y su aviso real).
- Columna derecha: Dossier en escena (evidencias en poder
  encontradas en esta escena — procedencia lugar o ciudad —, con
  tipo, minuto y texto legible, y botón «Ver tablero completo de
  evidencias»), Estado de la investigación (objetivos con «{done} de
  {total} objetivos cumplidos», porcentaje y barra) y Operaciones
  globales (los botones que antes eran la tira de pestañas: Mapa,
  Tablero de evidencias, Equipo A.C.M.E., Guardados, Ajustes,
  Informe final, Terminal de inteligencia, Laboratorio, Central de
  comunicaciones; después Introducción, Resumen, Restablecer
  distribución y Actualizar vista; Mapa en teal como botón
  principal).
- La tira de pestañas DESAPARECE de la vista de escena; la tira del
  expediente se MANTIENE arriba, sin perder ningún dato. La caja de
  texto libre del intérprete y la consola narrativa se quedan
  (corazón del juego, no están en la maqueta), debajo de las dos
  columnas a todo lo ancho, en ese orden: primero la caja de texto
  y después la consola.
- Responsive: bajo 900 px las columnas se apilan (izquierda
  primero, derecha después); bajo 720 px las tarjetas se apilan
  con el botón debajo; héroe con min-height 260 px y título 29 px
  en móvil.
- Lo que NO se incluyó y por qué: el grupo C de la maqueta
  (Acciones bloqueadas) no existe — el motor solo expone ofertas
  disponibles, sin motivo de bloqueo, y no se inventa ninguna; las
  tarjetas de inspeccionar/hablar/recoger no enseñan coste en
  minutos porque la oferta pública del motor no lo trae (solo el
  detalle cuando lo hay: viajes, consultas, análisis, órdenes,
  detención e irregulares con su aviso real) — el coste real sigue
  viéndose en el diálogo de confirmación antes de aceptar; el
  hallazgo no sale en la tarjeta (vive en la consola y en el
  dossier en escena); el estado «Realizado» no se marca en la
  tarjeta (la oferta desaparece al completarse y lo realizado se
  ve en el dossier). Si Antonio quiere costes en las tarjetas, el
  motor tendría que exponerlos en la oferta (cambio de motor, fase
  posterior).
- Testids: se mantienen `offer-<id>`, `offer-finish`,
  `toolbar-<ventana>`, `open-lab`, `objectives-panel`,
  `objective-<id>`, `scene-art`, `scene-chat`, `game-scene`,
  `game-scene-meta` y la clase `.game-scene-npc`; nuevos
  `offer-card-<id>`, `npc-card-<npcId>` y `scene-dossier-full`.
  `toolbar-lab` desaparece con la barra (ningún test lo usaba).
  Los e2e afectados se actualizaron (`irregular.spec.ts`,
  `pulido-cosmetico.spec.ts`, `auto-arrest.spec.ts`); en
  `irregular.spec.ts` se corrigieron además sus llamadas a
  `openWindow(page, 'Dossier')` → `'Tablero de evidencias'`
  (título real de la ventana desde la fase 2).
- Hallazgo (preexistente, no causado por esta fase): varios specs
  e2e siguen buscando el diálogo `'Dossier'` y el botón
  `'Dossier'`, y `accesibilidad.spec.ts` espera colores pre-A2
  (`#005555`, foco `#ffff55`); la suite e2e no forma parte del
  gate, por eso nadie lo detectó. Se reporta sin tocar el resto.
- Verificación en navegador (2026-11-11, con cuenta de prueba
  eliminada después): 37/37 comprobaciones en Playwright contra
  producción — héroe con ilustración y título en Madrid, París y
  Lisboa; grupos A/B/D/E como tarjetas con coste real (viajes «180
  min», consultas e irregulares con su aviso); dossier y estado en
  la columna derecha; Operaciones globales abriendo Mapa, Tablero y
  Equipo; orden libre «Habla con Lucía sobre su identidad» abre el
  chat; inspeccionar la sala deja el hallazgo en la consola,
  inspeccionar la caja desbloquea recoger EV-06 y el dossier en
  escena pasa a «1 pista»; la nota de conducta de Inés («No voy a
  declarar sobre el robo.») aparece en su tarjeta de Lisboa;
  móvil 390 px sin desbordamiento (scrollW 390, una columna, héroe
  legible); caso generado (Fraude, Bilbao) con NPC en SVG, 10
  tarjetas y los grupos renderizados. Capturas en
  `~/workspace/redeseno-a2/shots-fase4/` (f4-01…f4-08).
- Dos correcciones durante la verificación: el recuento decía «1
  acciones» (ahora singular/plural: «1 acción», «2 acciones»,
  claves `game.scene.count*One/Many` en es/en/fr) y la primera
  comprobación del dossier esperaba evidencia tras inspeccionar la
  sala (la inspección solo revela hechos; la evidencia llega al
  recoger, verificado con EV-06).
- Nota de verificación: inspeccionar y hablar no piden diálogo de
  confirmación (lote 2: solo lo costoso ≥60 min o irreversible lo
  pide), así que la verificación usa el chat y la consola, no el
  diálogo de preview; el endpoint de interpretación responde 200
  en 0,3 s con la cuenta de prueba.

## Landing pública en `/`

- Visitante sin sesión: ve la landing. Usuario con sesión: redirige a
  `/archivo`. Cerrar sesión lleva a la landing. Las rutas `/archivo`,
  `/runs/:runId`, `/login`, `/registro`, `/glosario`, `/creditos` y
  `/prototype` no cambian. Los E2E que iban a `/` para entrar al archivo
  van ahora a `/archivo` (ver `apps/web/src/e2e/landing.spec.ts`).
- Contenido solo con hechos verificados: qué es el juego (público, para
  jugar en casa y crear tus propios casos), cómo se juega (investigar,
  interrogar, viajar, resolver, con plazo 96/48/24 h), qué se necesita
  (navegador; Ollama o LM Studio en local, o FreeLLMAPI por defecto en
  el servidor; cada persona configura su LLM y su clave), y los datos
  13 casos (1 fijo + 12 generados), 9 ciudades, 28 rutas, 3 idiomas
  (es/en/fr) y gratis. Sin estadísticas de jugadores, porcentajes,
  testimonios, casos de éxito ni ninguna cifra no verificada.
- Nombre provisional «Meridiano-cero» en un solo sitio fácil de cambiar
  (`landing.brand`); la decisión de nombre/marca sigue pendiente con
  Antonio. «A.C.M.E.» solo como agencia de ficción dentro del juego.
- Sin «Quiénes somos», sin dirección y sin soporte inventado: el pie
  enlaza al glosario, a los créditos, al login y al registro.
- Responsive y mobile-first, en es/en/fr (con selector de idioma en el
  pie, que guarda la preferencia como el resto de la app).

## Decisiones aplicadas

- Escena de París: no se añade ninguna escena nueva; el atlas sigue
  mostrando solo las ciudades del catálogo y del expediente.
- Billete: el dossier ya enseñaba el texto legible de cada evidencia,
  no su código crudo; no se cambia.
- Procedencia en el dossier: enseña el nombre real del lugar o de la
  ciudad tomado de los datos de la vista, no el código crudo.
- Barra superior: solo el avatar; el nombre del detective queda en el
  título del avatar.
- Cabecera del tablero: solo «Tablero de evidencias».
- Objetivos logrados: check verde y chip visible con su estado, nunca
  tachado.

## Lo que NO se copió de la maqueta, y por qué

- La etiqueta «Museo Naval de Madrid» no se aplica: en el caso real el
  lugar de Madrid es la sala de embalaje del Instituto Horizonte, y
  ese nombre no existe en el caso. La procedencia enseña el nombre
  real del lugar.
- La foto nocturna del Café de la Paix no se usa en la escena: el lugar
  real de París es el archivo de conservación, no un café. La foto del
  retrato de Inés sí se usa en el interrogatorio con ella.
- Los nombres de evidencias de la maqueta no se copian: los textos de
  evidencia los sirve el motor para cada caso y no se tocan.
- Los tiempos de viaje no se fijan en la interfaz: los calcula el
  motor para cada viaje (ruta del caso entre sus ciudades; catálogo
  geográfico fuera de ellas).
- El arte de escena y los retratos del equipo siguen siendo los SVG del
  juego: no existen fotos para el equipo. Los casos generados sí tienen
  fotos y escenas desde el set genérico (ver «Set genérico de imágenes»
  abajo); solo el caso fijo tiene ilustraciones y fotos propias (fase 3).

## Accesibilidad

- Contraste WCAG AA verificado con el script de auditoría de
  contraste, actualizado a los pares del tema claro.
- Las paletas de daltonismo y el alto contraste se adaptaron al tema
  claro (ya no son paneles azules oscuros).
- Se mantienen foco visible, enlace de salto, movimiento reducido y
  los textos para lectores de pantalla.

## Set genérico de imágenes (rama `imagenes-genericas-2026-11-12`)

- 8 retratos foto genéricos (4 hombres / 4 mujeres, edades variadas,
  mismo estilo cálido que el caso fijo) y 3 escenas genéricas
  (oficina, archivo, almacén, neutras, sin skyline de ninguna ciudad)
  para los casos generados. El caso fijo mantiene sus 5 fotos y sus
  3 escenas; el equipo sigue con SVG procedural.
- Retratos (`apps/web/src/game/portraits.ts`,
  `GENERIC_PHOTO_PORTRAITS_MEN` / `_WOMEN`): se asignan por género del
  nombre de pila y por semilla. El género no está en los datos del caso:
  se infiere del nombre (`inferNpcGender`: listas de nombres españoles
  habituales —los 14 de los 12 casos de producción más los comunes— y,
  si no está en lista, la terminación habitual: -a → mujer, -o →
  hombre). Si no se puede clasificar (Alex, Kim…), el NPC cae en el
  pool completo por semilla, nunca en un pool equivocado por adivinar.
  'Andrea' se clasifica como hombre (en España es mayoritariamente
  masculino). Dentro de cada caso, dos NPC del mismo género nunca
  comparten foto (4 fotos por género, 4 NPC por caso como máximo) y la
  misma semilla da siempre la misma foto.
- Escenas (`apps/web/src/game/scene-art.tsx`): por sufijo de tipo de
  lugar — `-OFIC` oficina, `-ARCH` y `-ARCHIVO` archivo, `-ALMACEN`
  almacén. Corrección encontrada al integrar: en producción no hay
  ningún `-ALM` y sí hay `-ARCHIVO` y `-ALMACEN`; sin ampliar el mapa,
  el arte de almacén no se habría visto jamás. Los demás sufijos
  (`-BIBLIOTECA`, `-RECEP`, `-CONT`…) caen en el respaldo de Madrid,
  como los tipos desconocidos.
- La mujer-3 genérica se parece a Lucía (protagonista del caso fijo):
  queda así, es un retrato genérico, no la Lucía del astrolabio.
- Verificación en navegador (2026-11-12, con cuenta de prueba eliminada
  después): 21/21 comprobaciones en Playwright — 2 casos generados y el
  caso fijo, escritorio y móvil 390 px.
- Arreglo por género (2026-11-12, decisión de Antonio: «sí me chirría,
  asigna por género»): antes la asignación era solo por semilla y un
  NPC con nombre masculino podía llevar foto de mujer (Marcos Ruiz →
  mujer-2, Diego Ramos → mujer-4 en la verificación). Tests en
  `apps/web/src/game/portraits.test.ts`: los 12 casos generados de
  producción (la lista tenía 11: faltaba `generado-639534d3`, añadido
  con este arreglo) sin cruzar el género, determinismo y distinción
  por caso.
