// Resúmenes de eventos de la consola: cada acción confirmada deja una frase
// legible, nunca un ID crudo ni el genérico «La investigación avanza.» cuando
// se sabe qué pasó.
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition } from '@meridiano/engine';
import type { EngineEvent } from '@meridiano/engine';
import { projectEvents } from './player-view.ts';

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
