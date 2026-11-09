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

  it('en state el modelo escribe la respuesta, sin copiar los hechos literalmente', () => {
    // Sin esta regla el servidor imprimía los textos factuales verbatim y
    // Marcos volcaba sus dos temas enlatados («Conozco el mercado…»)
    // en vez de contestar a «¿viste algo?» o a «Dame información sobre
    // traslados…»: la respuesta era el tema, no una respuesta.
    expect(prompt).toMatch(/'state'.*CONTESTE a la pregunta usando SOLO lo que dicen esos hechos/s);
    expect(prompt).toMatch(/No copies los textos de los hechos literalmente/s);
    expect(prompt).toMatch(/da la información que los hechos contienen, no te limites a decir que lo conoces/s);
  });
});

describe('validación de salida de conversación', () => {
  it('acepta acknowledge con texto en personaje', () => {
    expect(() => validateGameOutput('converse', { act: 'acknowledge', factIds: [], text: 'Buenos días, hoy hace sol.' })).not.toThrow();
  });
  it('acepta state con texto redactado a partir de los hechos citados', () => {
    expect(() => validateGameOutput('converse', { act: 'state', factIds: ['truth'], text: 'Sí, la recepción quedó registrada esta mañana.' })).not.toThrow();
  });
  it('rechaza state sin texto: en state el modelo escribe la respuesta', () => {
    expect(() => validateGameOutput('converse', { act: 'state', factIds: ['truth'], text: '' })).toThrow('INVALID_OUTPUT');
    expect(() => validateGameOutput('converse', { act: 'state', factIds: ['truth'], text: '   ' })).toThrow('INVALID_OUTPUT');
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

describe('prompt de generación', () => {
  it('la etapa 3 pide los canales remotos de cada NPC (GDD §10)', () => {
    const prompt = buildGameFunctionPrompt('generateCase');
    expect(prompt).toContain('Etapa 3');
    expect(prompt).toContain('channels');
    expect(prompt).toContain('call');
    expect(prompt).toContain('solo habla en persona');
  });

  it('la etapa 4b recibe el presupuesto en minutos y la orientación de rutas cortas', () => {
    const prompt = buildGameFunctionPrompt('generateCase');
    expect(prompt).toContain('budgetMinutes');
    expect(prompt).toContain('720 en corta');
    expect(prompt).toContain('1440 en media');
    expect(prompt).toContain('2880 en larga');
    expect(prompt).toContain('cada viaje entre ciudades cuesta de 120 a 720 minutos');
  });
});
