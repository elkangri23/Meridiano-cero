import type { CareerProfileDto, PlayerViewDto } from '@meridiano/contracts';

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
  role: string;
  blurb: string;
}

export const TEAM_MEMBERS: readonly TeamMemberDisplay[] = [
  { id: 'margaret', name: 'Margaret Sullivan', role: 'Directora',
    blurb: 'Presenta los casos y responde preguntas sobre el encargo.' },
  { id: 'richter', name: 'Dr. Samuel Richter', role: 'Laboratorio forense',
    blurb: 'Explica los análisis ya completados, solo con lo que la prueba permite decir.' },
  { id: 'elena', name: 'Elena Vázquez', role: 'Inteligencia',
    blurb: 'Consulta los registros de la partida: identidades, viajes, pruebas y lugares.' },
  { id: 'david', name: 'David Nakamura', role: 'Viajes y detenciones',
    blurb: 'Coordina detenciones con las autoridades y consulta las rutas de viaje.' },
  { id: 'clara', name: 'Clara Beaumont', role: 'Expedientes',
    blurb: 'Organiza el expediente: pruebas, solicitudes, órdenes y objetivos.' },
];

export const TEAM_SERVICE_LABELS: Record<TeamServiceId, string> = {
  briefing: 'Preguntar sobre el encargo',
  explain: 'Explicar un análisis',
  lookup: 'Consulta de inteligencia',
  coordinate: 'Coordinar una detención',
  routes: 'Consultar rutas de viaje',
  organize: 'Organizar el expediente',
  evaluate: 'Evaluar mi carrera',
};

/** Elena Vázquez como interlocutora: la misma consulta determinista que la
 * terminal de inteligencia, con su persona. Sin hecho que respalde la
 * respuesta, lo dice y no llama al modelo (la misma regla que la terminal). */
export const ELENA_ID = 'elena';
export const ELENA_NAME = 'Elena Vázquez';
export const ELENA_PERSONA = 'Eres Elena Vázquez, de inteligencia de A.C.M.E. Respondes con frases cortas y formales, en primera persona, solo con lo que dicen los registros citados. Nunca inventas hechos del caso, nunca revelas culpabilidad y nunca dices quién es el culpable salvo que un registro citado lo afirme. Si un dato no está en los registros citados, di que no consta.';
export const ELENA_REFUSAL = 'Sin registro en los archivos consultados. La ausencia de registro no demuestra inocencia.';
export const ELENA_GREETING = 'Soy Elena Vázquez, inteligencia de A.C.M.E. Pregunta por lo investigado: sospechosos, pruebas, lugares. Solo respondo con lo que consta en los registros.';
export const TEAM_GREETING = 'Soy Margaret Sullivan, directora de A.C.M.E. Pregunta al equipo: yo te recuerdo el encargo y evalúo tu carrera, Richter explica los análisis, Elena consulta los registros, David coordina detenciones y Clara organiza el expediente.';

/** Respuesta de un servicio determinista desde la vista, o null si el
 * servicio no tiene respuesta calculable (la consulta de Elena y la
 * coordinación de David van por otro camino). La evaluación de carrera
 * necesita además el perfil (`career`): sin perfil cargado no hay
 * evaluación (null); con el perfil vacío, la respuesta dice que la
 * carrera empieza con el primer cierre. */
export function teamServiceAnswer(serviceId: TeamServiceId, view: PlayerViewDto, targetId?: string, career?: CareerProfileDto | null): string | null {
  switch (serviceId) {
    case 'briefing': return briefingAnswer(view);
    case 'explain': return targetId ? explainAnswer(view, targetId) : null;
    case 'routes': return routesAnswer(view);
    case 'organize': return organizeAnswer(view);
    case 'evaluate': return career ? evaluateAnswer(career) : null;
    default: return null;
  }
}

/** La frase con la que el jugador pide el servicio: texto fijo para los
 * servicios deterministas (la consulta de Elena lleva la pregunta real). */
export function teamRequestText(serviceId: TeamServiceId, targetId?: string): string {
  switch (serviceId) {
    case 'briefing': return '¿Qué me puedes decir del encargo?';
    case 'explain': return `¿Qué dice el análisis ${targetId ?? ''}?`;
    case 'routes': return '¿Qué rutas de viaje hay desde aquí?';
    case 'organize': return '¿Puedes organizar el expediente?';
    case 'evaluate': return '¿Cómo va mi carrera?';
    case 'coordinate': return 'Coordinar una detención.';
    case 'lookup': return 'Consulta de inteligencia.';
  }
}

/** Etiqueta legible de una medalla de carrera. */
export function medalLabel(medal: string | null): string {
  if (medal === 'medalla-oro') return 'Medalla de oro';
  if (medal === 'medalla-plata') return 'Medalla de plata';
  return 'Sin medalla';
}

/** Margaret evalúa la carrera: solo el perfil oficial (rango, puntos,
 * casos, medallas, reputación y sanciones activas). Nunca valora el caso
 * en curso ni dice si se va bien: la carrera solo cuenta cierres. */
export function evaluateAnswer(career: CareerProfileDto): string {
  if (career.totalCases === 0) {
    return 'Aún no tienes casos cerrados. Tu carrera empieza con el primer informe oficial: cierra un caso y te diré tu rango, tus puntos y tu reputación.';
  }
  const parts: string[] = [];
  parts.push(`Tu carrera: rango ${career.rank}, ${career.points} puntos en ${career.totalCases} ${career.totalCases === 1 ? 'caso' : 'casos'} (${career.completedCases} ${career.completedCases === 1 ? 'resuelto' : 'resueltos'}).`);
  parts.push(`Prestigio ${career.prestigeLabel.toLowerCase()}, integridad ${career.integrityLabel.toLowerCase()}, confianza ${career.trustLabel.toLowerCase()}.`);
  if (career.medals.length > 0) {
    parts.push('Medallas: ' + career.medals.map(medalLabel).join(', ') + '.');
  }
  const active = career.sanctions.filter(sanction => sanction.active);
  if (active.length > 0) {
    parts.push(`Tienes ${active.length} ${active.length === 1 ? 'suspensión activa' : 'suspensiones activas'}: ${active.map(sanction => sanction.reason).join('; ')}. Un caso limpio la resuelve.`);
  } else if (career.sanctions.length > 0) {
    parts.push('Tuviste una suspensión y ya la resolviste con casos limpios.');
  }
  return parts.join(' ');
}

/** Margaret sobre el encargo: la introducción del caso tal como la
 * presentó ella, más los objetivos con su estado. Nunca valora si se va
 * bien: solo recuerda qué se encargó y qué falta. */
export function briefingAnswer(view: PlayerViewDto): string {
  const lines: string[] = [];
  if (view.briefing) {
    lines.push(`${view.briefing.speaker}: ${view.briefing.paragraphs.join(' ')}`);
  } else {
    lines.push('El encargo es el caso que tienes abierto.');
  }
  lines.push('Objetivos: ' + view.objectives.map(objective =>
    `${objective.description} (${objective.achieved ? 'logrado' : 'pendiente'})`).join('; ') + '.');
  return lines.join(' ');
}

/** Richter explica un análisis completado: el texto del resultado y el
 * recordatorio de procedimiento del laboratorio. Sin análisis completado
 * no hay nada que explicar (el motor lo rechaza). */
export function explainAnswer(view: PlayerViewDto, analysisId: string): string {
  const text = view.evidenceTexts[analysisId] ?? analysisId;
  const object = view.objects.find(item => item.id === analysisId);
  const admissibility = object ? (object.admissible ? 'admisible' : 'no admisible') : '';
  return `Resultado: ${text}` +
    (admissibility ? ` Prueba ${admissibility}.` : '') +
    ' Un análisis solo dice lo que la prueba permite decir.';
}

/** Clara organiza el expediente: lo recogido (con admisibilidad), lo
 * pendiente, las órdenes y detenciones y los objetivos. Todo sale de la
 * vista; nada nuevo, solo ordenado. */
export function organizeAnswer(view: PlayerViewDto): string {
  const parts: string[] = [];
  parts.push(view.objects.length === 0
    ? 'Pruebas en tu poder: ninguna todavía.'
    : 'Pruebas en tu poder: ' + view.objects.map(item =>
      `${view.evidenceTexts[item.id] ?? item.id} (${item.admissible ? 'admisible' : 'no admisible'})`).join('; ') + '.');
  parts.push(view.pendingRequests.length === 0
    ? 'Solicitudes pendientes: ninguna.'
    : 'Solicitudes pendientes: ' + view.pendingRequests.map(item =>
      `${item.type} (responde en el minuto ${item.dueMinute})`).join('; ') + '.');
  parts.push(view.warrants.length === 0 ? 'Órdenes: ninguna.' : `Órdenes: ${view.warrants.length}.`);
  parts.push(view.detentions.length === 0 ? 'Detenciones: ninguna.' : `Detenciones: ${view.detentions.length}.`);
  parts.push('Objetivos: ' + view.objectives.map(objective =>
    `${objective.description} (${objective.achieved ? 'logrado' : 'pendiente'})`).join('; ') + '.');
  return parts.join(' ');
}

/** David consulta las rutas: los viajes que la vista ofrece desde la
 * ciudad actual, con su duración. Las rutas son las del expediente; el
 * viaje en sí se hace desde la escena o el mapa, como siempre. */
export function routesAnswer(view: PlayerViewDto): string {
  const routes = view.offers.filter(offer => offer.action.type === 'travel');
  if (routes.length === 0) return `Desde ${view.position.city.name} no hay rutas de viaje disponibles.`;
  return `Desde ${view.position.city.name}: ` + routes.map(offer =>
    `${offer.label}${offer.detail ? ` (${offer.detail})` : ''}`).join('; ') + '.';
}
