import type { ReactElement } from 'react';
import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH, photoPortraitFor, portraitGrid, portraitTraitsFor } from './portraits';

/** Retrato de un personaje: foto cuando la tiene (la fija del caso fijo
 * o la genérica del set por género y semilla, fase 3 del rediseño A2 y set
 * genérico: `photoPortraitFor`) y retrato SVG procedural por semilla en el
 * resto (fallback, también para el equipo A.C.M.E.). `npcIds` es la lista
 * de los NPC del caso en orden de definición (`view.npcChat`) y `npcNames`
 * sus nombres en el mismo orden: sin ellos, la foto genérica sale del
 * hash de la semilla y dos NPC del mismo caso podrían compartir cara. No
 * es clicable ni esconde pistas (GDD §2: sin pixel hunting): es solo la
 * cara del personaje, con `role="img"` y su nombre como etiqueta
 * accesible. */
export function Portrait({ seed, name, size = 'small', npcIds = [], npcNames = [] }: {
  seed: string;
  name: string;
  size?: 'small' | 'medium';
  npcIds?: readonly string[];
  npcNames?: readonly string[];
}): ReactElement {
  const photo = photoPortraitFor(seed, npcIds, name, npcNames);
  const width = size === 'medium' ? 48 : 32;
  const height = size === 'medium' ? 60 : 40;
  if (photo) {
    return <img className={`game-portrait-photo game-portrait-${size}`} src={photo} width={width} height={height}
      role="img" aria-label={`Retrato de ${name}`} data-testid="portrait-photo" alt="" />;
  }
  const grid = portraitGrid(portraitTraitsFor(seed));
  return <svg className={`game-portrait game-portrait-${size}`} width={width} height={height}
    viewBox={`0 0 ${PORTRAIT_WIDTH} ${PORTRAIT_HEIGHT}`} shapeRendering="crispEdges"
    role="img" aria-label={`Retrato de ${name}`} data-testid="portrait" focusable="false">
    {grid.flatMap((row, y) => row.map((color, x) =>
      <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />))}
  </svg>;
}
