import { describe, it, expect } from 'vitest';
import { generadoFraudeDefinition } from '@meridiano/engine';
import { diagnoseGoldenPathFailure, simulateCase, type GoldenPathAction } from './simulator.js';

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
    expect(result.diagnosis).toBeNull();
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

describe('diagnoseGoldenPathFailure', () => {
  it('explica una consulta antes de su requisito (EV-03)', () => {
    // Sin el análisis de EV-02 no hay EV-03, así que registro-facturas
    // (segunda ciudad) se rechaza aunque se pida en el lugar correcto.
    const path = GOLDEN_PATH.filter(action => action.type !== 'analyze');
    const diagnosis = diagnoseGoldenPathFailure(generadoFraudeDefinition, path, 1440);
    expect(diagnosis).toContain('registro-facturas');
    expect(diagnosis).toContain('EV-03');
    expect(diagnosis).toContain('DESPUÉS');
  });

  it('explica una recuperación sin evidencia de acceso en la orden', () => {
    // Como el modelo real en el smoke: la orden usa ['EV-03', 'EV-04']
    // (válida para detener) pero ninguna es de acceso (EV-05, EV-08).
    const path = GOLDEN_PATH.map(action =>
      action.type === 'request_warrant'
        ? { ...action, params: { ...action.params, evidenceIds: ['EV-03', 'EV-04'] } }
        : action,
    );
    const diagnosis = diagnoseGoldenPathFailure(generadoFraudeDefinition, path, 1440);
    expect(diagnosis).toContain('ninguna es una evidencia de acceso');
    expect(diagnosis).toContain('EV-05');
  });

  it('explica una detención antes de que madure la orden', () => {
    // Sin el wait de 30 min entre la orden y la detención, la orden aún
    // no ha madurado cuando se intenta detener.
    const warrantIndex = GOLDEN_PATH.findIndex(action => action.type === 'request_warrant');
    const path = GOLDEN_PATH.filter((action, index) => !(index === warrantIndex + 1 && action.type === 'wait'));
    const diagnosis = diagnoseGoldenPathFailure(generadoFraudeDefinition, path, 1440);
    expect(diagnosis).toContain('aún no ha madurado');
    expect(diagnosis).toContain('30 min');
  });

  it('explica una consulta en la ciudad equivocada', () => {
    // registro-facturas es de Barcelona; pedirla en Madrid se rechaza
    // por la posición, antes que por sus requisitos.
    const queryIndex = GOLDEN_PATH.findIndex(action => action.type === 'query' && action.params.topicId === 'registro-facturas');
    const first = GOLDEN_PATH[0];
    const query = GOLDEN_PATH[queryIndex];
    if (!first || !query) throw new Error('Sin consulta registro-facturas en el fixture.');
    const path = [first, query, ...GOLDEN_PATH.slice(1, queryIndex), ...GOLDEN_PATH.slice(queryIndex + 1)];
    const diagnosis = diagnoseGoldenPathFailure(generadoFraudeDefinition, path, 1440);
    expect(diagnosis).toContain('Barcelona');
    expect(diagnosis).toContain('Madrid');
  });

  it('devuelve null cuando la ruta es jugable', () => {
    expect(diagnoseGoldenPathFailure(generadoFraudeDefinition, GOLDEN_PATH, 1440)).toBeNull();
  });
});
