import { describe, expect, it } from 'vitest';
import { createTranslator } from '@meridiano/contracts';
import type { PlayerViewDto, PublicActionOffer } from '@meridiano/contracts';
import {
  analysisDelayMinutes,
  analysisTypeLabel,
  analyzeOfferForEvidence,
  describePendingRequest,
  evidenceAnalysisState,
  evidenceCount,
  loadAnalysisLinks,
  pendingAnalysisRequest,
  reconcileAnalysisLinks,
  saveAnalysisLinks,
  unlinkedAnalysisResults,
} from './dossier-analysis';
import type { AnalysisLinks } from './dossier-analysis';

const t = createTranslator('es').t;
const tEn = createTranslator('en').t;
const tFr = createTranslator('fr').t;

function analyzeOffer(evidenceId: string, detail = 'El resultado tarda 90 min'): PublicActionOffer {
  return {
    id: `analyze:${evidenceId}`,
    label: 'Análisis de huellas — La cerradura de la vitrina tiene residuo de herramienta.',
    detail,
    forensicType: 'huellas',
    action: { type: 'analyze', params: { evidenceId } },
  };
}

function view(overrides: Partial<PlayerViewDto> = {}): PlayerViewDto {
  return {
    dossier: [],
    evidenceTexts: { 'EV-01': 'La caja está a la vista. Su etiqueta remite al archivo de París.', 'EV-02': 'La cerradura de la vitrina tiene residuo de herramienta.', 'EV-03': 'La huella técnica es compatible con una herramienta de la serie HV-17.' },
    pendingRequests: [],
    analysisResults: [],
    clock: { minute: 30, deadlineMinutes: 2880 },
    offers: [],
    position: { city: { id: 'madrid', name: 'Madrid', country: 'España' }, location: { id: 'MAD-SALA', name: 'Sala de embalaje', description: '' } },
    ...overrides,
  } as PlayerViewDto;
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

describe('analysisDelayMinutes: la demora sale del detalle de la oferta', () => {
  it('saca 90 de «El resultado tarda 90 min»', () => {
    expect(analysisDelayMinutes(analyzeOffer('EV-02'))).toBe(90);
  });

  it('saca la demora de los detalles en inglés y francés', () => {
    expect(analysisDelayMinutes(analyzeOffer('EV-02', 'The result takes 90 min'))).toBe(90);
    expect(analysisDelayMinutes(analyzeOffer('EV-02', 'Le résultat prend 90 min'))).toBe(90);
  });

  it('sin número no inventa demora', () => {
    expect(analysisDelayMinutes(analyzeOffer('EV-02', 'El resultado tarda un rato'))).toBeNull();
    expect(analysisDelayMinutes({ id: 'analyze:EV-02', label: 'x', action: { type: 'analyze', params: { evidenceId: 'EV-02' } } })).toBeNull();
  });
});

describe('analysisTypeLabel: el tipo forense en minúsculas, como el motor', () => {
  it('huellas en los tres idiomas', () => {
    const offer = analyzeOffer('EV-02');
    expect(analysisTypeLabel(offer, t)).toBe('huellas y marcas');
    expect(analysisTypeLabel(offer, tEn)).toBe('fingerprints and marks');
    expect(analysisTypeLabel(offer, tFr)).toBe('empreintes et traces');
  });

  it('sin tipo conocido, la etiqueta genérica', () => {
    const offer: PublicActionOffer = { id: 'analyze:EV-02', label: 'x', action: { type: 'analyze', params: { evidenceId: 'EV-02' } } };
    expect(analysisTypeLabel(offer, t)).toBe('análisis');
  });
});

describe('analyzeOfferForEvidence: la oferta de cada evidencia', () => {
  it('encuentra la de EV-02 y no la de EV-06', () => {
    const offers = [analyzeOffer('EV-02')];
    expect(analyzeOfferForEvidence(offers, 'EV-02')?.id).toBe('analyze:EV-02');
    expect(analyzeOfferForEvidence(offers, 'EV-06')).toBeUndefined();
  });
});

describe('evidenceAnalysisState: disponible, en curso, hecho o nada', () => {
  it('con oferta y sin anotar: disponible con su demora', () => {
    const state = evidenceAnalysisState(view({ offers: [analyzeOffer('EV-02')] }), [analyzeOffer('EV-02')], {}, 'EV-02');
    expect(state).toEqual({ kind: 'available', offer: analyzeOffer('EV-02'), minutes: 90 });
  });

  it('anotada y con solicitud en curso: en curso con su cuenta atrás', () => {
    const current = view({ offers: [analyzeOffer('EV-02')], pendingRequests: [{ id: 'req-4', type: 'analysis', dueMinute: 120 }] });
    const state = evidenceAnalysisState(current, [analyzeOffer('EV-02')], { 'EV-02': { inputId: 'EV-02' } }, 'EV-02');
    expect(state).toEqual({ kind: 'running', dueMinute: 120, minutesLeft: 90 });
  });

  it('anotada y con resultado en la vista: hecho con su resultado', () => {
    const current = view({ analysisResults: ['EV-03'], dossier: ['EV-02', 'EV-03'] });
    const state = evidenceAnalysisState(current, [], { 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } }, 'EV-02');
    expect(state).toEqual({ kind: 'done', resultId: 'EV-03' });
  });

  it('sin oferta ni anotación ni resultado: sin análisis disponible', () => {
    expect(evidenceAnalysisState(view(), [], {}, 'EV-06')).toEqual({ kind: 'none' });
  });

  it('un resultado anotado que ya no está en la vista no se enseña como hecho', () => {
    const current = view({ offers: [analyzeOffer('EV-02')] });
    const state = evidenceAnalysisState(current, [analyzeOffer('EV-02')], { 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } }, 'EV-02');
    expect(state.kind).toBe('available');
  });

  it('sin anotación, un único resultado sin vincular se atribuye a la evidencia sin oferta', () => {
    const current = view({ analysisResults: ['EV-03'] });
    expect(evidenceAnalysisState(current, [], {}, 'EV-02')).toEqual({ kind: 'done', resultId: 'EV-03' });
  });
});

describe('reconcileAnalysisLinks: el resultado vuelve a su entrada', () => {
  it('sin análisis en curso, el resultado sin vincular se enlaza a la entrada anotada', () => {
    const current = view({ analysisResults: ['EV-03'] });
    const { links, changed } = reconcileAnalysisLinks(current, { 'EV-02': { inputId: 'EV-02' } });
    expect(changed).toBe(true);
    expect(links).toEqual({ 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } });
  });

  it('con análisis en curso no atribuye nada todavía', () => {
    const current = view({ analysisResults: [], pendingRequests: [{ id: 'req-4', type: 'analysis', dueMinute: 120 }] });
    const { changed } = reconcileAnalysisLinks(current, { 'EV-02': { inputId: 'EV-02' } });
    expect(changed).toBe(false);
  });

  it('sin resultados pendientes no cambia nada', () => {
    const { changed } = reconcileAnalysisLinks(view(), {});
    expect(changed).toBe(false);
  });
});

describe('pendingAnalysisRequest y unlinkedAnalysisResults', () => {
  it('encuentra la solicitud de análisis entre las pendientes', () => {
    const current = view({ pendingRequests: [
      { id: 'req-1', type: 'query', dueMinute: 60 },
      { id: 'req-2', type: 'analysis', dueMinute: 120 },
    ] });
    expect(pendingAnalysisRequest(current)?.id).toBe('req-2');
    expect(pendingAnalysisRequest(view())).toBeUndefined();
  });

  it('los resultados ya vinculados no vuelven a ofrecerse', () => {
    const links: AnalysisLinks = { 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } };
    expect(unlinkedAnalysisResults(view({ analysisResults: ['EV-03'] }), links)).toEqual([]);
    expect(unlinkedAnalysisResults(view({ analysisResults: ['EV-03'] }), {})).toEqual(['EV-03']);
  });
});

describe('load/saveAnalysisLinks: el vínculo sobrevive en la pestaña', () => {
  it('guarda y recupera, y descarta lo que no valida', () => {
    const storage = memoryStorage();
    saveAnalysisLinks(storage, 'run-1', { 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } });
    expect(loadAnalysisLinks(storage, 'run-1')).toEqual({ 'EV-02': { inputId: 'EV-02', resultId: 'EV-03' } });
    expect(loadAnalysisLinks(storage, 'run-2')).toEqual({});
    storage.setItem('meridiano:analysis:run-3', '{"EV-02":{"inputId":"EV-09"}}');
    expect(loadAnalysisLinks(storage, 'run-3')).toEqual({});
    storage.setItem('meridiano:analysis:run-4', 'no-json{');
    expect(loadAnalysisLinks(storage, 'run-4')).toEqual({});
  });
});

describe('evidenceCount: el distintivo del Dossier cuenta evidencias, no marcadores', () => {
  it('cuenta EV-01 y EV-02, no la ciudad ni el lugar', () => {
    const current = view({ dossier: ['MAD-SALA', 'paris', 'EV-01', 'EV-02', 'identity:lucia'] });
    expect(evidenceCount(current)).toBe(2);
  });

  it('sin dossier, cero', () => {
    expect(evidenceCount(view())).toBe(0);
  });
});

describe('describePendingRequest: la solicitud en curso nombra su evidencia', () => {
  it('el análisis en curso nombra la cerradura y su hora prevista', () => {
    const current = view({ pendingRequests: [{ id: 'req-4', type: 'analysis', dueMinute: 120 }], offers: [analyzeOffer('EV-02')] });
    const { title, detail } = describePendingRequest(current, current.pendingRequests[0] as PlayerViewDto['pendingRequests'][number], [analyzeOffer('EV-02')], { 'EV-02': { inputId: 'EV-02' } }, t);
    expect(title).toContain('Análisis');
    expect(title).toContain('La cerradura de la vitrina tiene residuo de herramienta.');
    expect(detail).toBe('Responde en el minuto 120 (ahora 30)');
  });

  it('una consulta solo lleva su tipo y su hora', () => {
    const current = view({ pendingRequests: [{ id: 'req-1', type: 'query', dueMinute: 60 }] });
    const { title, detail } = describePendingRequest(current, current.pendingRequests[0] as PlayerViewDto['pendingRequests'][number], [], {}, t);
    expect(title).toBe('Consulta');
    expect(detail).toBe('Responde en el minuto 60 (ahora 30)');
  });
});
