import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, it, expect } from 'vitest';
import { astrolabioDefinition, availableOffers, confirmAction, createInitialRun, projectToPlayerView, resolveAction } from './index.js';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';

/** Expediente libre: el mismo astrolabio con el modo de exploración en
 * libre; la dificultad y el resto no cambian. */
function freeDefinition(): CaseDefinition {
  return { ...structuredClone(astrolabioDefinition), explorationMode: 'free' };
}

function freshRun(def: CaseDefinition): CaseRun {
  return createInitialRun(def, 'owner-synthetic', 'run-synthetic', hashDefinition(def));
}

/** Aplica una acción (con su confirmación cuando la pide) y devuelve la
 * partida resultante; si no se aplica, falla el test con el motivo. */
function apply(def: CaseDefinition, run: CaseRun, action: Parameters<typeof resolveAction>[2]): CaseRun {
  const preview = resolveAction(def, run, action);
  const result = preview.status === 'confirmation_required' ? confirmAction(def, run, action) : preview;
  if (result.status !== 'applied') throw new Error('Acción no aplicada: ' + result.status + ' ' + ('reason' in result ? result.reason : ''));
  return result.run;
}

describe('exploración libre y mapa mundial (GDD §5)', () => {
  it('en guiado se ven las tres ciudades del expediente desde el principio', () => {
    const view = projectToPlayerView(astrolabioDefinition, freshRun(astrolabioDefinition));
    expect(view.visibleCities).toEqual(['madrid', 'paris', 'lisboa']);
  });

  it('en libre solo se ve la ciudad inicial hasta descubrir investigando', () => {
    const def = freeDefinition();
    let run = freshRun(def);
    expect(projectToPlayerView(def, run).visibleCities).toEqual(['madrid']);
    // Inspeccionar la sala revela EV-01 y, con ella, París (la caja remite
    // al archivo de París): la ciudad pasa a ser visible sin viajar.
    run = apply(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    expect(run.discoveries).toContain('paris');
    expect(projectToPlayerView(def, run).visibleCities).toEqual(['madrid', 'paris']);
  });

  it('en libre la escena no ofrece viajar a ciudades del expediente sin descubrir', () => {
    const def = freeDefinition();
    const run = freshRun(def);
    const travel = availableOffers(def, run).filter(offer => offer.action.type === 'travel');
    const destinations = travel.map(offer => offer.action.params.toCityId);
    expect(destinations).not.toContain('paris');
    expect(destinations).not.toContain('lisboa');
    // Los destinos turísticos del catálogo sí se ofrecen: son información
    // pública del atlas, no del expediente.
    expect(destinations).toContain('barcelona');
    expect(destinations).toContain('valencia');
  });

  it('la ruta del expediente manda sobre la del catálogo para sus ciudades', () => {
    const def = freeDefinition();
    const run = freshRun(def);
    const preview = resolveAction(def, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(preview.status).toBe('confirmation_required');
    if (preview.status === 'confirmation_required') expect(preview.preview?.estimatedMinutes).toBe(180);
  });

  it('viajar a una ciudad admitida fuera del expediente cuesta la ruta del catálogo', () => {
    const def = freeDefinition();
    const run = freshRun(def);
    const preview = resolveAction(def, run, { type: 'travel', params: { toCityId: 'barcelona' } });
    expect(preview.status).toBe('confirmation_required');
    if (preview.status === 'confirmation_required') expect(preview.preview?.estimatedMinutes).toBe(300);
    const confirmed = confirmAction(def, run, { type: 'travel', params: { toCityId: 'barcelona' } });
    expect(confirmed.status).toBe('applied');
    if (confirmed.status === 'applied') {
      expect(confirmed.run.position).toEqual({ cityId: 'barcelona', locationId: 'visit:barcelona' });
      expect(confirmed.run.minute).toBeGreaterThanOrEqual(300);
      expect(confirmed.run.discoveries).toContain('travel:barcelona');
    }
  });

  it('en una ciudad turística no hay escenarios investigables ni personajes del caso', () => {
    const def = freeDefinition();
    let run = freshRun(def);
    run = apply(def, run, { type: 'travel', params: { toCityId: 'barcelona' } });
    const offers = availableOffers(def, run);
    expect(offers.some(offer => offer.action.type === 'inspect')).toBe(false);
    expect(offers.some(offer => offer.action.type === 'talk')).toBe(false);
    expect(offers.some(offer => offer.action.type === 'collect')).toBe(false);
    // Desde Barcelona se puede volver a Madrid o seguir a Valencia, pero no
    // hay ruta directa a Sevilla: el catálogo no finge cobertura universal.
    const travel = offers.filter(offer => offer.action.type === 'travel').map(offer => offer.action.params.toCityId);
    expect(travel).toContain('madrid');
    expect(travel).toContain('valencia');
    expect(travel).not.toContain('sevilla');
  });

  it('sin ruta directa ni del expediente el viaje es imposible con motivo honesto', () => {
    const def = freeDefinition();
    let run = freshRun(def);
    run = apply(def, run, { type: 'travel', params: { toCityId: 'barcelona' } });
    const noRoute = resolveAction(def, run, { type: 'travel', params: { toCityId: 'sevilla' } });
    expect(noRoute.status).toBe('impossible');
    if (noRoute.status === 'impossible') expect(noRoute.reason).toBe('No hay ruta disponible.');
    const unknown = resolveAction(def, run, { type: 'travel', params: { toCityId: 'roma' } });
    expect(unknown.status).toBe('impossible');
    if (unknown.status === 'impossible') expect(unknown.reason).toBe('No hay ruta disponible.');
  });

  it('viajar a una ciudad del expediente la descubre aunque no se conociera', () => {
    const def = freeDefinition();
    let run = freshRun(def);
    // Madrid → Lisboa es ruta del expediente (120 min) y se puede pedir
    // aunque Lisboa no esté descubierta: el viaje no se bloquea.
    run = apply(def, run, { type: 'travel', params: { toCityId: 'lisboa' } });
    expect(projectToPlayerView(def, run).visibleCities).toEqual(['madrid', 'lisboa']);
  });
});
