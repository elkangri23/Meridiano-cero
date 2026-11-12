// Equipo recurrente A.C.M.E. (GDD §8): los cinco miembros con nombre
// provisional del GDD, sus funciones y los servicios que el jugador puede
// pedirles. Los miembros recuerdan la trayectoria del detective y mantienen
// personalidades diferenciadas; pueden ejecutar consultas y gestiones
// concretas, pero nunca indicar si se va bien, señalar al culpable ni
// sugerir la siguiente pista. La evaluación de carrera de Margaret está
// conectada desde T5-04: responde solo con el perfil de carrera oficial
// (rango, puntos, medallas, reputación), nunca con el estado del caso.

/** Miembros del equipo recurrente A.C.M.E. (GDD §8). Nombres provisionales
 * del GDD; las funciones son las del expediente, no un catálogo por caso. */
export type TeamMemberId = 'margaret' | 'richter' | 'elena' | 'david' | 'clara';

export interface TeamMember {
  id: TeamMemberId;
  name: string;
  role: string;
}

/** Servicios que el motor registra como petición al equipo (GDD §8).
 * `coordinate` no es un servicio del motor: coordinar una detención es la
 * acción `detain` que ya existe y la ventana del equipo solo la enseña a
 * través de David. */
export type TeamServiceId = 'briefing' | 'explain' | 'lookup' | 'routes' | 'organize' | 'evaluate' | 'advice';

/** Una petición al equipo A.C.M.E. (GDD §8): quién, qué servicio, sobre
 * qué (solo `explain`, con el id del análisis completado) y cuándo. El
 * registro nunca se borra; el dossier lo enseña y la ventana del equipo
 * muestra el historial. El texto libre de la pregunta nunca vive aquí. */
export interface TeamRecord {
  id: string;
  memberId: TeamMemberId;
  serviceId: TeamServiceId;
  targetId?: string;
  minute: number;
}

export const TEAM_MEMBERS: readonly TeamMember[] = [
  { id: 'margaret', name: 'Margaret Sullivan', role: 'Directora' },
  { id: 'richter', name: 'Dr. Samuel Richter', role: 'Laboratorio forense' },
  { id: 'elena', name: 'Elena Vázquez', role: 'Inteligencia' },
  { id: 'david', name: 'David Nakamura', role: 'Viajes y detenciones' },
  { id: 'clara', name: 'Clara Beaumont', role: 'Expedientes' },
];

export const TEAM_MEMBER_IDS: readonly TeamMemberId[] = TEAM_MEMBERS.map(member => member.id);

export function teamMember(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(member => member.id === id);
}

/** Servicios que el motor registra como petición al equipo. `coordinate`
 * no está aquí a propósito: coordinar una detención es la acción `detain`
 * que ya existe (GDD §12) y la ventana del equipo solo la enseña a través
 * de David, con su mismo flujo de confirmación. */
export const TEAM_SERVICES: Readonly<Record<TeamMemberId, readonly TeamServiceId[]>> = {
  margaret: ['briefing', 'evaluate'],
  richter: ['explain'],
  elena: ['lookup', 'advice'],
  david: ['routes'],
  clara: ['organize'],
};

export function isTeamMemberId(value: unknown): value is TeamMemberId {
  return typeof value === 'string' && (TEAM_MEMBER_IDS as readonly string[]).includes(value);
}

export function isTeamServiceId(memberId: TeamMemberId, value: unknown): value is TeamServiceId {
  return typeof value === 'string' && (TEAM_SERVICES[memberId] as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const TEAM_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function isTeamId(value: unknown): value is string {
  return typeof value === 'string' && TEAM_ID.test(value);
}

/** Validador de un registro de petición al equipo persistido (misma forma
 * estricta que `isCommunicationRecord` / `isMisconductRecord`): claves
 * exactas, miembro y servicio válidos, objetivo acotado y minuto no
 * negativo. El texto libre de la pregunta nunca vive aquí (T2): solo el
 * servicio, el objetivo y el minuto. */
export function isTeamRecord(value: unknown): value is TeamRecord {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'id,memberId,minute,serviceId' && keys !== 'id,memberId,minute,serviceId,targetId') return false;
  if (!isTeamId(value.id) || !isTeamMemberId(value.memberId)) return false;
  if (!isTeamServiceId(value.memberId, value.serviceId)) return false;
  if (value.targetId !== undefined && !isTeamId(value.targetId)) return false;
  return isNonNegativeInteger(value.minute);
}
