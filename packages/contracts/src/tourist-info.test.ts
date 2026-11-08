import { describe, it, expect } from 'vitest';
import { GEOGRAPHIC_CATALOG } from './geography-catalog.js';
import { TOURIST_INFO, touristInfoFor, visitCityId, visitLocationId, visitLocationName } from './tourist-info.js';

describe('tourist-info', () => {
  it('cada ciudad admitida tiene información turística determinista', () => {
    for (const city of GEOGRAPHIC_CATALOG) {
      const info = touristInfoFor(city.id);
      expect(info, city.id).toBeDefined();
      expect(info?.summary.trim().length).toBeGreaterThan(20);
      expect(info?.landmarks.length).toBeGreaterThanOrEqual(2);
      for (const landmark of info?.landmarks ?? []) expect(landmark.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(TOURIST_INFO).sort()).toEqual(GEOGRAPHIC_CATALOG.map(city => city.id).sort());
  });

  it('una ciudad fuera del catálogo no tiene información turística', () => {
    expect(touristInfoFor('roma')).toBeUndefined();
    expect(touristInfoFor('')).toBeUndefined();
  });

  it('el lugar de visita es sintético y reversible', () => {
    expect(visitLocationId('paris')).toBe('visit:paris');
    expect(visitCityId('visit:paris')).toBe('paris');
    expect(visitCityId('PAR-ARCH')).toBeUndefined();
    expect(visitLocationName({ id: 'paris', name: 'París', country: 'FR', countryName: 'Francia', region: 'paris', coordinates: { x: 59, y: 29 } })).toBe('Centro de París');
  });
});
