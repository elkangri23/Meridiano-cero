import { describe, expect, it } from 'vitest';
import { SCENE_ART_IMAGES, locationArtId } from './scene-art';

describe('arte de escena del caso fijo (fase 3 del rediseño A2)', () => {
  it('cada lugar del caso fijo tiene su ilustración en /images/', () => {
    expect(SCENE_ART_IMAGES).toEqual({
      'madrid-sala': '/images/madrid-sala.webp',
      'paris-archivo': '/images/paris-archivo.webp',
      'lisboa-almacen': '/images/lisboa-almacen.webp',
      'generico-oficina': '/images/generico-escena-oficina.webp',
      'generico-archivo': '/images/generico-escena-archivo.webp',
      'generico-almacen': '/images/generico-escena-almacen.webp',
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

  it('los lugares generados usan el arte de su tipo: OFIC, ARCH o ALM', () => {
    expect(locationArtId('MAD-OFIC')).toBe('generico-oficina');
    expect(locationArtId('BCN-OFIC')).toBe('generico-oficina');
    expect(locationArtId('MAD-ARCH')).toBe('generico-archivo');
    expect(locationArtId('BCN-ARCH')).toBe('generico-archivo');
    expect(locationArtId('MAD-ALM')).toBe('generico-almacen');
    expect(locationArtId('VLC-ALM')).toBe('generico-almacen');
  });

  it('los sufijos reales del catálogo también valen: -ARCHIVO y -ALMACEN', () => {
    expect(locationArtId('BIL-ARCHIVO')).toBe('generico-archivo');
    expect(locationArtId('BAR-ARCHIVO')).toBe('generico-archivo');
    expect(locationArtId('MAL-ALMACEN')).toBe('generico-almacen');
  });

  it('el caso fijo manda sobre el sufijo: PAR-ARCH y LIS-ALM no son genéricos', () => {
    expect(locationArtId('PAR-ARCH')).toBe('paris-archivo');
    expect(locationArtId('LIS-ALM')).toBe('lisboa-almacen');
  });
});
