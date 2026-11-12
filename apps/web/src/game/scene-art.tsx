/**
 * Arte de escena por localización (fase 3 del rediseño A2): cada lugar del
 * caso fijo tiene su propia ilustración cinematográfica, en el estilo
 * aprobado por Antonio (foto para retratos, ilustración cinematográfica
 * para escenas; tonos cálidos papel/dorado/azul oscuro, coherentes con la
 * web A2 clara). Antes eran tres SVG pixel-art dibujados en código; ahora
 * son imágenes en `apps/web/public/images/`. El arte es decorativo: no
 * inventa contenido del caso, solo ilustra el tipo de lugar que la
 * definición ya nombra (sala de embalaje, archivo de conservación,
 * almacén de depósito). Los lugares de casos generados usan una de las 3
 * ilustraciones genéricas según su tipo (OFIC/ARCH/ALM); las
 * localizaciones desconocidas usan el arte de Madrid como respaldo. La
 * descripción accesible (§15) dice solo lo que dibuja el fondo, nunca
 * pruebas del caso que el jugador aún no descubrió: el contenido del caso
 * está en el texto de la escena.
 */

export type SceneArtId = 'madrid-sala' | 'paris-archivo' | 'lisboa-almacen' | 'generico-oficina' | 'generico-archivo' | 'generico-almacen';

import { useTranslation } from '../i18n';
import type { TranslateFn } from '@meridiano/contracts';

export function locationArtId(locationId: string): SceneArtId {
  if (locationId === 'PAR-ARCH') return 'paris-archivo';
  if (locationId === 'LIS-ALM') return 'lisboa-almacen';
  if (locationId === 'MAD-SALA') return 'madrid-sala';
  if (locationId.endsWith('-OFIC')) return 'generico-oficina';
  if (locationId.endsWith('-ARCH') || locationId.endsWith('-ARCHIVO')) return 'generico-archivo';
  if (locationId.endsWith('-ALM') || locationId.endsWith('-ALMACEN')) return 'generico-almacen';
  return 'madrid-sala';
}

/** Ilustración de cada lugar: las tres del caso fijo y las tres genéricas
 * por tipo de lugar (OFIC/ARCH/ALM) para los casos generados. Madrid es el
 * respaldo para lo desconocido. */
export const SCENE_ART_IMAGES: Record<SceneArtId, string> = {
  'madrid-sala': '/images/madrid-sala.webp',
  'paris-archivo': '/images/paris-archivo.webp',
  'lisboa-almacen': '/images/lisboa-almacen.webp',
  'generico-oficina': '/images/generico-escena-oficina.webp',
  'generico-archivo': '/images/generico-escena-archivo.webp',
  'generico-almacen': '/images/generico-escena-almacen.webp',
};

/** Descripción accesible del fondo (§15): lo que dibuja, sin spoilers del
 * caso. Las pruebas se descubren jugando; el arte no las nombra. */
export const SCENE_ART_KEYS: Record<SceneArtId, 'sceneArt.paris' | 'sceneArt.lisbon' | 'sceneArt.madrid' | 'sceneArt.office' | 'sceneArt.archive' | 'sceneArt.warehouse'> = {
  'paris-archivo': 'sceneArt.paris',
  'lisboa-almacen': 'sceneArt.lisbon',
  'madrid-sala': 'sceneArt.madrid',
  'generico-oficina': 'sceneArt.office',
  'generico-archivo': 'sceneArt.archive',
  'generico-almacen': 'sceneArt.warehouse',
};

export function sceneArtDescription(art: SceneArtId, t: TranslateFn): string {
  return t(SCENE_ART_KEYS[art]);
}

export function SceneArt({ locationId }: { locationId: string }) {
  const t = useTranslation();
  const art = locationArtId(locationId);
  return <div className="game-scene-art" data-testid="scene-art" data-location={locationId} role="img" aria-label={sceneArtDescription(art, t)}>
    <img src={SCENE_ART_IMAGES[art]} alt="" />
  </div>;
}
