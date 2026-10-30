import type { AIFunction } from '../index.js';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function requireOutput(valid: boolean): void {
  if (!valid) throw new Error('INVALID_OUTPUT');
}

/**
 * Bloquea cualquier campo no explícitamente autorizado en el esquema,
 * evitando que el modelo inyecte 'pensamientos', 'razonamientos' o metadatos no solicitados.
 */
function strictObject(out: Record<string, unknown>, allowedKeys: string[]) {
  const keys = Object.keys(out);
  const extra = keys.filter(k => !allowedKeys.includes(k));
  if (extra.length > 0) throw new Error(`INVALID_OUTPUT: Campos no autorizados: ${extra.join(', ')}`);
}

function action(out: Record<string, unknown>) {
  strictObject(out, ['actionType', 'params', 'confidence', 'clarificationQuestion']);
  const types = ['inspect', 'collect', 'talk', 'travel', 'analyze', 'communicate', 'query', 'wait', 'request_warrant', 'detain', 'recover', 'finish', 'batch'];
  requireOutput(typeof out.actionType === 'string' && types.includes(out.actionType));
  requireOutput(object(out.params));
  requireOutput(typeof out.confidence === 'number' && Number.isFinite(out.confidence) && out.confidence >= 0 && out.confidence <= 1);
}

function conversation(out: Record<string, unknown>) {
  strictObject(out, ['text', 'factIds', 'actOfSpeech', 'cooperationChange', 'newKnowledge']);
  requireOutput(typeof out.text === 'string');
  requireOutput(typeof out.actOfSpeech === 'string' && ['inform', 'question', 'refusal', 'evasion', 'silence'].includes(out.actOfSpeech));
  if (out.factIds !== undefined) requireOutput(strings(out.factIds));
}

function narration(out: Record<string, unknown>) {
  strictObject(out, ['narrative', 'factReferences', 'style']);
  requireOutput(typeof out.narrative === 'string' && strings(out.factReferences));
  requireOutput(typeof out.style === 'string' && ['brief', 'detailed', 'ambient'].includes(out.style));
}

function generation(out: Record<string, unknown>) {
  strictObject(out, ['definition', 'validationReport']);
  requireOutput(object(out.definition) && object(out.validationReport));
}

function validation(out: Record<string, unknown>) {
  strictObject(out, ['valid', 'errors']);
  requireOutput(typeof out.valid === 'boolean' && strings(out.errors));
}
const validators: Record<AIFunction, (output: Record<string, unknown>) => void> = {
  interpretAction: action, converse: conversation, narrateResult: narration, generateCase: generation, validateCase: validation,
};

/** Forma de salida; la autorización de hechos/acciones sigue siendo otra puerta. */
export function validateOllamaOutput(functionName: AIFunction, output: unknown): void {
  if (!object(output) || !Object.hasOwn(validators, functionName)) throw new Error('INVALID_OUTPUT');
  validators[functionName](output);
}
