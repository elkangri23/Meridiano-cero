import { hashDefinition } from '@meridiano/case-schema/server';
import { ARREST_COORDINATION_MINUTES, arrestTypeOf } from '@meridiano/case-schema';
import { describe, expect, it } from 'vitest';
import { createInitialRun, resolveAction, confirmAction, astrolabioDefinition, generadoFraudeDefinition } from './index.js';
import { detentionPlan, arrestFactsForNpc, DETENTION_INTERACTIVE_MINUTES } from './arrest.js';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';

function runFor(def: CaseDefinition, patch: Partial<CaseRun>): CaseRun {
  return { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), ...patch };
}
// Estado sintético controlado: identidad y ubicación conocidas, orden
// válida; las rutas naturales están en simulation.test.ts.
function readyFixed(suspectId = 'ines', cityId = 'lisboa', locationId = 'LIS-ALM'): CaseRun {
  return runFor(astrolabioDefinition, {
    position: { cityId, locationId },
    discoveries: ['identity:' + suspectId, 'location:' + suspectId],
    warrants: ['warrant:' + suspectId, 'warrant:access'],
  });
}
function readyGenerated(def: CaseDefinition, cityId = 'valencia', locationId = 'VLC-ALM'): CaseRun {
  return runFor(def, {
    position: { cityId, locationId },
    discoveries: ['identity:carmen', 'location:carmen'],
    warrants: ['warrant:carmen', 'warrant:access'],
  });
}

describe('detenciones automáticas (GDD §12)', () => {
  it('el caso fijo es automático y un generado sin campo es interactivo', () => {
    expect(arrestTypeOf(astrolabioDefinition)).toBe('automatic');
    expect(arrestTypeOf(generadoFraudeDefinition)).toBe('interactive');
    expect(arrestTypeOf({ ...generadoFraudeDefinition, arrestType: 'automatic' })).toBe('automatic');
  });

  it('la automática no exige presencia: coordina desde otra ciudad y cuesta 30 min', () => {
    const run = readyFixed('ines', 'madrid', 'MAD-SALA');
    const plan = detentionPlan(astrolabioDefinition, run, 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.minutes).toBe(ARREST_COORDINATION_MINUTES);
    expect(ARREST_COORDINATION_MINUTES).toBe(30);
  });

  it('la automática rechaza modo interactivo, orden ausente, identidad desconocida, ubicación errónea y repetición', () => {
    const run = readyFixed();
    expect(detentionPlan(astrolabioDefinition, run, 'ines', 'interactive',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
    expect(detentionPlan(astrolabioDefinition, { ...run, warrants: [] }, 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
    expect(detentionPlan(astrolabioDefinition, { ...run, discoveries: ['location:ines'] }, 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
    expect(detentionPlan(astrolabioDefinition, run, 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'MAD-SALA' }).ok).toBe(false);
    expect(detentionPlan(astrolabioDefinition, { ...run, detentions: ['ines'] }, 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
  });

  it('sin parámetros, el plan vale para las ofertas (orden y ubicación no se revalidan)', () => {
    expect(detentionPlan(astrolabioDefinition, readyFixed(), 'ines', 'automatic').ok).toBe(true);
    expect(detentionPlan(astrolabioDefinition, { ...readyFixed(), warrants: [] }, 'ines', 'automatic').ok).toBe(false);
  });

  it('la interactiva exige presencia y cuesta 15 min', () => {
    const interactive = { ...astrolabioDefinition, arrestType: 'interactive' as const };
    expect(detentionPlan(interactive, readyFixed(), 'ines', 'interactive',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(true);
    const plan = detentionPlan(interactive, readyFixed(), 'ines', 'interactive',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' });
    if (plan.ok) expect(plan.minutes).toBe(DETENTION_INTERACTIVE_MINUTES);
    expect(DETENTION_INTERACTIVE_MINUTES).toBe(15);
    expect(detentionPlan(interactive, readyFixed('ines', 'madrid', 'MAD-SALA'), 'ines', 'interactive',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
    expect(detentionPlan(interactive, readyFixed(), 'ines', 'automatic',
      { warrantId: 'warrant:ines', locationId: 'LIS-ALM' }).ok).toBe(false);
  });

  it('un generado automático coordina desde otra ciudad; uno interactivo, no', () => {
    const automatic = { ...generadoFraudeDefinition, arrestType: 'automatic' as const };
    const away = readyGenerated(automatic, 'madrid', 'MAD-OFIC');
    expect(detentionPlan(automatic, away, 'carmen', 'automatic',
      { warrantId: 'warrant:carmen', locationId: 'VLC-ALM' }).ok).toBe(true);
    expect(detentionPlan(generadoFraudeDefinition, away, 'carmen', 'interactive',
      { warrantId: 'warrant:carmen', locationId: 'VLC-ALM' }).ok).toBe(false);
    const present = readyGenerated(generadoFraudeDefinition);
    expect(detentionPlan(generadoFraudeDefinition, present, 'carmen', 'interactive',
      { warrantId: 'warrant:carmen', locationId: 'VLC-ALM' }).ok).toBe(true);
  });

  it('detener en automático desde Madrid aplica, registra el modo y avanza 30 min', () => {
    const run = readyFixed('ines', 'madrid', 'MAD-SALA');
    const action = { type: 'detain' as const, params: { suspectId: 'ines', warrantId: 'warrant:ines', locationId: 'LIS-ALM', mode: 'automatic' } };
    const preview = resolveAction(astrolabioDefinition, run, action);
    expect(preview.status).toBe('confirmation_required');
    if (preview.status === 'confirmation_required') {
      expect(preview.preview?.estimatedMinutes).toBe(30);
      expect(preview.preview?.description).toContain('autoridades');
    }
    const result = confirmAction(astrolabioDefinition, run, action);
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(30);
    expect(result.run.detentions).toEqual(['ines']);
    expect(result.events).toMatchObject([{ type: 'detain', payload: { suspectId: 'ines', mode: 'automatic' } }]);
  });

  it('los testigos en la ciudad del detenido y el propio detenido reaccionan; los de otra ciudad, no', () => {
    // Tomás está en Madrid con Lucía; Inés, en Lisboa.
    const run = { ...readyFixed('tomas', 'madrid', 'MAD-SALA'), detentions: ['tomas'] };
    expect(arrestFactsForNpc(astrolabioDefinition, run, 'lucia')).toEqual([
      { id: 'arrest:tomas', text: 'Las autoridades detuvieron a Tomás Ríos por orden de A.C.M.E.' }]);
    expect(arrestFactsForNpc(astrolabioDefinition, run, 'tomas')).toEqual([
      { id: 'arrest:tomas', text: 'Las autoridades me detuvieron por orden de A.C.M.E.' }]);
    expect(arrestFactsForNpc(astrolabioDefinition, run, 'ines')).toEqual([]);
    expect(arrestFactsForNpc(astrolabioDefinition, run, 'marta')).toEqual([]);
    expect(arrestFactsForNpc(astrolabioDefinition, { ...run, detentions: [] }, 'lucia')).toEqual([]);
  });
});
