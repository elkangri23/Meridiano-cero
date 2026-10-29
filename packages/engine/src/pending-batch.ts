import { isCommunicationParams } from './communications.js';
import { isEvidenceSelection } from './warrants.js';
import type { Action, BatchStep } from './types.js';
import { EngineStateError } from './state-error.js';

type Data = Record<string, unknown>;
function object(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}
const fields = {
  inspect: { required: 'targetId', optional: ['elementId'] },
  collect: { required: 'evidenceId', optional: [] },
  talk: { required: 'npcId', optional: ['topicId'] },
  analyze: { required: 'evidenceId', optional: [] },
  query: { required: 'topicId', optional: [] },
  recover: { required: 'objectId', optional: [] },
  travel: { required: 'toCityId', optional: [] },
} as const;

function identifierParams(type: keyof typeof fields, params: Data): boolean {
  const rule = fields[type];
  const allowed: readonly string[] = [rule.required, ...rule.optional];
  if (!Object.hasOwn(params, rule.required) || !id(params[rule.required])) return false;
  if (!Object.keys(params).every(key => allowed.includes(key))) return false;
  return rule.optional.every(key => params[key] === undefined || id(params[key]));
}

const supportedTypes = new Set([...Object.keys(fields), 'wait', 'request_warrant', 'detain', 'finish', 'communicate']);

function detentionParams(params: Data): boolean {
  if (Object.keys(params).sort().join(',') !== 'locationId,mode,suspectId,warrantId') return false;
  return params.mode === 'interactive' && ['suspectId', 'warrantId', 'locationId'].every(key => id(params[key]));
}

function waitParams(params: Data): boolean {
  return Object.keys(params).join(',') === 'minutes' && typeof params.minutes === 'number' &&
    Number.isSafeInteger(params.minutes) && params.minutes > 0;
}

function validParams(type: string, params: Data): boolean {
  if (type === 'communicate') return isCommunicationParams(params);
  if (type === 'finish') return Object.keys(params).length === 0;
  if (type === 'detain') return detentionParams(params);
  if (type === 'wait') return waitParams(params);
  if (type === 'request_warrant') return Object.keys(params).sort().join(',') === 'evidenceIds,suspectId' &&
    id(params.suspectId) && isEvidenceSelection(params.evidenceIds);
  return Object.hasOwn(fields, type) && identifierParams(type as keyof typeof fields, params);
}

export function isBatchAction(value: unknown): value is Action {
  if (!object(value) || typeof value.type !== 'string' || !supportedTypes.has(value.type)) return false;
  if (!Object.keys(value).every(key => ['type', 'params'].includes(key))) return false;
  if (!Object.hasOwn(value, 'type') || !Object.hasOwn(value, 'params') || !object(value.params)) return false;
  return validParams(value.type, value.params);
}

function dependencies(value: unknown, ordinal: number): value is number[] {
  if (!Array.isArray(value) || value.length > ordinal) return false;
  if (!Array.from(value).every(item => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0 && item < ordinal)) return false;
  return new Set(value).size === value.length;
}

function actionList(value: unknown): Action[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return undefined;
  const result: Action[] = [];
  for (const action of value) {
    if (!isBatchAction(action)) return undefined;
    result.push(action);
  }
  return result;
}

export function createBatchSteps(params: Data): BatchStep[] | undefined {
  if (!Object.hasOwn(params, 'steps') || !Object.keys(params).every(key => ['steps', 'dependencies'].includes(key))) return undefined;
  const actions = actionList(params.steps);
  if (!actions) return undefined;
  const inputGraph = Object.hasOwn(params, 'dependencies') ? params.dependencies : undefined;
  const graph: unknown = inputGraph === undefined ? actions.map((_, index) => index === 0 ? [] : [index - 1]) : inputGraph;
  if (!Array.isArray(graph) || graph.length !== actions.length) return undefined;
  const steps: BatchStep[] = [];
  for (const [ordinal, action] of actions.entries()) {
    const parents: unknown = graph[ordinal];
    if (!dependencies(parents, ordinal)) return undefined;
    steps.push({ ordinal, action: structuredClone(action), dependsOn: [...parents], status: 'pending' });
  }
  return steps;
}

function validStep(value: unknown, ordinal: number): value is BatchStep {
  if (!object(value) || value.ordinal !== ordinal || !isBatchAction(value.action)) return false;
  if (!Object.keys(value).every(key => ['ordinal', 'action', 'dependsOn', 'status', 'reason'].includes(key))) return false;
  if (!dependencies(value.dependsOn, ordinal)) return false;
  if (typeof value.status !== 'string' || !['pending', 'applied', 'impossible', 'skipped'].includes(value.status)) return false;
  return value.reason === undefined || typeof value.reason === 'string' && value.reason.length <= 512;
}

export function dependenciesApplied(steps: BatchStep[], step: BatchStep): boolean {
  return step.dependsOn.every(parent => steps[parent]?.status === 'applied');
}

function coherent(steps: BatchStep[]): boolean {
  const failed = steps.findLastIndex(step => step.status === 'impossible');
  if (failed < 0) return false;
  return steps.every((step, index) => {
    if (index > failed) return step.status === 'pending';
    if (step.status === 'pending') return false;
    if (step.status === 'applied') return dependenciesApplied(steps, step);
    if (step.status === 'skipped') return !dependenciesApplied(steps, step);
    return dependenciesApplied(steps, step);
  });
}

function parseStep(record: unknown, ordinal: number): BatchStep {
  if (typeof record !== 'string' || record.length > 32768) throw new EngineStateError('BATCH_STATE_INVALID');
  let value: unknown;
  try { value = JSON.parse(record); }
  catch { throw new EngineStateError('BATCH_STATE_INVALID'); }
  if (!validStep(value, ordinal)) throw new EngineStateError('BATCH_STATE_INVALID');
  return value;
}

export function parsePendingBatch(records: string[]): BatchStep[] {
  if (!Array.isArray(records) || records.length < 1 || records.length > 8) throw new EngineStateError('BATCH_STATE_INVALID');
  const steps: BatchStep[] = [];
  for (const [index, record] of records.entries()) steps.push(parseStep(record, index));
  if (!coherent(steps)) throw new EngineStateError('BATCH_STATE_INVALID');
  return steps;
}
