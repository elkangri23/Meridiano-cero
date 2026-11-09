// Traducciones del contenido de los casos: las ciudades usan siempre la
// grafía española en la prosa traducida (decisión de Antonio, 2026-11-09):
// París, Barcelona, Lisboa, Málaga. Nunca exónimos (Paris, Lisbon,
// Lisbonne, Barcelone, Malaga). Las claves en minúscula (p. ej.
// 'texts.knowledge.avistamiento-malaga') son identificadores y no se
// tocan: este test solo mira los VALORES.
import { describe, expect, it } from 'vitest';
import { CASE_EN } from './cases-en.js';
import { CASE_FR } from './cases-fr.js';

const EXONYMS = /\b(Paris|Lisbon|Lisbonne|Barcelone|Malaga)\b/;

describe('prosa de los casos: ciudades con grafía española', () => {
  it.each([
    ['en', CASE_EN],
    ['fr', CASE_FR],
  ] as const)('en %s ningún texto usa exónimos de ciudades', (_lang, table) => {
    for (const [caseId, fields] of Object.entries(table)) {
      for (const [key, value] of Object.entries(fields)) {
        expect(value, `${caseId}:${key}`).not.toMatch(EXONYMS);
      }
    }
  });

  it('el astrolabio nombra París y Lisboa con grafía española en EN y FR', () => {
    expect(CASE_EN['astrolabio-tres-ciudades']?.['texts.evidence.EV-01']).toContain('París archive');
    expect(CASE_EN['astrolabio-tres-ciudades']?.['texts.evidence.EV-05']).toContain('Lisboa');
    expect(CASE_EN['astrolabio-tres-ciudades']?.['briefing.p1']).toContain('París and Lisboa');
    expect(CASE_FR['astrolabio-tres-ciudades']?.['texts.evidence.EV-01']).toContain('archives de París');
    expect(CASE_FR['astrolabio-tres-ciudades']?.['texts.evidence.EV-05']).toContain('Lisboa');
    expect(CASE_FR['astrolabio-tres-ciudades']?.['briefing.p1']).toContain('à París et à Lisboa');
  });
});
