// El informe final traduce los objetivos a frases desde un catálogo; ese
// catálogo duplica la descripción que trae la definición del expediente, así
// que este test impide que se desvíen: si cambia la definición, el catálogo
// debe cambiar con ella.
import { describe, expect, it } from 'vitest';
import { objectiveText } from '@meridiano/case-schema';
import { astrolabioDefinition } from './fixtures/case-astrolabio.js';

describe('textos del informe final', () => {
  it('cada objetivo del astrolabio se lee con su descripción de la definición', () => {
    for (const objective of astrolabioDefinition.objectives) {
      expect(objectiveText(objective.id)).toBe(objective.description);
    }
  });
});
