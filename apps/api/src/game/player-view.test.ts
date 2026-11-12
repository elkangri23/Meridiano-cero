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
    status: 'active', difficulty: 'easy', deadlineMinutes: 5760, explorationMode: 'guided', engineState: base,
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

  it('una acción irregular deja resumen legible y la retirada se nombra', () => {
    expect(summaries([
      { type: 'irregular', payload: { kind: 'force_entry', targetId: 'LIS-ALM', seenBy: ['marta', 'ines'] } },
      { type: 'irregular', payload: { kind: 'bribe', targetId: 'lucia', seenBy: [] } },
      { type: 'case_withdrawn', payload: { reason: 'withdrawn' } },
    ])).toEqual([
      'Forzaste el acceso a Almacén de depósito. Te han visto.',
      'Sobornaste a Lucía. Nadie te ha visto.',
      'A.C.M.E. ha retirado el caso por tu conducta.',
    ]);
  });

  it('una detención automática dice que actúan las autoridades; la manual, que detienes tú', () => {
    expect(summaries([{ type: 'detain', payload: { suspectId: 'ines', mode: 'automatic' } }])).toEqual([
      'Las autoridades han detenido a Inés Valera por orden de A.C.M.E.',
    ]);
    expect(summaries([{ type: 'detain', payload: { suspectId: 'ines', mode: 'interactive' } }])).toEqual([
      'Detención de Inés Valera.',
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

describe('vista del jugador en francés (T5-05)', () => {
  it('objetivos, dossier, charla y ofertas salen en francés y la vista valida el contrato', () => {
    const view = playerViewDto(astrolabioDefinition, fullRun(), 0, [], null, 'fr');
    expect(view.objectives).toEqual([
      { id: 'obj-detener', description: 'Arrêter Inés avec un mandat valide', achieved: false },
      { id: 'obj-recuperar', description: 'Récupérer l\'astrolabe original', achieved: false },
    ]);
    expect(view.briefing?.title).toBe('L\'astrolabe des trois villes');
    expect(view.evidenceTexts['EV-02']).toBe('La serrure de la vitrine porte des résidus d\'outil.');
    expect(view.position.city).toEqual({ id: 'madrid', name: 'Madrid', country: 'Espagne' });
    expect(view.cities.map(city => city.country)).toEqual(['Espagne', 'France', 'Portugal']);
    expect(view.position.location).toMatchObject({ id: 'MAD-SALA', name: 'Salle d\'emballage' });
    expect(view.offers.map(offer => offer.label)).toContain('Inspecter Salle d\'emballage');
    expect(view.offers.map(offer => offer.label)).toContain('Clore le dossier et présenter le rapport');
    const ines = view.npcChat.find(entry => entry.id === 'ines');
    expect(ines).toMatchObject({ refusal: 'Je ne vais pas témoigner sur le vol.' });
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('los resúmenes de eventos salen en francés, con el canal en minúscula en la frase', () => {
    const engineEvents: EngineEvent[] = [
      { ordinal: 1, minute: 10, type: 'collect', payload: { evidenceId: 'EV-06' } },
      { ordinal: 2, minute: 20, type: 'communicate', payload: { recipientId: 'tomas', channel: 'call' } },
      { ordinal: 3, minute: 30, type: 'irregular', payload: { kind: 'bribe', targetId: 'lucia', seenBy: [] } },
      { ordinal: 4, minute: 40, type: 'detain', payload: { suspectId: 'ines', mode: 'automatic' } },
    ];
    const summaries = projectEvents(astrolabioDefinition, engineEvents, 'fr').map(item => item.summary);
    expect(summaries[0]).toContain('Ramassé :');
    expect(summaries[1]).toBe('Message envoyé à Tomás Ríos par appel.');
    expect(summaries[2]).toBe('Tu as soudoyé Lucía. Personne ne t\'a vu.');
    expect(summaries[3]).toBe('Les autorités ont arrêté Inés Valera sur ordre de l\'A.C.M.E.');
    // El resumen de inspeccionar nombra el lugar traducido, no el español
    // de la definición (antes: «Inspection in Sala de embalaje.» en inglés).
    const inspect = [{ ordinal: 1, minute: 10, type: 'inspect', payload: { targetId: 'MAD-SALA' } }] as EngineEvent[];
    expect(projectEvents(astrolabioDefinition, inspect, 'fr').map(item => item.summary)).toEqual(['Inspection à Salle d\'emballage.']);
    expect(projectEvents(astrolabioDefinition, inspect, 'en').map(item => item.summary)).toEqual(['Inspection in Packing room.']);
    expect(projectEvents(astrolabioDefinition, inspect).map(item => item.summary)).toEqual(['Inspección en Sala de embalaje.']);
  });

  it('en español la vista sigue diciendo exactamente lo mismo que antes', () => {
    const view = playerViewDto(astrolabioDefinition, fullRun(), 0);
    expect(view.position.city).toEqual({ id: 'madrid', name: 'Madrid', country: 'España' });
    expect(view.objectives[0]?.description).toBe('Detener a Inés con orden válida');
    expect(isPlayerViewDto(view)).toBe(true);
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
    expect(isPlayerViewDto(view)).toBe(true);
    // Detener a otro no logra nada.
    const wrong = playerViewDto(astrolabioDefinition, fullRun({ detentions: ['tomas'] }), 0);
    expect(wrong.objectives.every(objective => !objective.achieved)).toBe(true);
  });

  it('la conducta irregular viaja en la vista y valida el contrato', () => {
    const misconduct = [
      { id: 'irr-1', kind: 'bribe', targetId: 'lucia', minute: 30, seenBy: ['tomas'] },
      { id: 'irr-2', kind: 'force_entry', targetId: 'LIS-ALM', minute: 150, seenBy: [] },
    ];
    const view = playerViewDto(astrolabioDefinition, fullRun({ misconduct }), 0);
    expect(view.misconduct).toEqual(misconduct);
    expect(isPlayerViewDto(view)).toBe(true);
    // Sin actos, el campo va vacío (las partidas anteriores no lo traen).
    expect(playerViewDto(astrolabioDefinition, fullRun(), 0).misconduct).toEqual([]);
  });

  it('un consejo de Elena (servicio advice) viaja en la vista y valida el contrato', () => {
    // Regresión 2026-11-12: publicTeamRecord tenía la lista de servicios
    // a mano sin 'advice' y el cliente rechazaba la respuesta del commit
    // («La respuesta del servidor no es válida»), así que el historial
    // del equipo nunca se actualizaba.
    const teamRequests = [{ id: 'tr-1', memberId: 'elena', minute: 0, serviceId: 'advice' }];
    const view = playerViewDto(astrolabioDefinition, fullRun({ teamRequests }), 0);
    expect(view.team).toEqual(teamRequests);
    expect(isPlayerViewDto(view)).toBe(true);
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
        channels: ['call', 'email'],
      },
    ]);
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('la vista lleva el historial de la central y el envío queda en la consola', () => {
    const record = { id: 'comm-1', channel: 'email', recipientId: 'lucia', requestText: 'Te envío la cerradura.',
      documentId: 'EV-02', sentMinute: 60, dueMinute: 90, receivedMinute: 90 };
    const view = playerViewDto(astrolabioDefinition, fullRun({ communications: [record] }), 0);
    expect(view.communications).toEqual([record]);
    expect(isPlayerViewDto(view)).toBe(true);
    // Sin historial (partidas anteriores a la central): vacío, no ausente.
    expect(playerViewDto(astrolabioDefinition, fullRun(), 0).communications).toEqual([]);
    expect(summaries([
      { type: 'communicate', payload: { recipientId: 'lucia', channel: 'email', documentId: 'EV-02' } },
      { type: 'communicate', payload: { recipientId: 'tomas', channel: 'call' } },
    ])).toEqual([
      'Documento enviado a Lucía por correo.',
      'Mensaje enviado a Tomás Ríos por llamada.',
    ]);
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
