import { describe, it, expect } from 'vitest';
import {
  GEOGRAPHIC_CATALOG, DEFAULT_TRAVEL_ROUTES, getCity, getRoute, getReachableCities, searchCities,
} from './geography-catalog.js';

describe('geography-catalog', () => {
  it('contiene ciudades reales con coordenadas', () => {
    expect(GEOGRAPHIC_CATALOG.length).toBeGreaterThanOrEqual(8);
    expect(getCity('madrid')).toMatchObject({ name: 'Madrid', country: 'ES', countryName: 'España' });
    expect(getCity('paris')).toMatchObject({ name: 'París', country: 'FR', countryName: 'Francia' });
    expect(getCity('lisboa')).toMatchObject({ name: 'Lisboa', country: 'PT', countryName: 'Portugal' });
  });

  it('las coordenadas están dentro del rango 0-100', () => {
    for (const city of GEOGRAPHIC_CATALOG) {
      expect(city.coordinates.x).toBeGreaterThanOrEqual(0);
      expect(city.coordinates.x).toBeLessThanOrEqual(100);
      expect(city.coordinates.y).toBeGreaterThanOrEqual(0);
      expect(city.coordinates.y).toBeLessThanOrEqual(100);
    }
  });

  it('getRoute devuelve duraciones positivas', () => {
    const route = getRoute('madrid', 'paris');
    expect(route).toBeDefined();
    expect(route!.minutes).toBeGreaterThan(0);
  });

  it('getRoute es simétrico', () => {
    const a = getRoute('madrid', 'paris');
    const b = getRoute('paris', 'madrid');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.minutes).toBe(b!.minutes);
  });

  it('getRoute devuelvo undefined para ruta inexistente', () => {
    expect(getRoute('madrid', 'inexistente')).toBeUndefined();
  });

  it('getReachableCities encuentra todas las ciudades desde Madrid', () => {
    const reachable = getReachableCities('madrid');
    // El grafo es conexo: desde Madrid se alcanzan todas las ciudades del catálogo.
    expect(reachable.length).toBe(GEOGRAPHIC_CATALOG.length);
    const ids = reachable.map(c => c.id);
    expect(ids).toContain('madrid');
    expect(ids).toContain('paris');
    expect(ids).toContain('lisboa');
  });

  it('searchCities encuentra por nombre', () => {
    const results = searchCities('Mad');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe('Madrid');
  });

  it('searchCities encuentra por país', () => {
    const results = searchCities('Francia');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.countryName).toBe('Francia');
  });

  it('searchCities con consulta vacía devuelve vacío', () => {
    expect(searchCities('')).toEqual([]);
  });

  it('DEFAULT_TRAVEL_ROUTES no tiene rutas duplicadas', () => {
    const keys = DEFAULT_TRAVEL_ROUTES.map(r => `${r.fromCityId}->${r.toCityId}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(DEFAULT_TRAVEL_ROUTES.length);
  });

  it('DEFAULT_TRAVEL_ROUTES no tiene auto-viajes', () => {
    for (const route of DEFAULT_TRAVEL_ROUTES) {
      expect(route.fromCityId).not.toBe(route.toCityId);
    }
  });
});