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
  /** Negativa en personaje al declarar sobre el robo, si el personaje la
   * tiene (solo Inés). El director la usa como texto de 'decline' en vez
   * de la genérica; sin ella, 'decline' sigue siendo la frase genérica. */
  refusal?: string;
}
export const speechActs = ['state', 'acknowledge', 'decline', 'silence'] as const;
export type SpeechAct = typeof speechActs[number];
/** Un turno de conversación: acto y hechos citados (lo que el director
 * valida) más lo que se dijo de verdad. `you` es la pregunta del jugador y
 * `npc` la respuesta que vio: el texto factual autorizado (`state`), la
 * charla escrita por el modelo (`acknowledge`), la negativa (`decline`) o
 * la línea fija de silencio. Sin los textos el modelo no ve el hilo: solo
 * vería actos e ids y repetiría lo ya dicho. Los turnos viejos (solo acto
 * e ids, de antes de este cambio) se aceptan con textos vacíos. */
export interface ConversationMemory {
  schemaVersion: 1;
  runId: string;
  npcId: string;
  treatment: 'neutral' | 'respectful' | 'hostile';
  turns: readonly { factIds: readonly string[]; act: SpeechAct; you: string; npc: string }[];
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
    act: turn.act, factIds: turn.factIds.filter(id => allowed.has(id)), you: turn.you, npc: turn.npc,
  })) };
}
export function remember(
  memory: ConversationMemory, factIds: readonly string[], act: SpeechAct, you = '', npc = '',
): ConversationMemory {
  return { ...memory, turns: [...memory.turns.slice(-11), { factIds: [...factIds], act, you, npc }] };
}

function memoryTurn(value: unknown): value is ConversationMemory['turns'][number] {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  if (!keys.every(key => ['factIds', 'act', 'you', 'npc'].includes(key))) return false;
  if (!('factIds' in value) || !('act' in value)) return false;
  if (!speechActs.some(act => act === value.act)) return false;
  if (!Array.isArray(value.factIds) || value.factIds.length > 16) return false;
  if (new Set(value.factIds).size !== value.factIds.length) return false;
  if ((value.act === 'state') !== (value.factIds.length > 0)) return false;
  if (!value.factIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128)) return false;
  // Textos opcionales (turnos viejos): si vienen, acotados como la entrada
  // del jugador (4000) y la respuesta mostrada (2000, por encima del tope
  // de 600 del modelo para no rechazar líneas fijas antiguas).
  if ('you' in value && (typeof value.you !== 'string' || value.you.length > 4000)) return false;
  if ('npc' in value && (typeof value.npc !== 'string' || value.npc.length > 2000)) return false;
  return true;
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
    turns: value.turns.map(turn => ({ act: turn.act, factIds: [...turn.factIds],
      you: typeof turn.you === 'string' ? turn.you : '', npc: typeof turn.npc === 'string' ? turn.npc : '' })) };
}
