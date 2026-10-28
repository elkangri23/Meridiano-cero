import { describe, expect, it } from 'vitest';
import { parseEvaluationArgs } from './evaluation-options.ts';

describe('Modo explícito de evaluación', () => {
  it.each([
    { args: ['--mock'], expected: { kind: 'mock' } },
    { args: ['--probe'], expected: { kind: 'probe' } },
    { args: ['--model', 'synthetic:local'], expected: { kind: 'model', model: 'synthetic:local' } },
  ])('admite un único modo: $args', ({ args, expected }) => {
    expect(parseEvaluationArgs(args)).toEqual(expected);
  });
  it.each([
    [], ['--model'], ['--model', ''], ['--model', '  '], ['--model', '--mock'],
    ['--mock', '--model', 'synthetic:local'], ['--probe', '--mock'],
    ['--mock', '--unknown'], ['--unknown'], ['--model', 'synthetic:local', '--probe'],
  ].map(args => ({ args })))('rechaza modos ambiguos o incompletos antes de acceder a red: $args', ({ args }) => {
    expect(() => parseEvaluationArgs(args)).toThrow('único modo');
  });
});
