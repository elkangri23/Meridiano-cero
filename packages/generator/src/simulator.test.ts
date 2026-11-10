import { describe, it, expect } from 'vitest';
import { astrolabioDefinition, generadoFraudeDefinition } from '@meridiano/engine';
import { analyzeWarrantRoutes, diagnoseGoldenPathFailure, hasMultipleRoutes, obtainableWithout, simulateCase, warrantEvidenceOfPath, type GoldenPathAction } from './simulator.js';

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

describe('detenciones automáticas (GDD §12)', () => {
  it('la ruta dorada automática detiene desde otra ciudad, sin viajar a detener', () => {
    const definition = { ...generadoFraudeDefinition, arrestType: 'automatic' as const };
    // Hablar con Carmen en Valencia, viajar a Barcelona, coordinar la
    // detención desde allí y volver a Valencia a recuperar: en interactivo
    // el detain desde Barcelona sería imposible por falta de presencia.
    const path: GoldenPathAction[] = [];
    for (const action of GOLDEN_PATH) {
      if (action.type === 'talk' && action.params.npcId === 'carmen') {
        path.push(action, { type: 'travel', params: { toCityId: 'barcelona' } });
      } else if (action.type === 'detain') {
        path.push({ type: 'detain', params: { ...action.params, mode: 'automatic' } },
          { type: 'travel', params: { toCityId: 'valencia' } });
      } else path.push(action);
    }
    const result = simulateCase(definition, path, 1440);
    expect(result.playable).toBe(true);
    expect(result.result).toBe('complete');
    expect(result.objectivesAchieved).toEqual(['obj-detener', 'obj-recuperar']);
    expect(result.diagnosis).toBeNull();
  });

  it('el simulador diagnostica el modo de detención equivocado', () => {
    const definition = { ...generadoFraudeDefinition, arrestType: 'automatic' as const };
    const result = simulateCase(definition, GOLDEN_PATH, 1440);
    expect(result.playable).toBe(false);
    expect(result.diagnosis).toContain('automatic');
    expect(result.diagnosis).toContain("mode: 'automatic'");
  });

  it('detener sin orden sigue siendo imposible en un caso automático', () => {
    const definition = { ...generadoFraudeDefinition, arrestType: 'automatic' as const };
    const result = simulateCase(definition, GOLDEN_PATH, 1440);
    expect(result.checks.find(check => check.name === 'detain-without-warrant')?.passed).toBe(true);
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

describe('diagnoseGoldenPathFailure (evidencia pendiente)', () => {
  it('explica una consulta cuyo requisito está pedido pero aún no ha madurado', () => {
    // En el fixture, accesos-jorge no exige nada; aquí exige EV-03, que el
    // análisis de EV-02 pide pero aún no entrega (delay 90, sin espera).
    const definition = structuredClone(generadoFraudeDefinition);
    const query = definition.mechanics?.queries.find(entry => entry.id === 'accesos-jorge');
    if (!query) throw new Error('Sin consulta accesos-jorge en el fixture.');
    query.requires = ['EV-03'];
    const path: GoldenPathAction[] = [
      { type: 'inspect', params: { targetId: 'MAD-OFIC' } },
      { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'cajon' } },
      { type: 'collect', params: { evidenceId: 'EV-02' } },
      { type: 'analyze', params: { evidenceId: 'EV-02' } },
      { type: 'query', params: { topicId: 'accesos-jorge' } },
    ];
    const diagnosis = diagnoseGoldenPathFailure(definition, path, 1440);
    expect(diagnosis).toContain('EV-03');
    expect(diagnosis).toContain('aún no ha llegado');
    expect(diagnosis).toContain('90 min');
  });

  it('explica un análisis repetido mientras su resultado está en curso', () => {
    const path: GoldenPathAction[] = [
      { type: 'inspect', params: { targetId: 'MAD-OFIC' } },
      { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'cajon' } },
      { type: 'collect', params: { evidenceId: 'EV-02' } },
      { type: 'analyze', params: { evidenceId: 'EV-02' } },
      { type: 'analyze', params: { evidenceId: 'EV-02' } },
    ];
    const diagnosis = diagnoseGoldenPathFailure(generadoFraudeDefinition, path, 1440);
    expect(diagnosis).toContain('ya está en curso');
    expect(diagnosis).toContain('90 min');
  });
});

describe('diagnoseGoldenPathFailure (recuperación sin acceso declarado)', () => {
  it('explica una recuperación cuando el sospechoso no declara evidencia de acceso', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.accessEvidenceIds = [];
    const path = GOLDEN_PATH.map(action =>
      action.type === 'request_warrant'
        ? { ...action, params: { ...action.params, evidenceIds: ['EV-06', 'EV-07', 'EV-08'] } }
        : action,
    );
    const diagnosis = diagnoseGoldenPathFailure(definition, path, 1440);
    expect(diagnosis).toContain('accessEvidenceIds vacío');
  });
});

// Ruta A técnica del fixture (la dorada del fixture es la B documental):
// EV-02 -> análisis EV-03 -> consultas EV-04/EV-05 -> orden con EV-05 de
// acceso -> detención en persona en Valencia -> recuperación.
const ALTERNATIVE_PATH: GoldenPathAction[] = [
  { type: 'inspect', params: { targetId: 'MAD-OFIC' } },
  { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'cajon' } },
  { type: 'collect', params: { evidenceId: 'EV-02' } },
  { type: 'analyze', params: { evidenceId: 'EV-02' } },
  { type: 'travel', params: { toCityId: 'barcelona' } },
  { type: 'query', params: { topicId: 'registro-facturas' } },
  { type: 'query', params: { topicId: 'registro-envios' } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'request_warrant', params: { suspectId: 'carmen', evidenceIds: ['EV-03', 'EV-04', 'EV-05'] } },
  { type: 'wait', params: { minutes: 30 } },
  { type: 'travel', params: { toCityId: 'valencia' } },
  { type: 'talk', params: { npcId: 'carmen', topicId: 'identidad' } },
  { type: 'detain', params: { suspectId: 'carmen', warrantId: 'warrant:carmen', locationId: 'VLC-ALM', mode: 'interactive' } },
  { type: 'recover', params: { objectId: 'contrato-original' } },
  { type: 'finish', params: {} },
];

describe('simulateCase con ruta alternativa (GDD §4/§18)', () => {
  it('las dos rutas completan el caso dentro del presupuesto y son independientes', () => {
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440, ALTERNATIVE_PATH);
    expect(result.playable).toBe(true);
    expect(result.result).toBe('complete');
    expect(result.minute).toBe(475);
    expect(result.alternative).toEqual({ minute: 335, result: 'complete', objectivesAchieved: ['obj-detener', 'obj-recuperar'] });
    expect(result.checks.map(check => check.name)).toEqual([
      'golden-path', 'early-finish', 'detain-without-warrant', 'recover-without-access',
      'alternative-path', 'alternative-independent', 'golden-independent',
    ]);
    expect(result.checks.every(check => check.passed)).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.diagnosis).toBeNull();
  });

  it('sin ruta alternativa solo se comprueba la dorada, como antes', () => {
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440);
    expect(result.playable).toBe(true);
    expect(result.alternative).toBeUndefined();
    expect(result.checks.map(check => check.name)).toEqual(['golden-path', 'early-finish', 'detain-without-warrant', 'recover-without-access']);
  });

  it('rechaza una alternativa que es la misma ruta con otros waits (variación cosmética)', () => {
    // Misma orden, mismos waits extra: se juega, pero no es una vía
    // distinta — su combinación es la de la dorada.
    const cosmetic = [
      ...GOLDEN_PATH.slice(0, 20),
      { type: 'wait', params: { minutes: 10 } },
      ...GOLDEN_PATH.slice(20),
    ];
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440, cosmetic);
    expect(result.playable).toBe(false);
    expect(result.checks.find(check => check.name === 'alternative-path')?.passed).toBe(true);
    expect(result.checks.find(check => check.name === 'alternative-independent')?.passed).toBe(false);
    expect(result.checks.find(check => check.name === 'golden-independent')?.passed).toBe(false);
    expect(result.diagnosis).toContain('no es independiente de la dorada');
    expect(result.diagnosis).toContain('EV-06');
  });

  it('el diagnóstico de una alternativa dependiente nombra las evidencias seguras', () => {
    const cosmetic = [
      ...GOLDEN_PATH.slice(0, 20),
      { type: 'wait', params: { minutes: 10 } },
      ...GOLDEN_PATH.slice(20),
    ];
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440, cosmetic);
    expect(result.diagnosis).toContain('candidatas para la combinación de la ruta alternativa');
    // La cadena documental (EV-06/07/08) se obtiene sin la técnica.
    expect(result.diagnosis).toContain('EV-06');
    expect(result.diagnosis).toContain('EV-07');
    expect(result.diagnosis).toContain('EV-08');
  });

  it('rechaza una alternativa por encima del presupuesto', () => {
    const slow = [
      ...ALTERNATIVE_PATH.slice(0, 7),
      { type: 'wait', params: { minutes: 2000 } },
      ...ALTERNATIVE_PATH.slice(7),
    ];
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440, slow);
    expect(result.playable).toBe(false);
    expect(result.errors.some(error => error.includes('alternativa') && error.includes('presupuesto'))).toBe(true);
    expect(result.diagnosis).toContain('alternativa');
    expect(result.diagnosis).toContain('presupuesto');
  });

  it('rechaza una alternativa que no cierra el caso', () => {
    const short = ALTERNATIVE_PATH.slice(0, 10);
    const result = simulateCase(generadoFraudeDefinition, GOLDEN_PATH, 1440, short);
    expect(result.playable).toBe(false);
    expect(result.diagnosis).toContain('alternativa');
    expect(result.diagnosis).toContain('no cierra el caso');
  });

  it('rechaza una alternativa cuya orden usa una evidencia de la otra ruta', () => {
    // La ruta B documental con EV-05 (cadena técnica) añadida a la orden:
    // se juega, pero su evidencia de acceso pertenece a la otra cadena.
    const shared = GOLDEN_PATH.map(action =>
      action.type === 'request_warrant'
        ? { ...action, params: { ...action.params, evidenceIds: ['EV-06', 'EV-07', 'EV-08', 'EV-05'] } }
        : action,
    );
    const result = simulateCase(generadoFraudeDefinition, ALTERNATIVE_PATH, 1440, shared);
    expect(result.playable).toBe(false);
    expect(result.checks.find(check => check.name === 'alternative-path')?.passed).toBe(true);
    expect(result.checks.find(check => check.name === 'alternative-independent')?.passed).toBe(false);
    expect(result.diagnosis).toContain('no es independiente de la dorada');
    expect(result.diagnosis).toContain('EV-05');
  });
});

describe('obtainableWithout', () => {
  it('una evidencia de análisis se obtiene sin la otra cadena', () => {
    expect(obtainableWithout(generadoFraudeDefinition, 'EV-03', new Set(['EV-06', 'EV-07', 'EV-08']))).toBe(true);
  });

  it('un registro con requires «cualquiera de» se obtiene por la vía libre', () => {
    // EV-08 exige EV-05 o EV-07: sin EV-05 se obtiene por EV-07.
    expect(obtainableWithout(generadoFraudeDefinition, 'EV-08', new Set(['EV-05']))).toBe(true);
    expect(obtainableWithout(generadoFraudeDefinition, 'EV-08', new Set(['EV-05', 'EV-07']))).toBe(false);
  });

  it('el objeto de la recuperación no se obtiene por ninguna vía', () => {
    expect(obtainableWithout(generadoFraudeDefinition, 'EV-11', new Set())).toBe(false);
  });

  it('un ciclo de requisitos no sirve como vía', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const facturas = definition.mechanics?.queries.find(entry => entry.id === 'registro-facturas');
    const envios = definition.mechanics?.queries.find(entry => entry.id === 'registro-envios');
    if (!facturas || !envios) throw new Error('Sin consultas del fixture.');
    facturas.requires = ['EV-05'];
    envios.requires = ['EV-04'];
    expect(obtainableWithout(definition, 'EV-04', new Set())).toBe(false);
    expect(obtainableWithout(definition, 'EV-05', new Set())).toBe(false);
  });
});

describe('analyzeWarrantRoutes', () => {
  it('el fixture tiene dos combinaciones disjuntas e independientes', () => {
    const analysis = analyzeWarrantRoutes(generadoFraudeDefinition);
    expect(analysis.solutionId).toBe('carmen');
    expect(analysis.combinations).toEqual([['EV-03', 'EV-04'], ['EV-06', 'EV-07', 'EV-08']]);
    expect(analysis.independentPairs).toEqual([{ first: 0, second: 1 }]);
    expect(analysis.reasons).toEqual([]);
  });

  it('una sola combinación no admite dos rutas', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.warrantCombinations = [['EV-03', 'EV-04']];
    const analysis = analyzeWarrantRoutes(definition);
    expect(analysis.independentPairs).toEqual([]);
    expect(analysis.reasons.join(' ')).toContain('una sola combinación');
  });

  it('dos combinaciones que comparten evidencia no son dos rutas', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.warrantCombinations = [['EV-03', 'EV-04'], ['EV-04', 'EV-05']];
    const analysis = analyzeWarrantRoutes(definition);
    expect(analysis.independentPairs).toEqual([]);
    expect(analysis.reasons.join(' ')).toContain('comparten EV-04');
  });

  it('una cadena que exige una evidencia de la otra no es independiente', () => {
    // Como el caso generado-4b7a3c11: la primera combinación es [EV-03,
    // EV-05] y la custodia (EV-08) exige solo EV-05.
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    const custody = definition.mechanics?.queries.find(entry => entry.id === 'custodia-contrato');
    if (!suspect || !custody) throw new Error('Sin sospechosa ni custodia en el fixture.');
    suspect.warrantCombinations = [['EV-03', 'EV-05'], ['EV-06', 'EV-07', 'EV-08']];
    custody.requires = ['EV-05'];
    const analysis = analyzeWarrantRoutes(definition);
    expect(analysis.independentPairs).toEqual([]);
    expect(analysis.reasons.join(' ')).toContain('EV-08');
  });

  it('warrantEvidenceOfPath recoge la orden de la ruta', () => {
    expect(warrantEvidenceOfPath(GOLDEN_PATH, 'carmen')).toEqual(['EV-06', 'EV-07', 'EV-08']);
    expect(warrantEvidenceOfPath(ALTERNATIVE_PATH, 'carmen')).toEqual(['EV-03', 'EV-04', 'EV-05']);
    expect(warrantEvidenceOfPath(ALTERNATIVE_PATH)).toEqual(['EV-03', 'EV-04', 'EV-05']);
  });
});

describe('hasMultipleRoutes', () => {
  it('el fixture tiene par independiente y acceso en los dos lados', () => {
    expect(hasMultipleRoutes(generadoFraudeDefinition)).toBe(true);
  });

  it('una sola combinación no admite dos rutas', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.warrantCombinations = [['EV-03', 'EV-04']];
    expect(hasMultipleRoutes(definition)).toBe(false);
  });

  it('par independiente sin acceso en un lado no es dos rutas (como generado-25b39aed y generado-8621c8a9)', () => {
    // La única evidencia de acceso (EV-08) exige EV-07, que exige EV-06:
    // pertenece a la segunda cadena y la primera ruta no puede recuperar.
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.accessEvidenceIds = ['EV-08'];
    expect(analyzeWarrantRoutes(definition).independentPairs).toEqual([{ first: 0, second: 1 }]);
    expect(hasMultipleRoutes(definition)).toBe(false);
  });

  it('sin evidencias de acceso la recuperación es imposible en ambas rutas', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === 'carmen');
    if (!suspect) throw new Error('Sin sospechosa en el fixture.');
    suspect.accessEvidenceIds = [];
    expect(hasMultipleRoutes(definition)).toBe(false);
  });

  it('sin orden de acceso el par independiente basta', () => {
    const definition = structuredClone(generadoFraudeDefinition);
    if (!definition.mechanics) throw new Error('Sin mecánica en el fixture.');
    definition.mechanics.recovery.requiresAccessWarrant = false;
    expect(hasMultipleRoutes(definition)).toBe(true);
  });

  it('el caso fijo no se puede analizar desde la mecánica: lo decide el catálogo', () => {
    expect(hasMultipleRoutes(astrolabioDefinition)).toBe(false);
  });
});
