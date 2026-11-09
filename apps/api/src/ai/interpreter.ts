// Emparejador determinista de órdenes de texto libre para el intérprete
// (lote intérprete de texto libre, 2026-11-09). El intérprete es un LLM
// y confundía las acciones que comparten palabras —«orden», «detención»,
// «detener», «solicitar», «coordinar»—: pedir una orden se leía como
// cerrar el caso y coordinar una detención como solicitar la orden. Este
// pre-paso resuelve las tres lecturas documentadas SIN llamar al modelo,
// solo cuando el emparejamiento es único y sin ambigüedad; todo lo demás
// sigue yendo al LLM como hasta ahora.
//
// Reglas:
// - Solo se emparejan tres tipos: pedir orden (`request_warrant:*`),
//   detener (`detain:*`) y cerrar el caso (`finish`). Hablar,
//   inspeccionar, viajar, recoger, consultar o analizar no cambian.
// - El tipo lo decide la PRIMERA palabra de acción del texto: el verbo
//   de petición («solicitar», «pedir», «request», «demander»…) o el
//   sustantivo de orden («orden», «warrant», «mandat») mandan orden; el
//   verbo de detener/coordinar («detener», «arrest», «coordinar»…) o el
//   sustantivo de detención («detención», «arrest», «arrestation») mandan
//   detención. Así «Solicitar orden de detención» es orden (la
//   «detención» va subordinada a la orden) y «Coordinar la detención» es
//   detención.
// - Si el texto mezcla dos tipos sin subordinación («Detén a Inés y pide
//   una orden», «Cerrar el caso y pedir una orden») no se empareja: son
//   varias acciones y decide el LLM.
// - Si el texto nombra a una persona, solo vale la oferta de ese
//   sospechoso: pedir detener a Tomás con la detención de Inés ofrecida
//   no devuelve la detención de Inés.
// - Las palabras clave se prueban en español, inglés y francés a la vez
//   (no colisionan entre idiomas).
import type { LockedAction, LockedMissing } from '@meridiano/engine';
import type { ActionOffer } from './context.ts';

export type InterpreterActionType = 'warrant' | 'detain' | 'finish';

/** Acción bloqueada que el texto pide: el tipo, el sospechoso (o null
 * cuando el texto no nombra a nadie y todos los bloqueos coinciden) y
 * lo que falta para poder hacerla. */
export interface LockedMatch {
  type: 'warrant' | 'detain';
  suspectName: string | null;
  missing: LockedMissing[];
}

/** Normaliza para comparar: minúsculas, sin acentos, puntuación a
 * espacios, espacios colapsados. «Inés» → `ines`, «Tomás» → `tomas`. */
export function normalizeInterpreterText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Frases que nombran la orden sin ambigüedad (la «detención» va
// subordinada a la orden): se sustituyen por un marcador antes de
// buscar palabras sueltas, porque «arrest warrant» empieza por «arrest».
const WARRANT_PHRASES = [
  'arrest warrant', 'orden de detencion', 'orden de arresto',
  'mandat d arret', 'mandat de detention', 'detention order',
];

const REQUEST_VERBS = [
  'solicitar', 'solicito', 'solicita', 'soliciten', 'pedir', 'pido', 'pide', 'pidan',
  'obtener', 'request', 'requests', 'requesting', 'ask', 'asks', 'asking',
  'demander', 'demande', 'demandent', 'solliciter', 'sollicite', 'sollicitent', 'obtenir',
];
const WARRANT_NOUNS = ['orden', 'ordenes', 'warrant', 'warrants', 'mandat', 'mandats', 'warrantphrase'];
const DETAIN_VERBS = [
  'detener', 'detengo', 'detiene', 'deten', 'detengan', 'detenerla', 'detenerlo', 'detenga', 'detengas',
  'arrest', 'arrests', 'arresting', 'arresten', 'arreste', 'arresta', 'arrestan',
  'arreter', 'arrete', 'arretez', 'arretent',
  'coordinar', 'coordina', 'coordino', 'coordinen',
  'coordinate', 'coordinates', 'coordinating', 'coordonner', 'coordonne', 'coordonnez',
];
const DETAIN_NOUNS = [
  'detencion', 'detenciones', 'arrest', 'arrests', 'arrestation', 'arrestations',
  'detention', 'detentions',
];
const FINISH_PHRASES = [
  'cerrar el caso', 'cerrar caso', 'terminar el caso', 'finalizar el caso',
  'presentar el informe', 'close the case', 'present the report',
  'clore le dossier', 'presenter le rapport',
];

// Palabras que introducen un complemento de finalidad («para detener»):
// lo que sigue va subordinado a la acción principal, no es otra acción.
const PURPOSE_WORDS = [' para ', ' to ', ' pour '];

/** Palabras de acción con su posición y tipo, en orden de aparición. */
interface WordHit { index: number; type: InterpreterActionType }
function wordHits(normalized: string): WordHit[] {
  const hits: WordHit[] = [];
  const find = (words: string[], type: InterpreterActionType): void => {
    for (const word of words) {
      let from = 0;
      for (;;) {
        const index = normalized.indexOf(word, from);
        if (index < 0) break;
        const before = index === 0 || normalized[index - 1] === ' ';
        const after = index + word.length === normalized.length || normalized[index + word.length] === ' ';
        if (before && after) hits.push({ index, type });
        from = index + word.length;
      }
    }
  };
  find(REQUEST_VERBS, 'warrant');
  find(WARRANT_NOUNS, 'warrant');
  find(DETAIN_VERBS, 'detain');
  find(DETAIN_NOUNS, 'detain');
  return hits.sort((a, b) => a.index - b.index);
}

/** El tipo de acción que pide el texto, o null si no es una de las tres
 * o si mezcla dos tipos sin subordinación. */
export function detectInterpreterType(text: string): InterpreterActionType | null {
  let normalized = ' ' + normalizeInterpreterText(text) + ' ';
  for (const phrase of WARRANT_PHRASES) {
    normalized = normalized.replaceAll(' ' + phrase + ' ', ' warrantphrase ');
  }
  const finishAt = FINISH_PHRASES
    .map(phrase => normalized.indexOf(' ' + phrase + ' '))
    .filter(index => index >= 0);
  const hits = wordHits(normalized);
  if (finishAt.length > 0) {
    // «Cerrar el caso» solo vale si no hay palabras de orden/detención:
    // si las hay, son varias acciones y decide el LLM.
    return hits.length === 0 ? 'finish' : null;
  }
  if (hits.length === 0) return null;
  const first = hits[0];
  if (!first) return null;
  for (const hit of hits.slice(1)) {
    if (hit.type === first.type) continue;
    // Subordinado: el segundo tipo va tras una finalidad («para
    // detener») o es la «detención» de la propia orden.
    const between = normalized.slice(first.index, hit.index);
    if (PURPOSE_WORDS.some(word => between.includes(word))) continue;
    return null;
  }
  return first.type;
}

/** Tokens de nombre de un sospechoso a partir de su id de oferta
 * (`ines`, `marcos-ruiz` → `marcos`, `ruiz`) o de su nombre completo
 * (`Inés Valera` → `ines`, `valera`). */
function nameTokens(value: string): string[] {
  return normalizeInterpreterText(value).split(' ').filter(token => token.length >= 3);
}

/** ¿El texto nombra a este sospechoso? Basta con un token (nombre o
 * apellido): «Detener a Marcos Ruiz» nombra a `marcos-ruiz`. */
function namesSuspect(normalized: string, tokens: string[]): boolean {
  const padded = ' ' + normalized + ' ';
  return tokens.some(token => padded.includes(' ' + token + ' '));
}

/** El mensaje de aclaración en español para una acción bloqueada: qué
 * falta para poder hacerla, sin inventar otra acción. La web lo compone
 * en el idioma del jugador desde las claves de locales
 * (`game.interpret.*`); este texto es el respaldo del servidor para
 * otros consumidores de la API. */
const LOCKED_MISSING_ES: Record<LockedMissing, string> = {
  suspect_unknown: 'Primero tienes que conocer a la persona: habla con esa persona o encuentra pruebas que la señalen.',
  no_authorizing_evidence: 'Te faltan pruebas que autoricen la orden.',
  warrant_pending: 'La orden está en curso: espera a que se resuelva.',
  warrant_granted: 'Ya tienes la orden.',
  no_warrant: 'Primero necesitas una orden válida.',
  location_unknown: 'Aún no sabes dónde está esa persona.',
  identity_unknown: 'Aún no conoces la identidad de esa persona.',
  not_at_location: 'Para detener en persona tienes que estar en el mismo lugar que esa persona.',
  already_detained: 'Ya has detenido a esa persona.',
};
export function lockedMessageEs(match: LockedMatch): string {
  const intro = match.type === 'warrant'
    ? (match.suspectName ? `Todavía no puedes pedir una orden contra ${match.suspectName}.` : 'Todavía no puedes pedir una orden.')
    : (match.suspectName ? `Todavía no puedes detener a ${match.suspectName}.` : 'Todavía no puedes detener a nadie.');
  return [intro, ...match.missing.map(code => LOCKED_MISSING_ES[code])].join(' ');
}

/** Ids de las ofertas de este tipo que nombra el texto. */
function namedOfferIds(candidates: readonly ActionOffer[], normalized: string, prefix: string): string[] {
  return candidates
    .filter(offer => namesSuspect(normalized, nameTokens(offer.id.slice(prefix.length))))
    .map(offer => offer.id);
}

/** ¿El texto nombra a un sospechoso bloqueado de este tipo? Si es así,
 * no se devuelve la oferta de otro sospechoso. */
function namesLockedSuspect(locked: readonly LockedAction[], type: InterpreterActionType, normalized: string): boolean {
  return locked.some(entry => entry.type === type &&
    namesSuspect(normalized, nameTokens(entry.suspectName)));
}

/** Prefijo de id de oferta para cada tipo de acción. */
function offerPrefix(type: InterpreterActionType): string {
  if (type === 'warrant') return 'request_warrant:';
  if (type === 'detain') return 'detain:';
  return 'finish';
}

/** El id cuando queda una sola oferta candidata, o null. */
function singleOfferId(candidates: readonly ActionOffer[]): string | null {
  if (candidates.length !== 1) return null;
  const only = candidates[0];
  return only ? only.id : null;
}

/** La oferta de este tipo que pide el texto, o null si no hay una única
 * sin ambigüedad. `locked` sirve para no devolver la oferta de otro
 * sospechoso cuando el texto nombra a uno bloqueado. */
export function matchOfferedAction(
  text: string, offers: readonly ActionOffer[], locked: readonly LockedAction[] = [],
): string | null {
  const type = detectInterpreterType(text);
  if (type === null) return null;
  const prefix = offerPrefix(type);
  const candidates = offers.filter(offer => offer.id === prefix || offer.id.startsWith(prefix));
  if (candidates.length === 0) return null;
  if (type === 'finish') return singleOfferId(candidates);
  const normalized = normalizeInterpreterText(text);
  const named = namedOfferIds(candidates, normalized, prefix);
  if (named.length > 1) return null;
  if (named.length === 1) return named[0] ?? null;
  // El texto no nombra a nadie de los ofrecidos: si nombra a un
  // sospechoso bloqueado de este tipo, no se devuelve la oferta de otro.
  if (namesLockedSuspect(locked, type, normalized)) return null;
  return singleOfferId(candidates);
}

/** La acción bloqueada que pide el texto, o null si no pide una
 * bloqueada. Sin nombre y con varios sospechosos bloqueados con los
 * MISMOS motivos, la respuesta es genérica (sin nombre): lo que falta es
 * lo mismo para todos. Si los motivos difieren, no se puede saber a
 * quién se refiere y decide el LLM. */
export function matchLockedAction(text: string, locked: readonly LockedAction[]): LockedMatch | null {
  const type = detectInterpreterType(text);
  if (type === null || type === 'finish') return null;
  const candidates = locked.filter(entry => entry.type === type);
  if (candidates.length === 0) return null;
  const normalized = normalizeInterpreterText(text);
  const named = candidates.filter(entry => namesSuspect(normalized, nameTokens(entry.suspectName)));
  if (named.length > 1) return null;
  if (named.length === 1) {
    const only = named[0];
    return only ? { type, suspectName: only.suspectName, missing: only.missing } : null;
  }
  return unnamedLockedMatch(type, candidates);
}

/** Tipo de acción de un id de oferta (`request_warrant:ines` → orden,
 * `detain:ines` → detención, `finish` → cierre), o null si no es una
 * de las tres. */
export function offeredActionType(id: string): InterpreterActionType | null {
  if (id === 'finish' || id.startsWith('finish:')) return 'finish';
  if (id.startsWith('request_warrant:')) return 'warrant';
  if (id.startsWith('detain:')) return 'detain';
  return null;
}

/** Bloqueo sin nombre en el texto: uno solo, o varios con los mismos
 * motivos (respuesta genérica); con motivos distintos no se sabe a quién
 * se refiere. */
function unnamedLockedMatch(type: 'warrant' | 'detain', candidates: readonly LockedAction[]): LockedMatch | null {
  const first = candidates[0];
  if (!first) return null;
  if (candidates.length === 1) {
    return { type, suspectName: first.suspectName, missing: first.missing };
  }
  const firstMissing = JSON.stringify(first.missing);
  if (candidates.every(entry => JSON.stringify(entry.missing) === firstMissing)) {
    return { type, suspectName: null, missing: first.missing };
  }
  return salientLockedMatch(type, candidates);
}

/** Sin nombre y con motivos distintos: si un único sospechoso tiene una
 * orden en curso o (para la orden) ya concedida, ese es el estado
 * saliente — el jugador pregunta por la orden que conoce — y la
 * aclaración lo nombra. Si no hay uno solo, no se adivina. */
function salientLockedMatch(type: 'warrant' | 'detain', candidates: readonly LockedAction[]): LockedMatch | null {
  const salient = candidates.filter(entry =>
    entry.missing.includes('warrant_pending') ||
    (type === 'warrant' && entry.missing.includes('warrant_granted')));
  if (salient.length !== 1) return null;
  const only = salient[0];
  return only ? { type, suspectName: only.suspectName, missing: only.missing } : null;
}
