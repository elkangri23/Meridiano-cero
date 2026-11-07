// Resumen al retomar la partida (§13): solo datos reales de la vista —
// objetivos con estado, últimos descubrimientos en frases (no IDs crudos),
// minuto y plazo restante, ciudades visitadas derivadas de los viajes.
import { describe, expect, it } from 'vitest';
import type { PlayerViewDto } from '@meridiano/contracts';
import { resumeSummary } from './resume-summary';
import type { ResumeLookup } from './resume-summary';

const cities = [
  { id: 'madrid', name: 'Madrid', country: 'España' },
  { id: 'paris', name: 'París', country: 'Francia' },
  { id: 'lisbon', name: 'Lisboa', country: 'Portugal' },
];
const lookup: ResumeLookup = {
  locationName: id => ({ 'MAD-SALA': 'Sala de embalaje' } as Record<string, string>)[id],
  cityName: id => cities.find(city => city.id === id)?.name,
  npcName: id => ({ ines: 'Inés Valera' } as Record<string, string>)[id],
};
/** Descubrimientos en frases, como los traduce `discoveryText` en la
 * pantalla de juego (aquí, un doble de pruebas sin importar case-schema). */
function discover(id: string, lookup: ResumeLookup): string {
  if (id.startsWith('travel:')) {
    const city = lookup.cityName(id.slice('travel:'.length));
    return city ? `Viajas a ${city}.` : 'Viaje realizado.';
  }
  if (id.startsWith('identity:')) {
    const name = lookup.npcName(id.slice('identity:'.length));
    return name ? `Confirmaste la identidad de ${name}.` : id;
  }
  if (id === 'EV-02') return 'La cerradura de la vitrina tiene residuo de herramienta.';
  return id;
}

function viewFixture(overrides: Partial<PlayerViewDto> = {}): PlayerViewDto {
  return {
    schemaVersion: 1,
    runId: '00000000-0000-4000-8000-000000000001',
    branchId: 'main',
    version: 12,
    status: 'active',
    caseId: 'astrolabio-tres-ciudades',
    difficulty: 'normal',
    clock: { minute: 270, deadlineMinutes: 2880 },
    position: {
      city: { id: 'paris', name: 'París', country: 'Francia' },
      location: { id: 'PAR-ARCH', name: 'Archivo de conservación', description: 'Archivo' },
    },
    cities,
    locations: [{ id: 'MAD-SALA', name: 'Sala de embalaje', description: 'Sala' }],
    objects: [],
    dossier: ['travel:paris', 'identity:ines', 'EV-02'],
    conversation: [],
    npcChat: [],
    pendingRequests: [{ id: 'q1', type: 'query', dueMinute: 330 }],
    warrants: ['warrant:ines'],
    detentions: [],
    batch: null,
    finalReport: null,
    objectives: [
      { id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: false },
      { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false },
    ],
    officialResult: null,
    offers: [],
    briefing: null,
    caseMeta: { crimeType: 'robo', contentRating: 'familiar' },
    saveCapabilities: { manualLimit: 10, manualCount: 0, canSave: true, canLoad: true },
    recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
    ...overrides,
  } as PlayerViewDto;
}

describe('Resumen al retomar la partida (§13)', () => {
  it('devuelve minuto, plazo restante y posición actual', () => {
    const summary = resumeSummary(viewFixture(), lookup, discover);
    expect(summary.minute).toBe(270);
    expect(summary.deadlineMinutes).toBe(2880);
    expect(summary.remainingMinutes).toBe(2610);
    expect(summary.currentCity).toBe('París');
    expect(summary.currentLocation).toBe('Archivo de conservación');
  });

  it('las ciudades visitadas son la actual más las de los viajes del dossier', () => {
    const summary = resumeSummary(viewFixture(), lookup, discover);
    expect(summary.visitedCities).toEqual(['París']);
    const fromMadrid = resumeSummary(viewFixture({
      position: { city: { id: 'madrid', name: 'Madrid', country: 'España' }, location: { id: 'MAD-SALA', name: 'Sala de embalaje', description: 'Sala' } },
      dossier: ['travel:paris', 'travel:lisbon'],
    }), lookup, discover);
    expect(fromMadrid.visitedCities).toEqual(['Madrid', 'París', 'Lisboa']);
  });

  it('los últimos descubrimientos salen en frases, sin IDs crudos de viaje', () => {
    const summary = resumeSummary(viewFixture(), lookup, discover);
    expect(summary.lastDiscoveries).toEqual(['Viajas a París.', 'Confirmaste la identidad de Inés Valera.', 'La cerradura de la vitrina tiene residuo de herramienta.']);
  });

  it('los objetivos llevan su estado y las solicitudes su vencimiento', () => {
    const summary = resumeSummary(viewFixture({
      objectives: [
        { id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: true },
        { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false },
      ],
      detentions: ['ines'],
    }), lookup, discover);
    expect(summary.objectives).toEqual([
      { description: 'Detener a Inés con orden válida', achieved: true },
      { description: 'Recuperar el astrolabio original', achieved: false },
    ]);
    expect(summary.detentions).toBe(1);
    expect(summary.warrants).toBe(1);
    expect(summary.pendingRequests).toEqual([{ type: 'query', dueMinute: 330 }]);
  });

  it('el plazo restante nunca es negativo', () => {
    const summary = resumeSummary(viewFixture({ clock: { minute: 3000, deadlineMinutes: 2880 } }), lookup, discover);
    expect(summary.remainingMinutes).toBe(0);
  });
});
