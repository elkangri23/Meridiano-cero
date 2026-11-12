import { describe, expect, it } from 'vitest';
import { TRAVEL_TRANSITION_MS, travelCityPoint, travelPointOnRoute, travelProgressAt, travelRemainingMinutes, travelRoutePath } from './travel-animation';

describe('animación de viaje (rediseño Norte, fase 3)', () => {
  it('la ruta Madrid–París sale del catálogo, no de números a mano', () => {
    expect(travelCityPoint('madrid')).toEqual({ x: 43, y: 67 });
    expect(travelCityPoint('paris')).toEqual({ x: 60, y: 26 });
    expect(travelCityPoint('lisboa')).toEqual({ x: 20, y: 68 });
    expect(travelCityPoint('ciudad-sintetica')).toBeNull();
    const from = travelCityPoint('madrid');
    const to = travelCityPoint('paris');
    if (!from || !to) throw new Error('el catálogo no trae Madrid ni París');
    expect(travelRoutePath(from, to)).toBe('M43 67 Q51.5 36.5 60 26');
  });

  it('el punto avanza por la curva de origen a destino', () => {
    const from = { x: 43, y: 67 };
    const to = { x: 60, y: 26 };
    expect(travelPointOnRoute(from, to, 0)).toEqual(from);
    expect(travelPointOnRoute(from, to, 1)).toEqual(to);
    expect(travelPointOnRoute(from, to, 0.5)).toEqual({ x: 51.5, y: 41.5 });
    // Fuera de rango se sujeta a los extremos, nunca fuera de la ruta.
    expect(travelPointOnRoute(from, to, -0.5)).toEqual(from);
    expect(travelPointOnRoute(from, to, 2)).toEqual(to);
  });

  it('los minutos descuentan con el progreso y llegan a cero', () => {
    expect(travelRemainingMinutes(180, 0)).toBe(180);
    expect(travelRemainingMinutes(180, 0.5)).toBe(90);
    expect(travelRemainingMinutes(181, 0.5)).toBe(91);
    expect(travelRemainingMinutes(180, 1)).toBe(0);
    expect(travelRemainingMinutes(150, 0.25)).toBe(113);
  });

  it('el progreso es el tiempo transcurrido entre 0 y la duración', () => {
    expect(TRAVEL_TRANSITION_MS).toBe(2400);
    expect(travelProgressAt(0)).toBe(0);
    expect(travelProgressAt(1200)).toBe(0.5);
    expect(travelProgressAt(2400)).toBe(1);
    expect(travelProgressAt(5000)).toBe(1);
    expect(travelProgressAt(-100)).toBe(0);
  });
});
