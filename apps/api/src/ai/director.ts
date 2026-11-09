import { AiError, exactKeys, record } from './provider.ts';
import type { AiProvider, AiErrorCode } from './provider.ts';
import type { ActionOffer, ConversationMemory, NpcContext, PublicFact, PublicScene, SpeechAct } from './context.ts';
import { memoryForContext, permittedNpcFacts, remember, restoreMemory, speechActs } from './context.ts';
import { converseSchema, factualSchema, interpretationSchema, MAX_CONVERSE_TEXT_LENGTH } from './schemas.ts';
import { lockedMessageEs, matchLockedAction, matchOfferedAction } from './interpreter.ts';
import type { LockedAction, LockedMissing } from '@meridiano/engine';

export interface CallOptions { requestId: string; signal?: AbortSignal }
export type Interpretation =
  | { kind: 'actions'; actionIds: string[] }
  | { kind: 'clarification'; message: string; reason: AiErrorCode | 'ambiguous' | 'locked_warrant' | 'locked_detain';
      locked?: { type: 'warrant' | 'detain'; suspectName: string | null; missing: LockedMissing[] } };
export interface Narrative {
  text: string;
  factIds: string[];
  act: SpeechAct | null;
  source: 'model' | 'fallback';
  reason?: AiErrorCode;
}
function ensureActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiError('cancelled');
}
function strings(value: unknown, limit: number): value is string[] {
  return Array.isArray(value) && value.length <= limit && value.every(item => typeof item === 'string');
}
function actionSelection(value: unknown, offers: readonly ActionOffer[]): Interpretation | null {
  if (!record(value) || !exactKeys(value, ['kind', 'actionIds']) || !strings(value.actionIds, 8)) return null;
  if (value.kind === 'clarification' && value.actionIds.length === 0) {
    return { kind: 'clarification', message: 'Aclara la acción y su objetivo.', reason: 'ambiguous' };
  }
  const ids = value.actionIds;
  if (value.kind !== 'actions' || ids.length === 0 || ids.some(id => !offers.some(offer => offer.id === id))) return null;
  return { kind: 'actions', actionIds: [...ids] };
}
function factSelection(value: unknown, facts: readonly PublicFact[], acts: readonly SpeechAct[]) {
  if (!record(value) || !exactKeys(value, ['act', 'factIds']) || !strings(value.factIds, 16)) return null;
  const act = acts.find(item => item === value.act);
  if (!act || new Set(value.factIds).size !== value.factIds.length) return null;
  if (value.factIds.some(id => !facts.some(fact => fact.id === id))) return null;
  if ((act === 'state') !== (value.factIds.length > 0)) return null;
  return { act, factIds: [...value.factIds] };
}
/** Selección de conversación libre: como factSelection más el texto
 * escrito por el modelo. El texto se muestra cuando el acto es `state`
 * (redacción natural de los hechos citados, GDD §7: el LLM expresa
 * conversaciones; lo probatorio sigue siendo los factIds, validados
 * contra los hechos autorizados) o `acknowledge` (charla o desvío no
 * probatorio). Para `decline`/`silence` valen sus líneas fijas: el
 * contrato no acepta texto probatorio libre (CONVERSACIONES.md), así que
 * el texto del modelo en esos actos se ignora y solo se acota su
 * longitud. Un `state` o un `acknowledge` sin texto no es una respuesta.
 * El respaldo ante fallo del proveedor sigue mostrando los textos
 * factuales autorizados (factualFallback), no texto del modelo. */
function converseTextValid(act: SpeechAct, text: string): boolean {
  if (act !== 'state' && act !== 'acknowledge') return true;
  return text.trim().length > 0;
}
function converseFactIds(value: unknown, facts: readonly PublicFact[], act: SpeechAct): string[] | null {
  if (!strings(value, 16)) return null;
  if (new Set(value).size !== value.length) return null;
  if (value.some(id => !facts.some(fact => fact.id === id))) return null;
  if ((act === 'state') !== (value.length > 0)) return null;
  return [...value];
}
function converseSelection(value: unknown, facts: readonly PublicFact[], acts: readonly SpeechAct[]) {
  if (!record(value) || !exactKeys(value, ['act', 'factIds', 'text'])) return null;
  if (typeof value.text !== 'string' || value.text.length > MAX_CONVERSE_TEXT_LENGTH) return null;
  const act = acts.find(item => item === value.act);
  if (!act) return null;
  const factIds = converseFactIds(value.factIds, facts, act);
  if (factIds === null || !converseTextValid(act, value.text)) return null;
  return { act, factIds, text: value.text };
}
function render(facts: readonly PublicFact[], ids: readonly string[], act: SpeechAct): string {
  if (act === 'acknowledge') return 'He registrado tu consulta.';
  if (act === 'decline') return 'No puedo responder a esa consulta.';
  if (act === 'silence') return 'El interlocutor guarda silencio.';
  return facts.filter(fact => ids.includes(fact.id)).map(fact => fact.text).join('\n');
}
function showsModelText(act: SpeechAct): boolean {
  return act === 'state' || act === 'acknowledge';
}
function errorCode(error: unknown, signal?: AbortSignal): AiErrorCode {
  if (signal?.aborted) return 'cancelled';
  return error instanceof AiError ? error.code : 'unavailable';
}
function inputWithinBudget(text: string): boolean {
  return text.trim().length > 0 && text.length <= 4000;
}
function validateFacts(facts: readonly PublicFact[]): void {
  if (facts.length > 16 || new Set(facts.map(fact => fact.id)).size !== facts.length) {
    throw new Error('Contexto factual duplicado o demasiado amplio.');
  }
  if (facts.some(fact => !fact.id || fact.id.length > 128 || !fact.text || fact.text.length > 2000)) throw new Error('Hecho público no válido.');
}
function factualFallback(
  facts: readonly PublicFact[], acts: readonly SpeechAct[], reason: AiErrorCode,
  operation: 'narrateResult' | 'converse',
): Narrative {
  if (reason === 'cancelled' && operation === 'converse') {
    return { text: 'Consulta cancelada.', factIds: [], act: null, source: 'fallback', reason };
  }
  const canState = facts.length > 0 && acts.includes('state');
  const factIds = canState ? facts.map(fact => fact.id) : [];
  const act = canState ? 'state' : (acts.find(act => act !== 'state') ?? null);
  const text = act === null ? 'No se pudo completar la consulta.' : render(facts, factIds, act);
  return { text, factIds, act, source: 'fallback', reason };
}
export function createDirector(provider: AiProvider) {
  async function interpretAction(
    text: string, scene: PublicScene, offers: readonly ActionOffer[], options: CallOptions,
    locked: readonly LockedAction[] = [],
  ): Promise<Interpretation> {
    if (!inputWithinBudget(text) || offers.length > 64) {
      return { kind: 'clarification', message: 'Acota la orden antes de interpretarla.', reason: 'budget_exceeded' };
    }
    if (new Set(offers.map(offer => offer.id)).size !== offers.length) {
      throw new Error('Las ofertas de acción deben tener IDs únicos.');
    }
    // Pre-paso determinista (lote intérprete de texto libre): las tres
    // lecturas documentadas —pedir orden, coordinar detención, cerrar el
    // caso— se resuelven sin el modelo cuando el emparejamiento es único;
    // si el texto pide una orden o una detención bloqueada, la aclaración
    // dice qué falta en vez de dejar que el modelo invente otra acción.
    // Todo lo demás sigue yendo al LLM como hasta ahora.
    const offered = matchOfferedAction(text, offers, locked);
    if (offered) return { kind: 'actions', actionIds: [offered] };
    const blocked = matchLockedAction(text, locked);
    if (blocked) {
      return { kind: 'clarification', message: lockedMessageEs(blocked),
        reason: blocked.type === 'warrant' ? 'locked_warrant' : 'locked_detain', locked: blocked };
    }
    const context = { text, scene: { location: scene.location, description: scene.description },
      offers: offers.map(offer => ({ id: offer.id, label: offer.label })) };
    try {
      ensureActive(options.signal);
      const response = await provider.request({ ...options, operation: 'interpretAction', schema: interpretationSchema, context });
      ensureActive(options.signal);
      return actionSelection(response.payload, offers) ??
        { kind: 'clarification', message: 'No se pudo interpretar la orden con seguridad.', reason: 'invalid_response' };
    } catch (error) {
      return { kind: 'clarification', message: 'No se pudo interpretar la orden. Puedes volver a intentarlo.', reason: errorCode(error, options.signal) };
    }
  }
  async function factual(
    operation: 'narrateResult' | 'converse', facts: readonly PublicFact[],
    acts: readonly SpeechAct[], context: Record<string, unknown>, options: CallOptions,
  ): Promise<Narrative> {
    validateFacts(facts);
    try {
      ensureActive(options.signal);
      const schema = operation === 'converse' ? converseSchema : factualSchema;
      const response = await provider.request({ ...options, operation, schema,
        context: { ...context, facts: facts.map(fact => ({ id: fact.id, text: fact.text })), allowedActs: [...acts] } });
      ensureActive(options.signal);
      if (operation === 'narrateResult') {
        const selection = factSelection(response.payload, facts, acts);
        if (!selection) throw new AiError('invalid_response');
        // Confirmed result narration must include every event; the model cannot suppress consequences.
        if (selection.factIds.length !== facts.length) throw new AiError('invalid_response');
        return { ...selection, text: render(facts, selection.factIds, selection.act), source: 'model' };
      }
      const selection = converseSelection(response.payload, facts, acts);
      if (!selection) throw new AiError('invalid_response');
      // `state` y `acknowledge` muestran el texto escrito por el modelo
      // (redacción de los hechos citados, o charla no probatoria);
      // `decline` y `silence` muestran sus líneas fijas. narrateResult
      // sigue siendo determinista: renderiza los textos factuales.
      const text = showsModelText(selection.act)
        ? selection.text : render(facts, selection.factIds, selection.act);
      return { act: selection.act, factIds: selection.factIds, text, source: 'model' };
    } catch (error) {
      const reason = errorCode(error, options.signal);
      const fallback = factualFallback(facts, acts, reason, operation);
      // Sin acto válido no se escribe diálogo (CONVERSACIONES.md): el
      // respaldo de `acknowledge` era la frase fija «He registrado tu
      // consulta.»; en conversación libre eso es un error operativo y la
      // web enseña «La IA no responde». El resto de respaldos (declarar
      // los hechos, negativa, silencio) siguen siendo texto autorizado.
      if (operation === 'converse' && fallback.act === 'acknowledge') throw new AiError(reason);
      return fallback;
    }
  }
  async function narrateResult(facts: readonly PublicFact[], options: CallOptions): Promise<Narrative> {
    return factual('narrateResult', facts, facts.length ? ['state'] : ['acknowledge'], {}, options);
  }
  async function converse(input: {
    runId: string; text: string; npc: NpcContext; facts: readonly PublicFact[];
    memory: ConversationMemory; allowedActs: readonly SpeechAct[];
  }, options: CallOptions): Promise<{ narrative: Narrative; memory: ConversationMemory }> {
    if (input.memory.runId !== input.runId || input.memory.npcId !== input.npc.id) {
      throw new Error('La memoria no pertenece a esta partida y personaje.');
    }
    const restored = restoreMemory(input.memory, input.runId, input.npc.id);
    if (!input.allowedActs.length || input.allowedActs.some(act => !speechActs.includes(act))) {
      throw new Error('Actos de habla no válidos.');
    }
    if (!inputWithinBudget(input.text)) throw new AiError('budget_exceeded');
    const facts = permittedNpcFacts(input.npc, input.facts);
    const context = { text: input.text,
      npc: { id: input.npc.id, name: input.npc.name, persona: input.npc.persona },
      memory: memoryForContext(restored, facts) };
    const narrative = await factual('converse', facts, input.allowedActs, context, options);
    // Una negativa en personaje, no la genérica: si el modelo (o el
    // respaldo) se niega y el personaje tiene su frase, esa es la que ve
    // el jugador. Sin frase propia, 'decline' sigue siendo la genérica.
    const rendered = narrative.act === 'decline' && input.npc.refusal
      ? { ...narrative, text: input.npc.refusal } : narrative;
    const memory = rendered.act === null ? input.memory :
      remember(restored, rendered.factIds, rendered.act, input.text, rendered.text);
    return { narrative: rendered, memory };
  }
  return { interpretAction, narrateResult, converse };
}
