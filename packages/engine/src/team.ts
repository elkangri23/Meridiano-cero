// Equipo recurrente A.C.M.E. (GDD §8): peticiones al equipo como acción
// propia del motor. Conversar o leer no cuesta tiempo (GDD §9), así que
// pedir ayuda al equipo es gratis: lo que cuesta tiempo son las gestiones
// que el equipo ejecuta por el jugador (el análisis del laboratorio, la
// coordinación de una detención), que siguen siendo sus acciones propias.
// La acción solo REGISTRA la petición (miembro, servicio, objetivo y
// minuto) en el dossier y en el historial del equipo: la respuesta es una
// proyección determinista de la vista (como la terminal de inteligencia) y
// el motor no la calcula. El texto libre de la pregunta nunca va en el
// registro (T2): solo el servicio, el objetivo y el minuto.
import type { CaseDefinition, CaseRun, TeamMemberId, TeamRecord, TeamServiceId } from '@meridiano/case-schema';
import { isTeamMemberId, isTeamServiceId } from '@meridiano/case-schema';
import type { ActionResult } from './types.js';

export type TeamParams = {
  memberId: TeamMemberId;
  serviceId: TeamServiceId;
  targetId?: string;
  question?: string;
};

const TEAM_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function teamId(value: unknown): value is string {
  return typeof value === 'string' && TEAM_ID.test(value);
}

function questionText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4000 && value.trim().length > 0;
}

function teamKeys(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data).sort().join(',');
  return keys === 'memberId,serviceId' || keys === 'memberId,serviceId,targetId' ||
    keys === 'memberId,question,serviceId';
}

export function isTeamParams(value: unknown): value is TeamParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return teamKeys(data) && teamMemberService(data) && teamExtraParams(data);
}

/** El miembro existe y el servicio es uno de los suyos. */
function teamMemberService(data: Record<string, unknown>): boolean {
  return isTeamMemberId(data.memberId) && isTeamServiceId(data.memberId, data.serviceId);
}

/** La pregunta solo acompaña a la consulta de inteligencia; el objetivo
 * solo a la explicación de un análisis; y ambos son obligatorios en su
 * servicio. */
function teamExtraParams(data: Record<string, unknown>): boolean {
  return teamExtraFormats(data) && teamExtraPlacement(data);
}

/** El objetivo y la pregunta, si vienen, tienen la forma debida. */
function teamExtraFormats(data: Record<string, unknown>): boolean {
  if (data.targetId !== undefined && !teamId(data.targetId)) return false;
  if (data.question !== undefined && !questionText(data.question)) return false;
  return true;
}

/** Cada extra va solo en su servicio, y es obligatorio en él. */
function teamExtraPlacement(data: Record<string, unknown>): boolean {
  if (data.question !== undefined && data.serviceId !== 'lookup') return false;
  if (data.targetId !== undefined && data.serviceId !== 'explain') return false;
  if (data.serviceId === 'lookup' && data.question === undefined) return false;
  if (data.serviceId === 'explain' && data.targetId === undefined) return false;
  return true;
}

/** Análisis completados del laboratorio, en orden de revelación (la misma
 * regla que la vista del jugador): solo esos puede explicar Richter. */
export function completedAnalyses(run: CaseRun): string[] {
  return Object.entries(run.evidenceRecords ?? {})
    .filter(([, record]) => record.method === 'analyze')
    .sort(([, a], [, b]) => a.revealedMinute - b.revealedMinute)
    .map(([id]) => id);
}

/** Id de la petición: `team-N`, con N el número de peticiones de la
 * partida (los registros nunca se borran). Prefijo propio, como `comm-N`:
 * no choca con los `req-N` de órdenes y consultas. */
function nextTeamId(run: CaseRun): string {
  return 'team-' + ((run.teamRequests?.length ?? 0) + 1);
}

/** Registro de la petición en el dossier: solo identificadores y el
 * minuto (T2); el texto libre NO va en el registro. */
function teamRequestRecord(run: CaseRun, params: TeamParams): string {
  return `team:${params.memberId}:${params.serviceId}` +
    `${params.targetId !== undefined ? ':' + params.targetId : ''}@${run.minute}`;
}

export function submitTeam(_def: CaseDefinition, run: CaseRun, params: Record<string, unknown>): ActionResult {
  const refuse = (): ActionResult => ({ status: 'impossible', run, events: [], reason: 'Petición al equipo no disponible.' });
  if (!isTeamParams(params)) return refuse();
  // Richter solo explica análisis ya completados: no se puede pedir que
  // explique un resultado que aún no existe.
  if (params.serviceId === 'explain' && !completedAnalyses(run).includes(params.targetId ?? '')) return refuse();
  const requestId = nextTeamId(run);
  const record: TeamRecord = { id: requestId, memberId: params.memberId, serviceId: params.serviceId,
    ...(params.targetId !== undefined ? { targetId: params.targetId } : {}), minute: run.minute };
  const newRun: CaseRun = { ...run, version: run.version + 1,
    conversationRecords: [...run.conversationRecords, teamRequestRecord(run, params)],
    teamRequests: [...(run.teamRequests ?? []), record] };
  return { status: 'applied', run: newRun,
    events: [{ ordinal: 0, minute: run.minute, type: 'team',
      payload: { requestId, memberId: params.memberId, serviceId: params.serviceId,
        ...(params.targetId !== undefined ? { targetId: params.targetId } : {}) } }] };
}
