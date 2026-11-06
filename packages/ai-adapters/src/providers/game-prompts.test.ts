// El prompt de conversación fija cuándo se usa cada acto de habla: la
// negativa ('decline') es solo para declarar sobre el robo. Sin esta
// semántica, el modelo se negaba a todo con Inés (persona «Sospechosa» y
// un solo hecho conocido): cualquier pregunta que el hecho no respondía
// salía como «No puedo responder a esa consulta.».
import { describe, expect, it } from 'vitest';
import { buildGameFunctionPrompt, validateGameOutput } from './game-prompts.js';

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

  it('las preguntas vagas sobre lo visto se responden con sus hechos, nunca con decline', () => {
    // Sin esta regla el modelo negaba «¿viste algo?» y «¿Qué objetos había?»
    // con decline: la frase «si ningún hecho las respalda, niégate, calla o
    // desvía» le daba la negativa como opción para la incertidumbre.
    expect(prompt).toMatch(/¿viste algo\?.*se responden con sus hechos autorizados \('state'\)/s);
    expect(prompt).toMatch(/nunca con 'decline'/s);
    expect(prompt).not.toContain('niégate, calla o desvía');
    expect(prompt).toMatch(/desvía en personaje \('acknowledge'\) sin inventar/s);
  });
});

describe('validación de salida de conversación', () => {
  it('acepta acknowledge con texto en personaje', () => {
    expect(() => validateGameOutput('converse', { act: 'acknowledge', factIds: [], text: 'Buenos días, hoy hace sol.' })).not.toThrow();
  });
  it('acepta state sin texto (el servidor muestra los textos factuales)', () => {
    expect(() => validateGameOutput('converse', { act: 'state', factIds: ['truth'], text: '' })).not.toThrow();
  });
  it('rechaza acknowledge sin texto, acto desconocido, campo extra y texto desmesurado', () => {
    for (const bad of [
      { act: 'acknowledge', factIds: [], text: '' },
      { act: 'acknowledge', factIds: [], text: '   ' },
      { act: 'inform', factIds: [], text: 'Hola.' },
      { act: 'acknowledge', factIds: [] },
      { act: 'acknowledge', factIds: [], text: 'x'.repeat(601) },
      { act: 'acknowledge', factIds: [], text: 'Hola.', extra: true },
      { act: 'acknowledge', factIds: ['a', 'a'], text: 'Hola.' },
    ]) expect(() => validateGameOutput('converse', bad)).toThrow('INVALID_OUTPUT');
  });
  it('narrateResult sigue sin aceptar texto libre', () => {
    expect(() => validateGameOutput('narrateResult', { act: 'state', factIds: ['x'], text: 'prosa' })).toThrow('INVALID_OUTPUT');
    expect(() => validateGameOutput('narrateResult', { act: 'state', factIds: ['x'] })).not.toThrow();
  });
});
