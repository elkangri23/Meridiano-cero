import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { archiveApi } from '../archive/client';
import { profileApi } from '../auth/client';
import { avatarLabel, ProfileSection } from '../auth/ProfileSection';
import { paletteLabelKeys, usePreferences } from '../preferences';
import { resumeSummary } from './resume-summary';
import { aiApi, AiError } from '../ai/client';
import type { AiInterpretation } from '../ai/client';
import { aiConnectionsApi, ConnectionsError } from '../ai/connections';
import type { AiConnection, ConnectionsResponse, ConnectionTestResult, ProviderCatalogEntry } from '../ai/connections';
import { gameApi, GameError } from './client';
import { needsConfirmationDialog } from './action-confirmation';
import { chatFacts, chatGreeting, chatNpcName, chatPersona, chatRefusal, findChatEntry, sceneRole } from './npc-chat';
import { SceneArt } from './scene-art';
import { Portrait } from './portrait';
import { portraitSeed, teamPortraitSeed } from './portraits';
import { createMusicEngine, type EffectKind } from './music';
import { groupOffers, groupTalkOffers } from './scene-offers';
import type { TalkGroup } from './scene-offers';
import { interpretClarificationText } from './interpret-clarification';
import { buildIntelFacts, INTEL_ID, INTEL_NAME, intelGreeting, intelNoRecord, intelPersona, intelRefusal, selectIntelFacts } from './intel-terminal';
import { ELENA_ID, ELENA_NAME, elenaPersona, elenaRefusal, teamGreeting, TEAM_MEMBERS, TEAM_SERVICE_KEYS, medalLabel, teamRequestText, teamServiceAnswer } from './team';
import type { TeamMemberId, TeamServiceId } from './team';
import type { GameErrorKind, SaveListDto, SaveListItem } from './client';
import { GameWindow, MinimizedBar, WINDOW_KEYS, useWindows } from './windows';
import type { WindowId } from './windows';
import { effectiveReducedMotion, objectiveStateText, trapTabKey, useSystemReducedMotion } from './accessibility';
import type { ActionResponseDto, CareerProfileDto, PlayerViewDto, PublicActionOffer, SessionDto, TranslateFn } from '@meridiano/contracts';
import type { DetectiveProfileDto } from '@meridiano/contracts';
import { caseLabel, conversationRecordText, createNoopTTSController, createTTSController, discoveryText, FORENSIC_TYPE_KEYS, GEOGRAPHIC_CATALOG, getNPC, getRoute, IRREGULAR_KIND_KEYS, npcGreeting, npcKnowledgeFacts, npcRefusal, objectiveText, reportReasonText, reportResultText, searchCities, SUPPORTED_LANGUAGES, touristInfoFor, travelText } from '@meridiano/contracts';
import type { CaseTexts, DiscoveryLookup, ForensicType, Language, LocaleKey, PaletteMode, PresentationPreferences, TTSController, TTSOptions, TTSVoice } from '@meridiano/contracts';
import { useTranslation } from '../i18n';
import './game.css';

type OrderPhase =
  | { kind: 'idle' }
  | { kind: 'interpreting' }
  | { kind: 'clarification'; question: string; original: string }
  | { kind: 'preview'; offer: PublicActionOffer; response: ActionResponseDto; key: string }
  | { kind: 'committing'; offer: PublicActionOffer; key: string }
  | { kind: 'recovering'; offer: PublicActionOffer; key: string; message: string }
  | { kind: 'error'; message: string };

type ScreenPhase = 'loading' | 'ready' | 'signed_out' | 'not_found' | 'error';
type SavePhase = 'idle' | 'saving' | 'saved' | 'failed';

/** Claves i18n de los canales, tipos de solicitud y tipos de evidencia
 * (el texto vive en `locales/es.ts`). */
const channelKeys: Record<string, LocaleKey> = { call: 'labels.channel.call', whatsapp: 'labels.channel.whatsapp', sms: 'labels.channel.sms', email: 'labels.channel.email', fax: 'labels.channel.fax' };
const requestTypeKeys: Record<string, LocaleKey> = { analysis: 'labels.request.analysis', query: 'labels.request.query', request: 'labels.request.request' };
const evidenceTypeKeys: Record<string, LocaleKey> = { object: 'labels.evidence.object', observation: 'labels.evidence.observation', testimony: 'labels.evidence.testimony', analysis: 'labels.evidence.analysis', record: 'labels.evidence.record' };

/** Etiqueta de un tipo de evidencia o de solicitud; un tipo desconocido
 * se enseña tal cual (el motor no debería enviarlo). */
function evidenceTypeLabel(type: string, t: TranslateFn): string {
  const key = evidenceTypeKeys[type];
  return key ? t(key) : type;
}
function requestTypeLabel(type: string, t: TranslateFn): string {
  const key = requestTypeKeys[type];
  return key ? t(key) : type;
}
function channelLabel(channel: string, t: TranslateFn): string {
  const key = channelKeys[channel];
  return key ? t(key) : channel;
}

/** Pregunta de la aclaración tras una orden libre: si el texto pide una
 * orden o una detención bloqueada, dice qué falta en el idioma del
 * jugador; si no, el motivo del servidor se resuelve en el idioma del
 * jugador (`game.notice.interpretClarification.*`), y solo si el motivo
 * es desconocido se enseña el mensaje del servidor o la ambigua
 * genérica. */
function clarificationQuestion(t: TranslateFn, result: AiInterpretation): string {
  return interpretClarificationText(t, result);
}

/** Dificultad de la partida, tal como se enseña en la cabecera junto al
 * reloj («Normal · 48 horas»): la etiqueta que la verificación no encontró
 * porque la vista del jugador no traía el dato. */
const difficultyKeys: Record<PlayerViewDto['difficulty'], LocaleKey> = { easy: 'labels.difficulty.easy', normal: 'labels.difficulty.normal', hard: 'labels.difficulty.hard' };
function difficultyLabel(difficulty: PlayerViewDto['difficulty'], t: TranslateFn): string {
  return t(difficultyKeys[difficulty]);
}

/** Modo de exploración de la partida (GDD §5), en la cabecera junto a la
 * dificultad: en libre, las ciudades del expediente se descubren. */
const explorationModeKeys: Record<PlayerViewDto['explorationMode'], LocaleKey> = { guided: 'labels.exploration.guided', free: 'labels.exploration.free' };
function explorationModeLabel(mode: PlayerViewDto['explorationMode'], t: TranslateFn): string {
  return t(explorationModeKeys[mode]);
}

/** Nombre del detective que se enseña en la cabecera: el alias si lo hay,
 * si no el nombre de la cuenta. */
function detectiveDisplayName(profile: DetectiveProfileDto | null, identity: SessionDto | null): string {
  return profile?.alias ?? identity?.profile.displayName ?? '—';
}

/** Etiqueta del avatar que se enseña en la cabecera. */
function detectiveAvatarName(profile: DetectiveProfileDto | null, t: TranslateFn): string {
  return profile ? avatarLabel(profile.avatar, t) : t('labels.avatar.detective');
}

/** Si la partida admite el resumen al retomar (en curso y ya empezada). */
function resumeAvailable(view: PlayerViewDto): boolean {
  return view.status === 'active' && view.clock.minute > 0;
}

/** Selector de paleta de daltonismo (§15): la paleta 'high-contrast' de la
 * librería se enseña como 'Predeterminada' porque el alto contraste tiene
 * su propio interruptor. */
function PaletteSetting({ palette, onPalette }: { palette: PaletteMode; onPalette: (value: PaletteMode) => void }) {
  const t = useTranslation();
  return <label className="game-setting"><span>{t('settings.palette')}</span>
    <select value={palette === 'high-contrast' ? 'default' : palette} onChange={event => onPalette(event.target.value as PaletteMode)}>
      {(['default', 'protanopia', 'deuteranopia', 'tritanopia'] as const).map(mode => <option key={mode} value={mode}>{t(paletteLabelKeys[mode])}</option>)}
    </select>
  </label>;
}

const gameErrorKeys: Record<GameErrorKind, LocaleKey> = {
  session: 'game.error.session',
  not_found: 'game.error.not_found',
  version_conflict: 'game.error.version_conflict',
  run_closed: 'game.error.run_closed',
  save_incompatible: 'game.error.save_incompatible',
  save_limit: 'game.error.save_limit',
  invalid: 'game.error.invalid',
  unavailable: 'game.error.unavailable',
};

function errorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof GameError) return t(gameErrorKeys[error.kind]);
  if (error instanceof AiError) return error.kind === 'budget_exceeded' ? t('game.error.aiTooLong') : t('game.error.aiDown');
  return t('game.error.unexpected');
}

/** Contacto de la central (GDD §10): un personaje con el que ya se habló
 * en persona, con los canales que tiene. La regla es la de siempre: el
 * motor exige relación previa (`talk:<id>@` en la conversación); los
 * canales salen de los datos de charla de la vista, nunca inventados. */
export interface Contact {
  id: string;
  name: string;
  channels: string[];
}

function contactsFromView(view: PlayerViewDto): Contact[] {
  // Solo contactos con los que ya se habló: el motor exige relación previa.
  const met = new Set<string>();
  for (const record of view.conversation) {
    const id = /^talk:([A-Za-z0-9._:-]+)@/.exec(record)?.[1];
    if (id) met.add(id);
  }
  const names = npcNamesFromView(view);
  return [...met].map(id => ({
    id,
    name: names.get(id) ?? id,
    channels: view.npcChat.find(entry => entry.id === id)?.channels ?? [],
  }));
}

/** Nombres de los personajes a partir de las etiquetas de las ofertas de
 * hablar («Hablar con X sobre su identidad») y de los datos de charla del
 * caso en curso: sin estos últimos, un NPC generado sin oferta visible
 * enseña su id crudo en el dossier y en la consola. */
function npcNamesFromView(view: PlayerViewDto): Map<string, string> {
  const names = new Map<string, string>();
  for (const offer of view.offers) {
    if (offer.action.type !== 'talk' || typeof offer.action.params.npcId !== 'string') continue;
    const label = /^Hablar con (.+) sobre su identidad$/.exec(offer.label)?.[1];
    if (label) names.set(offer.action.params.npcId, label);
  }
  for (const entry of view.npcChat) {
    if (!names.has(entry.id)) names.set(entry.id, entry.name);
  }
  return names;
}

/** Resolución de nombres para traducir los hallazgos del motor a frases
 * (lugares y ciudades de la vista, personajes de las ofertas). El nombre de
 * un personaje sale del catálogo cuando la oferta ya no está en la vista:
 * sin este respaldo, un marcador `identity:<npc>` o `location:<npc>` de
 * alguien sin oferta visible enseñaría el ID crudo. */
function lookupFromView(view: PlayerViewDto): DiscoveryLookup {
  const locations = new Map(view.locations.map(location => [location.id, location.name]));
  const cities = new Map(view.cities.map(city => [city.id, city.name]));
  // El atlas trae todas las ciudades admitidas, también las turísticas:
  // sin él, un `travel:barcelona` caía en «Viaje realizado.».
  for (const city of view.atlas) cities.set(city.id, city.name);
  const npcs = npcNamesFromView(view);
  return {
    locationName: id => locations.get(id),
    cityName: id => cities.get(id),
    npcName: id => npcs.get(id) ?? getNPC(id)?.name,
  };
}

/** Turno de memoria de conversación con hechos citados (la forma que
 * guarda el director: `factIds` con lo que el personaje dijo). */
function isMemoryTurn(value: unknown): value is { factIds: unknown[] } {
  return !!value && typeof value === 'object' && Array.isArray((value as { factIds?: unknown }).factIds);
}

/** Textos del expediente que lleva la vista: sin ellos, `discoveryText`
 * traduce los hallazgos con los textos del caso fijo y un expediente
 * generado enseñaba en el dossier frases que no son las suyas. */
function textsFromView(view: PlayerViewDto): CaseTexts {
  return { evidence: view.evidenceTexts, knowledge: {}, greetings: {} };
}

/** Órdenes en la escena: `warrant:<npc>` nombra al sospechoso y
 * `warrant:access` es la orden de acceso. Sin esto la escena enseñaba los
 * IDs crudos (`warrant:ines`). El nombre sale de la vista (casos
 * generados) con el catálogo fijo como respaldo. */
function warrantText(id: string, npcName: ((id: string) => string | undefined) | undefined, t: TranslateFn): string {
  if (id === 'warrant:access') return t('game.warrantAccess');
  if (id.startsWith('warrant:')) {
    const suspectId = id.slice('warrant:'.length);
    const name = npcName?.(suspectId) ?? getNPC(suspectId)?.name ?? suspectId;
    return t('game.warrantAgainst', { name });
  }
  return id;
}

/** Personaje con el que habla una acción talk, si la hay. */
function talkTarget(offer: PublicActionOffer | undefined, lookup: DiscoveryLookup): { id: string; name: string } | null {
  if (offer?.action.type !== 'talk' || typeof offer.action.params.npcId !== 'string') return null;
  const id = offer.action.params.npcId;
  return { id, name: lookup.npcName(id) ?? id };
}

/** Frase del viaje de una acción confirmada, si cambió de ciudad. */
function travelDetail(offer: PublicActionOffer | undefined, previous: PlayerViewDto | null, response: ActionResponseDto, language: Language): string {
  if (offer?.action.type !== 'travel' || !previous || previous.position.city.id === response.position.city.id) return '';
  return travelText(previous.position.city.name, response.position.city.name, language);
}

/** Hallazgos nuevos del dossier, en frases legibles. */
function discoveryDetail(response: ActionResponseDto, previous: PlayerViewDto | null, lookup: DiscoveryLookup, language: Language): string {
  const entries = (previous ? response.dossier.filter(entry => !previous.dossier.includes(entry)) : [...response.dossier])
    .filter(entry => !entry.startsWith('travel:'));
  const texts = textsFromView(previous ?? response);
  return entries.map(entry => discoveryText(entry, lookup, texts, response.caseId, language)).join(' ');
}

/** Solicitudes enviadas por la acción: qué se pidió y cuándo llega el
 * resultado. El resumen del servidor no puede decirlo (su evento solo lleva
 * el ID de la solicitud). */
function submittedDetail(response: ActionResponseDto, previous: PlayerViewDto | null, offer: PublicActionOffer | undefined, lookup: DiscoveryLookup, t: TranslateFn): string {
  const added = previous
    ? response.pendingRequests.filter(request => !previous.pendingRequests.some(item => item.id === request.id))
    : [...response.pendingRequests];
  return added.map(request => {
    const due = t('game.detail.resultDue', { due: request.dueMinute });
    if (offer?.action.type === 'request_warrant' && typeof offer.action.params.suspectId === 'string') {
      const name = lookup.npcName(offer.action.params.suspectId) ?? offer.action.params.suspectId;
      return t('game.detail.warrantRequested', { name, due });
    }
    return offer ? t('game.detail.sentOffer', { label: offer.label, due }) : due;
  }).join(' ');
}

/** Órdenes concedidas al madurar: no dejan hallazgo en el dossier, así que
 * sin esta línea el jugador no sabría que ya tiene la orden. */
function warrantDetail(response: ActionResponseDto, previous: PlayerViewDto | null, lookup: DiscoveryLookup, t: TranslateFn): string {
  const added = previous
    ? response.warrants.filter(item => !previous.warrants.includes(item))
    : [...response.warrants];
  return added.map(item => t('game.detail.warrantGranted', { warrant: warrantText(item, lookup.npcName, t) })).join(' ');
}

/** Detenciones nuevas: quedan registradas y el caso sigue abierto (la
 * detención no cierra; el informe final la valorará). La automática la
 * ejecutan las autoridades (GDD §12): la frase lo dice, para que el
 * jugador entienda que no viajó a detener en persona. */
function detentionDetail(response: ActionResponseDto, previous: PlayerViewDto | null, lookup: DiscoveryLookup, t: TranslateFn, offer?: PublicActionOffer): string {
  const added = previous
    ? response.detentions.filter(item => !previous.detentions.includes(item))
    : [...response.detentions];
  const automatic = offer?.action.type === 'detain' && offer.action.params.mode === 'automatic';
  return added.map(item => {
    const name = lookup.npcName(item) ?? item;
    return automatic
      ? t('game.detail.detainedAutomatic', { name })
      : t('game.detail.detained', { name });
  }).join(' ');
}

/** Qué contar al jugador tras una acción confirmada: con quién habló y qué
 * descubrió de nuevo, en frases legibles. Vacío si no hay nada que contar.
 * Cada acción confirmada deja narración: antes solo la dejaban los viajes,
 * hablar y las acciones con hallazgos nuevos en el dossier — recoger, pedir
 * una consulta o una orden, esperar a que madurase una orden, detener y
 * cerrar solo dejaban el resumen de una línea (y recoger, además, el ID
 * crudo). Inspeccionar sin hallazgos y esperar sin que llegue nada lo dicen
 * explícitamente, para que la acción no parezca no haber hecho nada. */
/** Frase de la conversación al hablar con alguien. */
function talkDetail(offer: PublicActionOffer | undefined, lookup: DiscoveryLookup, t: TranslateFn): string {
  const target = talkTarget(offer, lookup);
  return target ? t('game.detail.talk', { name: target.name }) : '';
}

/** Frase del cierre: dónde está el informe final. */
function finishDetail(response: ActionResponseDto, offer: PublicActionOffer | undefined, t: TranslateFn): string {
  return response.status === 'closed' && offer?.action.type === 'finish'
    ? t('game.detail.finish')
    : '';
}

/** Cuando nada de lo anterior contó nada: inspeccionar sin hallazgos y
 * esperar sin que llegue nada lo dicen explícitamente, para que la acción
 * no parezca no haber hecho nada. */
function emptyDetail(offer: PublicActionOffer | undefined, told: boolean, t: TranslateFn): string {
  if (told) return '';
  if (offer?.action.type === 'inspect') return t('game.detail.inspectEmpty');
  if (offer?.action.type === 'wait') return t('game.detail.waitEmpty');
  return '';
}

/** Qué contar al jugador tras una acción confirmada: con quién habló y qué
 * descubrió de nuevo, en frases legibles. Vacío si no hay nada que contar.
 * Cada acción confirmada deja narración: antes solo la dejaban los viajes,
 * hablar y las acciones con hallazgos nuevos en el dossier — recoger, pedir
 * una consulta o una orden, esperar a que madurase una orden, detener y
 * cerrar solo dejaban el resumen de una línea (y recoger, además, el ID
 * crudo). */
function actionResultDetail(response: ActionResponseDto, previous: PlayerViewDto | null, t: TranslateFn, language: Language, offer?: PublicActionOffer): string {
  // Los nombres de los personajes salen de la vista anterior: la oferta de
  // hablar puede no estar ya en la vista nueva.
  const lookup = lookupFromView(previous ?? response);
  const parts = [
    travelDetail(offer, previous, response, language),
    discoveryDetail(response, previous, lookup, language),
    talkDetail(offer, lookup, t),
    submittedDetail(response, previous, offer, lookup, t),
    warrantDetail(response, previous, lookup, t),
    detentionDetail(response, previous, lookup, t, offer),
    finishDetail(response, offer, t),
  ];
  const told = parts.some(part => part !== '');
  return [...parts, emptyDetail(offer, told, t)].filter(Boolean).join(' ');
}

/** Aviso de estado tras una acción confirmada. */
function noticeForOutcome(response: ActionResponseDto, offerLabel: string, t: TranslateFn): string {
  if (response.outcome === 'case_closed') return t('game.notice.caseClosed', { label: offerLabel });
  if (response.outcome === 'impossible') return t('game.notice.impossible', { reason: response.reason ?? offerLabel });
  if (response.outcome === 'clarification_required') return response.question ?? t('game.notice.clarificationNeeded');
  return t('game.notice.done', { label: offerLabel, minute: response.clock.minute });
}

function previewOutcome(response: ActionResponseDto, offer: PublicActionOffer, key: string, t: TranslateFn): OrderPhase {
  if (response.outcome === 'impossible') return { kind: 'error', message: response.reason ?? t('game.notice.actionUnavailable') };
  if (response.outcome === 'clarification_required') return { kind: 'clarification', question: response.question ?? t('game.notice.clarificationNeeded'), original: offer.label };
  return { kind: 'preview', offer, response, key };
}

// ── Secciones presentacionales ──────────────────────────────────────────────────

/** Icono del reloj de arena, compartido por la cabecera y la escena. */
function HourglassIcon({ animKey }: { animKey: number }) {
  return <svg key={animKey} viewBox="0 0 24 32" shapeRendering="crispEdges" focusable="false" aria-hidden="true">
    <rect x="2" y="0" width="20" height="3" fill="#ffff55" />
    <rect x="2" y="29" width="20" height="3" fill="#ffff55" />
    <path d="M4 3H20L12 16Z" fill="#55ffff" />
    <path d="M4 29H20L12 16Z" fill="#55ffff" />
    <rect className="game-hourglass-sand-top" x="9" y="6" width="6" height="5" fill="#ffff55" />
    <rect className="game-hourglass-sand-bottom" x="9" y="22" width="6" height="5" fill="#ffff55" />
    <rect x="11" y="14" width="2" height="4" fill="#ffff55" />
  </svg>;
}

/** Reloj de arena (lote 1 de jugabilidad, arreglado): cuando el reloj avanza
 * al confirmar una acción, la arena cae y el reloj gira unos segundos junto
 * al «+N min». Es solo cosmético: el motor y las reglas no cambian. La
 * primera versión era un icono de 18 px con una animación de una sola
 * pasada que no giraba hasta la mitad del ciclo, así que en el navegador
 * parecía estático: ahora es grande (30 px) y gira en bucle mientras dura
 * el pulso, para que se vea de verdad. */
function Hourglass({ delta, animKey }: { delta: number; animKey: number }) {
  const t = useTranslation();
  return <span className="game-hourglass" data-testid="hourglass" role="status" aria-label={t('game.hourglassAria', { delta })}>
    <HourglassIcon animKey={animKey} />
    <span>+{delta} min</span>
  </span>;
}

/** Reloj de arena grande en la escena: el tiempo avanza donde está la
 * mirada del jugador, no solo en la cabecera. Mismo pulso y mismo estilo. */
function SceneHourglass({ delta, animKey }: { delta: number; animKey: number }) {
  const t = useTranslation();
  return <span className="game-hourglass game-hourglass-scene" data-testid="hourglass-scene" role="status" aria-label={t('game.hourglassAria', { delta })}>
    <HourglassIcon animKey={animKey} />
    <span>{t('game.hourglassScene', { delta })}</span>
  </span>;
}

function HeaderSection({ view, caseTitle, detective, avatar, clockPulse, onLogout }: { view: PlayerViewDto; caseTitle: string | null; detective: string; avatar: string; clockPulse: { key: number; delta: number } | null; onLogout: (() => void) | null }) {
  const t = useTranslation();
  return <header className="game-header">
    <div className="game-agency">
      <div className="game-brand">
        <span className="game-mark" aria-hidden="true">M<span>0</span></span>
        <div><p className="game-overline">{t('game.agency')}</p><h1>Meridiano cero</h1></div>
      </div>
      <div className="game-detective">
        <span className="game-avatar" title={t('profile.avatar') + `: ${avatar}`} aria-hidden="true">{avatar.slice(0, 1).toUpperCase()}</span>
        <div><strong>{t('game.detectiveLine', { name: detective })}</strong><small>{t('game.refLine', { ref: view.runId.slice(0, 8), version: view.version })}</small></div>
      </div>
      <div className="game-header-actions">
        <Link to="/">{t('archive.title')}</Link>
        {onLogout && <button type="button" onClick={onLogout}>{t('archive.logout')}</button>}
      </div>
    </div>
    <div className="game-case-strip">
      <div><p className="game-overline">{t('archive.col.case')}</p><strong>{caseTitle ?? view.caseId}</strong></div>
      <div><p className="game-overline">{t('archive.col.crime')}</p><strong>{caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating, t)}</strong></div>
      <div><p className="game-overline">{t('game.currentCity')}</p><strong>{view.position.city.name}, {view.position.city.country}</strong></div>
      <div><p className="game-overline">{t('archive.col.difficulty')}</p><strong data-testid="difficulty">{t('game.difficultyLine', { label: difficultyLabel(view.difficulty, t), hours: Math.round(view.clock.deadlineMinutes / 60) })}</strong></div>
      <div><p className="game-overline">{t('game.explorationModeLabel')}</p><strong data-testid="exploration-mode">{explorationModeLabel(view.explorationMode, t)}</strong></div>
      <div className={`game-clock${clockPulse ? ' game-clock-pulse' : ''}`} data-testid="clock" aria-label={t('game.clockAria', { minute: view.clock.minute, deadline: view.clock.deadlineMinutes })}>
        <p className="game-overline">{t('game.clockLabel')}</p>
        <strong>{view.clock.minute} min<span> / {view.clock.deadlineMinutes} min</span></strong>
        {clockPulse && <Hourglass delta={clockPulse.delta} animKey={clockPulse.key} />}
        <small>{view.status === 'closed' ? t('common.closed') : t('common.active')}{t('game.clockNote')}</small>
      </div>
    </div>
  </header>;
}

/** Fila de un personaje presente en la escena: nombre y rol una sola vez,
 * con un botón por tema de conversación. Nombre y rol salen de los datos de
 * charla del caso en curso, con el catálogo como respaldo (sin inventar
 * nada). Antes había una fila por oferta y Lucía salía dos veces (su
 * identidad y la caja). */
function SceneNpcGroup({ group, view, disabled, onOffer }: { group: TalkGroup; view: PlayerViewDto; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const npcId = group.npcId;
  const entry = findChatEntry(view, npcId);
  const name = chatNpcName(entry, getNPC(npcId)?.name) ?? npcNamesFromView(view).get(npcId) ?? npcId;
  const role = sceneRole(view, npcId, getNPC(npcId)?.role);
  return <div className="game-scene-npc">
    <Portrait seed={portraitSeed(view.caseId, npcId)} name={name} size="small" />
    <span><strong>{name}</strong>{role ? ` · ${role}` : ''}</span>
    {group.offers.map(offer => (
      <button key={offer.id} type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
        onClick={event => onOffer(offer, event.currentTarget)}>{offer.label}</button>
    ))}
  </div>;
}

/** Lista de ofertas con su botón cada una (viajes u otras acciones). */
function SceneOfferList({ offers, disabled, onOffer }: { offers: PublicActionOffer[]; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  return <ul>{offers.map(offer => (
    <li key={offer.id}>
      <button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
        onClick={event => onOffer(offer, event.currentTarget)}>{offer.label}{offer.detail ? ` · ${offer.detail}` : ''}</button>
    </li>))}</ul>;
}

/** Estado de la escena: evidencias en poder, solicitudes, órdenes y
 * detenciones. Solo se muestra lo que hay. Los identificadores se traducen:
 * las órdenes y detenciones nombran a la persona, y cada evidencia lleva su
 * texto legible y su tipo en español (antes se veían `warrant:ines`, `ines`
 * y `EV-06` solos). */
function SceneMeta({ view }: { view: PlayerViewDto }) {
  const t = useTranslation();
  const lookup = lookupFromView(view);
  return <div className="game-scene-meta">
    {view.objects.length > 0 && <p>{t('game.inPossession', { items: view.objects.map(item => `${view.evidenceTexts[item.id] ?? item.id} (${evidenceTypeLabel(item.type, t)})`).join(', ') })}</p>}
    {view.pendingRequests.length > 0 && <p>{t('game.pendingRequests', { items: view.pendingRequests.map(item => `${requestTypeLabel(item.type, t)} (min ${item.dueMinute})`).join(', ') })}</p>}
    {view.warrants.length > 0 && <p>{t('game.warrants', { items: view.warrants.map(item => warrantText(item, lookup.npcName, t)).join(', ') })}</p>}
    {view.detentions.length > 0 && <p>{t('game.detentions', { items: view.detentions.map(id => lookup.npcName(id) ?? id).join(', ') })}</p>}
  </div>;
}

/** Acciones de la escena, agrupadas: quién hay aquí, viajes y el resto. */
function SceneActions({ view, grouped, disabled, onOffer, onOpenLab }: { view: PlayerViewDto; grouped: ReturnType<typeof groupOffers>; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void; onOpenLab: () => void }) {
  const t = useTranslation();
  const finishOffer = grouped.finish;
  if (view.status === 'closed') return <p className="game-scene-closed">{t('game.closedNote')}</p>;
  return <>
    {(grouped.talk.length > 0 || grouped.inspect.length > 0) && <div className="game-scene-group">
      <p className="game-overline">{t('game.inScene')}</p>
      {groupTalkOffers(grouped.talk).map(group => (
        <SceneNpcGroup key={group.npcId} group={group} view={view} disabled={disabled} onOffer={onOffer} />
      ))}
      {grouped.inspect.map(offer => (
        <p key={offer.id}><button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
          onClick={event => onOffer(offer, event.currentTarget)}>{offer.label}{offer.detail ? ` · ${offer.detail}` : ''}</button></p>
      ))}
    </div>}
    {grouped.lab.length > 0 && <div className="game-scene-group">
      <p className="game-overline">{t(WINDOW_KEYS.lab)}</p>
      <p><button type="button" data-testid="open-lab" disabled={disabled} onClick={onOpenLab}>
        {grouped.lab.length === 1 ? t('game.labOne') : t('game.labMany', { count: grouped.lab.length })}</button></p>
    </div>}
    {grouped.travel.length > 0 && <div className="game-scene-group">
      <p className="game-overline">{t('game.travel')}</p>
      <SceneOfferList offers={grouped.travel} disabled={disabled} onOffer={onOffer} />
    </div>}
    {(grouped.other.length > 0 || finishOffer) && <div className="game-scene-group">
      <p className="game-overline">{t('game.otherActions')}</p>
      <SceneOfferList offers={grouped.other} disabled={disabled} onOffer={onOffer} />
      {finishOffer && <p><button type="button" className="game-primary-button" data-testid="offer-finish" disabled={disabled}
        onClick={event => onOffer(finishOffer, event.currentTarget)}>{finishOffer.label}</button></p>}
    </div>}
  </>;
}

/** Objetivos siempre visibles (lote 2 de jugabilidad): el panel vive en el
 * flujo principal, entre la barra de herramientas y la escena, para que el
 * jugador vea en todo momento qué tiene que conseguir y qué lleva logrado.
 * Los objetivos y su estado vienen de la vista del servidor (la misma
 * evaluación que el informe final, pero en vivo); las frases son las del
 * expediente, sin spoilers más allá de lo que ellas mismas dicen. */
function ObjectivesSection({ view }: { view: PlayerViewDto }) {
  const t = useTranslation();
  return <section className="game-objectives" aria-labelledby="objectives-heading" data-testid="objectives-panel">
    <p className="game-overline" id="objectives-heading">{t('game.objectives')}</p>
    <ul>{view.objectives.map(objective =>
      <li key={objective.id} data-testid={`objective-${objective.id}`} data-achieved={objective.achieved}>
        <span aria-hidden="true">{objective.achieved ? '✓' : '○'}</span> <span className="game-sr-only">{objectiveStateText(objective.achieved, t)}: </span>{objective.description}
      </li>)}
    </ul>
  </section>;
}

/** Escena (lote 1 de jugabilidad): el arte es propio de cada localización
 * (ver scene-art.tsx) y las acciones disponibles del motor se muestran
 * agrupadas dentro de la escena: quién hay aquí (con su rol) y qué se puede
 * inspeccionar, a dónde se puede viajar, y el resto de acciones. Cada oferta
 * sale una sola vez y con su mismo testid, así que la caja de texto libre
 * queda para las órdenes creativas. */
function SceneSection({ view, disabled, clockPulse, onOffer, onOpenLab, chatPanel }: { view: PlayerViewDto; disabled: boolean; clockPulse: { key: number; delta: number } | null; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void; onOpenLab: () => void; chatPanel?: ReactNode }) {
  const t = useTranslation();
  const locationIndex = view.locations.findIndex(location => location.id === view.position.location.id) + 1;
  const grouped = groupOffers(view.offers);
  return <section className="game-scene" id="game-scene" tabIndex={-1} aria-labelledby="scene-heading">
    <div className="game-scene-top"><span>{t('game.location', { num: String(locationIndex).padStart(2, '0') })}</span><span>{view.position.city.name.toUpperCase()} · {view.position.city.country}</span></div>
    <SceneArt locationId={view.position.location.id} />
    <div className="game-scene-caption"><div><p className="game-overline">{view.position.city.name}</p><h2 id="scene-heading">{view.position.location.name}</h2></div>{clockPulse && <SceneHourglass delta={clockPulse.delta} animKey={clockPulse.key} />}</div>
    <p className="game-scene-description">{view.position.location.description}</p>
    <SceneMeta view={view} />
    <SceneActions view={view} grouped={grouped} disabled={disabled} onOffer={onOffer} onOpenLab={onOpenLab} />
    {chatPanel}
  </section>;
}

/** Escribe el texto de forma progresiva, como en una máquina de escribir
 * (estilo MS-DOS): el resultado de la última acción aparece poco a poco en
 * vez de hacerlo de golpe. Con movimiento reducido (interruptor manual o
 * sistema) se muestra entero. */
function useTypewriter(text: string, active: boolean, reduced: boolean): string {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) { setShown(text.length); return; }
    if (!active) { setShown(0); return; }
    setShown(0);
    if (text.length === 0) return;
    const duration = Math.min(1200, Math.max(250, text.length * 10));
    const step = Math.max(1, Math.ceil(text.length / Math.ceil(duration / 40)));
    const timer = window.setInterval(() => {
      setShown(current => {
        const next = current + step;
        if (next >= text.length) { window.clearInterval(timer); return text.length; }
        return next;
      });
    }, 40);
    return () => window.clearInterval(timer);
  }, [text, active, reduced]);
  return text.slice(0, shown);
}

type LogEntry = { minute: number; summary: string; detail?: string };

/** ¿Sigue escribiéndose la última entrada de la consola? */
function isLastEntryTyping(last: LogEntry | undefined, summaryTyped: string, detailTyped: string): boolean {
  if (!last) return false;
  return summaryTyped.length < last.summary.length ||
    (last.detail !== undefined && detailTyped.length < last.detail.length);
}

/** Una entrada de la consola: el resumen y, si lo hay, el detalle de los
 * descubrimientos. La última entrada se escribe progresivamente (los textos
 * ya vienen escritos por el hook de la consola). */
function ConsoleLogItem({ entry, isLast, summaryTyped, detailTyped, typing }: { entry: LogEntry; isLast: boolean; summaryTyped: string; detailTyped: string; typing: boolean }) {
  return <li><span className="game-log-minute">[min {entry.minute}]</span> {isLast ? summaryTyped : entry.summary}
    {entry.detail && <span className="game-log-detail">{isLast ? detailTyped : entry.detail}</span>}
    {isLast && typing && <span className="game-typing-cursor" aria-hidden="true">▌</span>}</li>;
}

/** Texto que anuncia el lector de pantalla (§15): la última entrada
 * entera, solo cuando termina de escribirse y solo si el interruptor está
 * activo. Así no se repite la narración entera en cada cambio pequeño. */
function narrationAnnounceText(last: LogEntry | undefined, typing: boolean, enabled: boolean): string {
  if (!enabled || typing || !last) return '';
  return last.detail ? `${last.summary} ${last.detail}` : last.summary;
}

function ConsoleSection({ log, orderHistory, readBar, reducedMotion, announceNarration }: { log: LogEntry[]; orderHistory: string[]; readBar?: ReactNode; reducedMotion: boolean; announceNarration: boolean }) {
  const t = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const last = log[log.length - 1];
  // La última entrada se escribe progresivamente: primero el resumen y,
  // cuando termina, el detalle de los descubrimientos.
  const summaryTyped = useTypewriter(last?.summary ?? '', true, reducedMotion);
  const detailTyped = useTypewriter(last?.detail ?? '', !!last && summaryTyped === last.summary, reducedMotion);
  const lastTyping = isLastEntryTyping(last, summaryTyped, detailTyped);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [log, summaryTyped, detailTyped]);
  // Anuncio para lectores de pantalla (§15): la lista NO es aria-live (el
  // efecto máquina de escribir anunciaría el texto a trozos); una región
  // oculta anuncia la última entrada entera solo cuando termina de
  // escribirse.
  const announceText = narrationAnnounceText(last, lastTyping, announceNarration);
  return <section className="game-console" aria-labelledby="console-heading">
    <p className="game-overline">{t('game.fieldNotes')}</p>
    <h2 id="console-heading">{t('game.console')}</h2>
    {readBar}
    <ol ref={listRef}>
      {log.length === 0 && <li>{t('game.consoleEmpty')}</li>}
      {log.map((entry, index) => <ConsoleLogItem key={index} entry={entry} isLast={index === log.length - 1}
        summaryTyped={summaryTyped} detailTyped={detailTyped} typing={lastTyping} />)}
    </ol>
    <p className="game-sr-only" aria-live="polite" data-testid="narration-announcer">{announceText}</p>
    <span className="game-narrative-cursor" aria-hidden="true">_</span>
    {orderHistory.length > 0 && <details><summary>{t('game.orderHistory')}</summary><ol>{orderHistory.map((item, index) => <li key={index}>{item}</li>)}</ol></details>}
  </section>;
}

/** Aviso al pulsar «Leer» sin voces disponibles (GDD §15): el texto sigue
 * visible y el juego no se bloquea; solo se explica por qué no suena. La
 * condición vive aquí para no engordar la complejidad de quien lo usa. */
function NoVoicesNotice({ show, testId }: { show?: boolean | undefined; testId: string }) {
  const t = useTranslation();
  if (!show) return null;
  return <p className="game-notice" role="status" data-testid={testId}>{t('game.noVoices')}</p>;
}

/** Barra de lectura en voz alta de la consola (GDD §15): leer la última
 * entrada, repetirla, pausar/reanudar y detener. Solo se habilita cuando
 * el TTS está activado y no silenciado; el texto siempre sigue visible. */
function ReadAloudBar({ text, canRead, speaking, paused, hasLast, noVoices, onRead, onRepeat, onPauseResume, onStop }: {
  text: string; canRead: boolean; speaking: boolean; paused: boolean; hasLast: boolean; noVoices?: boolean;
  onRead: () => void; onRepeat: () => void; onPauseResume: () => void; onStop: () => void;
}) {
  const t = useTranslation();
  return <div className="game-read-bar" role="group" aria-label={t('game.readAloud')}>
    <button type="button" data-testid="tts-read" disabled={!canRead || !text} onClick={onRead}>{t('game.read')}</button>
    <button type="button" data-testid="tts-repeat" disabled={!canRead || !hasLast} onClick={onRepeat}>{t('game.repeat')}</button>
    <button type="button" data-testid="tts-pause" disabled={!speaking && !paused} onClick={onPauseResume}>{paused ? t('game.resume') : t('game.pause')}</button>
    <button type="button" data-testid="tts-stop" disabled={!speaking && !paused} onClick={onStop}>{t('game.stop')}</button>
    <NoVoicesNotice show={noVoices} testId="tts-no-voices" />
  </div>;
}

/** Lectura automática de la última entrada de la consola cuando llega una
 * nueva (GDD §15): solo si el TTS está activado, con autoRead y sin
 * silenciar. El texto ya está en pantalla; la voz solo lo acompaña. */
function useAutoReadLog(log: LogEntry[], enabled: boolean, speak: (text: string) => boolean): void {
  const seenRef = useRef(0);
  useEffect(() => {
    const last = log[log.length - 1];
    const isNew = log.length > seenRef.current;
    seenRef.current = log.length;
    if (!isNew || !last || !enabled) return;
    speak(last.detail ? `${last.summary} ${last.detail}` : last.summary);
  }, [log, enabled, speak]);
}

/** Lectura automática de la última respuesta de un personaje (chat o
 * terminal): misma condición que la narración, solo turnos del NPC. */
function useAutoReadTurns(turns: ChatTurn[], enabled: boolean, speak: (text: string) => boolean): void {
  const seenRef = useRef(0);
  useEffect(() => {
    const last = turns[turns.length - 1];
    const isNew = turns.length > seenRef.current;
    seenRef.current = turns.length;
    if (!isNew || !last || last.from !== 'npc' || !enabled) return;
    speak(last.text);
  }, [turns, enabled, speak]);
}

/** Texto de la última entrada de la consola (resumen + detalle). */
function lastLogTextOf(log: LogEntry[]): string {
  const last = log[log.length - 1];
  if (!last) return '';
  return last.detail ? `${last.summary} ${last.detail}` : last.summary;
}

/** Controlador TTS del navegador, o el nulo si no hay síntesis de voz. */
function createTtsControllerForWindow(): TTSController {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) return createTTSController();
  return createNoopTTSController();
}

/** Voces del sistema: pueden llegar vacías hasta `voiceschanged`, y la
 * lista se refresca cuando el sistema las ofrece. */
function useTtsVoices(controller: TTSController): TTSVoice[] {
  const [voices, setVoices] = useState<TTSVoice[]>(() => controller.getVoices());
  useEffect(() => {
    const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    const refresh = () => setVoices(controller.getVoices());
    refresh();
    if (!synth) return undefined;
    synth.addEventListener('voiceschanged', refresh);
    return () => synth.removeEventListener('voiceschanged', refresh);
  }, [controller]);
  return voices;
}

interface TtsSpeaker {
  speaking: boolean;
  paused: boolean;
  lastText: string;
  noVoices: boolean;
  speak: (text: string) => boolean;
  pauseOrResume: () => void;
  stop: () => void;
}

/** Lectura en voz alta: hablar, pausar/reanudar y detener, con el volumen
 * y la voz de las preferencias. Cambiar de voz o de velocidad en mitad de
 * una lectura cancela la anterior para no dejar el sintetizador colgado, y
 * el mute cancela la narración en curso. Sin voces disponibles al pulsar,
 * no se finge hablar: se marca el aviso y la lectura no se intenta. */
function useTtsSpeaker(preferences: PresentationPreferences, controller: TTSController): TtsSpeaker {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastText, setLastText] = useState('');
  const [noVoices, setNoVoices] = useState(false);

  const speak = useCallback((text: string): boolean => {
    if (!preferences.tts.enabled || preferences.audio.muted || !text.trim()) return false;
    if (controller.getVoices().length === 0) {
      setNoVoices(true);
      return false;
    }
    controller.cancel();
    // `exactOptionalPropertyTypes`: la voz solo se pasa si no es 'auto'.
    // La voz sigue el idioma de la interfaz (lote pequeños del catálogo
    // 2026-11-10): en `auto` el controlador elige voz de ese idioma.
    const options: TTSOptions = { rate: preferences.tts.rate, volume: preferences.audio.narrationVolume / 100, language: preferences.language };
    if (preferences.tts.voice !== 'auto') options.voice = preferences.tts.voice;
    const ok = controller.speak(text, options);
    if (ok) {
      setLastText(text);
      setSpeaking(true);
      setPaused(false);
      setNoVoices(false);
    }
    return ok;
  }, [preferences, controller]);

  useEffect(() => {
    if (!preferences.audio.muted) return;
    controller.cancel();
    setSpeaking(false);
    setPaused(false);
    setNoVoices(false);
  }, [preferences.audio.muted, controller]);

  useEffect(() => {
    if (preferences.tts.enabled) return;
    setNoVoices(false);
  }, [preferences.tts.enabled]);

  function pauseOrResume(): void {
    if (paused) {
      controller.resume();
      setPaused(false);
    } else if (speaking) {
      controller.pause();
      setPaused(true);
    }
  }

  function stop(): void {
    controller.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  return { speaking, paused, lastText, noVoices, speak, pauseOrResume, stop };
}

/** Motor de música y efectos: volúmenes y mute de las preferencias, y
 * arranque solo tras el primer gesto del usuario (autoplay). */
function useMusicEngine(audio: PresentationPreferences['audio']): { playEffect: (kind: EffectKind) => void } {
  const engineRef = useRef<ReturnType<typeof createMusicEngine> | null>(null);
  if (engineRef.current === null) engineRef.current = createMusicEngine();
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (interacted) return undefined;
    const mark = () => setInteracted(true);
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, [interacted]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMusicVolume(audio.musicVolume);
    engine.setEffectsVolume(audio.effectsVolume);
    engine.setMuted(audio.muted);
    if (audio.musicEnabled && !audio.muted && audio.musicVolume > 0 && interacted) engine.start();
    else engine.stop();
  }, [audio, interacted]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const playEffect = useCallback((kind: EffectKind) => engineRef.current?.playEffect(kind), []);
  return { playEffect };
}

interface GameAudio {
  voices: TTSVoice[];
  speaking: boolean;
  paused: boolean;
  lastText: string;
  noVoices: boolean;
  canRead: boolean;
  autoReadOn: boolean;
  ttsSupported: boolean;
  speak: (text: string) => boolean;
  pauseOrResume: () => void;
  stop: () => void;
  playEffect: (kind: EffectKind) => void;
}

/** Audio y TTS de la pantalla de juego (GDD §15): compone el controlador
 * TTS, sus voces y su lector con el motor de música y efectos. El aviso de
 * falta de voces solo vive mientras no hay voces: si llegan después
 * (`voiceschanged`), desaparece solo y Leer funciona sin recargar. */
function useGameAudio(preferences: PresentationPreferences): GameAudio {
  const controllerRef = useRef<TTSController | null>(null);
  if (controllerRef.current === null) controllerRef.current = createTtsControllerForWindow();
  const controller = controllerRef.current;
  const voices = useTtsVoices(controller);
  const speaker = useTtsSpeaker(preferences, controller);
  const music = useMusicEngine(preferences.audio);
  return {
    voices,
    speaking: speaker.speaking,
    paused: speaker.paused,
    lastText: speaker.lastText,
    noVoices: speaker.noVoices && voices.length === 0,
    canRead: preferences.tts.enabled && !preferences.audio.muted,
    autoReadOn: preferences.tts.enabled && preferences.tts.autoRead && !preferences.audio.muted,
    ttsSupported: controller.getStatus().supported,
    speak: speaker.speak,
    pauseOrResume: speaker.pauseOrResume,
    stop: speaker.stop,
    playEffect: music.playEffect,
  };
}

function OrderSection({ draft, closed, busy, orderPhase, inputRef, onDraft, onSubmit, onKeyDown, onCancel, onRecover }: {
  draft: string; closed: boolean; busy: boolean; orderPhase: OrderPhase; inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void; onSubmit: (event: FormEvent) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void; onRecover: () => void;
}) {
  const t = useTranslation();
  return <section className="game-order" aria-labelledby="order-heading">
    <div className="game-order-label">
      <label id="order-heading" htmlFor="order-input">{t('game.orderTitle')}</label>
      <span>{t('game.orderHint')}</span>
    </div>
    <form onSubmit={onSubmit}>
      <span className="game-prompt-symbol" aria-hidden="true">&gt;</span>
      <textarea id="order-input" data-testid="order-input" ref={inputRef} rows={3} value={draft}
        onChange={event => onDraft(event.target.value)} onKeyDown={onKeyDown}
        disabled={closed || busy} placeholder={t('game.orderPlaceholder')} />
      <button type="submit" className="game-primary-button" data-testid="order-submit" disabled={closed || !draft.trim() || busy}>
        {orderPhase.kind === 'interpreting' ? t('game.interpreting') : t('game.interpretOrder')}
      </button>
    </form>
    <div className="game-order-bottom"><p>{t('game.orderKeys')}</p></div>
    <p className="game-order-hint">{t('game.orderHelp')}<Link to="/glosario">{t('game.viewGlossary')}</Link></p>
    {orderPhase.kind === 'clarification' && <div className="game-clarification" role="dialog" aria-label={t('game.clarification')}>
      <p><strong>{t('game.beforeActing')}</strong> {orderPhase.question}</p>
      <p>{t('game.originalOrder', { original: orderPhase.original })}</p>
      <button type="button" onClick={onCancel}>{t('game.understood')}</button>
    </div>}
    {orderPhase.kind === 'error' && <p className="game-error" role="alert">{orderPhase.message} <button type="button" onClick={onCancel}>{t('common.close')}</button></p>}
    {orderPhase.kind === 'recovering' && <div className="game-recovering" role="alert">
      <p>{orderPhase.message}</p>
      <button type="button" onClick={onRecover}>{t('game.recoverResult')}</button>
      <button type="button" onClick={onCancel}>{t('game.discard')}</button>
    </div>}
  </section>;
}

/** Animación de viaje estilo Carmen Sandiego (lote 1 de jugabilidad): al
 * confirmar un viaje, una ruta con el avión cruzando el mapa aparece sobre
 * la pantalla mientras el reloj ya avanzó y la escena ya es la de destino.
 * No bloquea nada: los clics pasan por debajo salvo el botón «Seguir», y
 * solo se cierra al pulsarlo — antes se cerraba sola a los 2,8 s y el
 * botón dejaba de responder si el jugador tardaba en leerla. */
function TravelOverlay({ travel, onDismiss }: { travel: { from: string; to: string; detail: string }; onDismiss: () => void }) {
  const t = useTranslation();
  return <div className="game-travel" data-testid="travel-animation" role="status">
    <div className="game-travel-panel">
      <p className="game-overline">{t('game.travel')}</p>
      <p><strong>{t('game.travelFromTo', { from: travel.from, to: travel.to })}</strong>{travel.detail ? ` · ${travel.detail}` : ''}</p>
      <div className="game-travel-route" aria-hidden="true">
        <span className="game-travel-line" />
        <svg className="game-travel-plane" viewBox="0 0 24 16" shapeRendering="crispEdges" focusable="false">
          <rect x="4" y="7" width="16" height="2" fill="#ffff55" />
          <rect x="10" y="3" width="3" height="10" fill="#ffff55" />
          <rect x="2" y="5" width="3" height="6" fill="#ffff55" />
          <rect x="18" y="6" width="4" height="4" fill="#ffff55" />
        </svg>
        <span className="game-travel-city game-travel-from">{travel.from}</span>
        <span className="game-travel-city game-travel-to">{travel.to}</span>
      </div>
      <p className="game-panel-note">{t('game.travelNote', { to: travel.to })}</p>
      <button type="button" onClick={onDismiss}>{t('game.continue')}</button>
    </div>
  </div>;
}

function TravelOverlaySlot({ travel, onDismiss }: { travel: { from: string; to: string; detail: string; key: number } | null; onDismiss: () => void }) {
  if (!travel) return null;
  return <TravelOverlay travel={travel} onDismiss={onDismiss} />;
}

/** Minutos que avanzó el reloj al confirmar una acción. */
function clockDelta(previous: PlayerViewDto | null, response: ActionResponseDto): number {
  const before = previous?.clock.minute ?? response.clock.minute;
  return response.clock.minute - before;
}

/** Datos de la animación de viaje: de dónde a dónde y con qué duración. */
function travelPayload(previous: PlayerViewDto | null, response: ActionResponseDto, offer: PublicActionOffer): { from: string; to: string; detail: string; key: number } {
  return { from: previous?.position.city.name ?? '', to: response.position.city.name, detail: offer.detail ?? '', key: Date.now() };
}

/** Reloj de arena y animación de viaje (lote 1 de jugabilidad): efectos
 * cosméticos que se disparan al confirmar una acción, según cuánto avanzó
 * el reloj y si la acción fue un viaje. Viven en un hook para no engordar
 * applyResponse con ramas. */
function useTimeFeedback() {
  const [clockPulse, setClockPulse] = useState<{ key: number; delta: number } | null>(null);
  const [travel, setTravel] = useState<{ from: string; to: string; detail: string; key: number } | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const apply = useCallback((previous: PlayerViewDto | null, response: ActionResponseDto, offer?: PublicActionOffer) => {
    const delta = clockDelta(previous, response);
    if (delta > 0) {
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
      setClockPulse({ key: Date.now(), delta });
      pulseTimerRef.current = window.setTimeout(() => setClockPulse(null), 2600);
    }
    // El aviso de viaje NO se cierra solo: se queda hasta pulsar «Seguir».
    if (offer?.action.type === 'travel') setTravel(travelPayload(previous, response, offer));
  }, []);
  const dismissTravel = useCallback(() => {
    setTravel(null);
  }, []);
  return { clockPulse, travel, apply, dismissTravel };
}

function PreviewDialog({ phase, confirmRef, onConfirm, onCancel }: {
  phase: Extract<OrderPhase, { kind: 'preview' }>; confirmRef: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  return <div className="game-preview-backdrop">
    <div className="game-preview" role="dialog" aria-modal="true" aria-labelledby="preview-heading" data-testid="preview-dialog"
      ref={dialogRef} onKeyDown={event => { if (dialogRef.current) trapTabKey(event, dialogRef.current); }}>
      <h2 id="preview-heading">{t('game.confirmAction')}</h2>
      <p><strong>{phase.offer.label}</strong>{phase.offer.detail ? ` · ${phase.offer.detail}` : ''}</p>
      {phase.response.preview
        ? <p>{phase.response.preview.description}</p>
        : <p>{t('game.confirmNote')}</p>}
      {phase.response.preview && <p className="game-preview-facts"><span>{t('game.estimatedDuration', { minutes: phase.response.preview.estimatedMinutes })}</span><span>{t('game.estimatedEnd', { minute: phase.response.preview.estimatedEndTime })}</span></p>}
      <div className="game-preview-actions">
        <button type="button" className="game-primary-button" ref={confirmRef} data-testid="preview-confirm" onClick={onConfirm}>{t('common.confirm')}</button>
        <button type="button" data-testid="preview-cancel" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  </div>;
}

// ── Contenidos de ventanas ──────────────────────────────────────────────────────

function MapContent({ view, busy, onOffer }: { view: PlayerViewDto; busy: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const t = useTranslation();
  const [query, setQuery] = useState('');
  const travelOffers = view.offers.filter(offer => offer.action.type === 'travel');
  const offerByCity = new Map(travelOffers.map(offer => [String(offer.action.params.toCityId), offer]));
  // El atlas enseña las ciudades turísticas siempre y las del expediente
  // solo cuando están descubiertas: en libre, una ciudad no descubierta no
  // se lista (pero el buscador admite viajar a ella si se conoce su nombre).
  const visibleAtlas = view.atlas.filter(city => city.kind === 'tourist' || city.discovered);
  const byId = new Map(GEOGRAPHIC_CATALOG.map(city => [city.id, city]));
  const currentId = view.position.city.id;
  const results = query.trim() ? searchCities(query.trim()) : [];
  const touristHere = touristInfoFor(currentId);
  // Oferta de viaje a una ciudad: la de la escena si existe (manda la ruta
  // del expediente), si no la del catálogo cuando hay ruta directa. Sin
  // ruta directa no se ofrece el viaje: hay que pasar por otra ciudad.
  function travelOfferFor(cityId: string, name: string): PublicActionOffer | null {
    const offer = offerByCity.get(cityId);
    if (offer) return offer;
    const isCase = view.atlas.find(entry => entry.id === cityId)?.kind === 'case';
    // Una ciudad del expediente no descubierta no tiene oferta en la escena,
    // pero el buscador admite viajar a ella: el diálogo de confirmación
    // enseña la duración real de la ruta del expediente.
    if (isCase) return { id: 'travel:' + cityId, label: t('game.travelTo', { name }), detail: '', action: { type: 'travel', params: { toCityId: cityId } } };
    const route = getRoute(currentId, cityId);
    if (!route) return null;
    return { id: 'travel:' + cityId, label: t('game.travelTo', { name }), detail: route.minutes + ' min', action: { type: 'travel', params: { toCityId: cityId } } };
  }
  return <div>
    <p className="game-overline">{t('game.atlasOverline')}</p>
    <h4>{t('game.atlasTitle')}</h4>
    <div className="game-atlas" role="img" aria-label={t('game.atlasAria', { cities: visibleAtlas.map(city => city.name).join(', ') })}><div className="game-atlas-land" />{visibleAtlas.map(city => {
      const position = byId.get(city.id)?.coordinates;
      if (!position) return null;
      return <span key={city.id} className={`game-atlas-city game-atlas-city--${city.kind}`} style={{ left: position.x + '%', top: position.y + '%' }}>{city.name}</span>;
    })}</div>
    <label>{t('game.searchCity')} <input type="search" data-testid="map-search" placeholder={t('game.searchPlaceholder')} value={query} onChange={event => setQuery(event.target.value)} /></label>
    {query.trim() !== '' && <ul className="game-destination-list" data-testid="map-search-results">
      {results.length === 0
        ? <li><span>{t('game.searchEmpty', { query: query.trim() })}</span></li>
        : results.map(city => {
          const current = city.id === currentId;
          const atlasEntry = view.atlas.find(entry => entry.id === city.id);
          const offer = current ? null : travelOfferFor(city.id, city.name);
          return <li key={city.id} data-city={city.id}>
            <span><strong>{city.name}, {city.countryName}</strong><small>{current ? t('game.youAreHere') : t(atlasEntry?.kind === 'case' ? 'game.atlasCase' : 'game.atlasTourist')}</small></span>
            {offer && <button type="button" data-testid={`travel-search-${city.id}`} disabled={busy} onClick={event => onOffer(offer, event.currentTarget)}>{offer.detail ? t('game.travelButton', { detail: offer.detail }) : t('game.travelTo', { name: city.name })}</button>}
            {!current && !offer && <small>{t('game.noDirectRoute', { from: view.position.city.name })}</small>}
          </li>;
        })}
    </ul>}
    {query.trim() === '' && <ul className="game-destination-list">
      {visibleAtlas.filter(city => city.id !== currentId).map(city => {
        const offer = travelOfferFor(city.id, city.name);
        return <li key={city.id} data-city={city.id}>
          <span><strong>{city.name}, {city.country}</strong><small>{t(city.kind === 'case' ? 'game.atlasCase' : 'game.atlasTourist')}</small></span>
          {offer && <button type="button" data-testid={`travel-${city.id}`} disabled={busy} onClick={event => onOffer(offer, event.currentTarget)}>{offer.detail ? t('game.travelButton', { detail: offer.detail }) : t('game.travelTo', { name: city.name })}</button>}
          {!offer && <small>{t('game.noDirectRoute', { from: view.position.city.name })}</small>}
        </li>;
      })}
    </ul>}
    {touristHere && <div><h4>{t('game.touristLandmarks')}</h4><p>{view.position.location.description}</p><ul>{touristHere.landmarks.map(landmark => <li key={landmark}>{landmark}</li>)}</ul></div>}
    <h4>{t('game.knownPlaces')}</h4>
    <ul className="game-destination-list">{view.locations.map(location => <li key={location.id}><span><strong>{location.name}</strong>{location.id === view.position.location.id ? t('game.hereSuffix') : ''}<small>{location.description}</small></span></li>)}</ul>
  </div>;
}

function BriefingText({ briefing }: { briefing: NonNullable<PlayerViewDto['briefing']> }) {
  const t = useTranslation();
  return <div><p><em>{t('initialRun.briefingIntro', { speaker: briefing.speaker })}</em></p>{briefing.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
}

/** Introducción del caso: qué ha ocurrido y qué tienes que resolver. Se
 * muestra al entrar en una partida nueva (versión 1, minuto 0) y queda
 * guardada por partida en esta pestaña; se puede volver a abrir desde la
 * barra de herramientas y siempre está en el dossier. */
function BriefingSection({ view, onDismiss }: { view: PlayerViewDto; onDismiss: () => void }) {
  const t = useTranslation();
  if (!view.briefing) return null;
  return <section className="game-briefing" aria-label={t('initialRun.briefingTitle')}>
    <p className="game-overline">{t('initialRun.briefingTitle')}</p>
    <h2>{view.briefing.title}</h2>
    <BriefingText briefing={view.briefing} />
    <button type="button" onClick={onDismiss}>{t('game.understoodInvestigate')}</button>
  </section>;
}

function IntroPanel({ view, open, onDismiss }: { view: PlayerViewDto; open: boolean; onDismiss: () => void }) {
  if (!open || !view.briefing) return null;
  return <BriefingSection view={view} onDismiss={onDismiss} />;
}

function IntroButton({ view, onOpen }: { view: PlayerViewDto; onOpen: () => void }) {
  const t = useTranslation();
  if (!view.briefing) return null;
  return <button type="button" onClick={onOpen}>{t('game.introButton')}</button>;
}

/** Resumen al retomar la partida (§13): se abre solo al entrar en una
 * partida en curso (minuto > 0, activa) salvo que ya se haya descartado en
 * esta pestaña; queda recuperable desde la barra de herramientas. Los datos
 * salen de `resumeSummary` (vista del jugador + estado del motor). */
function ResumePanel({ view, open, onDismiss }: { view: PlayerViewDto; open: boolean; onDismiss: () => void }) {
  const t = useTranslation();
  const { preferences } = usePreferences();
  if (!open) return null;
  const summary = resumeSummary(view, lookupFromView(view), (id, lookup) => discoveryText(id, lookup, textsFromView(view), view.caseId, preferences.language));
  return <section className="game-briefing" data-testid="resume-panel" aria-label={t('game.resumeTitle')}>
    <p className="game-overline">{t('game.resumeTitle')}</p>
    <h2>{t('game.resumeHeading')}</h2>
    <p>{t('game.resumeLine', { minute: summary.minute, deadline: summary.deadlineMinutes, remaining: summary.remainingMinutes, city: summary.currentCity, location: summary.currentLocation })}</p>
    <h4>{t('game.objectives')}</h4>
    <ul>{summary.objectives.map(objective => <li key={objective.description}>{objective.achieved ? '✓' : '○'} <span className="game-sr-only">{objectiveStateText(objective.achieved, t)}: </span>{objective.description}</li>)}</ul>
    <h4>{t('game.visitedCities')}</h4>
    <p>{summary.visitedCities.join(', ')}</p>
    <h4>{t('game.lastFindings')}</h4>
    {summary.lastDiscoveries.length === 0
      ? <p>{t('game.noFindings')}</p>
      : <ul>{summary.lastDiscoveries.map((discovery, index) => <li key={index}>{discovery}</li>)}</ul>}
    <p>{t('game.resumeCounts', {
      detentions: summary.detentions, warrants: summary.warrants,
      pending: summary.pendingRequests.length === 0
        ? t('game.none')
        : summary.pendingRequests.map(request => `${requestTypeLabel(request.type, t)} (min ${request.dueMinute})`).join(', '),
    })}</p>
    <button type="button" onClick={onDismiss}>{t('game.resumeContinue')}</button>
  </section>;
}

function DossierContent({ view, onRead, canRead, noVoices }: { view: PlayerViewDto; onRead?: (text: string) => void; canRead?: boolean; noVoices?: boolean }) {
  const t = useTranslation();
  const { preferences } = usePreferences();
  const lookup = lookupFromView(view);
  const npcName = (id: string) => lookup.npcName(id);
  return <div>
    <div><h4>{t('game.dossierSheet')}</h4><p>{t('game.dossierCrime', { label: caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating, t) })}</p></div>
    {view.briefing && <div><h4>{t('initialRun.briefingTitle')}</h4><BriefingText briefing={view.briefing} /></div>}
    <h4>{t('game.evidenceOwned')}</h4>
    {view.objects.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noEvidence')}</p></div>
      : <table><thead><tr><th>{t('game.col.evidence')}</th><th>{t('game.col.type')}</th><th>{t('game.col.origin')}</th><th>{t('game.col.minute')}</th><th>{t('game.col.admissible')}</th></tr></thead>
        <tbody>{view.objects.map(item => <tr key={item.id}><td>{view.evidenceTexts[item.id] ?? item.id}</td><td>{evidenceTypeLabel(item.type, t)}</td><td>{item.origin}</td><td>{item.minute}</td><td>{item.admissible ? t('common.yes') : t('common.no')}</td></tr>)}</tbody></table>}
    <h4>{t('game.findings')}</h4>
    {view.dossier.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noFindings')}</p></div>
      : view.dossier.map((entry, index) => {
        const text = discoveryText(entry, lookup, textsFromView(view), view.caseId, preferences.language);
        return <article key={index} className="game-evidence-card"><span className="game-evidence-kind">{t('game.finding')}</span><p>{text}</p>
          {canRead && onRead && <p><button type="button" data-testid={`dossier-read-${index}`} onClick={() => onRead(text)}>{t('game.read')}</button></p>}
        </article>;
      })}
    <NoVoicesNotice show={noVoices} testId="tts-no-voices-dossier" />
    <p className="game-panel-note">{t('game.procedureNote')}</p>
    <h4>{t('game.recordedConversation')}</h4>
    {view.conversation.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noConversations')}</p></div>
      : <ul className="game-destination-list">{view.conversation.map((entry, index) => <li key={index}><span>{conversationRecordText(entry, npcName, undefined, id => lookup.locationName(id), preferences.language)}</span></li>)}</ul>}
  </div>;
}

type ChatTurn = { from: 'you' | 'npc'; text: string };

/** Conversación con un personaje: se abre sola al confirmar «hablar con»
 * alguien y muestra su saludo y sus respuestas como burbujas de chat. Los
 * turnos y la memoria de la conversación se guardan en esta pestaña por
 * partida y personaje; la memoria del servidor no se persiste (límite
 * documentado: al recargar la página la conversación sigue en esta pestaña,
 * pero una sesión nueva empieza de cero). */
function ChatContent({ npc, view, turns, draft, busy, error, onDraft, onSend, placeholder, note, onRead, canRead, noVoices }: {
  npc: { id: string; name: string } | null; view: PlayerViewDto; turns: ChatTurn[]; draft: string; busy: boolean; error: string;
  onDraft: (value: string) => void; onSend: (event: FormEvent) => void;
  placeholder?: string; note?: string; onRead?: (text: string) => void; canRead?: boolean; noVoices?: boolean;
}) {
  const t = useTranslation();
  if (!npc) {
    return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span>
      <p>{t('game.chatEmpty')}</p></div>;
  }
  const role = sceneRole(view, npc.id, getNPC(npc.id)?.role);
  return <div className="game-chat">
    <p className="game-chat-npc"><Portrait seed={portraitSeed(view.caseId, npc.id)} name={npc.name} size="medium" /><span><strong>{npc.name}</strong>{role ? ` · ${role}` : ''}</span></p>
    <ol className="game-chat-turns" data-testid="chat-turns" aria-live="polite">
      {turns.map((turn, index) => <li key={index} className={turn.from === 'you' ? 'game-chat-you' : 'game-chat-npc-turn'}>
        <span className="game-chat-speaker">{turn.from === 'you' ? t('game.you') : npc.name}</span>
        <span>{turn.text}</span>
        {turn.from === 'npc' && canRead && onRead && <button type="button" data-testid={`chat-read-${index}`} onClick={() => onRead(turn.text)}>{t('game.read')}</button>}
      </li>)}
    </ol>
    <NoVoicesNotice show={noVoices} testId="tts-no-voices-chat" />
    <form onSubmit={onSend} className="game-chat-form">
      <input type="text" data-testid="chat-input" value={draft} disabled={busy} maxLength={4000}
        placeholder={placeholder ?? t('game.chatPlaceholder')} aria-label={t('game.chatAria')}
        onChange={event => onDraft(event.target.value)} />
      <button type="submit" data-testid="chat-send" disabled={!draft.trim() || busy}>{busy ? t('game.asking') : t('game.ask')}</button>
    </form>
    {error && <p className="game-error" role="alert">{error}</p>}
    <p className="game-panel-note">{note ?? t('game.chatNote')}</p>
  </div>;
}

/** Conversación con un personaje DENTRO de la escena (sin ventana aparte):
 * el personaje no «desaparece» al hablar: su retrato, sus turnos y la
 * entrada de texto viven en línea en el panel de la escena, bajo las
 * acciones. Al cerrarla se vuelve a la vista normal de la escena. El foco
 * entra en el título de la charla al abrirla (o al cambiar de personaje) y
 * vuelve a quien la abrió al cerrarla (lo hace quien llama). */
function SceneChatPanel({ npc, view, turns, draft, busy, error, onDraft, onSend, onRead, canRead, noVoices, onClose }: {
  npc: { id: string; name: string }; view: PlayerViewDto; turns: ChatTurn[]; draft: string; busy: boolean; error: string;
  onDraft: (value: string) => void; onSend: (event: FormEvent) => void;
  onRead: (text: string) => void; canRead: boolean; noVoices: boolean; onClose: () => void;
}) {
  const t = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Al abrir la charla (o cambiar de personaje) el foco entra en su
  // título: quien navega con teclado no tiene que buscarla. Los turnos
  // nuevos no mueven el foco (el id no cambia).
  useEffect(() => { headingRef.current?.focus(); }, [npc.id]);
  return <section className="game-scene-chat" data-testid="scene-chat" aria-labelledby="scene-chat-heading">
    <div className="game-scene-chat-head">
      <h3 id="scene-chat-heading" ref={headingRef} tabIndex={-1}>{t('game.chatTitle', { name: npc.name })}</h3>
      <button type="button" data-testid="chat-close" onClick={onClose}>{t('game.chatClose')}</button>
    </div>
    <ChatContent npc={npc} view={view} turns={turns} draft={draft} busy={busy} error={error}
      onDraft={onDraft} onSend={onSend} onRead={onRead} canRead={canRead} noVoices={noVoices} />
  </section>;
}

/** Un análisis del laboratorio: su método forense, la prueba con su frase
 * del expediente y su estado (disponible, en curso o con resultado). */
function LabAnalysisItem({ offer, view, pendingAnalysis, disabled, onAnalyze }: {
  offer: PublicActionOffer; view: PlayerViewDto; pendingAnalysis: PlayerViewDto['pendingRequests'][number] | undefined;
  disabled: boolean; onAnalyze: (offer: PublicActionOffer, trigger: HTMLElement | null) => void;
}) {
  const t = useTranslation();
  const inputId = typeof offer.action.params.evidenceId === 'string' ? offer.action.params.evidenceId : '';
  const typeLabel = offer.forensicType && offer.forensicType in FORENSIC_TYPE_KEYS
    ? t(FORENSIC_TYPE_KEYS[offer.forensicType as ForensicType])
    : t('game.analysisLabel');
  const evidence = view.evidenceTexts[inputId] ?? inputId;
  return <li><span><strong>{typeLabel}</strong><small>{evidence}{offer.detail ? ` · ${offer.detail}` : ''}</small></span>
    {pendingAnalysis
      ? <span><small>{t('game.labInProgress', { due: pendingAnalysis.dueMinute, now: view.clock.minute })}</small></span>
      : <span> <button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
        onClick={event => onAnalyze(offer, event.currentTarget)}>{t('game.labRequestAnalysis')}</button></span>}
  </li>;
}

function LabContent({ view, labOffers, disabled, onAnalyze, onOpenIntel }: {
  view: PlayerViewDto;
  labOffers: PublicActionOffer[]; disabled: boolean;
  onAnalyze: (offer: PublicActionOffer, trigger: HTMLElement | null) => void; onOpenIntel: () => void;
}) {
  const t = useTranslation();
  // Un solo análisis por expediente: una solicitud de tipo análisis en
  // curso es la de la oferta que se enseña, y su resultado es la primera
  // evidencia revelada por un análisis (la vista la trae en
  // `analysisResults`, desde `evidenceRecords` del motor).
  const pendingAnalysis = view.pendingRequests.find(item => item.type === 'analysis');
  const analysisResult = view.analysisResults[0];
  return <div>
    <h4>{t('game.labTitle')}</h4>
    {labOffers.length === 0 && !analysisResult
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.labEmpty')}</p></div>
      : <ul className="game-destination-list">{labOffers.map(offer => (
        <LabAnalysisItem key={offer.id} offer={offer} view={view} pendingAnalysis={pendingAnalysis} disabled={disabled} onAnalyze={onAnalyze} />
      ))}</ul>}
    {analysisResult && <p>{t('game.labResult', { result: view.evidenceTexts[analysisResult] ?? analysisResult })}</p>}
    <p className="game-panel-note">{t('game.labNote')}</p>
    <p><button type="button" onClick={onOpenIntel}>{t('game.openIntelTerminal')}</button></p>
    <h4>{t('game.pendingRequestsTitle')}</h4>
    {view.pendingRequests.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noPendingRequests')}</p></div>
      : <ul className="game-destination-list">{view.pendingRequests.map(item => <li key={item.id}><span><strong>{requestTypeLabel(item.type, t)}</strong><small>{t('game.requestDue', { due: item.dueMinute, now: view.clock.minute })}</small></span></li>)}</ul>}
    <p className="game-panel-note">{t('game.consultNote')}</p>
  </div>;
}

/** Central de comunicaciones (GDD §10): contactos con sus canales, envío
 * de mensajes y documentos del dossier, e historial de lo comunicado. Solo
 * se ofrece lo que el contacto tiene: un canal que no tiene no aparece, y
 * un documento solo se puede enviar si está en poder del jugador
 * (`view.objects` son las pruebas recogidas, nunca la solución ni pruebas
 * no halladas). */
function CommsContactList({ contacts, caseId }: { contacts: Contact[]; caseId: string }) {
  const t = useTranslation();
  if (contacts.length === 0) return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.commsEmpty')}</p></div>;
  return <ul className="game-destination-list">{contacts.map(contact => <li key={contact.id}>
    <Portrait seed={portraitSeed(caseId, contact.id)} name={contact.name} size="small" />
    <span><strong>{contact.name}</strong><small>{contact.channels.length > 0
      ? contact.channels.map(item => channelLabel(item, t)).join(', ')
      : t('game.noRemoteChannels')}</small></span>
  </li>)}</ul>;
}

function CommsSendForm({ view, contacts, recipient, channel, channels, documentId, text, busy, onRecipient, onChannel, onDocument, onText, onSend }: {
  view: PlayerViewDto; contacts: Contact[]; recipient: string; channel: string; channels: string[]; documentId: string; text: string; busy: boolean;
  onRecipient: (value: string) => void; onChannel: (value: string) => void; onDocument: (value: string) => void; onText: (value: string) => void;
  onSend: (event: FormEvent) => void;
}) {
  const t = useTranslation();
  return <form onSubmit={onSend} data-testid="comms-form">
    <label>{t('game.recipient')} <select data-testid="comms-recipient" value={recipient} onChange={event => onRecipient(event.target.value)}>
      <option value="">{t('game.choose')}</option>
      {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
    </select></label>
    <label>{t('game.channel')} <select data-testid="comms-channel" value={channel} onChange={event => onChannel(event.target.value)} disabled={channels.length === 0}>
      {channels.map(item => <option key={item} value={item}>{channelLabel(item, t)}</option>)}
    </select></label>
    <label>{t('game.message')} <input type="text" data-testid="comms-text" value={text} onChange={event => onText(event.target.value)} maxLength={4000} /></label>
    <label>{t('game.document')} <select data-testid="comms-document" value={documentId} onChange={event => onDocument(event.target.value)}>
      <option value="">{t('game.noDocument')}</option>
      {view.objects.map(item => <option key={item.id} value={item.id}>{view.evidenceTexts[item.id] ?? item.id}</option>)}
    </select></label>
    <button type="submit" data-testid="comms-send" disabled={!recipient || channels.length === 0 || !text.trim() || busy}>
      {documentId ? t('game.sendDocument') : t('game.sendMessage')}</button>
  </form>;
}

function CommsHistoryItem({ view, contacts, record, onAskReply }: {
  view: PlayerViewDto; contacts: Contact[]; record: PlayerViewDto['communications'][number];
  onAskReply: (record: PlayerViewDto['communications'][number], trigger: HTMLElement | null) => void;
}) {
  const t = useTranslation();
  const name = contacts.find(contact => contact.id === record.recipientId)?.name
    ?? view.npcChat.find(entry => entry.id === record.recipientId)?.name ?? record.recipientId;
  return <li>
    <span><strong>{t('game.commsTo', { name, channel: channelLabel(record.channel, t) })}</strong>
      <small>{record.requestText}</small>
      {record.documentId && <small>{t('game.commsDocument', { document: view.evidenceTexts[record.documentId] ?? record.documentId })}</small>}
      <small>{t('game.commsSent', { sent: record.sentMinute, receipt: record.receivedMinute !== undefined
        ? t('game.commsReceiptReceived', { minute: record.receivedMinute }) : t('game.commsReceiptDue', { minute: record.dueMinute }) })}</small></span>
    {record.receivedMinute !== undefined && <span> <button type="button" data-testid={`comms-ask-${record.id}`}
      onClick={event => onAskReply(record, event.currentTarget)}>{t('game.askForReply')}</button></span>}
  </li>;
}

function CommsContent({ view, contacts, recipient, channel, documentId, text, busy, onRecipient, onChannel, onDocument, onText, onSend, onAskReply }: {
  view: PlayerViewDto; contacts: Contact[]; recipient: string; channel: string; documentId: string; text: string; busy: boolean;
  onRecipient: (value: string) => void; onChannel: (value: string) => void; onDocument: (value: string) => void; onText: (value: string) => void;
  onSend: (event: FormEvent) => void;
  onAskReply: (record: PlayerViewDto['communications'][number], trigger: HTMLElement | null) => void;
}) {
  const t = useTranslation();
  const selected = contacts.find(contact => contact.id === recipient);
  const channels = selected?.channels ?? [];
  return <div>
    <h4>{t('game.contactsTitle')}</h4>
    <CommsContactList contacts={contacts} caseId={view.caseId} />
    <h4>{t('game.sendTitle')}</h4>
    {contacts.length === 0 ? null : <CommsSendForm view={view} contacts={contacts} recipient={recipient} channel={channel}
      channels={channels} documentId={documentId} text={text} busy={busy} onRecipient={onRecipient} onChannel={onChannel}
      onDocument={onDocument} onText={onText} onSend={onSend} />}
    {documentId && <p className="game-panel-note">{t('game.documentCostNote')}</p>}
    <h4>{t('game.commsHistory')}</h4>
    {view.communications.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.commsEmptyHistory')}</p></div>
      : <ul className="game-destination-list" data-testid="comms-history">{view.communications.map(record =>
        <CommsHistoryItem key={record.id} view={view} contacts={contacts} record={record} onAskReply={onAskReply} />)}</ul>}
    <p className="game-panel-note">{t('game.commsNote')}</p>
  </div>;
}

/** Un turno del equipo: quién lo dice (tú o el miembro) y qué se dijo.
 * La respuesta es un resumen de la vista: nunca indica si se va bien,
 * ni señala al culpable ni sugiere la siguiente pista. */
export type TeamTurn = { memberId: TeamMemberId; from: 'you' | 'team'; text: string };

function TeamContent({ view, turns, draft, busy, elenaBusy, error, analysisId, detainOffers, onAnalysis, onService, onOffer, onDraft, onSendElena }: {
  view: PlayerViewDto; turns: TeamTurn[]; draft: string; busy: boolean; elenaBusy: boolean; error: string; analysisId: string;
  detainOffers: PublicActionOffer[];
  onAnalysis: (value: string) => void;
  onService: (memberId: TeamMemberId, serviceId: TeamServiceId, targetId: string | undefined, trigger: HTMLElement | null) => void;
  onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void;
  onDraft: (value: string) => void; onSendElena: (event: FormEvent) => void;
}) {
  const t = useTranslation();
  const memberName = (id: string) => TEAM_MEMBERS.find(member => member.id === id)?.name ?? id;
  const serviceLabel = (id: string) => {
    const key = (TEAM_SERVICE_KEYS as Record<string, LocaleKey>)[id];
    return key ? t(key) : id;
  };
  return <div>
    <h4>{t('game.teamMembers')}</h4>
    <ul className="game-destination-list">{TEAM_MEMBERS.map(member => <li key={member.id}>
      <Portrait seed={teamPortraitSeed(member.id)} name={member.name} size="small" />
      <span><strong>{member.name}</strong><small>{t(member.role)} · {t(member.blurb)}</small></span>
      <span>
        {member.id === 'margaret' && <button type="button" data-testid="team-briefing" disabled={busy}
          onClick={event => onService('margaret', 'briefing', undefined, event.currentTarget)}>{t(TEAM_SERVICE_KEYS.briefing)}</button>}
        {member.id === 'margaret' && <button type="button" data-testid="team-evaluate" disabled={busy}
          onClick={event => onService('margaret', 'evaluate', undefined, event.currentTarget)}>{t(TEAM_SERVICE_KEYS.evaluate)}</button>}
        {member.id === 'clara' && <button type="button" data-testid="team-organize" disabled={busy}
          onClick={event => onService('clara', 'organize', undefined, event.currentTarget)}>{t(TEAM_SERVICE_KEYS.organize)}</button>}
        {member.id === 'david' && <button type="button" data-testid="team-routes" disabled={busy}
          onClick={event => onService('david', 'routes', undefined, event.currentTarget)}>{t(TEAM_SERVICE_KEYS.routes)}</button>}
      </span>
    </li>)}</ul>
    <h4>{t('game.richterExplain')}</h4>
    {view.analysisResults.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noAnalysisResults')}</p></div>
      : <p><label>{t('game.analysisLabel')} <select data-testid="team-analysis" value={analysisId}
        onChange={event => onAnalysis(event.target.value)}>
        {view.analysisResults.map(id => <option key={id} value={id}>{view.evidenceTexts[id] ?? id}</option>)}
      </select></label>
      <span> <button type="button" data-testid="team-explain" disabled={busy || !analysisId}
        onClick={event => onService('richter', 'explain', analysisId, event.currentTarget)}>{t(TEAM_SERVICE_KEYS.explain)}</button></span></p>}
    <h4>{t('game.elenaQuery')}</h4>
    <form onSubmit={onSendElena} className="game-chat-form">
      <input type="text" data-testid="team-elena-input" value={draft} disabled={elenaBusy} maxLength={4000}
        placeholder={t('game.elenaPlaceholder')} aria-label={t('game.elenaAria')}
        onChange={event => onDraft(event.target.value)} />
      <button type="submit" data-testid="team-elena-send" disabled={!draft.trim() || elenaBusy}>{elenaBusy ? t('game.consulting') : t('game.ask')}</button>
    </form>
    {error && <p className="game-error" role="alert">{error}</p>}
    <h4>{t('game.davidDetain')}</h4>
    {detainOffers.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noDetentions')}</p></div>
      : <ul className="game-destination-list">{detainOffers.map(offer => <li key={offer.id}>
        <span><strong>{offer.label}</strong><small>{offer.detail}</small></span>
        <span> <button type="button" data-testid={`offer-${offer.id}`} disabled={busy}
          onClick={event => onOffer(offer, event.currentTarget)}>{t('game.coordinate')}</button></span>
      </li>)}</ul>}
    <h4>{t('game.teamConversation')}</h4>
    {turns.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.teamEmpty')}</p></div>
      : <ol className="game-chat-turns" data-testid="team-turns" aria-live="polite">
        {turns.map((turn, index) => <li key={index} className={turn.from === 'you' ? 'game-chat-you' : 'game-chat-npc-turn'}>
          <span className="game-chat-speaker">{turn.from === 'you' ? t('game.you') : memberName(turn.memberId)}</span>
          <span>{turn.text}</span>
        </li>)}
      </ol>}
    <h4>{t('game.teamRequests')}</h4>
    {view.team.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.teamNoRequests')}</p></div>
      : <ul className="game-destination-list" data-testid="team-history">{view.team.map(record =>
        <li key={record.id}><span><strong>{memberName(record.memberId)} · {serviceLabel(record.serviceId)}</strong>
          <small>{t('game.teamRecordMinute', { minute: record.minute })}{record.targetId ? ` · ${view.evidenceTexts[record.targetId] ?? record.targetId}` : ''}</small></span></li>)}</ul>}
    <p className="game-panel-note">{t('game.teamNote')}</p>
  </div>;
}

function SaveList({ saves, atLimit, closed, onLoad, onDelete, onReplace }: {
  saves: SaveListDto | null; atLimit: boolean; closed: boolean;
  onLoad: (save: SaveListItem) => void; onDelete: (save: SaveListItem) => void; onReplace: (save: SaveListItem) => void;
}) {
  const t = useTranslation();
  if (!saves) return <p>{t('game.loadingSaves')}</p>;
  if (saves.items.length === 0) return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.noSaves')}</p></div>;
  return <ul className="game-save-list" data-testid="save-list">
    {saves.items.map(save => <li key={save.saveId}>
      <span><strong>{save.name}</strong><small>{save.cityName} · min {save.minute} · {new Date(save.createdAt).toLocaleString('es-ES')}</small></span>
      <span> <button type="button" data-testid={`load-${save.saveId}`} disabled={closed} onClick={() => onLoad(save)}>{t('game.loadSave')}</button></span>
      <span> <button type="button" disabled={closed} onClick={() => onDelete(save)}>{t('game.deleteSave')}</button></span>
      {atLimit && !closed && <span> <button type="button" onClick={() => onReplace(save)}>{t('game.replaceWithNew')}</button></span>}
    </li>)}
  </ul>;
}

function SaveCreateForm({ savePhase, saveName, closed, canSave, replaceTarget, onSaveName, onCreate }: {
  savePhase: SavePhase; saveName: string; closed: boolean; canSave: boolean; replaceTarget: SaveListItem | null;
  onSaveName: (value: string) => void; onCreate: () => void;
}) {
  const t = useTranslation();
  return <form onSubmit={event => { event.preventDefault(); onCreate(); }}>
    <label>{t('game.saveName')} <input type="text" data-testid="save-name-input" value={saveName}
      onChange={event => onSaveName(event.target.value)} maxLength={128} /></label>
    {replaceTarget && <p>{t('game.replaceNote', { name: replaceTarget.name })}</p>}
    <button type="submit" data-testid="save-create"
      disabled={closed || !saveName.trim() || savePhase === 'saving' || (!canSave && !replaceTarget)}>
      {savePhase === 'saving' ? t('game.saving') : t('game.saveRun')}
    </button>
  </form>;
}

function SavesContent({ view, saves, savePhase, saveName, replaceTarget, loadTarget, onSaveName, onCreate, onLoad, onDelete, onReplace, onConfirmLoad, onCancelLoad }: {
  view: PlayerViewDto; saves: SaveListDto | null; savePhase: SavePhase; saveName: string; replaceTarget: SaveListItem | null;
  loadTarget: SaveListItem | null; onSaveName: (value: string) => void; onCreate: () => void;
  onLoad: (save: SaveListItem) => void; onDelete: (save: SaveListItem) => void; onReplace: (save: SaveListItem) => void;
  onConfirmLoad: () => void; onCancelLoad: () => void;
}) {
  const t = useTranslation();
  const closed = view.status === 'closed';
  const atLimit = view.saveCapabilities.manualCount >= view.saveCapabilities.manualLimit;
  return <div>
    <p className="game-save-count">{t('game.manualSavesCount')} <strong>{view.saveCapabilities.manualCount}</strong> / {view.saveCapabilities.manualLimit}. {t('game.saveNoClock')}</p>
    {closed && <p className="game-closed-note" role="status" data-testid="save-closed-notice">{t('game.closedRunNote')}</p>}
    <SaveCreateForm savePhase={savePhase} saveName={saveName} closed={closed} canSave={view.saveCapabilities.canSave}
      replaceTarget={replaceTarget} onSaveName={onSaveName} onCreate={onCreate} />
    {savePhase === 'saved' && <p role="status">{t('game.saveConfirmed')}</p>}
    {savePhase === 'failed' && <p role="alert">{t('game.saveFailed')}</p>}
    <h4>{t('game.manualSaves')}</h4>
    <SaveList saves={saves} atLimit={atLimit} closed={closed} onLoad={onLoad} onDelete={onDelete} onReplace={onReplace} />
    {loadTarget && <div className="game-load-confirm" role="dialog" aria-label={t('game.confirmLoad')} data-testid="load-confirm">
      <p>{t('game.loadConfirmText', { name: loadTarget.name, minute: loadTarget.minute })}</p>
      <button type="button" data-testid="load-confirm-button" onClick={onConfirmLoad}>{t('game.loadThisPoint')}</button>
      <button type="button" onClick={onCancelLoad}>{t('common.cancel')}</button>
    </div>}
  </div>;
}

function describeEffectiveProvider(data: ConnectionsResponse | null, catalogLabel: (providerId: string) => string, t: TranslateFn): string {
  if (!data) return t('settings.effectiveLoading');
  if (data.effective.source === 'mock') return t('settings.effectiveMock');
  if (data.effective.source === 'admin') {
    return t('settings.effectiveAdmin', { provider: catalogLabel(data.effective.providerId), model: data.effective.model });
  }
  return t('settings.effectiveConnection', { name: data.effective.connectionName ?? '', provider: catalogLabel(data.effective.providerId), model: data.effective.model });
}

function testSummary(result: ConnectionTestResult, t: TranslateFn): string {
  if (!result.available) return t('settings.testUnavailable', { error: result.error ? `: ${result.error}` : '' });
  return t('settings.testAvailable', { latency: result.latencyMs ?? '?' });
}

function ConnectionsList({ connections, effectiveId, catalogLabel, testingId, testResults, onUse, onTest, onRemove }: {
  connections: AiConnection[];
  effectiveId: string | null;
  catalogLabel: (providerId: string) => string;
  testingId: string | null;
  testResults: Record<string, ConnectionTestResult>;
  onUse: (id: string) => void;
  onTest: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslation();
  return <ul>{connections.map(connection => {
    const result = testResults[connection.id];
    const inUse = effectiveId === connection.id;
    return <li key={connection.id}>
      <strong>{connection.name}</strong> · {catalogLabel(connection.adapterId)} · {connection.model}
      {connection.status !== 'active' ? ` · ${connection.status}` : ''}{inUse ? t('settings.connectionInUse') : ''}
      {result && <span> · {testSummary(result, t)}</span>}
      <div>
        {!inUse && <button type="button" onClick={() => onUse(connection.id)}>{t('settings.useConnection')}</button>}
        <button type="button" disabled={testingId === connection.id} onClick={() => onTest(connection.id)}>
          {testingId === connection.id ? t('settings.testingConnection') : t('settings.testConnection')}
        </button>
        <button type="button" aria-label={t('settings.deleteConnectionAria', { name: connection.name })} onClick={() => onRemove(connection.id)}>{t('settings.deleteConnection')}</button>
      </div>
    </li>;
  })}</ul>;
}

function validateConnectionForm(selected: ProviderCatalogEntry, connName: string, apiKey: string, t: TranslateFn): string | null {
  if (!connName.trim()) return t('settings.connectionNameRequired');
  if (selected.needsKey && !apiKey) return t('settings.connectionKeyRequired');
  return null;
}

/** Nombre sugerido para una conexión nueva («Mi Ollama», «Mi OpenAI», …). */
function defaultConnectionName(entry: ProviderCatalogEntry | undefined): string {
  if (!entry) return '';
  const short = entry.label.replace(/\s*\(.*\)\s*$/, '').replace(/\s+local\s*$/i, '').trim();
  return `Mi ${short || entry.id}`;
}

function ConnectionProviderFields({ selected, baseUrl, onBaseUrl, model, onModel, apiKey, onApiKey }: {
  selected: ProviderCatalogEntry | undefined;
  baseUrl: string; onBaseUrl: (value: string) => void;
  model: string; onModel: (value: string) => void;
  apiKey: string; onApiKey: (value: string) => void;
}) {
  const t = useTranslation();
  return <>
    {selected?.needsBaseUrl && <label className="game-setting"><span>{t('settings.endpointUrl')}</span>
      <input data-testid="ai-connection-base-url" value={baseUrl} onChange={event => onBaseUrl(event.target.value)} maxLength={512} placeholder={selected.defaultBaseUrl} />
    </label>}
    <label className="game-setting"><span>{t('settings.model')}</span>
      <input data-testid="ai-connection-model" value={model} onChange={event => onModel(event.target.value)} maxLength={128} placeholder={selected?.defaultModel ?? ''} />
    </label>
    {selected?.needsKey && <label className="game-setting"><span>{t('settings.apiKey')}</span>
      <input data-testid="ai-connection-key" type="password" value={apiKey} onChange={event => onApiKey(event.target.value)} maxLength={512} autoComplete="off" placeholder={t('settings.apiKeyPlaceholder')} />
    </label>}
  </>;
}

/** Mensaje de error al guardar una conexión: el motivo real del servidor
 * (p. ej. destino no permitido) se muestra tal cual; el genérico solo queda
 * para el resto de fallos. */
function connectionSaveErrorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof ConnectionsError && error.kind === 'session') return t('settings.sessionExpired');
  if (error instanceof ConnectionsError && error.detail) return error.detail;
  return t('settings.connectionSaveFailed');
}

function AddConnectionForm({ catalog, csrfToken, onSaved, formMessage, formError, onFormMessage, onFormError }: {
  catalog: ProviderCatalogEntry[];
  csrfToken: string;
  onSaved: () => Promise<void>;
  formMessage: string;
  formError: string;
  onFormMessage: (value: string) => void;
  onFormError: (value: string) => void;
}) {
  // El estado arranca con los valores que el formulario muestra: lo que se ve
  // es lo que se guarda (antes los placeholders sugerían valores que el
  // estado no tenía y el primer guardado fallaba).
  const defaultEntry = catalog.find(entry => entry.id === 'ollama') ?? catalog[0];
  const [adapterId, setAdapterId] = useState(defaultEntry?.id ?? 'ollama');
  const [connName, setConnName] = useState(() => defaultConnectionName(defaultEntry));
  const [baseUrl, setBaseUrl] = useState(() => defaultEntry?.needsBaseUrl ? defaultEntry.defaultBaseUrl : '');
  const [model, setModel] = useState(() => defaultEntry?.defaultModel ?? '');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = catalog.find(entry => entry.id === adapterId);

  function onAdapterChange(value: string) {
    setAdapterId(value);
    const entry = catalog.find(item => item.id === value);
    if (entry) {
      setConnName(defaultConnectionName(entry));
      setModel(entry.defaultModel);
      setBaseUrl(entry.needsBaseUrl ? entry.defaultBaseUrl : '');
    }
    setApiKey('');
    onFormError('');
    onFormMessage('');
  }

  const t = useTranslation();
  async function saveConnection(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    const validationError = validateConnectionForm(selected, connName, apiKey, t);
    if (validationError) { onFormError(validationError); return; }
    setSaving(true);
    onFormError('');
    onFormMessage('');
    try {
      const input: { name: string; adapterId: string; baseUrl?: string; model: string; credential?: string; isDefault: boolean } = {
        name: connName.trim(), adapterId: selected.id,
        model: model.trim() || selected.defaultModel, isDefault: true,
      };
      if (selected.needsBaseUrl) input.baseUrl = baseUrl.trim();
      if (apiKey) input.credential = apiKey;
      await aiConnectionsApi.create(input, new AbortController().signal, { csrfToken });
      // El formulario vuelve a los valores por defecto del proveedor,
      // listo para otra conexión.
      setConnName(defaultConnectionName(selected));
      setBaseUrl(selected.needsBaseUrl ? selected.defaultBaseUrl : '');
      setModel(selected.defaultModel);
      setApiKey('');
      onFormMessage(t('settings.connectionSaved'));
      await onSaved();
    } catch (error) {
      onFormError(connectionSaveErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={saveConnection}>
    <label className="game-setting"><span>{t('settings.provider')}</span>
      <select data-testid="ai-connection-adapter" value={adapterId} onChange={event => onAdapterChange(event.target.value)}>
        {catalog.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>
    </label>
    {selected && <p className="game-panel-note">{selected.hint}</p>}
    <label className="game-setting"><span>{t('settings.connectionName')}</span>
      <input data-testid="ai-connection-name" value={connName} onChange={event => setConnName(event.target.value)} maxLength={100} placeholder={t('settings.connectionNamePlaceholder')} />
    </label>
    <ConnectionProviderFields
      selected={selected}
      baseUrl={baseUrl} onBaseUrl={setBaseUrl}
      model={model} onModel={setModel}
      apiKey={apiKey} onApiKey={setApiKey}
    />
    <p><button data-testid="ai-connection-save" type="submit" disabled={saving}>{saving ? t('game.saving') : t('settings.saveConnection')}</button></p>
    {formMessage && <p role="status">{formMessage}</p>}
    {formError && <p role="alert">{formError}</p>}
  </form>;
}

/** Sección de audio y voz de los Ajustes (GDD §15): interruptores y
 * volúmenes independientes de música, efectos y narración, mute general, y
 * TTS con voz, velocidad y lectura automática. Sin voz compatible, la
 * lectura queda deshabilitada y explicada, y el texto sigue disponible. */
function AudioSettingsSection({ audio, tts, voices, ttsSupported, onAudio, onTTS }: {
  audio: PresentationPreferences['audio']; tts: PresentationPreferences['tts']; voices: TTSVoice[]; ttsSupported: boolean;
  onAudio: (patch: Partial<PresentationPreferences['audio']>) => void;
  onTTS: (patch: Partial<PresentationPreferences['tts']>) => void;
}) {
  const t = useTranslation();
  const voiceValue = voices.some(voice => voice.name === tts.voice) ? tts.voice : 'auto';
  return <>
    <label className="game-setting"><span>{t('settings.muteAll')}</span><input type="checkbox" data-testid="audio-muted" checked={audio.muted} onChange={event => onAudio({ muted: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.music')}</span><input type="checkbox" data-testid="audio-music-enabled" checked={audio.musicEnabled} onChange={event => onAudio({ musicEnabled: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.musicVolume')}</span><input type="range" data-testid="audio-music-volume" min={0} max={100} value={audio.musicVolume} onChange={event => onAudio({ musicVolume: Number(event.target.value) })} /></label>
    <label className="game-setting"><span>{t('settings.effects')}</span><input type="checkbox" data-testid="audio-effects-enabled" checked={audio.effectsEnabled} onChange={event => onAudio({ effectsEnabled: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.effectsVolume')}</span><input type="range" data-testid="audio-effects-volume" min={0} max={100} value={audio.effectsVolume} onChange={event => onAudio({ effectsVolume: Number(event.target.value) })} /></label>
    <label className="game-setting"><span>{t('settings.narrationVolume')}</span><input type="range" data-testid="audio-narration-volume" min={0} max={100} value={audio.narrationVolume} onChange={event => onAudio({ narrationVolume: Number(event.target.value) })} /></label>
    {!ttsSupported
      ? <p className="game-panel-note" data-testid="tts-unsupported">{t('settings.ttsUnsupported')}</p>
      : <>
        <label className="game-setting"><span>{t('settings.ttsEnabled')}</span><input type="checkbox" data-testid="tts-enabled" checked={tts.enabled} onChange={event => onTTS({ enabled: event.target.checked })} /></label>
        <label className="game-setting"><span>{t('settings.ttsVoice')}</span>
          <select data-testid="tts-voice" value={voiceValue} disabled={!tts.enabled} onChange={event => onTTS({ voice: event.target.value })}>
            <option value="auto">{t('settings.ttsVoiceAuto')}</option>
            {voices.map(voice => <option key={voice.name} value={voice.name}>{voice.name} ({voice.lang})</option>)}
          </select>
        </label>
        {voices.length === 0 && <p className="game-panel-note">{t('settings.ttsNoVoices')}</p>}
        <label className="game-setting"><span>{t('settings.ttsRate')}</span><input type="range" data-testid="tts-rate" min={0.5} max={2} step={0.1} value={tts.rate} disabled={!tts.enabled} onChange={event => onTTS({ rate: Number(event.target.value) })} /></label>
        <label className="game-setting"><span>{t('settings.ttsAutoRead')}</span><input type="checkbox" data-testid="tts-autoread" checked={tts.autoRead} disabled={!tts.enabled} onChange={event => onTTS({ autoRead: event.target.checked })} /></label>
      </>}
    <p className="game-panel-note">{t('settings.audioHelp')}</p>
  </>;
}

function SettingsContent({ identity, language, onLanguage, textScale, highContrast, palette, accessibility, fontMode, onScale, onContrast, onPalette, onAccessibility, onFontMode, profile, onProfileSaved, audio, tts, voices, ttsSupported, onAudio, onTTS }: {
  identity: SessionDto | null; language: Language; onLanguage: (value: Language) => void;
  textScale: number; highContrast: boolean; palette: PaletteMode;
  accessibility: PresentationPreferences['accessibility']; fontMode: PresentationPreferences['fontMode'];
  onScale: (value: number) => void; onContrast: (value: boolean) => void; onPalette: (value: PaletteMode) => void;
  onAccessibility: (patch: Partial<PresentationPreferences['accessibility']>) => void;
  onFontMode: (value: PresentationPreferences['fontMode']) => void;
  profile: DetectiveProfileDto | null; onProfileSaved: (profile: DetectiveProfileDto) => void;
  audio: PresentationPreferences['audio']; tts: PresentationPreferences['tts']; voices: TTSVoice[]; ttsSupported: boolean;
  onAudio: (patch: Partial<PresentationPreferences['audio']>) => void;
  onTTS: (patch: Partial<PresentationPreferences['tts']>) => void;
}) {
  const t = useTranslation();
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  // Los mensajes del formulario de alta viven aquí para poder limpiarlos
  // cuando la lista cambia por otro lado (borrar o volver al defecto).
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState('');

  const csrfToken = identity?.csrfToken ?? null;
  const auth = csrfToken ? { csrfToken } : undefined;
  const catalogLabel = (providerId: string): string =>
    data?.catalog.find(entry => entry.id === providerId)?.label ?? providerId;

  const reload = useCallback(async (signal: AbortSignal) => {
    if (!csrfToken) return;
    setLoading(true);
    setLoadError('');
    try {
      setData(await aiConnectionsApi.list(signal, { csrfToken }));
    } catch {
      setLoadError(t('settings.aiLoadError'));
    } finally {
      setLoading(false);
    }
  }, [csrfToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  async function useConnection(id: string) {
    if (!auth) return;
    await aiConnectionsApi.update(id, { isDefault: true, status: 'active' }, new AbortController().signal, auth);
    await reload(new AbortController().signal);
  }

  async function testConnection(id: string) {
    if (!auth) return;
    setTestingId(id);
    try {
      const result = await aiConnectionsApi.test(id, new AbortController().signal, auth);
      setTestResults(prev => ({ ...prev, [id]: result }));
      await reload(new AbortController().signal);
    } finally {
      setTestingId(null);
    }
  }

  async function removeConnection(id: string) {
    if (!auth) return;
    await aiConnectionsApi.remove(id, new AbortController().signal, auth);
    // El mensaje de «guardada y activada» queda obsoleto al borrar.
    setFormMessage('');
    setFormError('');
    await reload(new AbortController().signal);
  }

  async function useServerDefault() {
    if (!auth) return;
    await aiConnectionsApi.useDefault(new AbortController().signal, auth);
    setFormMessage('');
    setFormError('');
    await reload(new AbortController().signal);
  }

  return <div>
    <h4>{t('settings.language')}</h4>
    <label className="game-setting"><span>{t('settings.language')}</span>
      <select data-testid="settings-language" value={language} onChange={event => onLanguage(event.target.value as Language)}>
        {SUPPORTED_LANGUAGES.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>
    </label>
    <p className="game-panel-note">{t('settings.languageHelp')}</p>
    <h4>{t('settings.aiProvider')}</h4>
    <p data-testid="settings-ai-effective">{t('settings.aiEffective')} <strong>{describeEffectiveProvider(data, catalogLabel, t)}</strong></p>
    {loading && <p role="status">{t('settings.aiLoading')}</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {data && <>
      <p className="game-panel-note">{t('settings.aiPersonalNote')}</p>
      <h4>{t('settings.myConnections')}</h4>
      <div data-testid="ai-connections-list">
        {data.connections.length === 0
          ? <p className="game-panel-note">{t('settings.aiNoConnections')}</p>
          : <ConnectionsList
              connections={data.connections}
              effectiveId={data.effective.connectionId}
              catalogLabel={catalogLabel}
              testingId={testingId}
              testResults={testResults}
              onUse={id => void useConnection(id)}
              onTest={id => void testConnection(id)}
              onRemove={id => void removeConnection(id)}
            />}
      </div>
      {data.effective.source === 'personal' && <p><button type="button" onClick={() => void useServerDefault()}>{t('settings.aiUseServer')}</button></p>}
      <h4>{t('settings.addConnection')}</h4>
      {csrfToken && <AddConnectionForm
        catalog={data.catalog} csrfToken={csrfToken} onSaved={() => reload(new AbortController().signal)}
        formMessage={formMessage} formError={formError} onFormMessage={setFormMessage} onFormError={setFormError}
      />}
    </>}
    <h4>{t('settings.presentation')}</h4>
    <label className="game-setting"><span>{t('settings.textSize')}</span>
      <select value={textScale} onChange={event => onScale(Number(event.target.value))}>
        {[100, 125, 150, 175, 200].map(scale => <option key={scale} value={scale}>{scale}%</option>)}
      </select>
    </label>
    <label className="game-setting"><span>{t('settings.highContrast')}</span><input type="checkbox" checked={highContrast} onChange={event => onContrast(event.target.checked)} /></label>
    <PaletteSetting palette={palette} onPalette={onPalette} />
    <h4>{t('settings.accessibility')}</h4>
    <label className="game-setting"><span>{t('settings.reducedMotion')}</span><input type="checkbox" data-testid="a11y-reduced-motion" checked={accessibility.reducedMotion} onChange={event => onAccessibility({ reducedMotion: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.focusVisible')}</span><input type="checkbox" data-testid="a11y-focus-visible" checked={accessibility.focusVisible} onChange={event => onAccessibility({ focusVisible: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.skipNav')}</span><input type="checkbox" data-testid="a11y-skip-nav" checked={accessibility.skipNav} onChange={event => onAccessibility({ skipNav: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.announceNarration')}</span><input type="checkbox" data-testid="a11y-announce-narration" checked={accessibility.announceNarration} onChange={event => onAccessibility({ announceNarration: event.target.checked })} /></label>
    <label className="game-setting"><span>{t('settings.font')}</span>
      <select data-testid="a11y-font-mode" value={fontMode} onChange={event => onFontMode(event.target.value as PresentationPreferences['fontMode'])}>
        <option value="retro">{t('settings.fontRetro')}</option>
        <option value="accessible">{t('settings.fontAccessible')}</option>
      </select>
    </label>
    <p className="game-panel-note">{t('settings.accessibilityHelp')}</p>
    <p className="game-panel-note">{t('settings.savedHereHelp')}</p>
    <h4>{t('settings.audioVoice')}</h4>
    <AudioSettingsSection audio={audio} tts={tts} voices={voices} ttsSupported={ttsSupported} onAudio={onAudio} onTTS={onTTS} />
    <ProfileSection identity={identity} profile={profile} onSaved={onProfileSaved} />
  </div>;
}

// El informe final completo (GDD §12, REQ-G12-05/T2-05): resultado y motivo
// en español, verdad completa, cronología, pruebas halladas y omitidas,
// detenciones y puntuación con su desglose. El motor y la API ya resuelven
// los identificadores a frases; la pantalla solo los enseña. Los objetivos
// se resuelven con la descripción que trae la vista (en los casos generados
// el catálogo fijo no los conoce y enseñaría el ID crudo).
function ReportList({ items, empty }: { items: string[]; empty: string }) {
  return items.length === 0
    ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{empty}</p></div>
    : <ul className="game-report-objectives">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

/** Delta con signo para el informe: +3, 0, −2. */
function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/** Sufijo de medalla para una línea de resultado oficial, o vacío. */
function medalSuffix(medal: string | null | undefined, t: TranslateFn): string {
  return medal ? ` · ${medalLabel(medal, t)}` : '';
}

/** Consecuencias de carrera del cierre (GDD §13, DEC-020): el cierre
 * oficial fija el resultado y enseña puntos/medalla/rango antes→después;
 * el de práctica recuerda el oficial existente; una partida cerrada antes
 * de la carrera no tiene resultado oficial. */
function CareerConsequences({ officialResult }: { officialResult: PlayerViewDto['officialResult'] }) {
  const t = useTranslation();
  return <>
    <h4>{t('game.careerConsequences')}</h4>
    {!officialResult && <p>{t('game.careerNoResult')}</p>}
    {officialResult?.isThisRun && <>
      <p>{t('game.careerOfficialResult')}: <strong>{reportResultText(officialResult.result, t)}</strong> · {officialResult.points} {t('game.careerPoints')}{medalSuffix(officialResult.medal, t)} · {t('game.careerRank')}: {officialResult.rankBefore} → {officialResult.rankAfter}</p>
      <p>{t('game.careerDeltas', { prestige: signedDelta(officialResult.prestigeDelta), integrity: signedDelta(officialResult.integrityDelta), trust: signedDelta(officialResult.trustDelta) })}</p>
      <p>{t('game.careerOfficialNote')}</p>
    </>}
    {officialResult && !officialResult.isThisRun && <>
      <p>{t('game.careerPracticeLine', {
        caseTitle: officialResult.caseTitle, result: reportResultText(officialResult.result, t), points: officialResult.points,
        medal: officialResult.medal ? `, ${medalLabel(officialResult.medal, t)}` : '',
      })}</p>
    </>}
  </>;
}

function ReportContent({ view }: { view: PlayerViewDto }) {
  const t = useTranslation();
  const { preferences } = usePreferences();
  if (!view.finalReport) return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.reportNotAvailable')}</p></div>;
  const report = view.finalReport;
  const objectiveDescription = (id: string) =>
    view.objectives.find(objective => objective.id === id)?.description ?? objectiveText(id, view.caseId, preferences.language);
  return <div>
    <p className="game-report-result">{t('game.reportResult')}: <strong>{reportResultText(report.result, t)}</strong> · {t('game.reportReason')}: {reportReasonText(report.reason, t)} · {t('game.reportMinute')}: {report.minute}</p>
    <h4>{t('game.reportTruth')}</h4>
    <p>{t('game.reportCulprit')}: <strong>{report.truth.culpritName}</strong></p>
    {report.truth.objectLabel && <p>{t('game.reportStolenObject', { label: report.truth.objectLabel })}</p>}
    <h4>{t('game.reportKeyEvidence')}</h4>
    <ReportList items={report.truth.keyEvidence.map(entry => entry.text)} empty={t('game.reportNoKeyEvidence')} />
    {report.timeline.length > 0 && <>
      <h4>{t('game.reportTimeline')}</h4>
      <ul className="game-report-objectives">{report.timeline.map(entry =>
        <li key={entry.sequence}>[min {entry.minute}] {entry.summary}</li>)}</ul>
    </>}
    <h4>{t('game.reportEvidenceFound')}</h4>
    <ReportList items={report.evidenceFound.map(entry => entry.text)} empty={t('game.reportNoEvidenceFound')} />
    <h4>{t('game.reportEvidenceMissed')}</h4>
    <ReportList items={report.evidenceMissed.map(entry => entry.text)} empty={t('game.reportNoEvidenceMissed')} />
    <h4>{t('game.reportDetentions')}</h4>
    <ReportList
      items={report.detentions.map(detention =>
        `${detention.suspectName} — ${detention.correct ? t('game.reportDetentionCorrect') : t('game.reportDetentionWrong')}${detention.withWarrant ? t('game.reportDetentionWithWarrant') : t('game.reportDetentionWithoutWarrant')}`)}
      empty={t('game.reportNoDetentions')} />
    <h4>{t('game.reportIrregular')}</h4>
    <ReportList
      items={(report.irregularActs ?? []).map(act => {
        const kindKey = IRREGULAR_KIND_KEYS[act.kind];
        return `${kindKey ? t(kindKey) : act.kind} — ${act.targetName} · min ${act.minute}${act.seen ? t('game.reportIrregularSeen') : t('game.reportIrregularUnseen')}`;
      })}
      empty={t('game.reportNoIrregular')} />
    <h4>{t('game.reportScore')}</h4>
    <ul className="game-report-objectives">{report.score.breakdown.map(entry =>
      <li key={entry.label}>{entry.label}: {entry.points > 0 ? `+${entry.points}` : entry.points}</li>)}</ul>
    <p>{t('game.reportTotal')}: <strong>{report.score.total} / {report.score.max}</strong></p>
    <CareerConsequences officialResult={view.officialResult} />
    <h4>{t('game.reportObjectives')}</h4>
    <ReportList items={report.objectivesAchieved.map(objectiveDescription)} empty={t('game.reportNoObjectives')} />
  </div>;
}

function UnavailableScreen({ phase, notice }: { phase: ScreenPhase; notice: string }) {
  const t = useTranslation();
  return <main className="game" data-testid="game-screen">
    {phase === 'loading'
      ? <p className="game-notice" role="status">{t('game.loading')}</p>
      : <><h1>{t('game.unavailable')}</h1>
        <p className="game-notice" role="status">{notice}</p>
        <p><Link to="/">{t('glossary.backArchive')}</Link></p>
        {phase === 'error' && <p><button type="button" onClick={() => window.location.reload()}>{t('common.retry')}</button></p>}</>}
  </main>;
}

// ── Pantalla ────────────────────────────────────────────────────────────────────

/** Pantalla de juego (Fase A): vista del jugador, órdenes en texto libre con
 * interpretación, ofertas del motor, guardados manuales y ventanas de
 * herramientas. La UI no calcula resultados: recibe PlayerView y eventos. */
export function GameScreen() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const t = useTranslation();
  const windows = useWindows();
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Quién abrió la charla en escena (botón «Hablar con» o «Preguntar por
  // la respuesta» de la central): al cerrarla, el foco vuelve a él.
  const chatOpenerRef = useRef<HTMLElement | null>(null);

  /** Cierra la charla en escena y devuelve el foco a quien la abrió (o a
   * la escena si ese botón ya no está). Los turnos y la memoria quedan
   * guardados en esta pestaña, como antes. */
  const closeChat = useCallback(() => {
    setChatNpc(null);
    const opener = chatOpenerRef.current;
    chatOpenerRef.current = null;
    if (opener && opener.isConnected) opener.focus();
    else document.getElementById('game-scene')?.focus();
  }, []);
  const orderInputRef = useRef<HTMLTextAreaElement>(null);

  const [identity, setIdentity] = useState<SessionDto | null>(null);
  const [view, setView] = useState<PlayerViewDto | null>(null);
  const [caseTitle, setCaseTitle] = useState<string | null>(null);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [notice, setNotice] = useState(t('game.loading'));
  // Consola narrativa guardada en esta pestaña por partida (como el
  // borrador y la memoria de chat): sin esto, al recargar se perdía y la
  // consola volvía al texto genérico «La investigación comienza…».
  const [log, setLog] = useState<LogEntry[]>(() => loadStoredLog(runId));
  const [draft, setDraft] = useState(() => (runId ? sessionStorage.getItem('meridiano-draft:' + runId) ?? '' : ''));
  const [orderHistory, setOrderHistory] = useState<string[]>([]);
  const [orderPhase, setOrderPhase] = useState<OrderPhase>({ kind: 'idle' });
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [saves, setSaves] = useState<SaveListDto | null>(null);
  const [savePhase, setSavePhase] = useState<SavePhase>('idle');
  const [saveName, setSaveName] = useState('');
  const [replaceTarget, setReplaceTarget] = useState<SaveListItem | null>(null);
  const [loadTarget, setLoadTarget] = useState<SaveListItem | null>(null);
  // Preferencias persistentes (§15): escala, contraste y paleta se guardan
  // en localStorage y se aplican en <html>/<main> al cambiar.
  const { preferences, updatePreferences } = usePreferences();
  // Movimiento reducido (§15): el interruptor manual manda si difiere del
  // sistema; el sistema vale cuando el manual está apagado.
  const systemReducedMotion = useSystemReducedMotion();
  const reducedMotion = effectiveReducedMotion(preferences.accessibility.reducedMotion, systemReducedMotion);
  // Audio y TTS (GDD §15): todo el cableado vive en `useGameAudio` (ver
  // abajo): el motor de música en ./music (WebAudio puro, sin imports de
  // paquetes) y el controlador TTS en case-schema (importado aquí, donde
  // ya existe la vía a case-schema). La música no arranca hasta el primer
  // gesto del usuario (autoplay) y el mute silencia música, efectos y
  // narración a la vez.
  const audioTts = useGameAudio(preferences);
  const [detectiveProfile, setDetectiveProfile] = useState<DetectiveProfileDto | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [commRecipient, setCommRecipient] = useState('');
  const [commChannel, setCommChannel] = useState('call');
  const [commText, setCommText] = useState('');
  const [commDocument, setCommDocument] = useState('');
  /** Hechos autorizados extra para la próxima pregunta de chat: el texto
   * del documento enviado a ese personaje, para poder preguntarle por él. */
  const [chatExtraFacts, setChatExtraFacts] = useState<{ npcId: string; facts: Array<{ id: string; text: string }> } | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [chatNpc, setChatNpc] = useState<{ id: string; name: string } | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatMemory, setChatMemory] = useState<unknown>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  // Terminal de inteligencia (GDD §11): misma forma que la conversación
  // con un personaje, pero con la terminal como interlocutora y sus hechos
  // autorizados (lo descubierto, los objetivos, el resumen y lo oído).
  const [intelTurns, setIntelTurns] = useState<ChatTurn[]>([]);
  const [intelMemory, setIntelMemory] = useState<unknown>(null);
  const [intelDraft, setIntelDraft] = useState('');
  const [intelBusy, setIntelBusy] = useState(false);
  const [intelError, setIntelError] = useState('');
  // Equipo A.C.M.E. (GDD §8): misma forma que la terminal (turnos en esta
  // pestaña por partida), con su propia memoria de conversación para Elena.
  // Pedir ayuda no cuesta tiempo; la petición queda registrada en el motor.
  const [teamTurns, setTeamTurns] = useState<TeamTurn[]>([]);
  const [teamElenaMemory, setTeamElenaMemory] = useState<unknown>(null);
  const [teamDraft, setTeamDraft] = useState('');
  const [teamElenaBusy, setTeamElenaBusy] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamAnalysisId, setTeamAnalysisId] = useState('');
  // Carrera (GDD §13): el perfil se carga bajo demanda al pedir la
  // evaluación a Margaret y se guarda en la pestaña para no pedirlo dos
  // veces; si la carga falla, no se guarda nada y se puede reintentar.
  const [career, setCareer] = useState<CareerProfileDto | null>(null);
  const [careerLoaded, setCareerLoaded] = useState(false);
  // Lote 1 de jugabilidad: reloj de arena y animación de viaje (ver hook).
  const timeFeedback = useTimeFeedback();

  // Lectura automática (GDD §15): narración nueva y respuestas de los
  // personajes, solo con TTS activado, autoRead y sin silenciar.
  useAutoReadLog(log, audioTts.autoReadOn, audioTts.speak);
  useAutoReadTurns(chatTurns, audioTts.autoReadOn, audioTts.speak);
  useAutoReadTurns(intelTurns, audioTts.autoReadOn, audioTts.speak);

  // La intro se abre sola al entrar en una partida nueva (versión 1, minuto
  // 0, activa) salvo que ya se haya descartado en esta pestaña. Queda
  // recuperable desde la barra de herramientas y desde el dossier.
  useEffect(() => {
    if (view && view.status === 'active' && view.version === 1 && view.clock.minute === 0 && view.briefing && runId &&
      !sessionStorage.getItem('meridiano:intro-seen:' + runId)) setIntroOpen(true);
  }, [view, runId]);

  function dismissIntro() {
    if (runId) sessionStorage.setItem('meridiano:intro-seen:' + runId, '1');
    setIntroOpen(false);
  }

  // El resumen se abre solo al entrar en una partida en curso (minuto > 0,
  // activa) salvo que ya se haya descartado en esta pestaña. Queda
  // recuperable desde la barra de herramientas.
  useEffect(() => {
    if (view && view.status === 'active' && view.clock.minute > 0 && runId &&
      !sessionStorage.getItem('meridiano:resume-seen:' + runId)) setResumeOpen(true);
  }, [view, runId]);

  function dismissResume() {
    if (runId) sessionStorage.setItem('meridiano:resume-seen:' + runId, '1');
    setResumeOpen(false);
  }

  // Cambiar el idioma en Ajustes vuelve a pedir la vista (y el título del
  // expediente) en el idioma nuevo: el servidor traduce el contenido por
  // petición y la vista anterior quedaría en el idioma viejo. Silencioso:
  // si la recarga falla, se conserva la vista anterior.
  const viewLanguageRef = useRef(preferences.language);
  useEffect(() => {
    if (!view || !runId || viewLanguageRef.current === preferences.language) return;
    viewLanguageRef.current = preferences.language;
    const controller = new AbortController();
    (async () => {
      try {
        const [fresh, catalog] = await Promise.all([gameApi.view(runId, controller.signal), gameApi.catalog(controller.signal)]);
        setView(fresh);
        setCaseTitle(catalog.find(item => item.caseId === fresh.caseId)?.title ?? fresh.caseId);
      } catch { /* conserva la vista anterior */ }
    })();
    return () => controller.abort();
  }, [preferences.language, view, runId]);

  const contacts = useMemo(() => (view ? contactsFromView(view) : []), [view]);

  const handleLoadError = useCallback((error: unknown) => {
    setNotice(errorMessage(error, t));
    if (error instanceof GameError && error.kind === 'not_found') setPhase('not_found');
    else if (error instanceof GameError && error.kind === 'session') setPhase('signed_out');
    else setPhase('error');
  }, [t]);

  const refresh = useCallback(async () => {
    if (!runId) return;
    const ticket = ++generation.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const fresh = await gameApi.view(runId, controller.signal);
      if (generation.current !== ticket) return;
      setView(fresh);
      if (fresh.status === 'closed') setNotice(t('game.notice.runClosed'));
    } catch (error) {
      if (generation.current !== ticket) return;
      handleLoadError(error);
    }
  }, [runId, handleLoadError, t]);

  const handleActionError = useCallback((error: unknown) => {
    setNotice(errorMessage(error, t));
    audioTts.playEffect('error');
    if (error instanceof GameError && error.kind === 'version_conflict') void refresh();
  }, [refresh, audioTts, t]);

  const loadInitial = useCallback(async (ticket: number, controller: AbortController) => {
    if (!runId) return;
    const session = await archiveApi.me(controller.signal);
    if (generation.current !== ticket) return;
    if (!session) { setPhase('signed_out'); setNotice(t('game.notice.noSession')); return; }
    setIdentity(session);
    // El perfil de detective (alias/avatar) se carga con la sesión; si aún
    // no hay fila, la API devuelve el avatar por defecto y sin alias.
    const profile = await profileApi.get(controller.signal).catch(() => null);
    if (generation.current !== ticket) return;
    if (profile) setDetectiveProfile(profile);
    const [fresh, catalog] = await Promise.all([gameApi.view(runId, controller.signal), gameApi.catalog(controller.signal)]);
    if (generation.current !== ticket) return;
    setView(fresh);
    setCaseTitle(catalog.find(item => item.caseId === fresh.caseId)?.title ?? fresh.caseId);
    setSaves(await gameApi.saves(runId, controller.signal).catch(() => null));
    setPhase('ready');
    setNotice(fresh.status === 'closed' ? t('game.notice.runClosed') : t('game.notice.investigationBegins'));
  }, [runId, t]);

  useEffect(() => {
    if (!runId) { setPhase('not_found'); return; }
    const ticket = ++generation.current;
    const controller = new AbortController();
    abortRef.current = controller;
    (async () => {
      try { await loadInitial(ticket, controller); }
      catch (error) { if (generation.current === ticket) handleLoadError(error); }
    })();
    return () => { generation.current++; controller.abort(); };
  }, [runId, loadInitial, handleLoadError]);

  useEffect(() => {
    if (runId) sessionStorage.setItem('meridiano-draft:' + runId, draft);
  }, [draft, runId]);

  useEffect(() => {
    if (!runId) return;
    try { sessionStorage.setItem('meridiano-log:' + runId, JSON.stringify(log.slice(-100))); } catch { /* sin almacenamiento */ }
  }, [log, runId]);

  useEffect(() => {
    if (orderPhase.kind === 'preview') confirmButtonRef.current?.focus();
  }, [orderPhase]);

  useEffect(() => {
    // El botón que lanzó la orden está deshabilitado mientras el diálogo está
    // abierto: el foco solo se puede devolver tras el render que lo habilita.
    if (orderPhase.kind === 'idle' && restoreFocusRef.current) {
      restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    }
  }, [orderPhase]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || windows.moving) return;
      if (orderPhase.kind === 'preview' || orderPhase.kind === 'clarification' || orderPhase.kind === 'error' || orderPhase.kind === 'recovering') {
        // Cancelar con Escape es lo mismo que pulsar «Cancelar»: sin el
        // aviso, «Preparando: Cerrar el caso…» se quedaba pegado.
        restoreFocusRef.current = lastTriggerRef.current;
        setOrderPhase({ kind: 'idle' });
        setNotice(t('game.notice.cancelled'));
        return;
      }
      // La charla en escena se cierra con Escape antes que las ventanas:
      // es lo último que se abrió y su cierre devuelve el foco a la escena.
      if (chatNpc) { closeChat(); return; }
      const open = (Object.keys(windows.windows) as WindowId[]).filter(id => windows.windows[id].open);
      const last = open[open.length - 1];
      if (last) windows.close(last);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [orderPhase, windows.windows, windows.moving, windows.close, chatNpc, closeChat, t]);

  function applyResponse(response: ActionResponseDto, offerLabel: string, offer?: PublicActionOffer) {
    const previous = view;
    setView(response);
    const detail = actionResultDetail(response, previous, t, preferences.language, offer);
    const entries: LogEntry[] = response.events.map(event => ({ minute: event.minute, summary: event.summary }));
    const last = entries[entries.length - 1];
    if (detail && last) entries[entries.length - 1] = { ...last, detail };
    else if (detail) entries.push({ minute: response.clock.minute, summary: offerLabel, detail });
    setLog(current => [...current, ...entries]);
    setNotice(noticeForOutcome(response, offerLabel, t));
    timeFeedback.apply(previous, response, offer);
    // Efecto de interfaz (GDD §15): el viaje suena con arpegio y el resto
    // de acciones con una confirmación; con efectos apagados o silenciados
    // no suena nada.
    audioTts.playEffect(offer?.action.type === 'travel' ? 'travel' : 'confirm');
    const target = talkTarget(offer, lookupFromView(previous ?? response));
    if (target) openChat(target.id, target.name);
  }

  /** Consola narrativa guardada en esta pestaña por partida: al recargar,
   * la consola sigue donde se quedó en vez de volver al texto genérico. */
  function loadStoredLog(id: string | null | undefined): LogEntry[] {
    if (!id) return [];
    try {
      const stored = JSON.parse(sessionStorage.getItem('meridiano-log:' + id) ?? 'null') as unknown;
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((entry): entry is LogEntry => !!entry && typeof entry === 'object'
          && typeof (entry as LogEntry).minute === 'number' && typeof (entry as LogEntry).summary === 'string')
        .slice(-100);
    } catch { return []; }
  }

  /** Turnos y memoria de una conversación guardados en esta pestaña. */
  function loadStoredChat(key: string): { turns: ChatTurn[]; memory: unknown } | null {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { turns: ChatTurn[]; memory: unknown } | null;
      return stored && Array.isArray(stored.turns) ? stored : null;
    } catch { return null; }
  }

  function saveChat(key: string, turns: ChatTurn[], memory: unknown) {
    try { sessionStorage.setItem(key, JSON.stringify({ turns, memory })); } catch { /* sin almacenamiento */ }
  }

  /** Abre la conversación con un personaje DENTRO de la escena (sin
   * ventana aparte): recupera sus turnos y su memoria de esta pestaña o
   * la inicia con su saludo. El foco lo mueve el panel al montarse. */
  function openChat(npcId: string, npcName: string, opener: HTMLElement | null = null) {
    if (!runId || !view) return;
    const key = `meridiano:chat:${runId}:${npcId}`;
    const stored = loadStoredChat(key);
    if (stored) {
      setChatTurns(stored.turns);
      setChatMemory(stored.memory ?? null);
    } else {
      const greeting = chatGreeting(findChatEntry(view, npcId), npcGreeting(npcId, undefined, view.caseId, preferences.language), npcName, t);
      const turns: ChatTurn[] = [{ from: 'npc', text: greeting }];
      const memory = { schemaVersion: 1, runId, npcId, treatment: 'neutral', turns: [] };
      setChatTurns(turns);
      setChatMemory(memory);
      saveChat(key, turns, memory);
    }
    // Quién abrió la charla: el botón que se pasa, o el de la última
    // orden confirmada (el «Hablar con» de la escena). Al cerrarla, el
    // foco vuelve a él.
    chatOpenerRef.current = opener ?? lastTriggerRef.current;
    setChatNpc({ id: npcId, name: npcName });
    setChatError('');
  }

  /** Pregunta lista para enviar al personaje, o null si falta algo. */
  function chatQuestion(): { runId: string; csrfToken: string; npcId: string; name: string; text: string; facts: Array<{ id: string; text: string }>; memory: unknown } | null {
    const text = chatDraft.trim();
    if (!text || !runId || !identity || !chatNpc || chatBusy || !view) return null;
    const npcId = chatNpc.id;
    // Hechos extra de la central: si la pregunta viene de preguntar por
    // un documento enviado, su texto entra como hecho autorizado de esa
    // pregunta (el personaje lo recibió y puede comentarlo); sin él, la
    // pregunta por el documento saldría como «He registrado tu consulta.».
    const extra = chatExtraFacts && chatExtraFacts.npcId === npcId ? chatExtraFacts.facts : [];
    return { runId, csrfToken: identity.csrfToken, npcId, name: chatNpc.name, text,
      facts: [...chatFacts(findChatEntry(view, npcId), npcKnowledgeFacts(npcId, undefined, undefined, view.caseId, preferences.language)), ...extra],
      memory: chatMemory ?? { schemaVersion: 1, runId, npcId, treatment: 'neutral', turns: [] } };
  }

  async function sendChatMessage(event: FormEvent) {
    event.preventDefault();
    const question = chatQuestion();
    if (!question || !view) return;
    // Los hechos extra solo valen para esta pregunta.
    setChatExtraFacts(null);
    const factIds = question.facts.map(fact => fact.id);
    const turns: ChatTurn[] = [...chatTurns, { from: 'you', text: question.text }];
    setChatTurns(turns);
    setChatDraft('');
    setChatBusy(true);
    setChatError('');
    const controller = new AbortController();
    try {
      const refusal = chatRefusal(findChatEntry(view, question.npcId), npcRefusal(question.npcId, undefined, view.caseId, preferences.language));
      const result = await aiApi.converse({ runId: question.runId, text: question.text,
        npc: { id: question.npcId, name: question.name, persona: chatPersona(findChatEntry(view, question.npcId), getNPC(question.npcId)?.persona ?? ''), knownFactIds: factIds, revealableFactIds: factIds, ...(refusal ? { refusal } : {}) },
        facts: question.facts, memory: question.memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'] },
      controller.signal, { csrfToken: question.csrfToken });
      const next: ChatTurn[] = [...turns, { from: 'npc', text: result.narrative.text }];
      setChatTurns(next);
      setChatMemory(result.memory);
      saveChat(`meridiano:chat:${question.runId}:${question.npcId}`, next, result.memory);
    } catch {
      setChatError(t('game.notice.aiDownChat'));
    } finally {
      setChatBusy(false);
    }
  }

  /** Lo que la partida ha oído de los personajes: el conocimiento citado
   * en las memorias de conversación guardadas en esta pestaña (cada turno
   * guarda sus `factIds`). Solo eso entra en la terminal como «oído»: el
   * conocimiento completo de un personaje no es del jugador hasta que el
   * personaje lo dice. */
  function heardIntelFacts(): Array<{ id: string; text: string }> {
    if (!view || !runId) return [];
    const heard: Array<{ id: string; text: string }> = [];
    const seen = new Set<string>();
    const addFact = (entry: PlayerViewDto['npcChat'][number], factId: string) => {
      const knowledge = entry.knowledge.find(item => item.id === factId);
      if (knowledge && !seen.has(`${entry.id}:${factId}`)) {
        seen.add(`${entry.id}:${factId}`);
        heard.push({ id: `npc:${entry.id}:${factId}`, text: `${entry.name}: ${knowledge.text}` });
      }
    };
    const addTurn = (entry: PlayerViewDto['npcChat'][number], turn: unknown) => {
      if (!isMemoryTurn(turn)) return;
      for (const factId of turn.factIds) if (typeof factId === 'string') addFact(entry, factId);
    };
    for (const entry of view.npcChat) {
      const stored = loadStoredChat(`meridiano:chat:${runId}:${entry.id}`);
      const memory = stored?.memory as { turns?: unknown[] } | null;
      for (const turn of memory?.turns ?? []) addTurn(entry, turn);
    }
    return heard;
  }

  /** Abre la terminal de inteligencia: recupera sus turnos y su memoria
   * de esta pestaña o la inicia con su saludo. */
  function openIntel() {
    if (!runId) return;
    const key = `meridiano:intel:${runId}`;
    const stored = loadStoredChat(key);
    if (stored) {
      setIntelTurns(stored.turns);
      setIntelMemory(stored.memory ?? null);
    } else {
      const turns: ChatTurn[] = [{ from: 'npc', text: intelGreeting(t) }];
      const memory = { schemaVersion: 1, runId, npcId: INTEL_ID, treatment: 'neutral', turns: [] };
      setIntelTurns(turns);
      setIntelMemory(memory);
      saveChat(key, turns, memory);
    }
    setIntelError('');
    windows.open('intel', null);
  }

  /** Pregunta a la terminal: recupera los hechos autorizados que responden
   * (determinista, sin modelo) y solo entonces llama al modelo para
   * redactar lo recuperado. Sin hecho que respalde la respuesta, la
   * terminal lo dice sin llamar al modelo y sin inventar nada. */
  async function sendIntelMessage(event: FormEvent) {
    event.preventDefault();
    const text = intelDraft.trim();
    if (!text || !runId || !identity || !view || intelBusy) return;
    const turns: ChatTurn[] = [...intelTurns, { from: 'you', text }];
    setIntelTurns(turns);
    setIntelDraft('');
    setIntelBusy(true);
    setIntelError('');
    const key = `meridiano:intel:${runId}`;
    const memory = intelMemory ?? { schemaVersion: 1, runId, npcId: INTEL_ID, treatment: 'neutral', turns: [] };
    const facts = buildIntelFacts({
      dossier: view.dossier,
      objectives: view.objectives,
      briefing: view.briefing,
      heard: heardIntelFacts(),
      textForDiscovery: id => discoveryText(id, lookupFromView(view), textsFromView(view), view.caseId, preferences.language),
      t,
    });
    const selected = selectIntelFacts(text, facts);
    if (selected.length === 0) {
      const next: ChatTurn[] = [...turns, { from: 'npc', text: intelNoRecord(t) }];
      setIntelTurns(next);
      setIntelMemory(memory);
      saveChat(key, next, memory);
      setIntelBusy(false);
      return;
    }
    const controller = new AbortController();
    try {
      const factIds = selected.map(fact => fact.id);
      const result = await aiApi.converse({ runId, text,
        npc: { id: INTEL_ID, name: INTEL_NAME, persona: intelPersona(t), knownFactIds: factIds, revealableFactIds: factIds, refusal: intelRefusal(t) },
        facts: selected, memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'] },
      controller.signal, { csrfToken: identity.csrfToken });
      const next: ChatTurn[] = [...turns, { from: 'npc', text: result.narrative.text }];
      setIntelTurns(next);
      setIntelMemory(result.memory);
      saveChat(key, next, result.memory);
    } catch {
      setIntelError(t('game.notice.intelDown'));
    } finally {
      setIntelBusy(false);
    }
  }

  /** Turnos del equipo en esta pestaña por partida, con la memoria de
   * conversación de Elena (misma forma que `saveChat`, con el miembro). */
  function loadStoredTeam(key: string): { turns: TeamTurn[]; memory: unknown } | null {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { turns: TeamTurn[]; memory: unknown } | null;
      return stored && Array.isArray(stored.turns) ? stored : null;
    } catch { return null; }
  }

  function saveTeam(key: string, turns: TeamTurn[], memory: unknown) {
    try { sessionStorage.setItem(key, JSON.stringify({ turns, memory })); } catch { /* sin almacenamiento */ }
  }

  /** Abre el equipo: recupera sus turnos de esta pestaña o lo inicia con
   * el saludo de Margaret. */
  function openTeam(opener: HTMLElement | null) {
    if (!runId) return;
    const key = `meridiano:team:${runId}`;
    const stored = loadStoredTeam(key);
    if (stored) {
      setTeamTurns(stored.turns);
      setTeamElenaMemory(stored.memory ?? null);
    } else {
      const turns: TeamTurn[] = [{ memberId: 'margaret', from: 'team', text: teamGreeting(t) }];
      const memory = { schemaVersion: 1, runId, npcId: ELENA_ID, treatment: 'neutral', turns: [] };
      setTeamTurns(turns);
      setTeamElenaMemory(memory);
      saveTeam(key, turns, memory);
    }
    const firstAnalysis = view?.analysisResults[0];
    if (firstAnalysis) setTeamAnalysisId(firstAnalysis);
    setTeamError('');
    windows.open('team', opener);
  }

  /** Carga el perfil de carrera para la evaluación de Margaret (GDD §13):
   * null si la carga falla (el error queda en la ventana del equipo y la
   * petición no se registra). El perfil vacío (sin casos cerrados) es un
   * objeto válido, no un fallo. */
  async function ensureCareer(): Promise<CareerProfileDto | null> {
    if (careerLoaded) return career;
    try {
      const profile = await gameApi.career(new AbortController().signal);
      setCareer(profile);
      setCareerLoaded(true);
      return profile;
    } catch {
      setTeamError(t('game.notice.careerLoadFailed'));
      return null;
    }
  }

  /** Pide un servicio determinista al equipo: la respuesta se calcula
   * desde la vista (resumen de lo que ya consta) y la petición queda
   * registrada en el motor con una acción `team` gratuita. La evaluación
   * de carrera carga además el perfil oficial antes de responder. */
  async function requestTeamService(memberId: TeamMemberId, serviceId: TeamServiceId, targetId: string | undefined, trigger: HTMLElement | null) {
    if (!runId || !view) return;
    let answer: string | null;
    if (serviceId === 'evaluate') {
      const profile = await ensureCareer();
      if (!profile) return;
      answer = teamServiceAnswer(serviceId, view, targetId, profile, t);
    } else {
      answer = teamServiceAnswer(serviceId, view, targetId, undefined, t);
    }
    if (!answer) return;
    const name = TEAM_MEMBERS.find(member => member.id === memberId)?.name ?? memberId;
    const offer: PublicActionOffer = { id: `team:${memberId}:${serviceId}${targetId ? `:${targetId}` : ''}`,
      label: t('game.teamServiceWith', { service: t(TEAM_SERVICE_KEYS[serviceId]), name }),
      action: { type: 'team', params: { memberId, serviceId, ...(targetId ? { targetId } : {}) } } };
    const key = `meridiano:team:${runId}`;
    const turns: TeamTurn[] = [...teamTurns,
      { memberId, from: 'you', text: teamRequestText(serviceId, targetId, t) },
      { memberId, from: 'team', text: answer }];
    setTeamTurns(turns);
    saveTeam(key, turns, teamElenaMemory);
    void startPreview(offer, trigger);
  }

  /** Pregunta a Elena: la misma consulta determinista que la terminal,
   * con su persona; la consulta queda registrada en el motor (sin el
   * texto libre). Sin hecho que respalde la respuesta, lo dice sin
   * llamar al modelo. */
  async function sendElenaMessage(event: FormEvent) {
    event.preventDefault();
    const text = teamDraft.trim();
    if (!text || !runId || !identity || !view || teamElenaBusy) return;
    const turns: TeamTurn[] = [...teamTurns, { memberId: 'elena', from: 'you', text }];
    setTeamTurns(turns);
    setTeamDraft('');
    setTeamElenaBusy(true);
    setTeamError('');
    const key = `meridiano:team:${runId}`;
    const memory = teamElenaMemory ?? { schemaVersion: 1, runId, npcId: ELENA_ID, treatment: 'neutral', turns: [] };
    const offer: PublicActionOffer = { id: 'team:elena:lookup', label: t('game.elenaConsult'),
      action: { type: 'team', params: { memberId: 'elena', serviceId: 'lookup', question: text } } };
    void startPreview(offer, null);
    const facts = buildIntelFacts({
      dossier: view.dossier,
      objectives: view.objectives,
      briefing: view.briefing,
      heard: heardIntelFacts(),
      textForDiscovery: id => discoveryText(id, lookupFromView(view), textsFromView(view), view.caseId, preferences.language),
      t,
    });
    const selected = selectIntelFacts(text, facts);
    if (selected.length === 0) {
      const next: TeamTurn[] = [...turns, { memberId: 'elena', from: 'team', text: elenaRefusal(t) }];
      setTeamTurns(next);
      setTeamElenaMemory(memory);
      saveTeam(key, next, memory);
      setTeamElenaBusy(false);
      return;
    }
    const controller = new AbortController();
    try {
      const factIds = selected.map(fact => fact.id);
      const result = await aiApi.converse({ runId, text,
        npc: { id: ELENA_ID, name: ELENA_NAME, persona: elenaPersona(t), knownFactIds: factIds, revealableFactIds: factIds, refusal: elenaRefusal(t) },
        facts: selected, memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'] },
      controller.signal, { csrfToken: identity.csrfToken });
      const next: TeamTurn[] = [...turns, { memberId: 'elena', from: 'team', text: result.narrative.text }];
      setTeamTurns(next);
      setTeamElenaMemory(result.memory);
      saveTeam(key, next, result.memory);
    } catch {
      setTeamError(t('game.notice.elenaDown'));
    } finally {
      setTeamElenaBusy(false);
    }
  }

  /** Confirma una acción con su clave de idempotencia y su revisión
   * esperada (la misma llamada que el diálogo de confirmación, con o sin
   * diálogo previo). */
  async function commitOffer(offer: PublicActionOffer, key: string) {
    if (!runId || !identity || !view) return;
    setOrderPhase({ kind: 'committing', offer, key });
    const controller = new AbortController();
    try {
      const response = await gameApi.commit(runId, offer.action, view.version, key, identity, controller.signal);
      applyResponse(response, offer.label, offer);
      setOrderPhase({ kind: 'idle' });
      orderInputRef.current?.focus();
    } catch (error) {
      if (error instanceof GameError && error.kind === 'unavailable') {
        setOrderPhase({ kind: 'recovering', offer, key, message: t('game.notice.recoverLost') });
      } else {
        setOrderPhase({ kind: 'error', message: errorMessage(error, t) });
        handleActionError(error);
      }
    }
  }

  async function startPreview(offer: PublicActionOffer, trigger: HTMLElement | null) {
    if (!runId || !identity || !view || busyOffer) return;
    lastTriggerRef.current = trigger;
    setBusyOffer(offer.id);
    setNotice(t('game.notice.preparing', { label: offer.label }));
    const controller = new AbortController();
    try {
      const response = await gameApi.preview(runId, offer.action, identity, controller.signal);
      const phase = previewOutcome(response, offer, crypto.randomUUID(), t);
      // Un clic para lo barato y reversible (lote 2): si la acción no pide
      // diálogo, se confirma en el mismo clic, sin mostrarlo. Lo costoso o
      // irreversible sigue enseñando el diálogo, como antes.
      if (phase.kind === 'preview' && !needsConfirmationDialog(response, offer)) {
        await commitOffer(offer, phase.key);
        return;
      }
      setOrderPhase(phase);
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error, t) });
      handleActionError(error);
    } finally {
      setBusyOffer(null);
    }
  }

  async function confirmPreview() {
    if (orderPhase.kind !== 'preview' || !runId || !identity || !view) return;
    await commitOffer(orderPhase.offer, orderPhase.key);
  }

  async function recoverCommit() {
    if (orderPhase.kind !== 'recovering' || !runId || !identity || !view) return;
    const { offer, key } = orderPhase;
    const controller = new AbortController();
    try {
      const response = await gameApi.commit(runId, offer.action, view.version, key, identity, controller.signal);
      applyResponse(response, offer.label, offer);
      setOrderPhase({ kind: 'idle' });
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error, t) });
      handleActionError(error);
    }
  }

  function cancelOrder() {
    restoreFocusRef.current = lastTriggerRef.current;
    setOrderPhase({ kind: 'idle' });
    // Sin esto, el aviso «Preparando: Cerrar el caso…» se quedaba pegado
    // tras cancelar el diálogo de confirmación.
    setNotice(t('game.notice.cancelled'));
  }

  async function interpretOrder(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !runId || !identity || !view || orderPhase.kind !== 'idle') return;
    setOrderHistory(current => [text, ...current].slice(0, 20));
    setOrderPhase({ kind: 'interpreting' });
    setNotice(t('game.notice.interpreting'));
    const controller = new AbortController();
    try {
      const result = await aiApi.interpret(text, { location: view.position.location.id, description: view.position.location.description },
        view.offers.map(offer => ({ id: offer.id, label: offer.label })), controller.signal, { csrfToken: identity.csrfToken }, { runId });
      if (result.kind === 'clarification') {
        setOrderPhase({ kind: 'clarification', question: clarificationQuestion(t, result), original: text });
        setNotice(t('game.notice.clarificationNeededOrder'));
        return;
      }
      const offer = view.offers.find(item => item.id === result.actionIds?.[0]);
      if (!offer) {
        setOrderPhase({ kind: 'error', message: t('game.notice.interpretNoMatchDetail') });
        setNotice(t('game.notice.interpretNoMatch'));
        return;
      }
      setNotice(t('game.notice.interpretedAs', { label: offer.label }));
      await startPreview(offer, orderInputRef.current);
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error, t) });
      setNotice(errorMessage(error, t));
    }
  }

  function onOrderKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function reloadSaves() {
    if (!runId) return;
    try { setSaves(await gameApi.saves(runId, new AbortController().signal)); } catch { setSaves(null); }
  }

  // Recarga silenciosa de la vista: actualiza saveCapabilities.manualCount
  // tras crear o borrar un guardado. No se usa refresh() aquí: si la vista
  // fallara de forma transitoria tras un guardado correcto, refresh() mostraría
  // la pantalla de error; con un fallo silencioso el contador se actualiza en
  // la próxima recarga y el guardado confirmado no se pierde de vista.
  async function reloadView() {
    if (!runId) return;
    try { setView(await gameApi.view(runId, new AbortController().signal)); } catch { /* conserva la vista anterior */ }
  }

  async function createSave() {
    if (!runId || !identity || !view || !saveName.trim()) return;
    setSavePhase('saving');
    try {
      const summary = await gameApi.createSave(runId, saveName.trim(), view.version, crypto.randomUUID(),
        replaceTarget ? replaceTarget.saveId : null, identity, new AbortController().signal);
      setSavePhase('saved');
      setNotice(summary.replayed ? t('game.notice.saveExists') : t('game.notice.saveConfirmed', { name: summary.name }));
      setSaveName('');
      setReplaceTarget(null);
      await reloadSaves();
      await reloadView();
    } catch (error) {
      setSavePhase('failed');
      handleActionError(error);
    }
  }

  async function confirmLoad() {
    if (!runId || !identity || !view || !loadTarget) return;
    const target = loadTarget;
    setLoadTarget(null);
    const controller = new AbortController();
    try {
      const response = await gameApi.loadSave(runId, target.saveId, view.version, crypto.randomUUID(), identity, controller.signal);
      setView(response);
      setLog(current => [...current, { minute: response.clock.minute, summary: t('game.notice.saveLoadedLog', { name: target.name }) }]);
      setNotice(t('game.notice.saveLoaded', { name: target.name, minute: response.clock.minute }));
      await reloadSaves();
    } catch (error) {
      handleActionError(error);
    }
  }

  async function removeSave(save: SaveListItem) {
    if (!runId || !identity) return;
    try {
      await gameApi.deleteSave(runId, save.saveId, save.metadataVersion, crypto.randomUUID(), identity, new AbortController().signal);
      setNotice(t('game.notice.saveDeleted', { name: save.name }));
      await reloadSaves();
      await reloadView();
    } catch (error) {
      handleActionError(error);
    }
  }

  /** Al elegir destinatario, el canal pasa al primero de los suyos: la
   * central solo ofrece los canales de cada contacto, nunca todos. */
  function handleCommRecipient(value: string) {
    setCommRecipient(value);
    const contact = contacts.find(item => item.id === value);
    setCommChannel(contact?.channels[0] ?? '');
  }

  /** Nombre de un contacto de la central: su contacto, su entrada de
   * charla o su id si no hay nombre. */
  function communicationContactName(record: PlayerViewDto['communications'][number]): string {
    return contacts.find(contact => contact.id === record.recipientId)?.name
      ?? view?.npcChat.find(entry => entry.id === record.recipientId)?.name ?? record.recipientId;
  }

  /** Preguntar a un contacto por un envío ya recibido: abre su conversación
   * con la pregunta preparada (el jugador la envía cuando quiera) y, si
   * era un documento, su texto como hecho autorizado de esa pregunta. La
   * respuesta sigue las reglas de la conversación: solo hechos autorizados,
   * sin inventar; el turno queda en la memoria de chat del personaje. */
  function askAboutCommunication(record: PlayerViewDto['communications'][number], trigger: HTMLElement | null = null) {
    if (!view) return;
    const name = communicationContactName(record);
    const documentText = record.documentId ? view.evidenceTexts[record.documentId] : undefined;
    setChatExtraFacts({ npcId: record.recipientId,
      facts: record.documentId && documentText ? [{ id: record.documentId, text: documentText }] : [] });
    openChat(record.recipientId, name, trigger);
    setChatDraft(documentText
      ? t('game.chatDraftSentDocument', { document: documentText })
      : t('game.chatDraftSentMessage', { message: record.requestText }));
  }

  async function sendCommunication(event: FormEvent) {
    event.preventDefault();
    if (!runId || !identity || !view || !commRecipient || !commText.trim()) return;
    const name = contacts.find(contact => contact.id === commRecipient)?.name ?? commRecipient;
    const offer: PublicActionOffer = { id: `communicate:${commRecipient}:${commChannel}`,
      label: t('game.contactVia', { name, channel: channelLabel(commChannel, t) }),
      action: { type: 'communicate', params: { channel: commChannel, recipientId: commRecipient, requestText: commText.trim(),
        ...(commDocument ? { documentId: commDocument } : {}) } } };
    setCommText('');
    setCommDocument('');
    await startPreview(offer, null);
  }

  if (phase !== 'ready' || !view) {
    return <UnavailableScreen phase={phase} notice={notice} />;
  }

  const closed = view.status === 'closed';
  const busy = busyOffer !== null || orderPhase.kind !== 'idle';
  const windowProps = {
    moving: windows.moving, focusSeqs: windows.focusSeq, onMoveStart: windows.setMoving, onMoveEnd: () => windows.setMoving(null),
    onMoveBy: windows.moveBy, onMinimize: windows.minimize, onRestore: windows.restore, onClose: windows.close,
  };

  // Texto de la última entrada de la consola, para la barra de lectura.
  const lastLogText = lastLogTextOf(log);

  return <main className="game" data-testid="game-screen" style={{ fontSize: `${16 * preferences.textScale / 100}px` }}>
    {preferences.accessibility.skipNav && <a className="game-skip-link" href="#game-scene">{t('game.skipToScene')}</a>}
    <HeaderSection view={view} caseTitle={caseTitle} detective={detectiveDisplayName(detectiveProfile, identity)}
      avatar={detectiveAvatarName(detectiveProfile, t)} clockPulse={timeFeedback.clockPulse} onLogout={identity ? () => {
      void archiveApi.logout(identity.csrfToken, new AbortController().signal).finally(() => navigate('/'));
    } : null} />

    <p className="game-notice" role="status">{notice}</p>

    <IntroPanel view={view} open={introOpen} onDismiss={dismissIntro} />
    <ResumePanel view={view} open={resumeOpen} onDismiss={dismissResume} />

    <div className="game-toolbar" role="toolbar" aria-label={t('game.toolbarTools')}>
      <IntroButton view={view} onOpen={() => setIntroOpen(true)} />
      {resumeAvailable(view) && <button type="button" onClick={() => setResumeOpen(true)}>{t('game.toolbarResume')}</button>}
      {(Object.keys(WINDOW_KEYS) as WindowId[]).map(id => (
        <button key={id} type="button" data-testid={`toolbar-${id}`} aria-pressed={windows.windows[id].open}
          onClick={event => { if (id === 'team') openTeam(event.currentTarget); else windows.open(id, event.currentTarget); }}>{t(WINDOW_KEYS[id])}</button>
      ))}
      <button type="button" onClick={windows.resetLayout}>{t('game.toolbarResetLayout')}</button>
      <button type="button" onClick={() => void refresh()}>{t('game.toolbarRefresh')}</button>
    </div>

    <ObjectivesSection view={view} />
    <SceneSection view={view} disabled={busy} clockPulse={timeFeedback.clockPulse} onOffer={(offer, trigger) => void startPreview(offer, trigger)} onOpenLab={() => windows.open('lab', null)}
      chatPanel={chatNpc ? <SceneChatPanel npc={chatNpc} view={view} turns={chatTurns} draft={chatDraft} busy={chatBusy} error={chatError}
        onDraft={setChatDraft} onSend={event => void sendChatMessage(event)}
        onRead={text => void audioTts.speak(text)} canRead={audioTts.canRead} noVoices={audioTts.noVoices} onClose={closeChat} /> : null} />
    <ConsoleSection log={log} orderHistory={orderHistory} reducedMotion={reducedMotion} announceNarration={preferences.accessibility.announceNarration} readBar={<ReadAloudBar text={lastLogText} canRead={audioTts.canRead}
      speaking={audioTts.speaking} paused={audioTts.paused} hasLast={audioTts.lastText !== ''} noVoices={audioTts.noVoices} onRead={() => void audioTts.speak(lastLogText)}
      onRepeat={() => void audioTts.speak(audioTts.lastText)} onPauseResume={audioTts.pauseOrResume} onStop={audioTts.stop} />} />
    <OrderSection draft={draft} closed={closed} busy={orderPhase.kind !== 'idle'} orderPhase={orderPhase} inputRef={orderInputRef}
      onDraft={setDraft} onSubmit={interpretOrder} onKeyDown={onOrderKeyDown} onCancel={cancelOrder} onRecover={() => void recoverCommit()} />

    <TravelOverlaySlot travel={timeFeedback.travel} onDismiss={timeFeedback.dismissTravel} />

    {orderPhase.kind === 'preview' && <PreviewDialog phase={orderPhase} confirmRef={confirmButtonRef}
      onConfirm={() => void confirmPreview()} onCancel={cancelOrder} />}
    {orderPhase.kind === 'committing' && <p className="game-notice" role="status">{t('game.notice.committing')}</p>}

    <MinimizedBar windows={windows.windows} lastMinimized={windows.lastMinimized} onRestore={windows.restore} />

    <GameWindow id="map" title={t(WINDOW_KEYS['map'])} state={windows.windows.map} {...windowProps}>
      <MapContent view={view} busy={busy} onOffer={(offer, trigger) => void startPreview(offer, trigger)} />
    </GameWindow>
    <GameWindow id="dossier" title={t(WINDOW_KEYS['dossier'])} state={windows.windows.dossier} {...windowProps}>
      <DossierContent view={view} onRead={text => void audioTts.speak(text)} canRead={audioTts.canRead} noVoices={audioTts.noVoices} />
    </GameWindow>
    <GameWindow id="lab" title={t(WINDOW_KEYS['lab'])} state={windows.windows.lab} {...windowProps}>
      <LabContent view={view} labOffers={groupOffers(view.offers).lab} disabled={busy}
        onAnalyze={(offer, trigger) => void startPreview(offer, trigger)} onOpenIntel={openIntel} />
    </GameWindow>
    <GameWindow id="comms" title={t(WINDOW_KEYS['comms'])} state={windows.windows.comms} {...windowProps}>
      <CommsContent view={view} contacts={contacts} recipient={commRecipient} channel={commChannel} documentId={commDocument}
        text={commText} busy={busy} onRecipient={handleCommRecipient} onChannel={setCommChannel} onDocument={setCommDocument}
        onText={setCommText} onSend={sendCommunication} onAskReply={askAboutCommunication} />
    </GameWindow>
    <GameWindow id="team" title={t(WINDOW_KEYS['team'])} state={windows.windows.team} {...windowProps}>
      <TeamContent view={view} turns={teamTurns} draft={teamDraft} busy={busy} elenaBusy={teamElenaBusy} error={teamError}
        analysisId={teamAnalysisId} detainOffers={view.offers.filter(offer => offer.action.type === 'detain')}
        onAnalysis={setTeamAnalysisId} onService={(memberId, serviceId, targetId, trigger) => requestTeamService(memberId, serviceId, targetId, trigger)}
        onOffer={(offer, trigger) => void startPreview(offer, trigger)} onDraft={setTeamDraft} onSendElena={event => void sendElenaMessage(event)} />
    </GameWindow>
    <GameWindow id="saves" title={t(WINDOW_KEYS['saves'])} state={windows.windows.saves} {...windowProps}>
      <SavesContent view={view} saves={saves} savePhase={savePhase} saveName={saveName} replaceTarget={replaceTarget} loadTarget={loadTarget}
        onSaveName={setSaveName} onCreate={() => void createSave()} onLoad={setLoadTarget} onDelete={save => void removeSave(save)}
        onReplace={setReplaceTarget} onConfirmLoad={() => void confirmLoad()} onCancelLoad={() => setLoadTarget(null)} />
    </GameWindow>
    <GameWindow id="settings" title={t(WINDOW_KEYS['settings'])} state={windows.windows.settings} {...windowProps}>
      <SettingsContent identity={identity} language={preferences.language} onLanguage={value => updatePreferences({ language: value })}
        textScale={preferences.textScale} highContrast={preferences.highContrast}
        palette={preferences.palette} accessibility={preferences.accessibility} fontMode={preferences.fontMode}
        onScale={value => updatePreferences({ textScale: value })}
        onContrast={value => updatePreferences({ highContrast: value })} onPalette={value => updatePreferences({ palette: value })}
        onAccessibility={patch => updatePreferences({ accessibility: { ...preferences.accessibility, ...patch } })}
        onFontMode={value => updatePreferences({ fontMode: value })}
        profile={detectiveProfile} onProfileSaved={setDetectiveProfile}
        audio={preferences.audio} tts={preferences.tts} voices={audioTts.voices}
        ttsSupported={audioTts.ttsSupported}
        onAudio={patch => updatePreferences({ audio: { ...preferences.audio, ...patch } })}
        onTTS={patch => updatePreferences({ tts: { ...preferences.tts, ...patch } })} />
    </GameWindow>
    <GameWindow id="report" title={t(WINDOW_KEYS['report'])} state={windows.windows.report} {...windowProps}>
      <ReportContent view={view} />
    </GameWindow>
    <GameWindow id="intel" title={t(WINDOW_KEYS['intel'])} state={windows.windows.intel} {...windowProps}>
      <ChatContent npc={{ id: INTEL_ID, name: INTEL_NAME }} view={view} turns={intelTurns} draft={intelDraft} busy={intelBusy} error={intelError}
        onDraft={setIntelDraft} onSend={event => void sendIntelMessage(event)}
        onRead={text => void audioTts.speak(text)} canRead={audioTts.canRead} noVoices={audioTts.noVoices}
        placeholder={t('game.intelPlaceholder')}
        note={t('game.intelNote')} />
    </GameWindow>
  </main>;
}
