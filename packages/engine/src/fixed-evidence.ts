import { EngineStateError } from './state-error.js';
import type { CaseDefinition, CaseRun, ScheduledResult } from '@meridiano/case-schema';
import { isFixedCase } from './fixed-case.js';

type QueryRule = { city: string; location: string; evidenceId: string; requires: readonly string[] };
const queries: Readonly<Record<string, QueryRule>> = {
  'herramienta-hv17': { city: 'paris', location: 'PAR-ARCH', evidenceId: 'EV-04', requires: ['EV-03'] },
  'traslado-ines': { city: 'paris', location: 'PAR-ARCH', evidenceId: 'EV-05', requires: [] },
  'firma-sello': { city: 'paris', location: 'PAR-ARCH', evidenceId: 'EV-07', requires: ['EV-06'] },
  'custodia-envio': { city: 'lisboa', location: 'LIS-ALM', evidenceId: 'EV-08', requires: ['EV-05', 'EV-07'] },
  'accesos-tomas': { city: 'madrid', location: 'MAD-SALA', evidenceId: 'EV-10', requires: [] },
};

export function knowsEvidence(run: CaseRun, id: string): boolean {
  return run.discoveries.includes(id) || run.inventory.includes(id);
}

export function revealEvidence(def: CaseDefinition, run: CaseRun, id: string, minute: number, method: string): CaseRun {
  const evidence = def.evidence.find(item => item.id === id);
  if (!evidence || knowsEvidence(run, id)) return run;
  return {
    ...run, discoveries: [...run.discoveries, id],
    admissibility: { ...run.admissibility, [id]: evidence.admissible === true && evidence.relations.every(parent => run.admissibility[parent] === undefined || run.admissibility[parent] === true) && (run.admissibility[id] === undefined || run.admissibility[id] === true) },
    evidenceRecords: { ...run.evidenceRecords, [id]: { revealedMinute: minute, origin: evidence.origin, method } },
  };
}

export function inspectedEvidence(target: string, element?: string): string | undefined {
  if (target !== 'MAD-SALA') return undefined;
  if (element === undefined) return 'EV-01';
  if (element === 'cerradura') return 'EV-02';
  if (element === 'caja') return 'EV-06';
  return undefined;
}

export function revealInspection(def: CaseDefinition, run: CaseRun, target: string, element?: string): CaseRun {
  if (!isFixedCase(def)) return run;
  const id = inspectedEvidence(target, element);
  if (!id) return run;
  const revealed = revealEvidence(def, run, id, run.minute, 'inspect');
  return id === 'EV-01' && !revealed.discoveries.includes('paris')
    ? { ...revealed, discoveries: [...revealed.discoveries, 'paris'] } : revealed;
}

export function canCollect(def: CaseDefinition, run: CaseRun, id: string): boolean {
  if (!isFixedCase(def)) return true;
  if (!['EV-02', 'EV-06'].includes(id) || !run.discoveries.includes(id)) return false;
  const evidence = def.evidence.find(item => item.id === id);
  return evidence?.origin === run.position.locationId;
}

export function queryRule(def: CaseDefinition, run: CaseRun, topicId: unknown): QueryRule | undefined {
  if (!isFixedCase(def) || typeof topicId !== 'string' || !Object.hasOwn(queries, topicId)) return undefined;
  const rule = queries[topicId];
  if (!rule || run.position.cityId !== rule.city || run.position.locationId !== rule.location) return undefined;
  if (!def.evidence.some(evidence => evidence.id === rule.evidenceId)) return undefined;
  // Custodia admite cualquiera de los dos documentos que identifica el envío.
  if (rule.requires.length && !rule.requires.some(id => knowsEvidence(run, id))) return undefined;
  return { ...rule, requires: [...rule.requires] };
}

export function matureEvidence(def: CaseDefinition, run: CaseRun, request: ScheduledResult): CaseRun {
  if (typeof request.payload !== 'object' || request.payload === null) throw new EngineStateError('REQUEST_STATE_INVALID');
  const payload = request.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(',') !== 'evidenceId,method') throw new EngineStateError('REQUEST_STATE_INVALID');
  const id = payload.evidenceId;
  const method = payload.method;
  if (typeof id !== 'string' || !['EV-03', 'EV-04', 'EV-05', 'EV-07', 'EV-08', 'EV-10'].includes(id)) throw new EngineStateError('REQUEST_STATE_INVALID');
  const expectedMethod = id === 'EV-03' ? 'analyze' : 'query';
  if (method !== expectedMethod) throw new EngineStateError('REQUEST_STATE_INVALID');
  if (!def.evidence.some(evidence => evidence.id === id)) throw new EngineStateError('REQUEST_STATE_INVALID');
  const revealed = revealEvidence(def, run, id, request.dueMinute, expectedMethod);
  if (!['EV-05', 'EV-08'].includes(id)) return revealed;
  const markers = ['lisboa', 'location:ines'];
  return { ...revealed, discoveries: [...revealed.discoveries, ...markers.filter(marker => !revealed.discoveries.includes(marker))] };
}

export function revealTalk(def: CaseDefinition, run: CaseRun, npcId: string, topicId: unknown): CaseRun {
  if (!isFixedCase(def)) return run;
  if (topicId === 'identidad') {
    const markers = ['identity:' + npcId, 'location:' + npcId];
    return { ...run, discoveries: [...run.discoveries, ...markers.filter(marker => !run.discoveries.includes(marker))] };
  }
  const witness = def.npcs.find(npc => npc.id === npcId);
  const knowsBox = witness?.knowledge.includes('tomas-moved-box') === true;
  if (npcId === 'lucia' && topicId === 'caja' && knowsBox && (run.npcRelations.lucia ?? 0) > 0) return revealEvidence(def, run, 'EV-09', run.minute, 'talk');
  return run;
}
