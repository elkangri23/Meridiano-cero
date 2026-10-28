import { parseEvaluationArgs } from './evaluation-options.ts';
import { arch, cpus, platform, totalmem } from 'node:os';
import { createOllamaProvider, inspectOllama } from './ollama.ts';
import { evaluateDirector, createEvaluationMock } from './evaluation.ts';
import { AiError } from './provider.ts';
import type { AiProvider } from './provider.ts';

async function main() {
  const mode = parseEvaluationArgs(process.argv.slice(2));
  const hardware = { platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown', memoryBytes: totalmem() };
  const base = { recordedAt: new Date().toISOString(), hardware, nodeVersion: process.version };
  const origin = process.env.OLLAMA_ORIGIN ?? 'http://127.0.0.1:11434';
  let provider: AiProvider;
  let metadata: unknown = { mode: 'mock', model: 'deterministic-ci' };
  if (mode.kind === 'mock') provider = createEvaluationMock();
  else {
    let inventory: Awaited<ReturnType<typeof inspectOllama>>;
    try { inventory = await inspectOllama(origin); }
    catch {
      process.stdout.write(JSON.stringify({ ...base, status: 'unavailable', evaluated: false,
        reason: 'No se ha podido consultar Ollama. No se ha instalado ni descargado ningún modelo.' }, null, 2) + '\n');
      process.exitCode = 2;
      return;
    }
    if (mode.kind === 'probe') {
      process.stdout.write(JSON.stringify({ ...base, status: 'available', evaluated: false, inventory }, null, 2) + '\n');
      return;
    }
    const installed = inventory.models.find(item => item.name === mode.model);
    if (!installed) throw new Error('Selecciona el nombre exacto de un modelo ya instalado; usa --probe para listar.');
    provider = createOllamaProvider({ origin, model: installed.name });
    metadata = { mode: 'real', model: installed.name, digest: installed.digest, ollamaVersion: inventory.version,
      configuration: { temperature: 0, numPredict: 512, numCtx: 8192 } };
  }
  const metrics: { operation: string; latencyMs: number; usage: unknown; error: string | null }[] = [];
  const measured: AiProvider = { providerId: provider.providerId, model: provider.model,
    async request(input) {
      const started = performance.now();
      try {
        const response = await provider.request(input);
        metrics.push({ operation: input.operation, latencyMs: response.latencyMs, usage: response.usage, error: null });
        return response;
      } catch (error) {
        metrics.push({ operation: input.operation, latencyMs: Math.round(performance.now() - started), usage: null,
          error: error instanceof AiError ? error.code : 'unavailable' });
        throw error;
      }
    },
  };
  const evaluation = await evaluateDirector(measured);
  process.stdout.write(JSON.stringify({ ...base, status: 'evaluated', metadata, evaluation, metrics,
    scope: 'Corpus sintético; no sustituye evaluación del caso fijo, memoria persistente ni E2E.' }, null, 2) + '\n');
  if (!evaluation.passed) process.exitCode = 1;
}
await main();
