// El prompt de conversación fija cuándo se usa cada acto de habla: la
// negativa ('decline') es solo para declarar sobre el robo. Sin esta
// semántica, el modelo se negaba a todo con Inés (persona «Sospechosa» y
// un solo hecho conocido): cualquier pregunta que el hecho no respondía
// salía como «No puedo responder a esa consulta.».
import { describe, expect, it } from 'vitest';
import { buildGameFunctionPrompt } from './game-prompts.js';

describe('prompt de conversación', () => {
  const prompt = buildGameFunctionPrompt('converse');

  it('define cada acto y reserva decline para declarar sobre el robo', () => {
    expect(prompt).toContain("'decline'");
    expect(prompt).toMatch(/decline.*SOLO cuando la pregunta pide declarar sobre el robo/s);
    expect(prompt).toMatch(/'state'.*hechos autorizados/s);
    expect(prompt).toMatch(/'acknowledge'.*NO se puede responder con los hechos autorizados/s);
  });

  it('solo ofrece los cuatro actos válidos del director', () => {
    for (const act of ['state', 'acknowledge', 'decline', 'silence']) {
      expect(prompt).toContain(`'${act}'`);
    }
    for (const invalid of ['inform', 'question', 'refusal', 'evasion']) {
      expect(prompt).not.toContain(`'${invalid}'`);
    }
  });

  it('sobre identidad, tarea y lo visto el NPC responde, nunca se niega', () => {
    expect(prompt).toMatch(/identidad, su tarea y lo que vio.*responde con los hechos autorizados/s);
    expect(prompt).toMatch(/nunca se niega a eso/s);
  });
});
