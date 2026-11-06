import { describe, it, expect } from 'vitest';
import { createInMemoryCheckpointStore } from './checkpoint.js';
import { createGeneratorService, runPipeline, type GenerationParams, type PipelineConfig, type StageLlm } from './pipeline.js';
import { selectGeography, type SelectedGeography } from './stages.js';

// Doble del modelo: construye las salidas de etapa a partir del contexto que
// recibe (las ciudades elegidas), con el mismo esqueleto que el fixture del
// fraude. No es un mock que devuelva «todo bien»: las salidas pasan por los
// mismos validadores de forma, el validador v1.5 y el simulador que las
// salidas reales.
function fakeOutputs(geography: SelectedGeography) {
  const [start, second, third] = geography.cities;
  if (!start || !second || !third) throw new Error('Geografía incompleta.');
  const locStart = `${start.id.slice(0, 3).toUpperCase()}-OFIC`;
  const locSecond = `${second.id.slice(0, 3).toUpperCase()}-ARCH`;
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
  const clues = {
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
        'jorge-vio-facturas': 'Vi a Carmen revisar las facturas, pero no vi qué había dentro del sobre.',
        'registro-facturas': 'Llevo el registro de facturas del archivo y puedo comprobar a quién se asignó cada serie.',
        truth: 'Soy Carmen, directora financiera de la empresa.',
      },
      greetings: {
        jorge: 'Soy Jorge, administrativo de la oficina. ¿En qué puedo ayudarte?',
        pablo: 'Soy Pablo, archivero de facturación. ¿Qué registro buscas?',
        carmen: 'Soy Carmen, directora financiera. Puedo confirmar mi identidad, pero no voy a declarar sobre el fraude.',
      },
      refusals: { carmen: 'No voy a declarar sobre el fraude.' },
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
  return { premise, npcs, clues };
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
      async generate({ stage }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return outputs.clues;
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

  it('repara la etapa 4 cuando la simulación falla y luego valida', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4Calls = 0;
    const llm: StageLlm = {
      async generate({ stage }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          stage4Calls++;
          if (stage4Calls === 1) {
            // Primera red de pistas: la orden se pide con evidencias que no
            // autorizan nada; la simulación la rechaza y el pipeline repara.
            const broken = structuredClone(outputs.clues);
            const warrant = broken.goldenPath.find(action => action.type === 'request_warrant');
            if (warrant) warrant.params = { suspectId: 'carmen', evidenceIds: ['EV-01', 'EV-02'] };
            return broken;
          }
          return outputs.clues;
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
    expect(result.draft.repairUsed).toBe(true);
    expect(result.draft.repairFeedback?.length).toBeGreaterThan(0);
    expect(stage4Calls).toBe(2);
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
          if (stage1Calls === 1) {
            // Como el modelo real en el smoke: ids con guion bajo.
            const broken = structuredClone(outputs.premise);
            broken.solution = { ...broken.solution, id: 'suspect_01' };
            broken.decoy = { ...broken.decoy, id: 'suspect_02' };
            const witness = broken.witnesses[0];
            if (!witness) throw new Error('Sin testigos en la premisa simulada.');
            broken.witnesses = [{ ...witness, id: 'witness_01' }];
            return broken;
          }
          return outputs.premise;
        }
        if (stage === 3) return outputs.npcs;
        if (stage === 4) return outputs.clues;
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

  it('reintenta la etapa 4 con el error como feedback cuando la mecánica usa nombres de campo inventados', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          stage4Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage4Calls === 1) {
            // Como el modelo real en el smoke: queryId en vez de id,
            // suspectId en vez de id, grantsEvidenceId en vez de evidenceId
            // e inspectables sin locationId.
            const broken = structuredClone(outputs.clues);
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
          return outputs.clues;
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
    expect(stage4Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/mechanics\.queries\[0\] debe tener id/);
  });

  it('reintenta la etapa 4 con el error como feedback cuando los lugares vienen en minúsculas', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          stage4Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage4Calls === 1) {
            // Como el modelo real en el smoke: ids de lugar en minúsculas.
            const broken = structuredClone(outputs.clues);
            for (const location of broken.locations) {
              location.id = location.id.toLowerCase();
            }
            return broken;
          }
          return outputs.clues;
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
    expect(stage4Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/id de lugar inválido/);
  });

  it('reintenta la etapa 4 con el error como feedback cuando las relaciones forman un ciclo', async () => {
    const geography = selectGeography(PARAMS);
    const outputs = fakeOutputs(geography);
    let stage4Calls = 0;
    const contexts: Array<Record<string, unknown>> = [];
    const llm: StageLlm = {
      async generate({ stage, context }) {
        if (stage === 1) return outputs.premise;
        if (stage === 3) return outputs.npcs;
        if (stage === 4) {
          stage4Calls++;
          contexts.push(context as Record<string, unknown>);
          if (stage4Calls === 1) {
            // Como el modelo real en el smoke: enlaces en ambos sentidos
            // (EV-01 depende de EV-02 y EV-02 de EV-01): el grafo no se
            // puede resolver.
            const broken = structuredClone(outputs.clues);
            const first = broken.evidence[0];
            const second = broken.evidence[1];
            if (first && second) {
              first.relations = ['EV-02'];
              second.relations = ['EV-01'];
            }
            return broken;
          }
          return outputs.clues;
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
    expect(stage4Calls).toBe(2);
    const secondFeedback = contexts[1]?.repairFeedback as string[] | undefined;
    expect(secondFeedback?.join(' ')).toMatch(/solo puede depender de evidencias anteriores/);
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
        if (stage === 4) return outputs.clues;
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
