import type { CareerProfileDto, PlayerViewDto } from '@meridiano/contracts';
import type { LocaleKey, TranslateFn } from '@meridiano/contracts';

/** Equipo recurrente A.C.M.E. (GDD §8) en la web: módulo PURO, sin importar
 * case-schema (la regla de aislamiento de la web). El catálogo de miembros
 * es el del GDD (nombres provisionales) y se mantiene sincronizado con el
 * del motor (`packages/case-schema/src/team.ts`); los servicios y sus
 * respuestas salen solo de la vista del jugador, nunca del catálogo
 * entero: el equipo nunca indica si se va bien, ni señala al culpable ni
 * sugiere la siguiente pista. */

export type TeamMemberId = 'margaret' | 'richter' | 'elena' | 'david' | 'clara';
export type TeamServiceId = 'briefing' | 'explain' | 'lookup' | 'coordinate' | 'routes' | 'organize' | 'evaluate';

export interface TeamMemberDisplay {
  id: TeamMemberId;
  name: string;
  /** Claves i18n: la web las resuelve con `t()` (nombres propios no se traducen). */
  role: LocaleKey;
  blurb: LocaleKey;
}

export const TEAM_MEMBERS: readonly TeamMemberDisplay[] = [
  { id: 'margaret', name: 'Margaret Sullivan', role: 'team.role.margaret',
    blurb: 'team.blurb.margaret' },
  { id: 'richter', name: 'Dr. Samuel Richter', role: 'team.role.richter',
    blurb: 'team.blurb.richter' },
  { id: 'elena', name: 'Elena Vázquez', role: 'team.role.elena',
    blurb: 'team.blurb.elena' },
  { id: 'david', name: 'David Nakamura', role: 'team.role.david',
    blurb: 'team.blurb.david' },
  { id: 'clara', name: 'Clara Beaumont', role: 'team.role.clara',
    blurb: 'team.blurb.clara' },
];

/** Claves i18n de las etiquetas de servicio (el texto vive en `locales/es.ts`). */
export const TEAM_SERVICE_KEYS: Record<TeamServiceId, LocaleKey> = {
  briefing: 'labels.teamService.briefing',
  explain: 'labels.teamService.explain',
  lookup: 'labels.teamService.lookup',
  coordinate: 'labels.teamService.coordinate',
  routes: 'labels.teamService.routes',
  organize: 'labels.teamService.organize',
  evaluate: 'labels.teamService.evaluate',
};

/** Elena Vázquez como interlocutora: la misma consulta determinista que la
 * terminal de inteligencia, con su persona. Sin hecho que respalde la
 * respuesta, lo dice y no llama al modelo (la misma regla que la terminal).
 * Las frases salen de `t()` en el idioma del jugador, no de constantes en
 * español: la persona alimenta al modelo y el saludo y la negativa se
 * enseñan. */
export const ELENA_ID = 'elena';
export const ELENA_NAME = 'Elena Vázquez';
export function elenaPersona(t: TranslateFn): string { return t('engine.team.elenaPersona'); }
export function elenaRefusal(t: TranslateFn): string { return t('engine.team.elenaRefusal'); }
export function elenaGreeting(t: TranslateFn): string { return t('engine.team.elenaGreeting'); }
export function teamGreeting(t: TranslateFn): string { return t('engine.team.greeting'); }

/** Respuesta de un servicio determinista desde la vista, o null si el
 * servicio no tiene respuesta calculable (la consulta de Elena y la
 * coordinación de David van por otro camino). La evaluación de carrera
 * necesita además el perfil (`career`): sin perfil cargado no hay
 * evaluación (null); con el perfil vacío, la respuesta dice que la
 * carrera empieza con el primer cierre. */
export function teamServiceAnswer(serviceId: TeamServiceId, view: PlayerViewDto, targetId: string | undefined, career: CareerProfileDto | null | undefined, t: TranslateFn): string | null {
  switch (serviceId) {
    case 'briefing': return briefingAnswer(view, t);
    case 'explain': return targetId ? explainAnswer(view, targetId, t) : null;
    case 'routes': return routesAnswer(view, t);
    case 'organize': return organizeAnswer(view, t);
    case 'evaluate': return career ? evaluateAnswer(career, t) : null;
    default: return null;
  }
}

/** La frase con la que el jugador pide el servicio: texto fijo para los
 * servicios deterministas (la consulta de Elena lleva la pregunta real). */
export function teamRequestText(serviceId: TeamServiceId, targetId: string | undefined, t: TranslateFn): string {
  switch (serviceId) {
    case 'briefing': return t('team.request.briefing');
    case 'explain': return t('team.request.explain', { targetId: targetId ?? '' });
    case 'routes': return t('team.request.routes');
    case 'organize': return t('team.request.organize');
    case 'evaluate': return t('team.request.evaluate');
    case 'coordinate': return t('team.request.coordinate');
    case 'lookup': return t('team.request.lookup');
  }
}

/** Etiqueta legible de una medalla de carrera. */
export function medalLabel(medal: string | null, t: TranslateFn): string {
  if (medal === 'medalla-oro') return t('labels.medal.gold');
  if (medal === 'medalla-plata') return t('labels.medal.silver');
  return t('labels.medal.none');
}

/** Margaret evalúa la carrera: solo el perfil oficial (rango, puntos,
 * casos, medallas, reputación y sanciones activas). Nunca valora el caso
 * en curso ni dice si se va bien: la carrera solo cuenta cierres. */
export function evaluateAnswer(career: CareerProfileDto, t: TranslateFn): string {
  if (career.totalCases === 0) {
    return t('engine.team.evaluateEmpty');
  }
  const parts: string[] = [];
  parts.push(t('engine.team.evaluateLine', {
    rank: career.rank, points: career.points, total: career.totalCases,
    caseWord: t(career.totalCases === 1 ? 'engine.team.caseOne' : 'engine.team.caseMany'),
    completed: career.completedCases,
    resolvedWord: t(career.completedCases === 1 ? 'engine.team.resolvedOne' : 'engine.team.resolvedMany'),
  }));
  parts.push(t('engine.team.evaluateReputation', {
    prestige: career.prestigeLabel.toLowerCase(), integrity: career.integrityLabel.toLowerCase(), trust: career.trustLabel.toLowerCase(),
  }));
  if (career.medals.length > 0) {
    parts.push(t('engine.team.evaluateMedals', { list: career.medals.map(medal => medalLabel(medal, t)).join(', ') }));
  }
  const active = career.sanctions.filter(sanction => sanction.active);
  if (active.length > 0) {
    parts.push(t(active.length === 1 ? 'engine.team.evaluateSanctionOne' : 'engine.team.evaluateSanctionsMany', {
      count: active.length, reasons: active.map(sanction => sanction.reason).join('; '),
    }));
  } else if (career.sanctions.length > 0) {
    parts.push(t('engine.team.evaluateSanctionResolved'));
  }
  return parts.join(' ');
}

/** Margaret sobre el encargo: la introducción del caso tal como la
 * presentó ella, más los objetivos con su estado. Nunca valora si se va
 * bien: solo recuerda qué se encargó y qué falta. */
export function briefingAnswer(view: PlayerViewDto, t: TranslateFn): string {
  const lines: string[] = [];
  if (view.briefing) {
    lines.push(`${view.briefing.speaker}: ${view.briefing.paragraphs.join(' ')}`);
  } else {
    lines.push(t('engine.team.briefingFallback'));
  }
  lines.push(t('engine.team.briefingObjectives', { list: view.objectives.map(objective =>
    `${objective.description} (${objective.achieved ? t('engine.team.objectiveAchieved') : t('engine.team.objectivePending')})`).join('; ') }));
  return lines.join(' ');
}

/** Richter explica un análisis completado: el texto del resultado y el
 * recordatorio de procedimiento del laboratorio. Sin análisis completado
 * no hay nada que explicar (el motor lo rechaza). */
export function explainAnswer(view: PlayerViewDto, analysisId: string, t: TranslateFn): string {
  const text = view.evidenceTexts[analysisId] ?? analysisId;
  const object = view.objects.find(item => item.id === analysisId);
  const admissibility = object ? t(object.admissible ? 'engine.team.explainAdmissible' : 'engine.team.explainInadmissible') : '';
  return t('engine.team.explainResult', { text }) +
    (admissibility ? ` ${t('engine.team.explainAdmissibility', { admissibility })}` : '') +
    ` ${t('engine.team.explainNote')}`;
}

/** Etiqueta de un tipo de solicitud pendiente; un tipo desconocido se
 * enseña tal cual (el motor no debería enviarlo). */
const requestTypeKeys: Record<string, LocaleKey> = { analysis: 'labels.request.analysis', query: 'labels.request.query', request: 'labels.request.request' };
function requestTypeLabel(type: string, t: TranslateFn): string {
  const key = requestTypeKeys[type];
  return key ? t(key) : type;
}

/** Clara organiza el expediente: lo recogido (con admisibilidad), lo
 * pendiente, las órdenes y detenciones y los objetivos. Todo sale de la
 * vista; nada nuevo, solo ordenado. */
export function organizeAnswer(view: PlayerViewDto, t: TranslateFn): string {
  const parts: string[] = [];
  parts.push(view.objects.length === 0
    ? t('engine.team.organizeEmpty')
    : t('engine.team.organizeObjects', { list: view.objects.map(item =>
      `${view.evidenceTexts[item.id] ?? item.id} (${item.admissible ? t('engine.team.explainAdmissible') : t('engine.team.explainInadmissible')})`).join('; ') }));
  parts.push(view.pendingRequests.length === 0
    ? t('engine.team.organizePendingEmpty')
    : t('engine.team.organizePending', { list: view.pendingRequests.map(item =>
      t('engine.team.pendingItem', { type: requestTypeLabel(item.type, t), due: item.dueMinute })).join('; ') }));
  parts.push(view.warrants.length === 0 ? t('engine.team.organizeWarrantsEmpty') : t('engine.team.organizeWarrants', { count: view.warrants.length }));
  parts.push(view.detentions.length === 0 ? t('engine.team.organizeDetentionsEmpty') : t('engine.team.organizeDetentions', { count: view.detentions.length }));
  parts.push(t('engine.team.organizeObjectives', { list: view.objectives.map(objective =>
    `${objective.description} (${objective.achieved ? t('engine.team.objectiveAchieved') : t('engine.team.objectivePending')})`).join('; ') }));
  return parts.join(' ');
}

/** David consulta las rutas: los viajes que la vista ofrece desde la
 * ciudad actual, con su duración. Las rutas son las del expediente; el
 * viaje en sí se hace desde la escena o el mapa, como siempre. */
export function routesAnswer(view: PlayerViewDto, t: TranslateFn): string {
  const routes = view.offers.filter(offer => offer.action.type === 'travel');
  if (routes.length === 0) return t('engine.team.routesEmpty', { city: view.position.city.name });
  return t('engine.team.routes', { city: view.position.city.name, list: routes.map(offer =>
    `${offer.label}${offer.detail ? ` (${offer.detail})` : ''}`).join('; ') });
}
