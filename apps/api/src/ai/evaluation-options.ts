export type EvaluationMode =
  | { kind: 'mock' }
  | { kind: 'probe' }
  | { kind: 'model'; model: string }
  | { kind: 'freellmapi' }
  | { kind: 'openai-compatible' };

const SINGLE_FLAG_MODES: Record<string, EvaluationMode> = {
  '--mock': { kind: 'mock' },
  '--probe': { kind: 'probe' },
  '--freellmapi': { kind: 'freellmapi' },
  '--openai-compatible': { kind: 'openai-compatible' },
};

export function parseEvaluationArgs(args: readonly string[]): EvaluationMode {
  if (args.length === 1) {
    const mode = SINGLE_FLAG_MODES[args[0] ?? ''];
    if (mode) return mode;
  }
  const model = args[1];
  if (args.length === 2 && args[0] === '--model' && model?.trim() && !model.startsWith('--')) {
    return { kind: 'model', model };
  }
  throw new Error('Uso: --mock | --probe | --model nombre:etiqueta | --freellmapi | --openai-compatible. Elige un único modo, sin argumentos adicionales.');
}
