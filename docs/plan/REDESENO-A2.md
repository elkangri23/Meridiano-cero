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

Solo juego y ajustes de IA: Puesto de Mando, escena, interrogatorio,
tablero de evidencias (ventana del dossier) y ajustes, incluida la
sección de conexiones de IA. Archivo, login y registro, glosario,
créditos y preferencias conservan su aspecto actual.

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
- El arte de escena y los retratos siguen siendo los SVG del juego:
  no existen fotos para el resto de lugares y personajes.

## Accesibilidad

- Contraste WCAG AA verificado con el script de auditoría de
  contraste, actualizado a los pares del tema claro.
- Las paletas de daltonismo y el alto contraste se adaptaron al tema
  claro (ya no son paneles azules oscuros).
- Se mantienen foco visible, enlace de salto, movimiento reducido y
  los textos para lectores de pantalla.
