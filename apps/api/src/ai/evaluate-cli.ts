import { parseEvaluationArgs, type EvaluationMode } from './evaluation-options.ts';
import { arch, cpus, platform, totalmem } from 'node:os';
import { createOllamaProvider, inspectOllama } from './ollama.ts';
import { buildProviderFromAdapter } from './provider-factory.ts';
import { evaluateDirector, createEvaluationMock } from './evaluation.ts';
import { AiError } from './provider.ts';
import type { AiProvider } from './provider.ts';

function envProviderConfig(prefix: string): { baseUrl: string; apiKey: string; model: string } | null {
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  const model = process.env[`${prefix}_MODEL`];
  if (!baseUrl || apiKey === undefined || !model) return null;
  return { baseUrl, apiKey, model };
}

interface EvalBase { recordedAt: string; hardware: { platform: string; arch: string; cpu: string; memoryBytes: number }; nodeVersion: string }

function writeJsonLine(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function writeUnavailable(base: EvalBase, reason: string): void {
  writeJsonLine({ ...base, status: 'unavailable', evaluated: false, reason });
  process.exitCode = 2;
}

interface SelectedProvider { provider: AiProvider; metadata: unknown }

/** Elige el proveedor según el modo; escribe el resultado y devuelve null si no hay nada que evaluar. */
async function selectProvider(mode: EvaluationMode, base: EvalBase, origin: string): Promise<SelectedProvider | null> {
  if (mode.kind === 'mock') {
    return { provider: createEvaluationMock(), metadata: { mode: 'mock', model: 'deterministic-ci' } };
  }
  if (mode.kind === 'freellmapi' || mode.kind === 'openai-compatible') {
    // Evaluación real contra un endpoint OpenAI-compatible (FreeLLMAPI del
    // VPS o LM Studio). La clave se lee solo del entorno, nunca se imprime.
    const prefix = mode.kind === 'freellmapi' ? 'FREELLMAPI' : 'OPENAI_COMPAT';
    const envConfig = envProviderConfig(prefix);
    if (!envConfig) {
      writeUnavailable(base, `Faltan ${prefix}_BASE_URL, ${prefix}_API_KEY o ${prefix}_MODEL en el entorno.`);
      return null;
    }
    return {
      provider: buildProviderFromAdapter(mode.kind, envConfig),
      metadata: { mode: 'real', provider: mode.kind, model: envConfig.model, baseUrl: envConfig.baseUrl,
        configuration: { temperature: 0.3, topP: 0.9 } },
    };
  }
  let inventory: Awaited<ReturnType<typeof inspectOllama>>;
  try { inventory = await inspectOllama(origin); }
  catch {
    writeUnavailable(base, 'No se ha podido consultar Ollama. No se ha instalado ni descargado ningún modelo.');
    return null;
  }
  if (mode.kind === 'probe') {
    writeJsonLine({ ...base, status: 'available', evaluated: false, inventory });
    return null;
  }
  const installed = inventory.models.find(item => item.name === mode.model);
  if (!installed) throw new Error('Selecciona el nombre exacto de un modelo ya instalado; usa --probe para listar.');
  return {
    provider: createOllamaProvider({ origin, model: installed.name }),
    metadata: { mode: 'real', model: installed.name, digest: installed.digest, ollamaVersion: inventory.version,
      configuration: { temperature: 0, numPredict: 512, numCtx: 8192 } },
  };
}

async function main() {
  const mode = parseEvaluationArgs(process.argv.slice(2));
  const hardware = { platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown', memoryBytes: totalmem() };
  const base = { recordedAt: new Date().toISOString(), hardware, nodeVersion: process.version };
  const origin = process.env.OLLAMA_ORIGIN ?? 'http://127.0.0.1:11434';
  const selected = await selectProvider(mode, base, origin);
  if (!selected) return;
  const provider = selected.provider;
  const metadata = selected.metadata;
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
  writeJsonLine({ ...base, status: 'evaluated', metadata, evaluation, metrics,
    scope: 'Corpus sintético; no sustituye evaluación del caso fijo, memoria persistente ni E2E.' });
  if (!evaluation.passed) process.exitCode = 1;
}
await main();
