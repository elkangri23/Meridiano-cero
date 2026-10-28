import { describe, expect, it } from 'vitest';
import { evaluateDirector, createEvaluationMock } from './evaluation.ts';
import { createMockProvider } from './mock.ts';
import { AiError } from './provider.ts';
import type { AiProvider, AiRequest } from './provider.ts';

describe('Evaluación reproducible sin confundir fallback con calidad del modelo', () => {
  it('ejercita el procedimiento completo, incluida memoria guardada y permisos revocados', async () => {
    const calls: AiRequest[] = [];
    const mock = createEvaluationMock();
    const provider: AiProvider = { ...mock, async request(input) {
      calls.push(input);
      return mock.request(input);
    } };
    const result = await evaluateDirector(provider);
    expect(result.corpusVersion).toBe(2);
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(17);
    const resumed = calls.find(call => call.requestId === 'evaluation-memory-resumed');
    expect(resumed?.context.memory).toEqual({ treatment: 'respectful', turns: [{ act: 'state', factIds: ['receipt'] }] });
    const revoked = calls.find(call => call.requestId === 'evaluation-memory-revoked');
    expect(revoked?.context.facts).toEqual([]);
    expect(JSON.stringify(revoked?.context.memory)).not.toContain('receipt');
    expect(JSON.stringify(calls)).not.toContain('PRIVATE_EVALUATION_SENTINEL');
  });
  it.each(['timeout', 'unavailable', 'invalid_response'] as const)('no aprueba por respaldos factuales cuando el modelo falla con %s', async code => {
    const provider = createMockProvider(() => { throw new AiError(code); });
    const result = await evaluateDirector(provider);
    expect(result.passed).toBe(false);
    expect(result.results.find(item => item.id === 'confirmed-result')).toMatchObject({ passed: false, source: 'fallback' });
    expect(result.results.find(item => item.id === 'ambiguous')?.passed).toBe(false);
  });
  it('no aprueba un modelo que pide aclaración para todas las órdenes claras', async () => {
    const provider = createMockProvider(() => ({ kind: 'clarification', actionIds: [] }));
    const result = await evaluateDirector(provider);
    expect(result.passed).toBe(false);
    expect(result.results.find(item => item.id === 'clear')?.passed).toBe(false);
    expect(result.results.find(item => item.id === 'ambiguous')?.passed).toBe(true);
  });
});
