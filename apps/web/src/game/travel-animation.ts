// Animación de viaje (rediseño Norte, fase 3): geometría pura de la ruta
// en el mapa del dock y de la transición de viaje. Sin estado ni React:
// el progreso lo mueve GameScreen y estas funciones solo calculan dónde
// va el punto, qué queda por descontar y qué camino dibujar. Las
// coordenadas son las del catálogo geográfico (porcentajes 0–100), así que
// la ruta nunca se fija a mano: sale de las ciudades de origen y destino.
import { GEOGRAPHIC_CATALOG } from '@meridiano/contracts';

/** Duración visual de la transición de viaje: la escena cambia al terminar. */
export const TRAVEL_TRANSITION_MS = 2400;

export interface TravelCityPoint { x: number; y: number; }

/** Punto de una ciudad del catálogo en el mapa (porcentajes), o null si la
 * ciudad no está en el catálogo (p. ej. una sintética de pruebas). */
export function travelCityPoint(cityId: string): TravelCityPoint | null {
  const city = GEOGRAPHIC_CATALOG.find(entry => entry.id === cityId);
  if (!city) return null;
  return { x: city.coordinates.x, y: city.coordinates.y };
}

/** Punto de control de la curva: el punto medio levantado, para que la
 * ruta se arquee como en la maqueta en vez de ir en línea recta. */
export function travelControlPoint(from: TravelCityPoint, to: TravelCityPoint): TravelCityPoint {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 10 };
}

/** Camino SVG de la ruta entre dos puntos del mapa. */
export function travelRoutePath(from: TravelCityPoint, to: TravelCityPoint): string {
  const control = travelControlPoint(from, to);
  return `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`;
}

/** Punto de la curva de Bézier cuadrática en el progreso 0–1. */
export function travelPointOnRoute(from: TravelCityPoint, to: TravelCityPoint, progress: number): TravelCityPoint {
  const clamped = Math.min(1, Math.max(0, progress));
  const control = travelControlPoint(from, to);
  const u = 1 - clamped;
  return {
    x: u * u * from.x + 2 * u * clamped * control.x + clamped * clamped * to.x,
    y: u * u * from.y + 2 * u * clamped * control.y + clamped * clamped * to.y,
  };
}

/** Minutos que quedan por descontar en el progreso 0–1. */
export function travelRemainingMinutes(totalMinutes: number, progress: number): number {
  return Math.max(0, Math.ceil(totalMinutes * (1 - Math.min(1, Math.max(0, progress)))));
}

/** Progreso 0–1 a partir del tiempo transcurrido de la transición. */
export function travelProgressAt(elapsedMs: number, durationMs: number = TRAVEL_TRANSITION_MS): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}
