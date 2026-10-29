import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../index.js';
import { validateCaseDefinition } from '@meridiano/case-schema';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const verbs = [
  { type: 'inspect', terms: ['inspec', 'mira', 'examina'] },
  { type: 'collect', terms: ['recog', 'coge', 'toma '] },
  { type: 'talk', terms: ['habl', 'pregunt', 'entrevist'] },
  { type: 'travel', terms: ['viaj', 've a ', 've hacia '] },
  { type: 'analyze', terms: ['analiz', 'laboratorio'] },
  { type: 'wait', terms: ['esper', 'wait'] },
];

function clarification() {
  return { actionType: '', params: {}, confidence: 0, clarificationQuestion: '¿Qué acción y objetivo quieres indicar?' };
}

function mentionsTarget(params: Record<string, unknown>, words: string[]): boolean {
  return Object.values(params).some(value => {
    if (typeof value === 'string') return words.includes(value.toLowerCase());
    return typeof value === 'number' && Number.isFinite(value) && words.includes(String(value));
  });
}

function matchingAction(value: unknown, type: string, words: string[]): value is { type: string; params: Record<string, unknown> } {
  if (!record(value) || value.type !== type || !record(value.params)) return false;
  return mentionsTarget(value.params, words);
}

function interpretationInput(input: unknown): input is { text: string; availableActions: unknown[] } {
  return record(input) && typeof input.text === 'string' && Array.isArray(input.availableActions);
}

function interpret(input: unknown) {
  if (!interpretationInput(input)) return clarification();
  if (input.text.length > 4096 || input.availableActions.length > 64) return clarification();
  const text = input.text.toLowerCase();
  const kinds = verbs.filter(verb => verb.terms.some(term => text.includes(term)));
  const kind = kinds[0];
  if (kinds.length !== 1 || !kind) return clarification();
  const words = text.match(/[\p{L}\p{N}._:-]+/gu) ?? [];
  const matches = input.availableActions.filter(value => matchingAction(value, kind.type, words));
  const action = matches[0];
  if (matches.length !== 1 || !action) return clarification();
  return { actionType: action.type, params: structuredClone(action.params), confidence: 1 };
}

function narrate(input: unknown) {
  const events = record(input) && Array.isArray(input.publicEvents) ? input.publicEvents : [];
  return { narrative: `Acción registrada. Eventos públicos: ${events.length}.`, factReferences: [], style: 'brief' };
}

function converse() {
  return { text: 'Te escucho, detective.', factIds: [], actOfSpeech: 'inform', cooperationChange: 0 };
}

function generationUnavailable() {
  return { definition: null, validationReport: { validatorVersion: 'mock-1', scenarios: [],
    errors: ['El doble no genera expedientes jugables.'], status: 'rejected' } };
}

function validate(input: unknown) {
  return validateCaseDefinition(record(input) ? input.definition : undefined);
}

const handlers: Record<AIFunction, (input: unknown) => unknown> = {
  interpretAction: interpret, narrateResult: narrate, converse,
  generateCase: generationUnavailable, validateCase: validate,
};

/** Doble sintético: no red, reloj ni azar, y nunca certifica una generación ficticia. */
export class DeterministicMockProvider implements AIProvider {
  readonly id: ProviderId = 'mock-deterministic';
  readonly capabilities: AIFunction[] = ['interpretAction', 'narrateResult', 'converse', 'validateCase'];
  readonly maxContextTokens = 8192;
  readonly defaultModel = 'mock-deterministic';

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    if (context.cancellationSignal?.aborted) throw new Error('CANCELLED');
    if (!Object.hasOwn(handlers, context.function)) throw new Error('Función no disponible.');
    return { payload: handlers[context.function](context.authorizedContext) as T, latencyMs: 0, finishReason: 'stop' };
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs: number }> {
    return { available: true, latencyMs: 0 };
  }

  estimateTokens(text: string): number { return Math.ceil(text.length / 4); }
}

export function createDeterministicMockProvider(): AIProvider {
  return new DeterministicMockProvider();
}
