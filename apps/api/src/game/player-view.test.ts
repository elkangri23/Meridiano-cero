// Resúmenes de eventos de la consola: cada acción confirmada deja una frase
// legible, nunca un ID crudo ni el genérico «La investigación avanza.» cuando
// se sabe qué pasó.
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { isPlayerViewDto } from '@meridiano/contracts';
import { astrolabioDefinition, createInitialRun, ENGINE_VERSION } from '@meridiano/engine';
import type { EngineEvent } from '@meridiano/engine';
import type { StoredRun } from './runs.ts';
import { playerViewDto, projectEvents } from './player-view.ts';

function fullRun(overrides: Record<string, unknown> = {}) {
  const base = createInitialRun(astrolabioDefinition, 'owner-1', '22222222-2222-4222-8222-222222222222',
    hashDefinition(astrolabioDefinition));
  const stored: StoredRun = {
    id: base.id, ownerId: 'owner-1', definitionId: base.definitionId, definitionHash: base.definitionHash,
    engineVersion: ENGINE_VERSION, revision: 1, branchId: '33333333-3333-4333-8333-333333333333',
    status: 'active', difficulty: 'easy', deadlineMinutes: 5760, engineState: base,
  };
  return { ...base, ...stored, ...overrides };
}

function summaries(events: Array<{ type: string; payload?: Record<string, unknown> }>): string[] {
  const engineEvents: EngineEvent[] = events.map((event, index) => ({
    ordinal: index + 1, minute: 10 * (index + 1), type: event.type, payload: event.payload ?? {},
  }));
  return projectEvents(astrolabioDefinition, engineEvents).map(item => item.summary);
}

describe('resúmenes de eventos de la consola', () => {
  it('recoger narra el hallazgo con su texto, no con el ID crudo', () => {
    expect(summaries([{ type: 'collect', payload: { evidenceId: 'EV-06' } }])).toEqual([
      'Recogido: La caja guarda una copia del manifiesto, con sello y firma verificables.',
    ]);
    // Sin texto conocido se mantiene el resumen anterior (nunca se oculta).
    expect(summaries([{ type: 'collect', payload: { evidenceId: 'EV-99' } }])).toEqual([
      'Objeto EV-99 recogido.',
    ]);
  });

  it('pedir una orden nombra al sospechoso en vez del genérico', () => {
    expect(summaries([{ type: 'request_warrant', payload: { requestId: 'req-1', suspectId: 'ines' } }])).toEqual([
      'Solicitud de orden contra Inés Valera.',
    ]);
  });

  it('al madurar una orden concedida se dice que se concede; una consulta, que dio resultado', () => {
    expect(summaries([{ type: 'request_matured', payload: { requestId: 'req-1', type: 'warrant' } }])).toEqual([
      'Orden concedida.',
    ]);
    expect(summaries([{ type: 'request_matured', payload: { requestId: 'req-2', type: 'fixed_evidence' } }])).toEqual([
      'Una solicitud ha dado resultado.',
    ]);
  });

  it('ningún resumen del caso fijo enseña IDs crudos ni el genérico sin motivo', () => {
    const all = summaries([
      { type: 'inspect', payload: { targetId: 'MAD-SALA' } },
      { type: 'inspect', payload: { targetId: 'MAD-SALA', elementId: 'caja' } },
      { type: 'collect', payload: { evidenceId: 'EV-01' } },
      { type: 'talk', payload: { npcId: 'tomas' } },
      { type: 'travel', payload: { toCityId: 'paris' } },
      { type: 'wait', payload: { minutes: 30 } },
      { type: 'request_submitted', payload: { requestId: 'req-1' } },
      { type: 'request_warrant', payload: { requestId: 'req-2', suspectId: 'ines' } },
      { type: 'request_matured', payload: { requestId: 'req-2', type: 'warrant' } },
      { type: 'warrant_denied', payload: {} },
      { type: 'detain', payload: { suspectId: 'ines' } },
      { type: 'recover', payload: {} },
      { type: 'finish', payload: {} },
    ]);
    for (const summary of all) {
      expect(summary).not.toMatch(/EV-\d\d|travel:|warrant:|request_warrant|La investigación avanza/);
    }
  });
});

describe('objetivos en vivo de la vista del jugador', () => {
  it('al empezar, los dos objetivos están pendientes y la vista valida el contrato', () => {
    const view = playerViewDto(astrolabioDefinition, fullRun(), 0);
    // La dificultad viaja en la vista para que la cabecera la enseñe junto
    // al reloj (antes no llegaba y la web no podía mostrarla).
    expect(view.difficulty).toBe('easy');
    expect(view.clock.deadlineMinutes).toBe(2880);
    expect(view.objectives).toEqual([
      { id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: false },
      { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false },
    ]);
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('detener a Inés y recuperar el astrolabio marcan los objetivos como logrados', () => {
    const view = playerViewDto(astrolabioDefinition,
      fullRun({ detentions: ['ines'], recoveredObjects: ['astrolabio-original'] }), 0);
    expect(view.objectives).toEqual([
      { id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: true },
      { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: true },
    ]);
    // Detener a otro no logra nada.
    const wrong = playerViewDto(astrolabioDefinition, fullRun({ detentions: ['tomas'] }), 0);
    expect(wrong.objectives.every(objective => !objective.achieved)).toBe(true);
  });

  it('la vista lleva los datos de charla de cada personaje y valida el contrato', () => {
    const view = playerViewDto(astrolabioDefinition, fullRun(), 0);
    const ines = view.npcChat.find(entry => entry.id === 'ines');
    expect(ines).toMatchObject({
      name: 'Inés Valera',
      refusal: 'No voy a declarar sobre el robo.',
    });
    expect(ines?.knowledge).toEqual([
      { id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' },
    ]);
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('un expediente generado lleva en la vista los datos de sus propios NPC', () => {
    const definition = structuredClone(astrolabioDefinition) as unknown as import('@meridiano/case-schema').CaseDefinition;
    definition.npcs = [
      { id: 'marcos', name: 'Marcos', cityId: 'bilbao',
        knowledge: ['mercado-negro'], cooperation: 6,
        role: 'Comerciante', persona: 'Soy comerciante y conozco el mercado de antigüedades.' },
    ];
    definition.texts = {
      evidence: {},
      knowledge: { 'mercado-negro': 'Conocimiento del mercado de antigüedades y canales de venta.' },
      greetings: { marcos: 'Buenos días, soy Marcos. Me dedico al comercio de antigüedades.' },
    };
    const view = playerViewDto(definition, fullRun(), 0);
    expect(view.npcChat).toEqual([
      {
        id: 'marcos',
        name: 'Marcos',
        role: 'Comerciante',
        persona: 'Soy comerciante y conozco el mercado de antigüedades.',
        knowledge: [
          { id: 'identity', text: 'Soy Marcos, Comerciante.' },
          { id: 'mercado-negro', text: 'Conocimiento del mercado de antigüedades y canales de venta.' },
        ],
        greeting: 'Buenos días, soy Marcos. Me dedico al comercio de antigüedades.',
      },
    ]);
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('la vista lleva los textos de evidencia del expediente, no los del caso fijo', () => {
    const fixed = playerViewDto(astrolabioDefinition, fullRun(), 0);
    expect(fixed.evidenceTexts['EV-02']).toBe('La cerradura de la vitrina tiene residuo de herramienta.');
    expect(isPlayerViewDto(fixed)).toBe(true);
    const definition = structuredClone(astrolabioDefinition) as unknown as import('@meridiano/case-schema').CaseDefinition;
    definition.texts = {
      evidence: { 'EV-02': 'Se localiza una caja de transporte vacía junto al espacio del manuscrito.' },
      knowledge: {}, greetings: {},
    };
    const generated = playerViewDto(definition, fullRun(), 0);
    expect(generated.evidenceTexts['EV-02']).toBe('Se localiza una caja de transporte vacía junto al espacio del manuscrito.');
    expect(isPlayerViewDto(generated)).toBe(true);
  });

  it('la vista lleva el resultado del análisis desde evidenceRecords, sin tocar el dossier', () => {
    const run = fullRun({
      evidenceRecords: {
        'EV-03': { revealedMinute: 120, origin: 'MAD-SALA', method: 'analyze' },
        'EV-04': { revealedMinute: 240, origin: 'PAR-ARCH', method: 'query' },
      },
      discoveries: ['EV-03', 'EV-04'],
    });
    const view = playerViewDto(astrolabioDefinition, run, 0);
    expect(view.analysisResults).toEqual(['EV-03']);
    expect(view.dossier).toEqual(['EV-03', 'EV-04']);
    expect(isPlayerViewDto(view)).toBe(true);
  });
});
