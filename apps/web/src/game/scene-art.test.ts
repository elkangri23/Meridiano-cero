import { describe, expect, it } from 'vitest';
import { SCENE_ART_IMAGES, locationArtId } from './scene-art';

describe('arte de escena del caso fijo (fase 3 del rediseño A2)', () => {
  it('cada lugar del caso fijo tiene su ilustración en /images/', () => {
    expect(SCENE_ART_IMAGES).toEqual({
      'madrid-sala': '/images/madrid-sala.webp',
      'paris-archivo': '/images/paris-archivo.webp',
      'lisboa-almacen': '/images/lisboa-almacen.webp',
    });
    for (const src of Object.values(SCENE_ART_IMAGES)) {
      expect(src.startsWith('/images/')).toBe(true);
      expect(src.endsWith('.webp')).toBe(true);
    }
  });

  it('el lugar manda en el arte: París y Lisboa por su id, Madrid como respaldo', () => {
    expect(locationArtId('PAR-ARCH')).toBe('paris-archivo');
    expect(locationArtId('LIS-ALM')).toBe('lisboa-almacen');
    expect(locationArtId('MAD-SALA')).toBe('madrid-sala');
    expect(locationArtId('DESCONOCIDO')).toBe('madrid-sala');
    expect(locationArtId('')).toBe('madrid-sala');
  });
});
