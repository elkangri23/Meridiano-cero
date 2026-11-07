import type { PlayerViewDto } from '@meridiano/contracts';

/** Terminal de inteligencia (GDD §11): consulta en lenguaje natural sobre
 * lo investigado. Módulo PURO, sin importar case-schema (la regla de
 * aislamiento de la web): la pantalla le pasa los textos y los hechos ya
 * resueltos, y este módulo solo decide qué hechos autorizados responden a
 * la pregunta. Lo probatorio solo viene de hechos autorizados: el
 * conocimiento de cada personaje y los textos de las pruebas solo entran si
 * la partida los ha descubierto, nunca del catálogo entero. La redacción es
 * del modelo solo para expresar lo recuperado, nunca para añadir hechos: si
 * no hay hecho que respalde la respuesta, la terminal lo dice y no inventa
 * (la respuesta determinista está en `INTEL_NO_RECORD`). */

export const INTEL_ID = 'terminal';
export const INTEL_NAME = 'Terminal de inteligencia';
export const INTEL_PERSONA = 'Eres la terminal de inteligencia de A.C.M.E., un archivo consultable. Respondes con frases cortas y formales, en primera persona, solo con lo que dicen los registros citados. Nunca inventas hechos del caso, nunca revelas culpabilidad y nunca dices quién es el culpable salvo que un registro citado lo afirme. Si un dato no está en los registros citados, di que no consta.';
export const INTEL_REFUSAL = 'Sin registro en los archivos consultados. La ausencia de registro no demuestra inocencia.';
export const INTEL_NO_RECORD = 'Sin registro en los archivos consultados. La ausencia de registro no demuestra inocencia.';
export const INTEL_GREETING = 'Terminal de inteligencia de A.C.M.E. Pregunta por lo investigado: sospechosos, pruebas, lugares. Solo respondo con lo que consta en los registros.';
/** Máximo de hechos que se le pasan al modelo por pregunta (el mismo tope
 * que la conversación con personajes). */
export const INTEL_MAX_FACTS = 16;

export interface IntelFact {
  id: string;
  text: string;
}

/** Palabras que no puntúan al buscar hechos: sin ellas, «qué se sabe de»
 * empataría con todo. */
const STOPWORDS = new Set([
  'que', 'qué', 'se', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'en', 'y', 'o', 'por', 'para', 'con', 'su', 'sus', 'al', 'a', 'es', 'son', 'hay', 'tiene',
  'tienen', 'esta', 'este', 'estas', 'estos', 'esa', 'ese', 'sabes', 'sabe', 'saber', 'sobre',
  'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde', 'quien', 'quién', 'cual', 'cuál',
  'me', 'te', 'le', 'lo', 'mi', 'tu', 'nos', 'os', 'yo', 'tu', 'él', 'ella', 'ellos', 'ellas',
  'fue', 'eran', 'era', 'han', 'ha', 'he', 'has', 'haber', 'ser', 'estar', 'está', 'están',
]);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(value: string): string[] {
  return normalize(value).split(/[^a-z0-9]+/).filter(token => token.length > 1 && !STOPWORDS.has(token));
}

function bigrams(list: string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index + 1 < list.length; index++) out.push(`${list[index]} ${list[index + 1]}`);
  return out;
}

/** Hechos autorizados para la terminal, desde el estado de la partida:
 * - cada hallazgo del dossier con su texto del expediente (pruebas,
 *   identidades y lugares ya descubiertos; nunca el catálogo entero),
 * - los objetivos del caso con su estado (lo que se busca, no la verdad),
 * - el resumen del caso y lo que la partida ha oído de los personajes en
 *   las conversaciones registradas (lo que `heard` trae ya citado).
 * `textForDiscovery` es el `discoveryText` de la pantalla con los textos
 * del expediente; si devuelve el ID crudo, ese hallazgo no entra. */
export function buildIntelFacts(input: {
  dossier: string[];
  objectives: Array<{ id: string; description: string; achieved: boolean }>;
  briefing: PlayerViewDto['briefing'];
  heard: Array<{ id: string; text: string }>;
  textForDiscovery: (id: string) => string;
}): IntelFact[] {
  const facts: IntelFact[] = [];
  const seen = new Set<string>();
  const add = (id: string, text: string) => {
    if (!text.trim() || seen.has(id)) return;
    seen.add(id);
    facts.push({ id, text });
  };
  for (const entry of input.dossier) {
    if (entry.startsWith('travel:')) continue;
    const text = input.textForDiscovery(entry);
    if (text !== entry) add(`dossier:${entry}`, text);
  }
  for (const objective of input.objectives) {
    add(`objetivo:${objective.id}`, `Objetivo: ${objective.description}. Estado: ${objective.achieved ? 'logrado' : 'pendiente'}.`);
  }
  if (input.briefing) {
    add('caso-resumen', `${input.briefing.speaker}: ${input.briefing.paragraphs.join(' ')}`);
  }
  for (const item of input.heard) add(item.id, item.text);
  return facts;
}

/** Hechos que responden a la pregunta, por solapamiento de palabras (con
 * peso doble a las parejas de palabras): determinista, sin modelo. Devuelve
 * como mucho `INTEL_MAX_FACTS`, ordenados por relevancia; vacío cuando
 * ningún hecho comparte palabra con la pregunta, y entonces la terminal
 * responde que no hay registro, sin llamar al modelo. */
export function selectIntelFacts(question: string, facts: IntelFact[]): IntelFact[] {
  const questionTokens = new Set(tokens(question));
  const questionBigrams = new Set(bigrams(tokens(question)));
  if (questionTokens.size === 0) return [];
  const scored = facts
    .map(fact => {
      const factTokens = new Set(tokens(fact.text));
      const factBigrams = new Set(bigrams(tokens(fact.text)));
      let score = 0;
      for (const token of questionTokens) if (factTokens.has(token)) score += 1;
      for (const bigram of questionBigrams) if (factBigrams.has(bigram)) score += 2;
      return { fact, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id));
  return scored.slice(0, INTEL_MAX_FACTS).map(item => item.fact);
}
