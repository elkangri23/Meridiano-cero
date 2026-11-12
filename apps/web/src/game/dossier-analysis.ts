// Análisis forense en el Dossier (rediseño Norte, fase 2): el análisis
// vive en la ficha de cada evidencia del maletín, no en una pestaña de
// laboratorio. Solo lógica pura sobre lo que el motor expone en la vista:
// ofertas `analyze` (con su demora en `detail`), solicitudes pendientes
// (tipo + minuto de entrega) y resultados (`analysisResults`). Nada de esto
// inventa datos del juego: el tipo forense y la demora salen de la oferta,
// el resultado de `analysisResults` y la hora prevista de la solicitud.
//
// El vínculo entrada → resultado no lo expone la vista (la solicitud
// pendiente no lleva la evidencia de entrada): se anota en esta pestaña,
// por partida, cuando el jugador pide el análisis, y se completa cuando el
// resultado madura. Si se abre otra pestaña después de completarse, el
// resultado sigue visible como hallazgo en el Dossier; solo se pierde su
// bloque enlazado bajo la evidencia de entrada.
import { FORENSIC_TYPE_KEYS } from '@meridiano/contracts';
import type { ForensicType, LocaleKey, PlayerViewDto, PublicActionOffer, TranslateFn } from '@meridiano/contracts';

export type AnalysisLink = { inputId: string; resultId?: string };
export type AnalysisLinks = Record<string, AnalysisLink>;

/** Una solicitud pendiente de la vista (`PlayerViewDto`): la API proyecta
 * su tipo (`analysis`/`query`/`request`) y su minuto de vencimiento; el
 * payload nunca llega a la web. */
export type PendingRequest = PlayerViewDto['pendingRequests'][number];

/** Clave de sessionStorage por partida, como el chat y la consola. */
export function analysisLinksKey(runId: string): string {
  return `meridiano:analysis:${runId}`;
}

function isAnalysisLink(value: unknown): value is AnalysisLink {
  return !!value && typeof value === 'object'
    && typeof (value as AnalysisLink).inputId === 'string'
    && ((value as AnalysisLink).resultId === undefined || typeof (value as AnalysisLink).resultId === 'string');
}

/** Vínculos guardados en esta pestaña, validados al cargar. */
export function loadAnalysisLinks(storage: Pick<Storage, 'getItem'>, runId: string): AnalysisLinks {
  try {
    const stored = JSON.parse(storage.getItem(analysisLinksKey(runId)) ?? 'null') as unknown;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    const links: AnalysisLinks = {};
    for (const [inputId, link] of Object.entries(stored)) {
      if (isAnalysisLink(link) && link.inputId === inputId) links[inputId] = link;
    }
    return links;
  } catch { return {}; }
}

export function saveAnalysisLinks(storage: Pick<Storage, 'setItem'>, runId: string, links: AnalysisLinks): void {
  try { storage.setItem(analysisLinksKey(runId), JSON.stringify(links)); } catch { /* sin almacenamiento */ }
}

/** Demora en minutos de una oferta de análisis, sacada de su `detail`
 * («El resultado tarda 90 min»): el motor no la expone como campo aparte.
 * null si el detalle no trae ningún número (no se inventa ninguno). */
export function analysisDelayMinutes(offer: PublicActionOffer): number | null {
  const match = /(\d+)/.exec(offer.detail ?? '');
  return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

/** Tipo forense de la oferta en minúsculas, como en la etiqueta que el
 * propio motor construye (`engine.offer.analyze`); sin tipo conocido, la
 * etiqueta genérica de análisis. */
export function analysisTypeLabel(offer: PublicActionOffer, t: TranslateFn): string {
  const key = offer.forensicType && offer.forensicType in FORENSIC_TYPE_KEYS
    ? FORENSIC_TYPE_KEYS[offer.forensicType as ForensicType]
    : undefined;
  const label = key ? t(key as LocaleKey) : t('game.analysisLabel');
  return label.toLowerCase();
}

/** Oferta de análisis para una evidencia en poder, si el motor la ofrece. */
export function analyzeOfferForEvidence(offers: PublicActionOffer[], evidenceId: string): PublicActionOffer | undefined {
  return offers.find(offer => offer.action.type === 'analyze'
    && typeof offer.action.params.evidenceId === 'string'
    && offer.action.params.evidenceId === evidenceId);
}

/** Solicitud de análisis en curso, si la hay (el motor solo deja una por
 * expediente en la práctica: un solo análisis por caso). */
export function pendingAnalysisRequest(view: PlayerViewDto): PendingRequest | undefined {
  return view.pendingRequests.find(request => request.type === 'analysis');
}

/** Resultados de análisis aún no vinculados a ninguna entrada. */
export function unlinkedAnalysisResults(view: PlayerViewDto, links: AnalysisLinks): string[] {
  const linked = new Set(Object.values(links).map(link => link.resultId).filter((id): id is string => typeof id === 'string'));
  return view.analysisResults.filter(id => !linked.has(id));
}

/** Completa los vínculos pendientes cuando el resultado ya maduró: si una
 * entrada anotada no tiene resultado y ya no hay análisis en curso, el
 * primer resultado sin vincular es el suyo (en orden de anotación). Sin
 * análisis en curso y sin resultados, no cambia nada. Idempotente. */
export function reconcileAnalysisLinks(view: PlayerViewDto, links: AnalysisLinks): { links: AnalysisLinks; changed: boolean } {
  if (pendingAnalysisRequest(view)) return { links, changed: false };
  const unlinked = unlinkedAnalysisResults(view, links);
  if (unlinked.length === 0) return { links, changed: false };
  let changed = false;
  const next: AnalysisLinks = { ...links };
  for (const inputId of Object.keys(next)) {
    const link = next[inputId];
    if (!link || link.resultId) continue;
    const resultId = unlinked.shift();
    if (!resultId) break;
    next[inputId] = { inputId, resultId };
    changed = true;
  }
  return { links: next, changed };
}

export type EvidenceAnalysisState =
  | { kind: 'available'; offer: PublicActionOffer; minutes: number | null }
  | { kind: 'running'; dueMinute: number; minutesLeft: number }
  | { kind: 'done'; resultId: string }
  | { kind: 'none' };

/** Estado del análisis de una evidencia en poder, solo con la vista y los
 * vínculos anotados. La vista manda: un resultado anotado que ya no está
 * en `analysisResults` (p. ej. tras cargar un guardado anterior) no se
 * enseña como hecho, y una entrada en curso sin solicitud pendiente vuelve
 * a ofrecerse. */
export function evidenceAnalysisState(view: PlayerViewDto, offers: PublicActionOffer[], links: AnalysisLinks, evidenceId: string): EvidenceAnalysisState {
  const link = links[evidenceId];
  const pending = pendingAnalysisRequest(view);
  if (link?.resultId && view.analysisResults.includes(link.resultId)) return { kind: 'done', resultId: link.resultId };
  if (link && !link.resultId && pending) {
    return { kind: 'running', dueMinute: pending.dueMinute, minutesLeft: Math.max(0, pending.dueMinute - view.clock.minute) };
  }
  const offer = analyzeOfferForEvidence(offers, evidenceId);
  if (offer) return { kind: 'available', offer, minutes: analysisDelayMinutes(offer) };
  if (!pending) {
    // Sin oferta, sin solicitud en curso y sin vínculo: si hay un resultado
    // sin vincular (p. ej. otra pestaña tras completarse), es el de esta
    // evidencia cuando es la única con análisis pendiente de atribuir.
    const unlinked = unlinkedAnalysisResults(view, links);
    if (unlinked.length === 1) return { kind: 'done', resultId: unlinked[0] as string };
  }
  return { kind: 'none' };
}

/** Evidencias descubiertas en el dossier: las entradas que tienen texto de
 * evidencia (los marcadores de lugar, ciudad o identidad no cuentan). Es el
 * número del distintivo de la pestaña Dossier: sube al inspeccionar, no
 * solo al recoger. */
export function evidenceCount(view: PlayerViewDto): number {
  return view.dossier.filter(entry => entry in view.evidenceTexts).length;
}

/** Título y detalle de una solicitud en curso para el bloque del Dossier:
 * el análisis nombra su evidencia de entrada cuando se conoce (anotada al
 * pedirlo, o la única oferta de análisis presente); el resto, su tipo. El
 * detalle es siempre la hora prevista del motor. */
export function describePendingRequest(view: PlayerViewDto, request: PendingRequest, offers: PublicActionOffer[], links: AnalysisLinks, t: TranslateFn): { title: string; detail: string } {
  const typeLabel = request.type === 'analysis' ? t('labels.request.analysis')
    : request.type === 'query' ? t('labels.request.query')
    : t('labels.request.request');
  const detail = t('game.requestDue', { due: request.dueMinute, now: view.clock.minute });
  if (request.type !== 'analysis') return { title: typeLabel, detail };
  const recorded = Object.keys(links).find(inputId => !links[inputId]?.resultId);
  const singleOffer = offers.filter(offer => offer.action.type === 'analyze').length === 1
    ? offers.find(offer => offer.action.type === 'analyze')
    : undefined;
  const singleInput = singleOffer && typeof singleOffer.action.params.evidenceId === 'string'
    ? singleOffer.action.params.evidenceId
    : undefined;
  const inputId = recorded ?? singleInput;
  if (!inputId) return { title: typeLabel, detail };
  const inputText = view.evidenceTexts[inputId] ?? inputId;
  return { title: `${typeLabel} · ${inputText}`, detail };
}
