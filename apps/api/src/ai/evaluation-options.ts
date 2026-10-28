export type EvaluationMode =
  | { kind: 'mock' }
  | { kind: 'probe' }
  | { kind: 'model'; model: string };

export function parseEvaluationArgs(args: readonly string[]): EvaluationMode {
  if (args.length === 1 && args[0] === '--mock') return { kind: 'mock' };
  if (args.length === 1 && args[0] === '--probe') return { kind: 'probe' };
  const model = args[1];
  if (args.length === 2 && args[0] === '--model' && model?.trim() && !model.startsWith('--')) {
    return { kind: 'model', model };
  }
  throw new Error('Uso: --mock | --probe | --model nombre:etiqueta. Elige un único modo, sin argumentos adicionales.');
}
