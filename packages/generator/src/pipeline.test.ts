import { describe, it, expect } from 'vitest';
import { validateCaseDefinition } from '@meridiano/case-schema';
import { createInMemoryCheckpointStore } from './checkpoint.js';
import { createGeneratorService, runPipeline, type GenerationParams, type PipelineConfig, type StageLlm } from './pipeline.js';
import { selectGeography, stageOutputSchema, validateStageOutput, type SelectedGeography } from './stages.js';

// Doble del modelo: construye las salidas de etapa a partir del contexto que
// recibe (las ciudades elegidas), con el mismo esqueleto que el fixture del
// fraude. No es un mock que devuelva «todo bien»: las salidas pasan por los
// mismos validadores de forma, el validador v1.5 y el simulador que las
// salidas reales.
function fakeOutputs(geography: SelectedGeography) {
  const [start, second, third] = geography.cities;
  if (!start || !second || !third) throw new Error('Geografía incompleta.');
  const locStart = `${start.id.slice(0, 3).toUpperCase()}-OFIC`;
  const locSecond = `${second.id.slice(0, 3).toUpperCase()}-GALERIA`;
  const locThird = `${third.id.slice(0, 3).toUpperCase()}-ALM`;
  const premise = {
    title: 'El contrato de las facturas falsas',
    crimeLabel: 'Fraude',
    truth: 'Carmen falsificó las facturas y trasladó el contrato original.',
    solution: { id: 'carmen', name: 'Carmen', role: 'Directora financiera', cityId: third.id },
    decoy: { id: 'jorge', name: 'Jorge', role: 'Administrativo', cityId: start.id },
    witnesses: [{ id: 'pablo', name: 'Pablo', role: 'Archivero', cityId: second.id }],
    motive: 'Carmen necesitaba cubrir un desfalco con facturas falsas.',
    objectives: { detain: 'Detener a Carmen con orden válida', recover: 'Recuperar el contrato original' },
    objectLabel: 'contrato original',
    briefing: {
      speaker: 'Margaret Sullivan',
      title: 'El contrato de las facturas falsas',
      paragraphs: [
        'Las facturas no cuadran y el contrato original ha desaparecido.',
        'Tres ciudades, tres registros y una firma que no coincide.',
        'Encuentra el contrato antes de que venza el plazo.',
      ],
    },
  };
  const npcs = {
    npcs: [
      { id: 'carmen', persona: 'Eres Carmen, directora financiera. Puedes confirmar tu identidad, pero no vas a declarar sobre el fraude.', knowledge: ['truth'], cooperation: 3 },
      { id: 'jorge', persona: 'Eres Jorge, administrativo de la oficina. Responde solo con lo que sabes por tu trabajo.', knowledge: ['jorge-vio-facturas'], cooperation: 7 },
      { id: 'pablo', persona: 'Eres Pablo, archivero de facturación. Responde solo con lo que sabes por tu trabajo.', knowledge: ['registro-facturas'], cooperation: 5 },
    ],
    timeline: ['Carmen revisa las facturas por la mañana.', 'El contrato sale hacia el almacén por la tarde.'],
  };
  const cluesWorld = {
    locations: [
      { id: locStart, cityId: start.id, name: 'Oficina de contratación', description: 'Oficina de contratación de la empresa' },
      { id: locSecond, cityId: second.id, name: 'Archivo de facturación', description: 'Archivo de facturación de la empresa' },
      { id: locThird, cityId: third.id, name: 'Almacén de custodia', description: 'Almacén de custodia de contratos' },
    ],
    evidence: [
      { id: 'EV-01', type: 'observation', origin: locStart, relations: [] },
      { id: 'EV-02', type: 'object', origin: locStart, relations: [] },
      { id: 'EV-03', type: 'analysis', origin: locStart, relations: ['EV-02'] },
      { id: 'EV-04', type: 'record', origin: locSecond, relations: ['EV-03'] },
      { id: 'EV-05', type: 'record', origin: locSecond, relations: [] },
      { id: 'EV-06', type: 'object', origin: locStart, relations: [] },
      { id: 'EV-07', type: 'record', origin: locSecond, relations: ['EV-06'] },
      { id: 'EV-08', type: 'record', origin: locThird, relations: ['EV-05', 'EV-07'] },
      { id: 'EV-09', type: 'testimony', origin: locStart, relations: [] },
      { id: 'EV-10', type: 'record', origin: start.id, relations: [] },
      { id: 'EV-11', type: 'object', origin: locThird, relations: [] },
    ],
    texts: {
      evidence: {
        'EV-01': 'La oficina muestra señales de una revisión apresurada de facturas.',
        'EV-02': 'En el cajón hay una factura rota, marcada con el código F-17.',
        'EV-03': 'El análisis confirma que la factura rota pertenece a la serie F-17.',
        'EV-04': 'El registro firmado asigna la serie F-17 a Carmen.',
        'EV-05': 'El registro de envíos muestra a Carmen firmando el traslado del contrato.',
        'EV-06': 'El archivador guarda una copia del contrato, con sello y firma verificables.',
        'EV-07': 'La firma del contrato coincide con la del registro de envíos.',
        'EV-08': 'Hay un asiento independiente de recepción del contrato por Carmen, en el almacén.',
        'EV-09': 'Jorge declara que Carmen revisó las facturas; no vio qué había dentro del sobre.',
        'EV-10': 'El registro muestra el acceso real de Jorge durante la preparación del envío.',
        'EV-11': 'El contrato original está recuperado.',
      },
      knowledge: {
        // Textos con contenido real (tercera vuelta, 2026-11-07): cada uno
        // nombra elementos concretos del mundo (serie F-17, traslado del
        // contrato, sobre); la paráfrasis del tema sin ancla al mundo la
        // rechaza la puerta de la etapa 4a y el validador v1.5.
        'jorge-vio-facturas': 'Vi a Carmen revisar las facturas y firmar el traslado del contrato, pero no vi qué había dentro del sobre.',
        'registro-facturas': 'Llevo el registro de facturas del archivo: la serie F-17 está asignada a Carmen.',
        truth: 'Soy Carmen, directora financiera de la empresa.',
      },
      greetings: {
        jorge: 'Soy Jorge, administrativo de la oficina. ¿En qué puedo ayudarte?',
        pablo: 'Soy Pablo, archivero de facturación. ¿Qué registro buscas?',
        carmen: 'Soy Carmen, directora financiera. Puedo confirmar mi identidad, pero no voy a declarar sobre el fraude.',
      },
      refusals: { carmen: 'No voy a declarar sobre el fraude.' },
    },
  };
  const cluesRules = {
    mechanics: {
      inspectables: [
        { locationId: locStart, elementId: '', label: 'Inspeccionar la oficina', evidenceId: 'EV-01', reveals: [second.id] },
        { locationId: locStart, elementId: 'cajon', label: 'el cajón del escritorio', evidenceId: 'EV-02' },
        { locationId: locStart, elementId: 'archivador', label: 'el archivador', evidenceId: 'EV-06' },
      ],
      queries: [
        { id: 'accesos-jorge', label: 'Consultar los accesos de Jorge', cityId: start.id, locationId: locStart, evidenceId: 'EV-10', requires: [], delayMinutes: 30 },
        { id: 'registro-facturas', label: 'Consultar el registro de facturas', cityId: second.id, locationId: locSecond, evidenceId: 'EV-04', requires: ['EV-03'], delayMinutes: 30 },
        { id: 'registro-envios', label: 'Consultar el registro de envíos', cityId: second.id, locationId: locSecond, evidenceId: 'EV-05', requires: [], delayMinutes: 30, reveals: ['location:carmen'] },
        { id: 'firma-contrato', label: 'Consultar la firma del contrato', cityId: second.id, locationId: locSecond, evidenceId: 'EV-07', requires: ['EV-06'], delayMinutes: 30 },
        { id: 'custodia-contrato', label: 'Consultar la custodia del contrato', cityId: third.id, locationId: locThird, evidenceId: 'EV-08', requires: ['EV-05', 'EV-07'], delayMinutes: 30 },
      ],
      analyses: [{ inputEvidenceId: 'EV-02', resultEvidenceId: 'EV-03', delayMinutes: 90 }],
      talkEvidence: [{ npcId: 'jorge', topicId: 'facturas', label: 'Preguntar a Jorge por las facturas', evidenceId: 'EV-09', requiresRelation: true }],
      suspects: [
        { id: 'carmen', cityId: third.id, locationId: locThird, knownFromEvidence: ['EV-04', 'EV-05', 'EV-07', 'EV-08'],
          warrantCombinations: [['EV-03', 'EV-04'], ['EV-06', 'EV-07', 'EV-08']], accessEvidenceIds: ['EV-05', 'EV-08'] },
      ],
      recovery: { objectId: 'contrato-original', label: 'Recuperar el contrato original', cityId: third.id, locationId: locThird, evidenceId: 'EV-11', requiresAccessWarrant: true },
    },
    goldenPath: [
      { type: 'inspect', params: { targetId: locStart } },
      { type: 'inspect', params: { targetId: locStart, elementId: 'cajon' } },
      { type: 'collect', params: { evidenceId: 'EV-02' } },
      { type: 'analyze', params: { evidenceId: 'EV-02' } },
      { type: 'inspect', params: { targetId: locStart, elementId: 'archivador' } },
      { type: 'collect', params: { evidenceId: 'EV-06' } },
      { type: 'talk', params: { npcId: 'jorge', topicId: 'identidad' } },
      { type: 'talk', params: { npcId: 'jorge', topicId: 'facturas' } },
      { type: 'query', params: { topicId: 'accesos-jorge' } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'travel', params: { toCityId: second.id } },
      { type: 'query', params: { topicId: 'registro-facturas' } },
      { type: 'query', params: { topicId: 'registro-envios' } },
      { type: 'query', params: { topicId: 'firma-contrato' } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'travel', params: { toCityId: third.id } },
      { type: 'query', params: { topicId: 'custodia-contrato' } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'request_warrant', params: { suspectId: 'carmen', evidenceIds: ['EV-06', 'EV-07', 'EV-08'] } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'talk', params: { npcId: 'carmen', topicId: 'identidad' } },
      { type: 'detain', params: { suspectId: 'carmen', warrantId: 'warrant:carmen', locationId: locThird, mode: 'interactive' } },
      { type: 'recover', params: { objectId: 'contrato-original' } },
      { type: 'finish', params: {} },
    ],
  };
  const clues = { ...cluesWorld, ...cluesRules };
  return { premise, npcs, clues, cluesWorld, cluesRules };
}

// La etapa 4 se genera en dos llamadas: 4a (mundo) y 4b (reglas).
function stage4Output(outputs: ReturnType<typeof fakeOutputs>, context: Record<string, unknown>): unknown {
  return context.part === 'b' ? outputs.cluesRules : outputs.cluesWorld;
}

// Premisa con los ids como los devolvió el modelo real en el smoke
// (suspect_01, suspect_02, witness_01: guion bajo en vez de guiones).
function brokenPremiseIds(outputs: ReturnType<typeof fakeOutputs>): unknown {
  const broken = structuredClone(outputs.premise);
  broken.solution = { ...broken.solution, id: 'suspect_01' };
  broken.decoy = { ...broken.decoy, id: 'suspect_02' };
  const witness = broken.witnesses[0];
  if (!witness) throw new Error('Sin testigos en la premisa simulada.');
  broken.witnesses = [{ ...witness, id: 'witness_01' }];
  return broken;
}

// Mecánica con los nombres de campo inventados del modelo real en el smoke
// (queryId en vez de id, suspectId en vez de id, grantsEvidenceId en vez de
// evidenceId, inspectables sin locationId).
function brokenMechanicFieldNames(outputs: ReturnType<typeof fakeOutputs>): unknown {
  const broken = structuredClone(outputs.cluesRules);
  const inspectables = broken.mechanics.inspectables as Array<Record<string, unknown>>;
  for (const entry of inspectables) {
    delete entry.locationId;
    entry.grantsEvidenceId = entry.evidenceId;
    delete entry.evidenceId;
  }
  const queries = broken.mechanics.queries as Array<Record<string, unknown>>;
  for (const entry of queries) {
    entry.queryId = entry.id;
    delete entry.id;
    entry.grantsEvidenceId = entry.evidenceId;
    delete entry.evidenceId;
  }
  const suspects = broken.mechanics.suspects as Array<Record<string, unknown>>;
  for (const entry of suspects) {
    entry.suspectId = entry.id;
    delete entry.id;
  }
  const talk = broken.mechanics.talkEvidence as Array<Record<string, unknown>>;
  const first = talk[0];
  if (first) {
    first.grantsEvidenceId = first.evidenceId;
    delete first.evidenceId;
  }
  return broken;
}

const PARAMS: GenerationParams = {
  crimeType: 'fraude',
  difficulty: 'normal',
  explorationMode: 'guided',
  duration: 'medium',
  region: 'europa',
  surpriseMode: 'familiar',
  seed: 7,
  catalogVersion: '1.0',
};

function configWith(llm: StageLlm): PipelineConfig {
  return {
    maxRetriesPerStage: 3,
    stageTimeoutMs: 5000,
    enableSemanticReview: true,
    enableSimulation: true,
    checkpointStore: createInMemoryCheckpointStore(),
    llm,
    caseId: 'generado-fraude-test',
  };
}

describe('pipeline con LLM simulado (T4-08)', () => {
  it('completa las 9 etapas y valida el expediente', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(result.draft.status).toBe('validated');
    expect(result.definition?.id).toBe('generado-fraude-test');
    expect(result.definition?.contentMode).toBe('generated');
    expect(result.definition?.mechanics).toBeDefined();
    expect(result.definition?.texts).toBeDefined();
    expect(result.draft.briefing?.paragraphs).toHaveLength(3);
    expect(result.draft.simulation?.playable).toBe(true);
    expect(result.draft.stages.every(stage => stage.status === 'completed')).toBe(true);
  });

  it('repara la etapa 4 cuando la revisión semántica falla y luego valida', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    let stage7Calls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          return outputs.cluesRules;
        }
        if (stage === 7) {
          stage7Calls++;
          // Primera revisión: la red de pistas no convence; el pipeline
          // repara la etapa 4 y la segunda revisión la acepta.
          if (stage7Calls === 1) return { coherent: false, issues: ['La motivación no se sigue de las evidencias.'] };
          return { coherent: true, issues: [] };
        }
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(result.draft.repairUsed).toBe(true);
    expect(result.draft.repairFeedback?.length).toBeGreaterThan(0);
    expect(stage4bCalls).toBe(2);
  });

  it('reintenta la etapa 4 cuando la ruta dorada no se puede jugar por el motor', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la orden se pide con
            // evidencias que no autorizan nada; el motor no puede aplicar
            // ese paso y la etapa 4 lo rechaza con el error del motor.
            const broken = structuredClone(outputs.cluesRules);
            const warrant = broken.goldenPath.find(action => action.type === 'request_warrant');
            if (warrant) warrant.params = { suspectId: 'carmen', evidenceIds: ['EV-01', 'EV-02'] };
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(result.draft.repairUsed).not.toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/no se puede jugar/);
  });

  it('reintenta la etapa 1 con el error como feedback cuando los ids vienen como suspect_01', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage1Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) {
          stage1Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage1Calls === 1) return brokenPremiseIds(outputs);
          return outputs.premise;
        }
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage1Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/id de NPC inválido: suspect_01/);
  });

  it('reintenta la etapa 1 con el error como feedback cuando un testigo no trae cityId', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage1Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) {
          stage1Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage1Calls === 1) {
            // Como el modelo real en el smoke: el testigo sin cityId.
            const broken = structuredClone(outputs.premise);
            const witness = broken.witnesses[0];
            if (!witness) throw new Error('Sin testigos en la premisa simulada.');
            delete (witness as Record<string, unknown>).cityId;
            return broken;
          }
          return outputs.premise;
        }
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage1Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/cada NPC.*necesita cityId/);
  });

  it('reintenta la etapa 4 con el error como feedback cuando la mecánica usa nombres de campo inventados', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) return brokenMechanicFieldNames(outputs);
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/mechanics\.queries\[0\] debe tener id/);
  });

  it('reintenta la etapa 4 con el error como feedback cuando los lugares vienen en minúsculas', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          if (stage4aCalls === 1) {
            // Como el modelo real en el smoke: ids de lugar en minúsculas.
            const broken = structuredClone(outputs.cluesWorld);
            for (const location of broken.locations) {
              location.id = location.id.toLowerCase();
            }
            return broken;
          }
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/id de lugar inválido/);
  });

  it('reintenta la etapa 4 con el error como feedback cuando las relaciones forman un ciclo', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          if (stage4aCalls === 1) {
            // Como el modelo real en el smoke: enlaces en ambos sentidos
            // (EV-01 depende de EV-02 y EV-02 de EV-01): el grafo no se
            // puede resolver.
            const broken = structuredClone(outputs.cluesWorld);
            const first = broken.evidence[0];
            const second = broken.evidence[1];
            if (first && second) {
              first.relations = ['EV-02'];
              second.relations = ['EV-01'];
            }
            return broken;
          }
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/solo puede depender de evidencias anteriores/);
  });

  it('reintenta la etapa 4 cuando la ruta dorada usa cityId/queryId y los ids llevan acentos', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: ids con acentos, viajes con
            // cityId en vez de toCityId y consultas con queryId.
            const broken = structuredClone(outputs.cluesRules);
            const inspectables = broken.mechanics.inspectables as Array<Record<string, unknown>>;
            const second = inspectables[1];
            if (second) second.elementId = 'cajón';
            broken.mechanics.recovery.objectId = 'maletín';
            const travel = broken.goldenPath.find(action => action.type === 'travel');
            if (travel) (travel as { params: Record<string, unknown> }).params = { cityId: 'barcelona', locationId: 'BAR-ARCH' };
            const query = broken.goldenPath.find(action => action.type === 'query');
            if (query) (query as { params: Record<string, unknown> }).params = { queryId: 'registro-facturas' };
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/toCityId|sin acentos/);
  });

  it('reintenta la etapa 4 cuando un testimonio usa el personaje como origen', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          if (stage4aCalls === 1) {
            // Como el modelo real en el smoke: el testimonio EV-09 con el
            // id del testigo como origen en vez de un lugar o ciudad.
            const broken = structuredClone(outputs.cluesWorld);
            const testimony = broken.evidence.find(item => item.id === 'EV-09');
            if (testimony) testimony.origin = 'pablo';
            return broken;
          }
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/origen desconocido: pablo/);
  });

  it('reintenta la etapa 4 cuando falta un texto de conocimiento de la etapa 3', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          if (stage4aCalls === 1) {
            // Como el modelo real en el smoke: texts.knowledge sin el texto
            // de uno de los ids declarados en la etapa 3.
            const broken = structuredClone(outputs.cluesWorld);
            const knowledge = broken.texts.knowledge as Record<string, string>;
            delete knowledge['jorge-vio-facturas'];
            return broken;
          }
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/Falta el texto de conocimiento de jorge-vio-facturas/);
  });

  it('reintenta la etapa 3 cuando los hitos vienen como objetos en vez de frases', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage3Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) {
          stage3Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage3Calls === 1) {
            // Como el modelo real en el smoke: hitos como objetos
            // { milestone: '...' } en vez de frases.
            const broken = structuredClone(outputs.npcs);
            broken.timeline = broken.timeline.map(text => ({ milestone: text })) as unknown as string[];
            return broken;
          }
          return outputs.npcs;
        }
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage3Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/cada hito debe ser una frase/);
  });

  it('reintenta la etapa 4 cuando la ruta dorada recoge una observación', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: collect de EV-01, que es una
            // observación y no se puede recoger.
            const broken = structuredClone(outputs.cluesRules);
            const collect = broken.goldenPath.find(action => action.type === 'collect');
            if (collect) collect.params = { evidenceId: 'EV-01' };
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/solo se recogen evidencias de tipo object/);
  });

  it('reintenta la etapa 4 cuando una evidencia no tiene vía para obtenerse', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: EV-02 es un objeto sin
            // inspeccionable que lo conceda; la ruta lo recoge y el motor
            // responde «Evidencia no disponible».
            const broken = structuredClone(outputs.cluesRules);
            const inspectables = broken.mechanics.inspectables as Array<Record<string, unknown>>;
            const drawer = inspectables.find(entry => entry.evidenceId === 'EV-02');
            if (drawer) drawer.evidenceId = 'EV-01';
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/EV-02.*no se puede obtener/);
  });

  it('reintenta la etapa 4 cuando el modelo devuelve el esquema en vez de los datos', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          // Como el modelo real en el smoke: devuelve el esquema JSON
          // (type/properties) en vez de los lugares y las evidencias.
          if (stage4aCalls === 1) return stageOutputSchema(4);
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/es el esquema JSON, no los datos/);
  });

  it('reintenta la etapa 4 cuando la orden no incluye evidencia de acceso para la recuperación', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la orden usa la
            // combinación ['EV-03', 'EV-04'] (válida para detener) pero
            // ninguna de sus accessEvidenceIds (EV-05, EV-08), así que la
            // recuperación se rechaza por falta de warrant:access.
            const broken = structuredClone(outputs.cluesRules);
            const warrant = broken.goldenPath.find(action => action.type === 'request_warrant');
            if (!warrant) throw new Error('Sin request_warrant en la salida simulada.');
            (warrant.params as Record<string, unknown>).evidenceIds = ['EV-03', 'EV-04'];
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
  });

  it('reintenta la etapa 4 cuando la ruta dorada consulta antes de su requisito', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la ruta pide la consulta
            // registro-facturas (requiere EV-03, en la segunda ciudad) al
            // principio, sin haber analizado EV-02 ni viajado.
            const broken = structuredClone(outputs.cluesRules);
            const queryIndex = broken.goldenPath.findIndex(
              action => action.type === 'query' && (action.params as Record<string, unknown>).topicId === 'registro-facturas',
            );
            if (queryIndex < 0) throw new Error('Sin consulta registro-facturas en la salida simulada.');
            const [query] = broken.goldenPath.splice(queryIndex, 1);
            if (!query) throw new Error('Sin consulta registro-facturas en la salida simulada.');
            broken.goldenPath.splice(1, 0, query);
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
  });

  it('reintenta la etapa 4 cuando el inspeccionable de la sala omite elementId', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la sala (EV-01) sin la
            // clave elementId, en vez de elementId '' (cadena vacía).
            const broken = structuredClone(outputs.cluesRules);
            const room = broken.mechanics.inspectables[0];
            if (room) delete (room as Record<string, unknown>).elementId;
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
  });

  it('reintenta la etapa 4 cuando la ruta dorada detiene sin identificar antes al sospechoso', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la ruta detiene a Carmen sin
            // haber hablado con ella de 'identidad', así que el motor
            // rechaza la detención con 'Intervención no disponible'.
            const broken = structuredClone(outputs.cluesRules);
            broken.goldenPath = broken.goldenPath.filter(
              action => !(action.type === 'talk' && (action.params as Record<string, unknown>).npcId === 'carmen' && (action.params as Record<string, unknown>).topicId === 'identidad'),
            );
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
  });

  it('acepta ids de lugar largos y naturales como MAL-BIBLIOTECA', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    // Como el modelo real en el smoke: BIBLIOTECA tiene 10 letras, fuera
    // del límite antiguo de 3-8; el motor no exige ids cortos. El id
    // cambia en TODAS las referencias (lugares, orígenes de evidencias,
    // ruta dorada) para que la salida siga siendo coherente.
    const first = outputs.cluesWorld.locations[0];
    if (!first) throw new Error('Sin lugares en la salida simulada.');
    const renamed = JSON.parse(JSON.stringify(outputs).replaceAll(first.id, 'MAL-BIBLIOTECA')) as typeof outputs;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return renamed.premise;
        if (stage === 3) return renamed.npcs;
        if (stage === 4) return stage4Output(renamed, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
  });

  it('reintenta la etapa 4 cuando el análisis EV-03 usa EV-02 como origen', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'b') return outputs.cluesRules;
          stage4aCalls++;
          if (stage4aCalls === 1) {
            // Como el modelo real en el smoke: EV-03 (análisis) con origen
            // EV-02 (su entrada) en vez del lugar donde se analiza.
            const broken = structuredClone(outputs.cluesWorld);
            const analysis = broken.evidence.find(item => item.id === 'EV-03');
            if (analysis) analysis.origin = 'EV-02';
            return broken;
          }
          return outputs.cluesWorld;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/origen desconocido: EV-02/);
  });

  it('reintenta la etapa 4 cuando la ruta dorada empieza viajando a la ciudad de inicio', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const startCity = geography.cities[0];
    if (!startCity) throw new Error('Sin ciudad de inicio.');
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la ruta empieza con un viaje
            // a la ciudad donde ya se está (no hay ruta a sí misma).
            const broken = structuredClone(outputs.cluesRules);
            broken.goldenPath.unshift({ type: 'travel', params: { toCityId: startCity.id } });
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/viaja a .* la ciudad actual/);
  });

  it('reintenta la etapa 4 cuando la ruta dorada empieza inspeccionando en otra ciudad', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const secondCity = geography.cities[1];
    if (!secondCity) throw new Error('Sin segunda ciudad.');
    const secondLocation = outputs.cluesWorld.locations.find(location => location.cityId === secondCity.id);
    if (!secondLocation) throw new Error('Sin lugar en la segunda ciudad.');
    let stage4bCalls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          contexts.push(context as Record<string, unknown>);
          if ((context as Record<string, unknown>).part === 'a') return outputs.cluesWorld;
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Como el modelo real en el smoke: la ruta empieza inspeccionando
            // un lugar de otra ciudad (el modelo creía empezar allí) y luego
            // viaja a la ciudad de inicio, que ya es la actual.
            const broken = structuredClone(outputs.cluesRules);
            const first = broken.goldenPath[0];
            if (first) first.params = { targetId: secondLocation.id };
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4bCalls).toBe(2);
    const secondFeedback = contexts[2]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/cada acción ocurre en la ciudad donde estás/);
  });

  it('reintenta la etapa 3 con el error como feedback cuando el conocimiento viene en frase', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage3Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) {
          stage3Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage3Calls === 1) {
            // Como el modelo real en el smoke: conocimiento en frase con
            // espacios (no un id) y cronología de un solo hito.
            const broken = structuredClone(outputs.npcs);
            const jorge = broken.npcs.find(npc => npc.id === 'jorge');
            if (jorge) jorge.knowledge = ['Vio a Carmen revisar las facturas'];
            broken.timeline = ['Carmen revisa las facturas por la mañana.'];
            return broken;
          }
          return outputs.npcs;
        }
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage3Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/conocimiento inválido/);
    expect(secondFeedback?.join(' ')).toMatch(/timeline/);
  });

  it('conserva la causa del proveedor cuando la etapa falla por el modelo', async () => {
    const llm: StageLlm = {
      async generate({ stage }) {
        if (stage === 1) {
          // Como el adaptador de IA real: el error llega como 'unavailable'
          // con la causa original (timeout, 500, corte) adjunta.
          throw new Error('unavailable', { cause: new Error('fetch failed') });
        }
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unavailable \(fetch failed\)/);
  });

  it('rechaza el borrador cuando la etapa 4 nunca es válida', async () => {
    const llm: StageLlm = {
      async generate({ stage }) {
        if (stage === 1) return { title: 'x' };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(false);
    expect(result.draft.status).toBe('rejected');
    expect(result.error).toMatch(/Etapa 1/);
    // La última tentativa inválida queda en el checkpoint para diagnosticar.
    expect(result.draft.stages[0]?.output).toEqual({ title: 'x' });
  });

  it('falla con un error claro sin proveedor de generación', async () => {
    const config: PipelineConfig = {
      maxRetriesPerStage: 1,
      stageTimeoutMs: 1000,
      enableSemanticReview: true,
      enableSimulation: true,
      checkpointStore: createInMemoryCheckpointStore(),
      caseId: 'generado-fraude-test',
    };
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Sin proveedor de generación/);
  });
});

describe('validación de la etapa 1 (título del expediente)', () => {
  it('rechaza un título que empieza por «Expediente:» (la interfaz lo duplicaría)', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const bad = { ...outputs.premise, title: 'Expediente: cuaderno desaparecido' };
    const result = validateStageOutput(1, bad, { geography, castIds: ['carmen', 'jorge', 'pablo'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('Expediente'))).toBe(true);
  });

  it('acepta un título con el formato «Caso: …»', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const result = validateStageOutput(1, outputs.premise, { geography, castIds: ['carmen', 'jorge', 'pablo'] });
    expect(result.valid).toBe(true);
  });
});

describe('diagnóstico de la etapa 4 en el pipeline', () => {
  it('el error de la etapa 4 incluye el diagnóstico de la ruta dorada', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    // La ruta nunca se repara: sin el análisis no hay EV-03 y la consulta
    // registro-facturas se rechaza siempre en la segunda ciudad.
    const broken = structuredClone(outputs.cluesRules);
    broken.goldenPath = broken.goldenPath.filter(action => action.type !== 'analyze');
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return (context as Record<string, unknown>).part === 'a' ? outputs.cluesWorld : broken;
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Diagnóstico/);
    expect(result.error).toMatch(/EV-03/);
  });
});

describe('validación de la etapa 4 (delayMinutes)', () => {
  it('rechaza una consulta con delayMinutes 0 (el resultado quedaría en curso)', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = { ...outputs.cluesWorld, ...structuredClone(outputs.cluesRules) };
    const mechanics = clues.mechanics as { queries: Array<{ delayMinutes: number }> };
    mechanics.queries[0]!.delayMinutes = 0;
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('delayMinutes'))).toBe(true);
  });

  it('acepta delayMinutes 30 en las consultas del doble', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = { ...outputs.cluesWorld, ...outputs.cluesRules };
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'] });
    expect(result.valid).toBe(true);
  });
});

describe('reparación de la etapa 4 por mitades', () => {
  it('reutiliza el mundo 4a cuando solo fallan las reglas 4b', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') {
            stage4aCalls++;
            return outputs.cluesWorld;
          }
          stage4bCalls++;
          if (stage4bCalls === 1) {
            // Ruta con la consulta de la segunda ciudad al principio, sin
            // haber viajado: falla la validación de la ruta, no el mundo.
            const broken = structuredClone(outputs.cluesRules);
            const queryIndex = broken.goldenPath.findIndex(
              action => action.type === 'query' && (action.params as Record<string, unknown>).topicId === 'registro-facturas',
            );
            if (queryIndex < 0) throw new Error('Sin consulta registro-facturas en la salida simulada.');
            const [query] = broken.goldenPath.splice(queryIndex, 1);
            if (!query) throw new Error('Sin consulta registro-facturas en la salida simulada.');
            broken.goldenPath.splice(1, 0, query);
            return broken;
          }
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(1);
    expect(stage4bCalls).toBe(2);
  });

  it('regenera el mundo cuando falla la mitad 4a', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4aCalls = 0;
    let stage4bCalls = 0;
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          if ((context as Record<string, unknown>).part === 'a') {
            stage4aCalls++;
            if (stage4aCalls === 1) {
              // Mundo con un texto de evidencia de menos: falla 4a y no se
              // llega a llamar a 4b en ese intento.
              const broken = structuredClone(outputs.cluesWorld);
              const texts = broken.texts as { evidence: Record<string, string> };
              delete texts.evidence['EV-11'];
              return broken;
            }
            return outputs.cluesWorld;
          }
          stage4bCalls++;
          return outputs.cluesRules;
        }
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    expect(stage4aCalls).toBe(2);
    expect(stage4bCalls).toBe(1);
  });
});

describe('validación de la etapa 4 (accessEvidenceIds)', () => {
  it('rechaza un sospechoso sin accessEvidenceIds cuando la recuperación exige acceso', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = { ...outputs.cluesWorld, ...structuredClone(outputs.cluesRules) };
    const mechanics = clues.mechanics as { suspects: Array<Record<string, unknown>> };
    delete mechanics.suspects[0]!.accessEvidenceIds;
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('accessEvidenceIds'))).toBe(true);
  });
});

describe('validación de la etapa 4 (textos de conocimiento decibles)', () => {
  it('rechaza una salida 4a con un texto-etiqueta («Información sobre…»)', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = structuredClone({ ...outputs.cluesWorld, ...outputs.cluesRules });
    const knowledge = (clues as { texts: { knowledge: Record<string, string> } }).texts.knowledge;
    knowledge['jorge-vio-facturas'] = 'Información sobre la revisión de facturas.';
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'], knowledgeIds: ['jorge-vio-facturas', 'registro-facturas', 'truth'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('etiqueta'))).toBe(true);
  });
  it('acepta la salida 4a con frases en primera persona', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = { ...outputs.cluesWorld, ...outputs.cluesRules };
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'], knowledgeIds: ['jorge-vio-facturas', 'registro-facturas', 'truth'] });
    expect(result.valid).toBe(true);
  });
  it('rechaza una salida 4a con una frase en primera persona sin contenido real', () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const clues = structuredClone({ ...outputs.cluesWorld, ...outputs.cluesRules });
    const knowledge = (clues as { texts: { knowledge: Record<string, string> } }).texts.knowledge;
    knowledge['registro-facturas'] = 'Conozco bien el mercado de facturas y los canales de venta de la zona.';
    const result = validateStageOutput(4, clues, { geography, castIds: ['carmen', 'jorge', 'pablo'], knowledgeIds: ['jorge-vio-facturas', 'registro-facturas', 'truth'] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('elemento concreto'))).toBe(true);
  });
});

describe('validación del expediente completo (textos de conocimiento decibles)', () => {
  it('el validador v1.5 rechaza el expediente si un texto de conocimiento es etiqueta', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    const definition = result.definition!;
    expect(validateCaseDefinition(definition).valid).toBe(true);
    const labelled = structuredClone(definition) as unknown as Record<string, unknown>;
    const texts = labelled.texts as { knowledge: Record<string, string> };
    texts.knowledge['jorge-vio-facturas'] = 'Conocimiento del mercado de facturas.';
    const check = validateCaseDefinition(labelled);
    expect(check.valid).toBe(false);
    expect(check.errors.some(error => error.includes('etiqueta'))).toBe(true);
  });
  it('el validador v1.5 rechaza el expediente si un texto de conocimiento es una paráfrasis del tema sin contenido real', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return stage4Output(outputs, context as Record<string, unknown>);
        if (stage === 7) return { coherent: true, issues: [] };
        throw new Error(`Etapa inesperada: ${stage}`);
      },
    };
    const config = configWith(llm);
    const service = createGeneratorService(config);
    const draft = await service.createDraft(PARAMS);
    const result = await runPipeline(draft, config);
    expect(result.success).toBe(true);
    const definition = result.definition!;
    expect(validateCaseDefinition(definition).valid).toBe(true);
    const paraphrase = structuredClone(definition) as unknown as Record<string, unknown>;
    const texts = paraphrase.texts as { knowledge: Record<string, string> };
    texts.knowledge['registro-facturas'] = 'Conozco bien el mercado de facturas y los canales de venta de la zona.';
    const check = validateCaseDefinition(paraphrase);
    expect(check.valid).toBe(false);
    expect(check.errors.some(error => error.includes('elemento concreto'))).toBe(true);
  });
});
