// Catálogo geográfico verificable para T5-02
// SPEC-008: destinos culturales separados de pistas y buscador accesible

export interface GeographicCity {
  id: string;
  name: string;
  country: string;
  countryName: string;
  region: string;
  coordinates: { x: number; y: number };
}

// Catálogo de ciudades reales con coordenadas de atlas (escala 0-100)
export const GEOGRAPHIC_CATALOG: GeographicCity[] = [
  {
    id: 'madrid', name: 'Madrid', country: 'ES', countryName: 'España',
    region: 'madrid', coordinates: { x: 43, y: 67 },
  },
  {
    id: 'barcelona', name: 'Barcelona', country: 'ES', countryName: 'España',
    region: 'barcelona', coordinates: { x: 47, y: 33 },
  },
  {
    id: 'valencia', name: 'Valencia', country: 'ES', countryName: 'España',
    region: 'valencia', coordinates: { x: 44, y: 25 },
  },
  {
    id: 'sevilla', name: 'Sevilla', country: 'ES', countryName: 'España',
    region: 'sevilla', coordinates: { x: 28, y: 83 },
  },
  {
    id: 'bilbao', name: 'Bilbao', country: 'ES', countryName: 'España',
    region: 'bilbao', coordinates: { x: 38, y: 12 },
  },
  {
    id: 'malaga', name: 'Málaga', country: 'ES', countryName: 'España',
    region: 'malaga', coordinates: { x: 26, y: 78 },
  },
  {
    id: 'zaragoza', name: 'Zaragoza', country: 'ES', countryName: 'España',
    region: 'zaragoza', coordinates: { x: 43, y: 30 },
  },
  {
    id: 'paris', name: 'París', country: 'FR', countryName: 'Francia',
    region: 'paris', coordinates: { x: 59, y: 29 },
  },
  {
    id: 'lisboa', name: 'Lisboa', country: 'PT', countryName: 'Portugal',
    region: 'lisboa', coordinates: { x: 23, y: 75 },
  },
];

// Duraciones de viaje base entre ciudades (minutos reales estimados)
export interface TravelRoute {
  fromCityId: string;
  toCityId: string;
  minutes: number;
}

export const DEFAULT_TRAVEL_ROUTES: TravelRoute[] = [
  { fromCityId: 'madrid', toCityId: 'barcelona', minutes: 300 },
  { fromCityId: 'barcelona', toCityId: 'madrid', minutes: 300 },
  { fromCityId: 'madrid', toCityId: 'valencia', minutes: 200 },
  { fromCityId: 'valencia', toCityId: 'madrid', minutes: 200 },
  { fromCityId: 'madrid', toCityId: 'sevilla', minutes: 330 },
  { fromCityId: 'sevilla', toCityId: 'madrid', minutes: 330 },
  { fromCityId: 'madrid', toCityId: 'bilbao', minutes: 240 },
  { fromCityId: 'bilbao', toCityId: 'madrid', minutes: 240 },
  { fromCityId: 'madrid', toCityId: 'malaga', minutes: 300 },
  { fromCityId: 'malaga', toCityId: 'madrid', minutes: 300 },
  { fromCityId: 'madrid', toCityId: 'zaragoza', minutes: 180 },
  { fromCityId: 'zaragoza', toCityId: 'madrid', minutes: 180 },
  { fromCityId: 'madrid', toCityId: 'paris', minutes: 600 },
  { fromCityId: 'paris', toCityId: 'madrid', minutes: 600 },
  { fromCityId: 'madrid', toCityId: 'lisboa', minutes: 360 },
  { fromCityId: 'lisboa', toCityId: 'madrid', minutes: 360 },
  { fromCityId: 'barcelona', toCityId: 'valencia', minutes: 180 },
  { fromCityId: 'valencia', toCityId: 'barcelona', minutes: 180 },
  { fromCityId: 'barcelona', toCityId: 'paris', minutes: 540 },
  { fromCityId: 'paris', toCityId: 'barcelona', minutes: 540 },
  { fromCityId: 'sevilla', toCityId: 'malaga', minutes: 120 },
  { fromCityId: 'malaga', toCityId: 'sevilla', minutes: 120 },
  { fromCityId: 'sevilla', toCityId: 'lisboa', minutes: 240 },
  { fromCityId: 'lisboa', toCityId: 'sevilla', minutes: 240 },
  { fromCityId: 'bilbao', toCityId: 'zaragoza', minutes: 180 },
  { fromCityId: 'zaragoza', toCityId: 'bilbao', minutes: 180 },
  { fromCityId: 'paris', toCityId: 'lisboa', minutes: 720 },
  { fromCityId: 'lisboa', toCityId: 'paris', minutes: 720 },
];

export function getCity(id: string): GeographicCity | undefined {
  return GEOGRAPHIC_CATALOG.find(city => city.id === id);
}

export function getRoute(fromCityId: string, toCityId: string): TravelRoute | undefined {
  return DEFAULT_TRAVEL_ROUTES.find(route => route.fromCityId === fromCityId && route.toCityId === toCityId);
}

export function getReachableCities(fromCityId: string): GeographicCity[] {
  const reachable = new Set<string>();
  const queue = [fromCityId];
  reachable.add(fromCityId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const route of DEFAULT_TRAVEL_ROUTES) {
      if (route.fromCityId === current && !reachable.has(route.toCityId)) {
        reachable.add(route.toCityId);
        queue.push(route.toCityId);
      }
    }
  }
  return GEOGRAPHIC_CATALOG.filter(city => reachable.has(city.id));
}

export function searchCities(query: string): GeographicCity[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];
  return GEOGRAPHIC_CATALOG.filter(city =>
    city.name.toLowerCase().includes(q) ||
    city.countryName.toLowerCase().includes(q) ||
    city.region.toLowerCase().includes(q)
  );
}