import { describe, it, expect } from 'vitest';
import { generadoFraudeDefinition } from '@meridiano/engine';
import { simulateCase, type GoldenPathAction } from './simulator.js';

// La ruta dorada del fixture, como en el test del motor: inspeccionar,
// recoger, analizar, hablar, consultar, viajar, orden, detener, recuperar.
const GOLDEN_PATH: GoldenPathAction[] = [
  { type: 'inspect', params: { targetId: 'MAD-OFIC' } },
  { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'cajon' } },
  { type: 'collect', params: { evidenceId: 'EV-02' } },
  { type: 'analyze', params: { evidenceId: 'EV-02' } },
  { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'archivador' } },
  { type: 'collect', params: { evidenceId: 'EV-06' } },
  { type: 'talk', params: { npcId: 'jorge', topicId: 'identidad' } },
  { type: 'talk', params: { npcId: 'jorge', topicId: 'facturas' } },
  { type: 'query', params: { topicId: 'accesos-jorge' } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'travel', params: { toCityId: 'barcelona' } },
  { type: 'query', params: { topicId: 'registro-facturas' } },
  { type: 'query', params: { topicId: 'registro-envios' } },
  { type: 'query', params: { topicId: 'firma-contrato' } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'travel', params: { toCityId: 'valencia' } },
  { type: 'query', params: { topicId: 'custodia-contrato' } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'request_warrant', params: { suspectId: 'carmen', evidenceIds: ['EV-06', 'EV-07', 'EV-08'] } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'talk', params: { npcId: 'carmen', topicId: 'identidad' } },
  { type: 'detain', params: { suspectId: 'carmen', warrantId: 'warrant:carmen', locationId: 'VLC-ALM', mode: 'interactive' } },
  { type: 'recover', params: { objectId: 'contrato-original' } },
  { type: 'finish', params: {} },
];

describe('simulateCase (T4-08)', () => {
  it('la ruta dorada del fixture es jugable dentro del presupuesto', () => {
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440);
    expect(result.playable).toBe(true);
    expect(result.result).toBe('complete');
    expect(result.objectivesAchieved).toEqual(['obj-detener', 'obj-recuperar']);
    expect(result.minute).toBeGreaterThan(0);
    expect(result.minute).toBeLessThanOrEqual(1440);
    expect(result.checks.map(check => check.name)).toEqual(['golden-path', 'early-finish', 'detain-without-warrant', 'recover-without-access']);
    expect(result.errors).toEqual([]);
  });

  it('rechaza una ruta dorada que no cierra el caso', () => {
    const short = GOLDEN_PATH.slice(0, 5);
    const result = simulateCase(generadoFraudeDefinition, short, 1440);
    expect(result.playable).toBe(false);
    expect(result.errors.some(error => error.includes('no cierra el caso'))).toBe(true);
  });

  it('rechaza una ruta dorada por encima del presupuesto', () => {
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 60);
    expect(result.playable).toBe(false);
    expect(result.errors.some(error => error.includes('presupuesto'))).toBe(true);
  });

  it('rechaza un expediente cuya solución no es detenible sin orden', () => {
    // El fixture es correcto; aquí se comprueba la puerta (c) con un caso
    // roto: si la mecánica no declara al sospechoso solución, no es jugable.
    const broken = structuredClone(generadoFraudeDefinition);
    if (!broken.mechanics) throw new Error('El fixture debe traer mecánica.');
    broken.mechanics.suspects = [];
    const result = simulateCase(broken, GOLDEN_PATH, 1440);
    expect(result.playable).toBe(false);
  });
});
