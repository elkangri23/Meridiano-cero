import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../types.js';
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
  return { kind: 'clarification', actionIds: [] };
}

type Offer = { id: string; label: string };

function mentionsTarget(offer: Offer, words: string[]): boolean {
  const suffix = offer.id.split(':').slice(1).join(':').toLowerCase();
  if (!suffix) return false;
  if (words.includes(suffix)) return true;
  const parts = suffix.split(/[^a-z0-9]+/u).filter(part => part.length > 0);
  return parts.length > 0 && parts.every(part => words.includes(part));
}

function matchingOffer(value: unknown, type: string, words: string[]): value is Offer {
  if (!record(value) || typeof value.id !== 'string' || typeof value.label !== 'string') return false;
  const offer: Offer = { id: value.id, label: value.label };
  return offer.id.startsWith(`${type}:`) && mentionsTarget(offer, words);
}

function interpretationInput(input: unknown): input is { text: string; offers: unknown[] } {
  return record(input) && typeof input.text === 'string' && Array.isArray(input.offers);
}

function interpret(input: unknown) {
  if (!interpretationInput(input)) return clarification();
  if (input.text.length > 4096 || input.offers.length > 64) return clarification();
  const text = input.text.toLowerCase();
  const kinds = verbs.filter(verb => verb.terms.some(term => text.includes(term)));
  const kind = kinds[0];
  if (kinds.length !== 1 || !kind) return clarification();
  const words = text.match(/[\p{L}\p{N}._:-]+/gu) ?? [];
  const matches = input.offers.filter(value => matchingOffer(value, kind.type, words));
  const offer = matches[0];
  if (matches.length !== 1 || !offer) return clarification();
  return { kind: 'actions', actionIds: [offer.id] };
}

function factIds(input: unknown): string[] {
  if (!record(input) || !Array.isArray(input.facts)) return [];
  return input.facts
    .filter(fact => record(fact) && typeof fact.id === 'string')
    .map(fact => (fact as { id: string }).id);
}

function narrate(input: unknown) {
  const ids = factIds(input);
  return ids.length > 0 ? { act: 'state', factIds: ids } : { act: 'acknowledge', factIds: [] };
}

function converse(input: unknown) {
  const ids = factIds(input);
  return ids.length > 0 ? { act: 'state', factIds: ids } : { act: 'acknowledge', factIds: [] };
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
