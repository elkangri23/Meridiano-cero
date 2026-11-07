import type { ReactElement } from 'react';
import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH, portraitGrid, portraitTraitsFor } from './portraits';

/** Retrato pixel-art de un personaje, dibujado como SVG a partir de su
 * rejilla determinista. No es clicable ni esconde pistas (GDD §2: sin pixel
 * hunting): es solo la cara del personaje, con `role="img"` y su nombre
 * como etiqueta accesible. */
export function Portrait({ seed, name, size = 'small' }: {
  seed: string;
  name: string;
  size?: 'small' | 'medium';
}): ReactElement {
  const grid = portraitGrid(portraitTraitsFor(seed));
  const width = size === 'medium' ? 48 : 32;
  const height = size === 'medium' ? 60 : 40;
  return <svg className={`game-portrait game-portrait-${size}`} width={width} height={height}
    viewBox={`0 0 ${PORTRAIT_WIDTH} ${PORTRAIT_HEIGHT}`} shapeRendering="crispEdges"
    role="img" aria-label={`Retrato de ${name}`} data-testid="portrait" focusable="false">
    {grid.flatMap((row, y) => row.map((color, x) =>
      <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />))}
  </svg>;
}
