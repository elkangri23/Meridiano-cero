import type { ReactElement } from 'react';
import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH, photoPortraitFor, portraitGrid, portraitTraitsFor } from './portraits';

/** Retrato de un personaje: foto cuando el NPC del caso fijo la tiene
 * (fase 3 del rediseño A2: `photoPortraitFor`) y retrato SVG procedural
 * por semilla en el resto de casos (fallback, también para el equipo
 * A.C.M.E.). No es clicable ni esconde pistas (GDD §2: sin pixel
 * hunting): es solo la cara del personaje, con `role="img"` y su nombre
 * como etiqueta accesible. */
export function Portrait({ seed, name, size = 'small' }: {
  seed: string;
  name: string;
  size?: 'small' | 'medium';
}): ReactElement {
  const photo = photoPortraitFor(seed);
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
