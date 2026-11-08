import type { PlayerViewDto, TranslateFn } from '@meridiano/contracts';

/** Terminal de inteligencia (GDD §11): consulta en lenguaje natural sobre
 * lo investigado. Módulo PURO, sin importar case-schema (la regla de
 * aislamiento de la web): la pantalla le pasa los textos y los hechos ya
 * resueltos, y este módulo solo decide qué hechos autorizados responden a
 * la pregunta. Lo probatorio solo viene de hechos autorizados: el
 * conocimiento de cada personaje y los textos de las pruebas solo entran si
 * la partida los ha descubierto, nunca del catálogo entero. La redacción es
 * del modelo solo para expresar lo recuperado, nunca para añadir hechos: si
 * no hay hecho que respalde la respuesta, la terminal lo dice y no inventa
 * (la respuesta determinista está en `intelNoRecord(t)`). */

export const INTEL_ID = 'terminal';
export const INTEL_NAME = 'Terminal de inteligencia';
/** Persona, negativa, respuesta sin registro y saludo en el idioma del
 * jugador: la persona alimenta al modelo y el resto se enseña. */
export function intelPersona(t: TranslateFn): string { return t('engine.intel.persona'); }
export function intelRefusal(t: TranslateFn): string { return t('engine.intel.refusal'); }
export function intelNoRecord(t: TranslateFn): string { return t('engine.intel.noRecord'); }
export function intelGreeting(t: TranslateFn): string { return t('engine.intel.greeting'); }
/** Máximo de hechos que se le pasan al modelo por pregunta (el mismo tope
 * que la conversación con personajes). */
export const INTEL_MAX_FACTS = 16;

export interface IntelFact {
  id: string;
  text: string;
}

/** Palabras que no puntúan al buscar hechos: sin ellas, «qué se sabe de»
 * empataría con todo. En los tres idiomas del juego (español, inglés y
 * francés): en francés «le/la» puntuarían como contenido y darían falsos
 * positivos. Las entradas van ya normalizadas (sin acentos, en minúscula),
 * como los tokens que se comparan. */
const STOPWORDS = new Set([
  'que', 'qué', 'se', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'en', 'y', 'o', 'por', 'para', 'con', 'su', 'sus', 'al', 'a', 'es', 'son', 'hay', 'tiene',
  'tienen', 'esta', 'este', 'estas', 'estos', 'esa', 'ese', 'sabes', 'sabe', 'saber', 'sobre',
  'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde', 'quien', 'quién', 'cual', 'cuál',
  'me', 'te', 'le', 'lo', 'mi', 'tu', 'nos', 'os', 'yo', 'tu', 'él', 'ella', 'ellos', 'ellas',
  'fue', 'eran', 'era', 'han', 'ha', 'he', 'has', 'haber', 'ser', 'estar', 'está', 'están',
  // Inglés: what, who, where, when, why, how, which, the, a, an, and, or, of,
  // to, in, on, is, are, was, were, do, does, did, have, has, had, can, could,
  // you, your, i, me, my, we, they, he, she, it, its, this, that, these, those,
  // there, here, about, know, known, tell, please, with, from, for, by, at, as,
  // not, no, yes.
  'what', 'who', 'where', 'when', 'why', 'how', 'which', 'the', 'an', 'and', 'or', 'of',
  'to', 'in', 'on', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'you', 'your', 'i', 'my', 'we', 'they', 'he', 'she', 'it', 'its', 'this',
  'that', 'these', 'those', 'there', 'here', 'about', 'know', 'known', 'tell', 'please',
  'with', 'from', 'for', 'by', 'at', 'as', 'not', 'no', 'yes',
  // Francés: que, quoi, qui, où, quand, comment, pourquoi, le, la, les, un,
  // une, des, de, du, au, aux, et, ou, dans, sur, est, sont, il, elle, ils,
  // elles, nous, vous, je, tu, ce, cet, cette, ces, mon, ton, son, mes, tes,
  // ses, avec, sans, pour, par, chez, savoir, sais, sait, savez, dit, dire,
  // fait, faire, plus, moins, très, bien, pas, ne, si, aussi, comme, tout,
  // tous, toute, toutes, être, avoir, suis, es, êtes, sommes, ont, ai, as,
  // avons, avez.
  'quoi', 'qui', 'ou', 'quand', 'comment', 'pourquoi', 'les', 'des', 'du', 'au', 'aux',
  'dans', 'sur', 'est', 'sont', 'il', 'elle', 'ils', 'elles', 'nous', 'vous', 'je', 'tu',
  'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'avec', 'sans',
  'pour', 'par', 'chez', 'savoir', 'sais', 'sait', 'savez', 'dit', 'dire', 'fait', 'faire',
  'plus', 'moins', 'tres', 'bien', 'pas', 'ne', 'si', 'aussi', 'comme', 'tout', 'tous',
  'toute', 'toutes', 'etre', 'avoir', 'suis', 'etes', 'sommes', 'ont', 'ai', 'as', 'avons', 'avez',
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
  t: TranslateFn;
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
    add(`objetivo:${objective.id}`, input.t('engine.intel.objectiveFact', {
      description: objective.description,
      state: input.t(objective.achieved ? 'engine.team.objectiveAchieved' : 'engine.team.objectivePending'),
    }));
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
