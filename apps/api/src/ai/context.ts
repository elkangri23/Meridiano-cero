import { exactKeys, record } from './provider.ts';

// These DTOs are constructed by the authorized server projection, never from request bodies.
// Deliberately no CaseDefinition, PlayerView.pendingRequests.payload, engine or DB imports.
export interface PublicFact { id: string; text: string }
export interface ActionOffer { id: string; label: string }
export interface PublicScene { location: string; description: string }
export interface NpcContext {
  id: string;
  name: string;
  persona: string;
  knownFactIds: readonly string[];
  revealableFactIds: readonly string[];
}
export const speechActs = ['state', 'acknowledge', 'decline', 'silence'] as const;
export type SpeechAct = typeof speechActs[number];
export interface ConversationMemory {
  schemaVersion: 1;
  runId: string;
  npcId: string;
  treatment: 'neutral' | 'respectful' | 'hostile';
  turns: readonly { factIds: readonly string[]; act: SpeechAct }[];
}
export function emptyMemory(runId: string, npcId: string): ConversationMemory {
  return { schemaVersion: 1, runId, npcId, treatment: 'neutral', turns: [] };
}
export function permittedNpcFacts(npc: NpcContext, facts: readonly PublicFact[]): PublicFact[] {
  return facts.filter(fact => npc.knownFactIds.includes(fact.id) && npc.revealableFactIds.includes(fact.id));
}
export function memoryForContext(memory: ConversationMemory, facts: readonly PublicFact[]) {
  const allowed = new Set(facts.map(fact => fact.id));
  return { treatment: memory.treatment, turns: memory.turns.slice(-12).map(turn => ({
    act: turn.act, factIds: turn.factIds.filter(id => allowed.has(id)),
  })) };
}
export function remember(
  memory: ConversationMemory, factIds: readonly string[], act: SpeechAct,
): ConversationMemory {
  return { ...memory, turns: [...memory.turns.slice(-11), { factIds: [...factIds], act }] };
}

function memoryTurn(value: unknown): value is ConversationMemory['turns'][number] {
  if (!record(value) || !exactKeys(value, ['factIds', 'act'])) return false;
  if (!speechActs.some(act => act === value.act)) return false;
  if (!Array.isArray(value.factIds) || value.factIds.length > 16) return false;
  if (new Set(value.factIds).size !== value.factIds.length) return false;
  if ((value.act === 'state') !== (value.factIds.length > 0)) return false;
  return value.factIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128);
}
export function restoreMemory(value: unknown, runId: string, npcId: string): ConversationMemory {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'runId', 'npcId', 'treatment', 'turns'])) {
    throw new Error('Memoria no válida.');
  }
  if (value.schemaVersion !== 1) throw new Error('Versión de memoria no compatible.');
  if (value.runId !== runId || value.npcId !== npcId) throw new Error('Memoria de otro ámbito.');
  const treatment = (['neutral', 'respectful', 'hostile'] as const).find(item => item === value.treatment);
  if (!treatment) {
    throw new Error('Trato no válido.');
  }
  if (!Array.isArray(value.turns) || value.turns.length > 12 || !value.turns.every(memoryTurn)) {
    throw new Error('Historial no válido.');
  }
  return { schemaVersion: 1, runId, npcId, treatment,
    turns: value.turns.map(turn => ({ act: turn.act, factIds: [...turn.factIds] })) };
}
