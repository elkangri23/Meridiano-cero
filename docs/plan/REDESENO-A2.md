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
- El arte de escena y los retratos de los casos generados y del equipo
  siguen siendo los SVG del juego: no existen fotos para el resto de
  lugares y personajes. Solo el caso fijo tiene ilustraciones y fotos
  (fase 3).

## Accesibilidad

- Contraste WCAG AA verificado con el script de auditoría de
  contraste, actualizado a los pares del tema claro.
- Las paletas de daltonismo y el alto contraste se adaptaron al tema
  claro (ya no son paneles azules oscuros).
- Se mantienen foco visible, enlace de salto, movimiento reducido y
  los textos para lectores de pantalla.
