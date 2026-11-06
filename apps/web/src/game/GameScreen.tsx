import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { archiveApi } from '../archive/client';
import { aiApi, AiError } from '../ai/client';
import { aiConnectionsApi, ConnectionsError } from '../ai/connections';
import type { AiConnection, ConnectionsResponse, ConnectionTestResult, ProviderCatalogEntry } from '../ai/connections';
import { gameApi, GameError } from './client';
import { needsConfirmationDialog } from './action-confirmation';
import { SceneArt } from './scene-art';
import { groupOffers } from './scene-offers';
import type { GameErrorKind, SaveListDto, SaveListItem } from './client';
import { GameWindow, MinimizedBar, useWindows } from './windows';
import type { WindowId } from './windows';
import type { ActionResponseDto, PlayerViewDto, PublicActionOffer, SessionDto } from '@meridiano/contracts';
import { caseLabel, conversationRecordText, discoveryText, getNPC, npcGreeting, npcKnowledgeFacts, npcRefusal, objectiveText, reportReasonText, reportResultText, travelText } from '@meridiano/case-schema';
import type { DiscoveryLookup } from '@meridiano/case-schema';
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

const windowLabels: Record<WindowId, string> = {
  map: 'Mapa', dossier: 'Dossier', lab: 'Laboratorio y comunicaciones', saves: 'Guardados', settings: 'Ajustes', report: 'Informe final', chat: 'Conversación',
};
const channelLabels: Record<string, string> = { call: 'Llamada', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Correo', fax: 'Fax' };
const requestTypeLabels: Record<string, string> = { analysis: 'Análisis', query: 'Consulta', request: 'Solicitud' };
const evidenceTypeLabels: Record<string, string> = { object: 'objeto', observation: 'observación', testimony: 'testimonio', analysis: 'análisis', record: 'registro' };

/** Dificultad de la partida, tal como se enseña en la cabecera junto al
 * reloj («Normal · 48 horas»): la etiqueta que la verificación no encontró
 * porque la vista del jugador no traía el dato. */
const difficultyLabels: Record<PlayerViewDto['difficulty'], string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };
function difficultyLabel(difficulty: PlayerViewDto['difficulty']): string {
  return difficultyLabels[difficulty];
}

const gameErrorMessages: Record<GameErrorKind, string> = {
  session: 'La sesión caducó. Vuelve al archivo e inicia sesión de nuevo.',
  not_found: 'La partida no existe o no pertenece a tu cuenta.',
  version_conflict: 'La partida cambió en otra pestaña. Se ha actualizado la vista; vuelve a intentarlo.',
  run_closed: 'La partida ya está cerrada.',
  save_incompatible: 'Ese guardado no es compatible con esta partida.',
  save_limit: 'Ya tienes 10 guardados manuales. Borra o reemplaza uno para crear otro.',
  invalid: 'La respuesta del servidor no es válida.',
  unavailable: 'No se pudo contactar con el servidor. Reinténtalo.',
};

function errorMessage(error: unknown): string {
  if (error instanceof GameError) return gameErrorMessages[error.kind];
  if (error instanceof AiError) return error.kind === 'budget_exceeded' ? 'La orden es demasiado larga.' : 'La IA no responde. Puedes seguir con las acciones disponibles.';
  return 'Error inesperado.';
}

function contactsFromView(view: PlayerViewDto): Array<{ id: string; name: string }> {
  // Solo contactos con los que ya se habló: el motor exige relación previa.
  const met = new Set<string>();
  for (const record of view.conversation) {
    const id = /^talk:([A-Za-z0-9._:-]+)@/.exec(record)?.[1];
    if (id) met.add(id);
  }
  const names = npcNamesFromView(view);
  return [...met].map(id => ({ id, name: names.get(id) ?? id }));
}

/** Nombres de los personajes a partir de las etiquetas de las ofertas de
 * hablar («Hablar con X sobre su identidad»). */
function npcNamesFromView(view: PlayerViewDto): Map<string, string> {
  const names = new Map<string, string>();
  for (const offer of view.offers) {
    if (offer.action.type !== 'talk' || typeof offer.action.params.npcId !== 'string') continue;
    const label = /^Hablar con (.+) sobre su identidad$/.exec(offer.label)?.[1];
    if (label) names.set(offer.action.params.npcId, label);
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
  const npcs = npcNamesFromView(view);
  return {
    locationName: id => locations.get(id),
    cityName: id => cities.get(id),
    npcName: id => npcs.get(id) ?? getNPC(id)?.name,
  };
}

/** Órdenes en la escena: `warrant:<npc>` nombra al sospechoso y
 * `warrant:access` es la orden de acceso. Sin esto la escena enseñaba los
 * IDs crudos (`warrant:ines`). */
function warrantText(id: string): string {
  if (id === 'warrant:access') return 'Orden de acceso';
  if (id.startsWith('warrant:')) {
    const name = getNPC(id.slice('warrant:'.length))?.name ?? id.slice('warrant:'.length);
    return `Orden contra ${name}`;
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
function travelDetail(offer: PublicActionOffer | undefined, previous: PlayerViewDto | null, response: ActionResponseDto): string {
  if (offer?.action.type !== 'travel' || !previous || previous.position.city.id === response.position.city.id) return '';
  return travelText(previous.position.city.name, response.position.city.name);
}

/** Hallazgos nuevos del dossier, en frases legibles. */
function discoveryDetail(response: ActionResponseDto, previous: PlayerViewDto | null, lookup: DiscoveryLookup): string {
  const entries = (previous ? response.dossier.filter(entry => !previous.dossier.includes(entry)) : [...response.dossier])
    .filter(entry => !entry.startsWith('travel:'));
  return entries.map(entry => discoveryText(entry, lookup)).join(' ');
}

/** Solicitudes enviadas por la acción: qué se pidió y cuándo llega el
 * resultado. El resumen del servidor no puede decirlo (su evento solo lleva
 * el ID de la solicitud). */
function submittedDetail(response: ActionResponseDto, previous: PlayerViewDto | null, offer: PublicActionOffer | undefined, lookup: DiscoveryLookup): string {
  const added = previous
    ? response.pendingRequests.filter(request => !previous.pendingRequests.some(item => item.id === request.id))
    : [...response.pendingRequests];
  return added.map(request => {
    const due = `El resultado llegará sobre el minuto ${request.dueMinute}.`;
    if (offer?.action.type === 'request_warrant' && typeof offer.action.params.suspectId === 'string') {
      const name = lookup.npcName(offer.action.params.suspectId) ?? offer.action.params.suspectId;
      return `Has solicitado una orden contra ${name}. ${due}`;
    }
    return offer ? `Has enviado «${offer.label}». ${due}` : due;
  }).join(' ');
}

/** Órdenes concedidas al madurar: no dejan hallazgo en el dossier, así que
 * sin esta línea el jugador no sabría que ya tiene la orden. */
function warrantDetail(response: ActionResponseDto, previous: PlayerViewDto | null): string {
  const added = previous
    ? response.warrants.filter(item => !previous.warrants.includes(item))
    : [...response.warrants];
  return added.map(item => `${warrantText(item)} concedida.`).join(' ');
}

/** Detenciones nuevas: quedan registradas y el caso sigue abierto (la
 * detención no cierra; el informe final la valorará). */
function detentionDetail(response: ActionResponseDto, previous: PlayerViewDto | null, lookup: DiscoveryLookup): string {
  const added = previous
    ? response.detentions.filter(item => !previous.detentions.includes(item))
    : [...response.detentions];
  return added.map(item => {
    const name = lookup.npcName(item) ?? item;
    return `${name} queda detenida. El caso sigue abierto.`;
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
function talkDetail(offer: PublicActionOffer | undefined, lookup: DiscoveryLookup): string {
  const target = talkTarget(offer, lookup);
  return target ? `Hablas con ${target.name}. Te confirma su identidad: pregúntale en la conversación.` : '';
}

/** Frase del cierre: dónde está el informe final. */
function finishDetail(response: ActionResponseDto, offer: PublicActionOffer | undefined): string {
  return response.status === 'closed' && offer?.action.type === 'finish'
    ? 'El informe final está disponible en la ventana «Informe final».'
    : '';
}

/** Cuando nada de lo anterior contó nada: inspeccionar sin hallazgos y
 * esperar sin que llegue nada lo dicen explícitamente, para que la acción
 * no parezca no haber hecho nada. */
function emptyDetail(offer: PublicActionOffer | undefined, told: boolean): string {
  if (told) return '';
  if (offer?.action.type === 'inspect') return 'No encuentras nada nuevo aquí.';
  if (offer?.action.type === 'wait') return 'No llega nada nuevo.';
  return '';
}

/** Qué contar al jugador tras una acción confirmada: con quién habló y qué
 * descubrió de nuevo, en frases legibles. Vacío si no hay nada que contar.
 * Cada acción confirmada deja narración: antes solo la dejaban los viajes,
 * hablar y las acciones con hallazgos nuevos en el dossier — recoger, pedir
 * una consulta o una orden, esperar a que madurase una orden, detener y
 * cerrar solo dejaban el resumen de una línea (y recoger, además, el ID
 * crudo). */
function actionResultDetail(response: ActionResponseDto, previous: PlayerViewDto | null, offer?: PublicActionOffer): string {
  // Los nombres de los personajes salen de la vista anterior: la oferta de
  // hablar puede no estar ya en la vista nueva.
  const lookup = lookupFromView(previous ?? response);
  const parts = [
    travelDetail(offer, previous, response),
    discoveryDetail(response, previous, lookup),
    talkDetail(offer, lookup),
    submittedDetail(response, previous, offer, lookup),
    warrantDetail(response, previous),
    detentionDetail(response, previous, lookup),
    finishDetail(response, offer),
  ];
  const told = parts.some(part => part !== '');
  return [...parts, emptyDetail(offer, told)].filter(Boolean).join(' ');
}

/** Aviso de estado tras una acción confirmada. */
function noticeForOutcome(response: ActionResponseDto, offerLabel: string): string {
  if (response.outcome === 'case_closed') return `Caso cerrado: ${offerLabel}. El informe final está disponible.`;
  if (response.outcome === 'impossible') return `No se pudo: ${response.reason ?? offerLabel}.`;
  if (response.outcome === 'clarification_required') return response.question ?? 'Hace falta aclarar la orden.';
  return `${offerLabel} · Reloj: ${response.clock.minute} min.`;
}

function previewOutcome(response: ActionResponseDto, offer: PublicActionOffer, key: string): OrderPhase {
  if (response.outcome === 'impossible') return { kind: 'error', message: response.reason ?? 'Acción no disponible.' };
  if (response.outcome === 'clarification_required') return { kind: 'clarification', question: response.question ?? 'Hace falta aclarar la orden.', original: offer.label };
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
  return <span className="game-hourglass" data-testid="hourglass" role="status" aria-label={`El reloj avanza ${delta} minutos`}>
    <HourglassIcon animKey={animKey} />
    <span>+{delta} min</span>
  </span>;
}

/** Reloj de arena grande en la escena: el tiempo avanza donde está la
 * mirada del jugador, no solo en la cabecera. Mismo pulso y mismo estilo. */
function SceneHourglass({ delta, animKey }: { delta: number; animKey: number }) {
  return <span className="game-hourglass game-hourglass-scene" data-testid="hourglass-scene" role="status" aria-label={`El reloj avanza ${delta} minutos`}>
    <HourglassIcon animKey={animKey} />
    <span>El reloj avanza {delta} min</span>
  </span>;
}

function HeaderSection({ view, caseTitle, detective, clockPulse, onLogout }: { view: PlayerViewDto; caseTitle: string | null; detective: string; clockPulse: { key: number; delta: number } | null; onLogout: (() => void) | null }) {
  return <header className="game-header">
    <div className="game-agency">
      <div className="game-brand">
        <span className="game-mark" aria-hidden="true">M<span>0</span></span>
        <div><p className="game-overline">Agencia de investigación internacional</p><h1>Meridiano cero</h1></div>
      </div>
      <div className="game-detective">
        <span className="game-avatar" aria-hidden="true">{detective.slice(0, 1).toUpperCase()}</span>
        <div><strong>Detective: {detective}</strong><small>Referencia: {view.runId.slice(0, 8)} · Revisión {view.version}</small></div>
      </div>
      <div className="game-header-actions">
        <Link to="/">Archivo</Link>
        {onLogout && <button type="button" onClick={onLogout}>Cerrar sesión</button>}
      </div>
    </div>
    <div className="game-case-strip">
      <div><p className="game-overline">Expediente</p><strong>{caseTitle ?? view.caseId}</strong></div>
      <div><p className="game-overline">Delito</p><strong>{caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating)}</strong></div>
      <div><p className="game-overline">Destino actual</p><strong>{view.position.city.name}, {view.position.city.country}</strong></div>
      <div><p className="game-overline">Dificultad</p><strong data-testid="difficulty">{difficultyLabel(view.difficulty)} · {Math.round(view.clock.deadlineMinutes / 60)} horas</strong></div>
      <div className={`game-clock${clockPulse ? ' game-clock-pulse' : ''}`} data-testid="clock" aria-label={`Reloj del caso: ${view.clock.minute} minutos de ${view.clock.deadlineMinutes}`}>
        <p className="game-overline">Tiempo transcurrido / plazo</p>
        <strong>{view.clock.minute} min<span> / {view.clock.deadlineMinutes} min</span></strong>
        {clockPulse && <Hourglass delta={clockPulse.delta} animKey={clockPulse.key} />}
        <small>{view.status === 'closed' ? 'Cerrada' : 'Activa'} · El reloj avanza solo al actuar</small>
      </div>
    </div>
  </header>;
}

/** Fila de un personaje presente en la escena: nombre y rol, con su botón
 * de hablar. El rol sale del catálogo de NPC (sin inventar nada). */
function SceneNpcOffer({ offer, view, disabled, onOffer }: { offer: PublicActionOffer; view: PlayerViewDto; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const npcId = typeof offer.action.params.npcId === 'string' ? offer.action.params.npcId : '';
  const npc = getNPC(npcId);
  const name = npc?.name ?? npcNamesFromView(view).get(npcId) ?? npcId;
  return <div className="game-scene-npc">
    <span><strong>{name}</strong>{npc?.role ? ` · ${npc.role}` : ''}</span>
    <button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
      onClick={event => onOffer(offer, event.currentTarget)}>{offer.label}</button>
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
 * tipo en español (antes se veían `warrant:ines`, `ines` y `EV-06` solos). */
function SceneMeta({ view }: { view: PlayerViewDto }) {
  return <div className="game-scene-meta">
    {view.objects.length > 0 && <p>En tu poder: {view.objects.map(item => `${item.id} (${evidenceTypeLabels[item.type] ?? item.type})`).join(', ')}</p>}
    {view.pendingRequests.length > 0 && <p>Solicitudes pendientes: {view.pendingRequests.map(item => `${requestTypeLabels[item.type] ?? item.type} (min ${item.dueMinute})`).join(', ')}</p>}
    {view.warrants.length > 0 && <p>Órdenes: {view.warrants.map(warrantText).join(', ')}</p>}
    {view.detentions.length > 0 && <p>Detenciones: {view.detentions.map(id => getNPC(id)?.name ?? id).join(', ')}</p>}
  </div>;
}

/** Acciones de la escena, agrupadas: quién hay aquí, viajes y el resto. */
function SceneActions({ view, grouped, disabled, onOffer }: { view: PlayerViewDto; grouped: ReturnType<typeof groupOffers>; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const finishOffer = grouped.finish;
  if (view.status === 'closed') return <p className="game-scene-closed">La partida está cerrada. Consulta el informe final.</p>;
  return <>
    {(grouped.talk.length > 0 || grouped.inspect.length > 0) && <div className="game-scene-group">
      <p className="game-overline">En esta escena</p>
      {grouped.talk.map(offer => (
        <SceneNpcOffer key={offer.id} offer={offer} view={view} disabled={disabled} onOffer={onOffer} />
      ))}
      {grouped.inspect.map(offer => (
        <p key={offer.id}><button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
          onClick={event => onOffer(offer, event.currentTarget)}>{offer.label}{offer.detail ? ` · ${offer.detail}` : ''}</button></p>
      ))}
    </div>}
    {grouped.travel.length > 0 && <div className="game-scene-group">
      <p className="game-overline">Viajes</p>
      <SceneOfferList offers={grouped.travel} disabled={disabled} onOffer={onOffer} />
    </div>}
    {(grouped.other.length > 0 || finishOffer) && <div className="game-scene-group">
      <p className="game-overline">Otras acciones</p>
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
  return <section className="game-objectives" aria-labelledby="objectives-heading" data-testid="objectives-panel">
    <p className="game-overline" id="objectives-heading">Objetivos</p>
    <ul>{view.objectives.map(objective =>
      <li key={objective.id} data-testid={`objective-${objective.id}`} data-achieved={objective.achieved}>
        <span aria-hidden="true">{objective.achieved ? '✓' : '○'}</span> {objective.description}
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
function SceneSection({ view, disabled, clockPulse, onOffer }: { view: PlayerViewDto; disabled: boolean; clockPulse: { key: number; delta: number } | null; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const locationIndex = view.locations.findIndex(location => location.id === view.position.location.id) + 1;
  const grouped = groupOffers(view.offers);
  return <section className="game-scene" aria-labelledby="scene-heading">
    <div className="game-scene-top"><span>Localización {String(locationIndex).padStart(2, '0')}</span><span>{view.position.city.name.toUpperCase()} · {view.position.city.country}</span></div>
    <SceneArt locationId={view.position.location.id} />
    <div className="game-scene-caption"><div><p className="game-overline">{view.position.city.name}</p><h2 id="scene-heading">{view.position.location.name}</h2></div>{clockPulse && <SceneHourglass delta={clockPulse.delta} animKey={clockPulse.key} />}</div>
    <p className="game-scene-description">{view.position.location.description}</p>
    <SceneMeta view={view} />
    <SceneActions view={view} grouped={grouped} disabled={disabled} onOffer={onOffer} />
  </section>;
}

/** Escribe el texto de forma progresiva, como en una máquina de escribir
 * (estilo MS-DOS): el resultado de la última acción aparece poco a poco en
 * vez de hacerlo de golpe. Con movimiento reducido se muestra entero. */
function useTypewriter(text: string, active: boolean): string {
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
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

function ConsoleSection({ log, orderHistory }: { log: LogEntry[]; orderHistory: string[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const last = log[log.length - 1];
  // La última entrada se escribe progresivamente: primero el resumen y,
  // cuando termina, el detalle de los descubrimientos.
  const summaryTyped = useTypewriter(last?.summary ?? '', true);
  const detailTyped = useTypewriter(last?.detail ?? '', !!last && summaryTyped === last.summary);
  const lastTyping = isLastEntryTyping(last, summaryTyped, detailTyped);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [log, summaryTyped, detailTyped]);
  return <section className="game-console" aria-labelledby="console-heading">
    <p className="game-overline">Cuaderno de campo</p>
    <h2 id="console-heading">Consola narrativa</h2>
    <ol ref={listRef} aria-live="polite">
      {log.length === 0 && <li>La investigación comienza. Inspecciona la escena o elige una acción.</li>}
      {log.map((entry, index) => <ConsoleLogItem key={index} entry={entry} isLast={index === log.length - 1}
        summaryTyped={summaryTyped} detailTyped={detailTyped} typing={lastTyping} />)}
    </ol>
    <span className="game-narrative-cursor" aria-hidden="true">_</span>
    {orderHistory.length > 0 && <details><summary>Historial de órdenes</summary><ol>{orderHistory.map((item, index) => <li key={index}>{item}</li>)}</ol></details>}
  </section>;
}

function OrderSection({ draft, closed, busy, orderPhase, inputRef, onDraft, onSubmit, onKeyDown, onCancel, onRecover }: {
  draft: string; closed: boolean; busy: boolean; orderPhase: OrderPhase; inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void; onSubmit: (event: FormEvent) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void; onRecover: () => void;
}) {
  return <section className="game-order" aria-labelledby="order-heading">
    <div className="game-order-label">
      <label id="order-heading" htmlFor="order-input">Tu siguiente acción</label>
      <span>Escribe con tus palabras</span>
    </div>
    <form onSubmit={onSubmit}>
      <span className="game-prompt-symbol" aria-hidden="true">&gt;</span>
      <textarea id="order-input" data-testid="order-input" ref={inputRef} rows={3} value={draft}
        onChange={event => onDraft(event.target.value)} onKeyDown={onKeyDown}
        disabled={closed || busy} placeholder="p. ej. inspeccionar la sala, hablar con Lucía…" />
      <button type="submit" className="game-primary-button" data-testid="order-submit" disabled={closed || !draft.trim() || busy}>
        {orderPhase.kind === 'interpreting' ? 'Interpretando…' : 'Interpretar orden'}
      </button>
    </form>
    <div className="game-order-bottom"><p>Ctrl+Enter para enviar · Las herramientas no consumen tiempo.</p></div>
    <p className="game-order-hint">Puedes ordenar: inspeccionar un lugar, hablar con alguien, viajar, consultar… Tras cada acción el resultado aparece en la consola. Al hablar con alguien se abre la conversación para preguntarle. <Link to="/glosario">Ver glosario</Link></p>
    {orderPhase.kind === 'clarification' && <div className="game-clarification" role="dialog" aria-label="Aclaración">
      <p><strong>Antes de actuar:</strong> {orderPhase.question}</p>
      <p>Orden original: «{orderPhase.original}»</p>
      <button type="button" onClick={onCancel}>Entendido, la reviso</button>
    </div>}
    {orderPhase.kind === 'error' && <p className="game-error" role="alert">{orderPhase.message} <button type="button" onClick={onCancel}>Cerrar</button></p>}
    {orderPhase.kind === 'recovering' && <div className="game-recovering" role="alert">
      <p>{orderPhase.message}</p>
      <button type="button" onClick={onRecover}>Recuperar resultado</button>
      <button type="button" onClick={onCancel}>Descartar</button>
    </div>}
  </section>;
}

/** Animación de viaje estilo Carmen Sandiego (lote 1 de jugabilidad): al
 * confirmar un viaje, una ruta con el avión cruzando el mapa aparece unos
 * segundos sobre la pantalla mientras el reloj ya avanzó y la escena ya es
 * la de destino. No bloquea nada: los clics pasan por debajo salvo el botón
 * «Seguir», y se cierra sola. */
function TravelOverlay({ travel, onDismiss }: { travel: { from: string; to: string; detail: string }; onDismiss: () => void }) {
  return <div className="game-travel" data-testid="travel-animation" role="status">
    <div className="game-travel-panel">
      <p className="game-overline">Viaje</p>
      <p><strong>De {travel.from} a {travel.to}</strong>{travel.detail ? ` · ${travel.detail}` : ''}</p>
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
      <p className="game-panel-note">El reloj ya avanzó: estás en {travel.to}.</p>
      <button type="button" onClick={onDismiss}>Seguir</button>
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
  const travelTimerRef = useRef<number | null>(null);
  const apply = useCallback((previous: PlayerViewDto | null, response: ActionResponseDto, offer?: PublicActionOffer) => {
    const delta = clockDelta(previous, response);
    if (delta > 0) {
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
      setClockPulse({ key: Date.now(), delta });
      pulseTimerRef.current = window.setTimeout(() => setClockPulse(null), 2600);
    }
    if (offer?.action.type === 'travel') {
      if (travelTimerRef.current !== null) window.clearTimeout(travelTimerRef.current);
      setTravel(travelPayload(previous, response, offer));
      travelTimerRef.current = window.setTimeout(() => setTravel(null), 2800);
    }
  }, []);
  const dismissTravel = useCallback(() => {
    if (travelTimerRef.current !== null) window.clearTimeout(travelTimerRef.current);
    setTravel(null);
  }, []);
  return { clockPulse, travel, apply, dismissTravel };
}

function PreviewDialog({ phase, confirmRef, onConfirm, onCancel }: {
  phase: Extract<OrderPhase, { kind: 'preview' }>; confirmRef: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void; onCancel: () => void;
}) {
  return <div className="game-preview-backdrop">
    <div className="game-preview" role="dialog" aria-modal="true" aria-labelledby="preview-heading" data-testid="preview-dialog">
      <h2 id="preview-heading">Confirmar acción</h2>
      <p><strong>{phase.offer.label}</strong>{phase.offer.detail ? ` · ${phase.offer.detail}` : ''}</p>
      {phase.response.preview
        ? <p>{phase.response.preview.description}</p>
        : <p>Esta acción se ejecutará al confirmar.</p>}
      {phase.response.preview && <p className="game-preview-facts"><span>Duración estimada: {phase.response.preview.estimatedMinutes} min</span><span>Hora prevista: min {phase.response.preview.estimatedEndTime}</span></p>}
      <div className="game-preview-actions">
        <button type="button" className="game-primary-button" ref={confirmRef} data-testid="preview-confirm" onClick={onConfirm}>Confirmar</button>
        <button type="button" data-testid="preview-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  </div>;
}

// ── Contenidos de ventanas ──────────────────────────────────────────────────────

// Coordenadas de presentación del atlas, tomadas de la maqueta
// (apps/web/src/prototype/sample.ts): las tres ciudades del caso.
const atlasPositions: Record<string, { x: number; y: number }> = {
  madrid: { x: 43, y: 67 }, paris: { x: 59, y: 29 }, lisboa: { x: 23, y: 75 },
};

function MapContent({ view, busy, onOffer }: { view: PlayerViewDto; busy: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const travelOffers = view.offers.filter(offer => offer.action.type === 'travel');
  return <div>
    <p className="game-overline">Atlas A.C.M.E.</p>
    <h4>Tres ciudades, un expediente</h4>
    <div className="game-atlas" aria-hidden="true"><div className="game-atlas-land" />{view.cities.map(city => {
      const position = atlasPositions[city.id];
      if (!position) return null;
      return <span key={city.id} className="game-atlas-city" style={{ left: position.x + '%', top: position.y + '%' }}>{city.name}</span>;
    })}</div>
    <label>Buscar ciudad <input type="search" data-testid="map-search" placeholder="Madrid, París, Lisboa…"
      onChange={event => {
        const query = event.target.value.toLowerCase();
        event.currentTarget.closest('div')?.querySelectorAll<HTMLElement>('[data-city]')?.forEach(el => {
          el.hidden = query !== '' && !el.textContent?.toLowerCase().includes(query);
        });
      }} /></label>
    <ul className="game-destination-list">
      {view.cities.map(city => {
        const travel = travelOffers.find(offer => offer.action.params.toCityId === city.id);
        const current = city.id === view.position.city.id;
        return <li key={city.id} data-city={city.id}>
          <span><strong>{city.name}, {city.country}</strong><small>{current ? 'Estás aquí' : 'Destino conocido'}</small></span>
          {travel && !current && <button type="button" data-testid={`travel-${city.id}`}
            disabled={busy}
            onClick={event => onOffer(travel, event.currentTarget)}>Viajar · {travel.detail ?? ''}</button>}
        </li>;
      })}
    </ul>
    <h4>Lugares conocidos</h4>
    <ul className="game-destination-list">{view.locations.map(location => <li key={location.id}><span><strong>{location.name}</strong>{location.id === view.position.location.id ? ' (aquí)' : ''}<small>{location.description}</small></span></li>)}</ul>
  </div>;
}

function BriefingText({ briefing }: { briefing: NonNullable<PlayerViewDto['briefing']> }) {
  return <div><p><em>{briefing.speaker} te pone en situación:</em></p>{briefing.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
}

/** Introducción del caso: qué ha ocurrido y qué tienes que resolver. Se
 * muestra al entrar en una partida nueva (versión 1, minuto 0) y queda
 * guardada por partida en esta pestaña; se puede volver a abrir desde la
 * barra de herramientas y siempre está en el dossier. */
function BriefingSection({ view, onDismiss }: { view: PlayerViewDto; onDismiss: () => void }) {
  if (!view.briefing) return null;
  return <section className="game-briefing" aria-label="Introducción del caso">
    <p className="game-overline">Introducción del caso</p>
    <h2>{view.briefing.title}</h2>
    <BriefingText briefing={view.briefing} />
    <button type="button" onClick={onDismiss}>Entendido, a investigar</button>
  </section>;
}

function IntroPanel({ view, open, onDismiss }: { view: PlayerViewDto; open: boolean; onDismiss: () => void }) {
  if (!open || !view.briefing) return null;
  return <BriefingSection view={view} onDismiss={onDismiss} />;
}

function IntroButton({ view, onOpen }: { view: PlayerViewDto; onOpen: () => void }) {
  if (!view.briefing) return null;
  return <button type="button" onClick={onOpen}>Introducción</button>;
}

function DossierContent({ view }: { view: PlayerViewDto }) {
  const lookup = lookupFromView(view);
  const npcName = (id: string) => lookup.npcName(id);
  return <div>
    <div><h4>Ficha del expediente</h4><p>Delito: {caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating)}.</p></div>
    {view.briefing && <div><h4>Introducción del caso</h4><BriefingText briefing={view.briefing} /></div>}
    <h4>Evidencias en tu poder</h4>
    {view.objects.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Sin evidencias recogidas.</p></div>
      : <table><thead><tr><th>ID</th><th>Tipo</th><th>Procedencia</th><th>Minuto</th><th>Admisible</th></tr></thead>
        <tbody>{view.objects.map(item => <tr key={item.id}><td>{item.id}</td><td>{evidenceTypeLabels[item.type] ?? item.type}</td><td>{item.origin}</td><td>{item.minute}</td><td>{item.admissible ? 'Sí' : 'No'}</td></tr>)}</tbody></table>}
    <h4>Hallazgos</h4>
    {view.dossier.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Sin hallazgos todavía.</p></div>
      : view.dossier.map((entry, index) => <article key={index} className="game-evidence-card"><span className="game-evidence-kind">Hallazgo</span><p>{discoveryText(entry, lookup)}</p></article>)}
    <h4>Conversación registrada</h4>
    {view.conversation.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Sin conversaciones registradas.</p></div>
      : <ul className="game-destination-list">{view.conversation.map((entry, index) => <li key={index}><span>{conversationRecordText(entry, npcName)}</span></li>)}</ul>}
  </div>;
}

type ChatTurn = { from: 'you' | 'npc'; text: string };

/** Conversación con un personaje: se abre sola al confirmar «hablar con»
 * alguien y muestra su saludo y sus respuestas como burbujas de chat. Los
 * turnos y la memoria de la conversación se guardan en esta pestaña por
 * partida y personaje; la memoria del servidor no se persiste (límite
 * documentado: al recargar la página la conversación sigue en esta pestaña,
 * pero una sesión nueva empieza de cero). */
function ChatContent({ npc, turns, draft, busy, error, onDraft, onSend }: {
  npc: { id: string; name: string } | null; turns: ChatTurn[]; draft: string; busy: boolean; error: string;
  onDraft: (value: string) => void; onSend: (event: FormEvent) => void;
}) {
  if (!npc) {
    return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span>
      <p>Habla primero con alguien en persona («hablar con…» o la acción «Hablar con») y la conversación se abrirá aquí.</p></div>;
  }
  const role = getNPC(npc.id)?.role ?? '';
  return <div className="game-chat">
    <p className="game-chat-npc"><strong>{npc.name}</strong>{role ? ` · ${role}` : ''}</p>
    <ol className="game-chat-turns" data-testid="chat-turns" aria-live="polite">
      {turns.map((turn, index) => <li key={index} className={turn.from === 'you' ? 'game-chat-you' : 'game-chat-npc-turn'}>
        <span className="game-chat-speaker">{turn.from === 'you' ? 'Tú' : npc.name}</span>
        <span>{turn.text}</span>
      </li>)}
    </ol>
    <form onSubmit={onSend} className="game-chat-form">
      <input type="text" data-testid="chat-input" value={draft} disabled={busy} maxLength={4000}
        placeholder="Pregúntale por lo que sabe: su tarea, lo que vio…" aria-label="Pregunta para el personaje"
        onChange={event => onDraft(event.target.value)} />
      <button type="submit" data-testid="chat-send" disabled={!draft.trim() || busy}>{busy ? 'Preguntando…' : 'Preguntar'}</button>
    </form>
    {error && <p className="game-error" role="alert">{error}</p>}
    <p className="game-panel-note">Hablar en persona no consume tiempo. Preguntar aquí tampoco: el reloj solo avanza al actuar.</p>
  </div>;
}

function LabContent({ view, contacts, recipient, channel, text, busy, onRecipient, onChannel, onText, onSend }: {
  view: PlayerViewDto; contacts: Array<{ id: string; name: string }>; recipient: string; channel: string; text: string; busy: boolean;
  onRecipient: (value: string) => void; onChannel: (value: string) => void; onText: (value: string) => void; onSend: (event: FormEvent) => void;
}) {
  return <div>
    <h4>Solicitudes pendientes</h4>
    {view.pendingRequests.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Sin solicitudes pendientes. Los análisis tardan 90 min y las consultas 30 min de juego.</p></div>
      : <ul className="game-destination-list">{view.pendingRequests.map(item => <li key={item.id}><span><strong>{requestTypeLabels[item.type] ?? item.type}</strong><small>Responde en el minuto {item.dueMinute} (ahora {view.clock.minute})</small></span></li>)}</ul>}
    <h4>Contactar</h4>
    {contacts.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Habla primero con alguien en persona para poder contactarlo después.</p></div>
      : <form onSubmit={onSend}>
        <label>Destinatario <select value={recipient} onChange={event => onRecipient(event.target.value)}>
          <option value="">Elige…</option>
          {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
        </select></label>
        <label>Canal <select value={channel} onChange={event => onChannel(event.target.value)}>
          {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Mensaje <input type="text" value={text} onChange={event => onText(event.target.value)} maxLength={4000} /></label>
        <button type="submit" disabled={!recipient || !text.trim() || busy}>Enviar mensaje</button>
      </form>}
    <p className="game-panel-note">Consultar este panel no consume tiempo.</p>
  </div>;
}

function SaveList({ saves, atLimit, closed, onLoad, onDelete, onReplace }: {
  saves: SaveListDto | null; atLimit: boolean; closed: boolean;
  onLoad: (save: SaveListItem) => void; onDelete: (save: SaveListItem) => void; onReplace: (save: SaveListItem) => void;
}) {
  if (!saves) return <p>Cargando guardados…</p>;
  if (saves.items.length === 0) return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Sin guardados manuales.</p></div>;
  return <ul className="game-save-list" data-testid="save-list">
    {saves.items.map(save => <li key={save.saveId}>
      <span><strong>{save.name}</strong><small>{save.cityName} · min {save.minute} · {new Date(save.createdAt).toLocaleString('es-ES')}</small></span>
      <span> <button type="button" data-testid={`load-${save.saveId}`} disabled={closed} onClick={() => onLoad(save)}>Cargar</button></span>
      <span> <button type="button" disabled={closed} onClick={() => onDelete(save)}>Borrar</button></span>
      {atLimit && !closed && <span> <button type="button" onClick={() => onReplace(save)}>Reemplazar con el nuevo</button></span>}
    </li>)}
  </ul>;
}

function SaveCreateForm({ savePhase, saveName, closed, canSave, replaceTarget, onSaveName, onCreate }: {
  savePhase: SavePhase; saveName: string; closed: boolean; canSave: boolean; replaceTarget: SaveListItem | null;
  onSaveName: (value: string) => void; onCreate: () => void;
}) {
  return <form onSubmit={event => { event.preventDefault(); onCreate(); }}>
    <label>Nombre del guardado <input type="text" data-testid="save-name-input" value={saveName}
      onChange={event => onSaveName(event.target.value)} maxLength={128} /></label>
    {replaceTarget && <p>Al guardar se reemplazará «{replaceTarget.name}».</p>}
    <button type="submit" data-testid="save-create"
      disabled={closed || !saveName.trim() || savePhase === 'saving' || (!canSave && !replaceTarget)}>
      {savePhase === 'saving' ? 'Guardando…' : 'Guardar partida'}
    </button>
  </form>;
}

function SavesContent({ view, saves, savePhase, saveName, replaceTarget, loadTarget, onSaveName, onCreate, onLoad, onDelete, onReplace, onConfirmLoad, onCancelLoad }: {
  view: PlayerViewDto; saves: SaveListDto | null; savePhase: SavePhase; saveName: string; replaceTarget: SaveListItem | null;
  loadTarget: SaveListItem | null; onSaveName: (value: string) => void; onCreate: () => void;
  onLoad: (save: SaveListItem) => void; onDelete: (save: SaveListItem) => void; onReplace: (save: SaveListItem) => void;
  onConfirmLoad: () => void; onCancelLoad: () => void;
}) {
  const closed = view.status === 'closed';
  const atLimit = view.saveCapabilities.manualCount >= view.saveCapabilities.manualLimit;
  return <div>
    <p className="game-save-count">Manuales: <strong>{view.saveCapabilities.manualCount}</strong> / {view.saveCapabilities.manualLimit}. Guardar no avanza el reloj.</p>
    {closed && <p className="game-closed-note" role="status" data-testid="save-closed-notice">Esta partida está cerrada porque el caso ya está
      resuelto. No se pueden crear guardados nuevos ni cargar uno anterior. Puedes consultar el informe final
      o empezar una partida nueva desde el archivo.</p>}
    <SaveCreateForm savePhase={savePhase} saveName={saveName} closed={closed} canSave={view.saveCapabilities.canSave}
      replaceTarget={replaceTarget} onSaveName={onSaveName} onCreate={onCreate} />
    {savePhase === 'saved' && <p role="status">Guardado confirmado por el servidor.</p>}
    {savePhase === 'failed' && <p role="alert">No se pudo guardar. Reinténtalo.</p>}
    <h4>Guardados manuales</h4>
    <SaveList saves={saves} atLimit={atLimit} closed={closed} onLoad={onLoad} onDelete={onDelete} onReplace={onReplace} />
    {loadTarget && <div className="game-load-confirm" role="dialog" aria-label="Confirmar carga" data-testid="load-confirm">
      <p>Volverás a «{loadTarget.name}» (min {loadTarget.minute}). Perderás el progreso posterior de la rama actual; el primer resultado oficial se mantiene.</p>
      <button type="button" data-testid="load-confirm-button" onClick={onConfirmLoad}>Cargar este punto</button>
      <button type="button" onClick={onCancelLoad}>Cancelar</button>
    </div>}
  </div>;
}

function describeEffectiveProvider(data: ConnectionsResponse | null, catalogLabel: (providerId: string) => string): string {
  if (!data) return 'Cargando proveedor…';
  if (data.effective.source === 'mock') return 'Mock determinista (se puede jugar sin modelo real).';
  if (data.effective.source === 'admin') {
    return `${catalogLabel(data.effective.providerId)} (${data.effective.model}) — proveedor del servidor.`;
  }
  return `Tu conexión «${data.effective.connectionName ?? ''}» (${catalogLabel(data.effective.providerId)}, ${data.effective.model}).`;
}

function testSummary(result: ConnectionTestResult): string {
  if (!result.available) return `no disponible${result.error ? `: ${result.error}` : ''}`;
  return `disponible (${result.latencyMs ?? '?'} ms)`;
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
  return <ul>{connections.map(connection => {
    const result = testResults[connection.id];
    const inUse = effectiveId === connection.id;
    return <li key={connection.id}>
      <strong>{connection.name}</strong> · {catalogLabel(connection.adapterId)} · {connection.model}
      {connection.status !== 'active' ? ` · ${connection.status}` : ''}{inUse ? ' · en uso' : ''}
      {result && <span> · {testSummary(result)}</span>}
      <div>
        {!inUse && <button type="button" onClick={() => onUse(connection.id)}>Usar</button>}
        <button type="button" disabled={testingId === connection.id} onClick={() => onTest(connection.id)}>
          {testingId === connection.id ? 'Probando…' : 'Probar'}
        </button>
        <button type="button" aria-label={`Borrar ${connection.name}`} onClick={() => onRemove(connection.id)}>Borrar</button>
      </div>
    </li>;
  })}</ul>;
}

function validateConnectionForm(selected: ProviderCatalogEntry, connName: string, apiKey: string): string | null {
  if (!connName.trim()) return 'Ponle un nombre a la conexión.';
  if (selected.needsKey && !apiKey) return 'Este proveedor necesita tu clave.';
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
  return <>
    {selected?.needsBaseUrl && <label className="game-setting"><span>URL del endpoint</span>
      <input data-testid="ai-connection-base-url" value={baseUrl} onChange={event => onBaseUrl(event.target.value)} maxLength={512} placeholder={selected.defaultBaseUrl} />
    </label>}
    <label className="game-setting"><span>Modelo</span>
      <input data-testid="ai-connection-model" value={model} onChange={event => onModel(event.target.value)} maxLength={128} placeholder={selected?.defaultModel ?? ''} />
    </label>
    {selected?.needsKey && <label className="game-setting"><span>Clave</span>
      <input data-testid="ai-connection-key" type="password" value={apiKey} onChange={event => onApiKey(event.target.value)} maxLength={512} autoComplete="off" placeholder="Tu clave, solo se guarda cifrada" />
    </label>}
  </>;
}

/** Mensaje de error al guardar una conexión: el motivo real del servidor
 * (p. ej. destino no permitido) se muestra tal cual; el genérico solo queda
 * para el resto de fallos. */
function connectionSaveErrorMessage(error: unknown): string {
  if (error instanceof ConnectionsError && error.kind === 'session') return 'La sesión caducó. Vuelve a entrar.';
  if (error instanceof ConnectionsError && error.detail) return error.detail;
  return 'No se pudo guardar la conexión. Revisa los datos (el nombre no puede repetirse).';
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

  async function saveConnection(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    const validationError = validateConnectionForm(selected, connName, apiKey);
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
      onFormMessage('Conexión guardada y activada.');
      await onSaved();
    } catch (error) {
      onFormError(connectionSaveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={saveConnection}>
    <label className="game-setting"><span>Proveedor</span>
      <select data-testid="ai-connection-adapter" value={adapterId} onChange={event => onAdapterChange(event.target.value)}>
        {catalog.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>
    </label>
    {selected && <p className="game-panel-note">{selected.hint}</p>}
    <label className="game-setting"><span>Nombre</span>
      <input data-testid="ai-connection-name" value={connName} onChange={event => setConnName(event.target.value)} maxLength={100} placeholder="Mi Ollama" />
    </label>
    <ConnectionProviderFields
      selected={selected}
      baseUrl={baseUrl} onBaseUrl={setBaseUrl}
      model={model} onModel={setModel}
      apiKey={apiKey} onApiKey={setApiKey}
    />
    <p><button data-testid="ai-connection-save" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar conexión'}</button></p>
    {formMessage && <p role="status">{formMessage}</p>}
    {formError && <p role="alert">{formError}</p>}
  </form>;
}

function SettingsContent({ identity, textScale, highContrast, onScale, onContrast }: {
  identity: SessionDto | null; textScale: number; highContrast: boolean; onScale: (value: number) => void; onContrast: (value: boolean) => void;
}) {
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
      setLoadError('No se pudo cargar la configuración de IA.');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

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
    <h4>Proveedor de IA</h4>
    <p data-testid="settings-ai-effective">Actual: <strong>{describeEffectiveProvider(data, catalogLabel)}</strong></p>
    {loading && <p role="status">Cargando conexiones…</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {data && <>
      <p className="game-panel-note">Tu conexión personal manda sobre el proveedor del servidor. Cada persona paga sus propios tokens; sin conexión personal, juega con el proveedor del servidor.</p>
      <h4>Mis conexiones</h4>
      <div data-testid="ai-connections-list">
        {data.connections.length === 0
          ? <p className="game-panel-note">Todavía no tienes conexiones propias.</p>
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
      {data.effective.source === 'personal' && <p><button type="button" onClick={() => void useServerDefault()}>Usar el proveedor del servidor</button></p>}
      <h4>Añadir conexión</h4>
      {csrfToken && <AddConnectionForm
        catalog={data.catalog} csrfToken={csrfToken} onSaved={() => reload(new AbortController().signal)}
        formMessage={formMessage} formError={formError} onFormMessage={setFormMessage} onFormError={setFormError}
      />}
    </>}
    <h4>Presentación</h4>
    <label className="game-setting"><span>Tamaño de texto</span>
      <select value={textScale} onChange={event => onScale(Number(event.target.value))}>
        {[100, 125, 150, 175, 200].map(scale => <option key={scale} value={scale}>{scale}%</option>)}
      </select>
    </label>
    <label className="game-setting"><span>Alto contraste</span><input type="checkbox" checked={highContrast} onChange={event => onContrast(event.target.checked)} /></label>
    <p className="game-panel-note">Estos ajustes afectan solo a la presentación. También puedes usar el zoom de tu navegador.</p>
  </div>;
}

function ReportContent({ view }: { view: PlayerViewDto }) {
  if (!view.finalReport) return <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>El informe final estará disponible al cerrar el caso.</p></div>;
  // El motor devuelve el resultado, el motivo y los objetivos como
  // identificadores en inglés; la pantalla los traduce a frases. La nota
  // anterior prometía un «informe completo (verdad y omisiones)» que no
  // existe (REQ-G12-05, T2-05, en curso): se retira para no prometerlo.
  return <div>
    <p className="game-report-result">Resultado: <strong>{reportResultText(view.finalReport.result)}</strong> · Motivo: {reportReasonText(view.finalReport.reason)} · Minuto: {view.finalReport.minute}</p>
    <h4>Objetivos logrados</h4>
    {view.finalReport.objectivesAchieved.length === 0
      ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>Ningún objetivo registrado.</p></div>
      : <ul className="game-report-objectives">{view.finalReport.objectivesAchieved.map((item, index) => <li key={index}>{objectiveText(item)}</li>)}</ul>}
  </div>;
}

function UnavailableScreen({ phase, notice }: { phase: ScreenPhase; notice: string }) {
  return <main className="game" data-testid="game-screen">
    {phase === 'loading'
      ? <p className="game-notice" role="status">Cargando la partida…</p>
      : <><h1>Partida no disponible</h1>
        <p className="game-notice" role="status">{notice}</p>
        <p><Link to="/">Volver al archivo</Link></p>
        {phase === 'error' && <p><button type="button" onClick={() => window.location.reload()}>Reintentar</button></p>}</>}
  </main>;
}

// ── Pantalla ────────────────────────────────────────────────────────────────────

/** Pantalla de juego (Fase A): vista del jugador, órdenes en texto libre con
 * interpretación, ofertas del motor, guardados manuales y ventanas de
 * herramientas. La UI no calcula resultados: recibe PlayerView y eventos. */
export function GameScreen() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const windows = useWindows();
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const orderInputRef = useRef<HTMLTextAreaElement>(null);

  const [identity, setIdentity] = useState<SessionDto | null>(null);
  const [view, setView] = useState<PlayerViewDto | null>(null);
  const [caseTitle, setCaseTitle] = useState<string | null>(null);
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [notice, setNotice] = useState('Cargando la partida…');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState(() => (runId ? sessionStorage.getItem('meridiano-draft:' + runId) ?? '' : ''));
  const [orderHistory, setOrderHistory] = useState<string[]>([]);
  const [orderPhase, setOrderPhase] = useState<OrderPhase>({ kind: 'idle' });
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [saves, setSaves] = useState<SaveListDto | null>(null);
  const [savePhase, setSavePhase] = useState<SavePhase>('idle');
  const [saveName, setSaveName] = useState('');
  const [replaceTarget, setReplaceTarget] = useState<SaveListItem | null>(null);
  const [loadTarget, setLoadTarget] = useState<SaveListItem | null>(null);
  const [textScale, setTextScale] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [commRecipient, setCommRecipient] = useState('');
  const [commChannel, setCommChannel] = useState('call');
  const [commText, setCommText] = useState('');
  const [introOpen, setIntroOpen] = useState(false);
  const [chatNpc, setChatNpc] = useState<{ id: string; name: string } | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatMemory, setChatMemory] = useState<unknown>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  // Lote 1 de jugabilidad: reloj de arena y animación de viaje (ver hook).
  const timeFeedback = useTimeFeedback();

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

  const contacts = useMemo(() => (view ? contactsFromView(view) : []), [view]);

  const handleLoadError = useCallback((error: unknown) => {
    setNotice(errorMessage(error));
    if (error instanceof GameError && error.kind === 'not_found') setPhase('not_found');
    else if (error instanceof GameError && error.kind === 'session') setPhase('signed_out');
    else setPhase('error');
  }, []);

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
      if (fresh.status === 'closed') setNotice('Partida cerrada. El informe final está disponible.');
    } catch (error) {
      if (generation.current !== ticket) return;
      handleLoadError(error);
    }
  }, [runId, handleLoadError]);

  const handleActionError = useCallback((error: unknown) => {
    setNotice(errorMessage(error));
    if (error instanceof GameError && error.kind === 'version_conflict') void refresh();
  }, [refresh]);

  const loadInitial = useCallback(async (ticket: number, controller: AbortController) => {
    if (!runId) return;
    const session = await archiveApi.me(controller.signal);
    if (generation.current !== ticket) return;
    if (!session) { setPhase('signed_out'); setNotice('No hay sesión iniciada.'); return; }
    setIdentity(session);
    const [fresh, catalog] = await Promise.all([gameApi.view(runId, controller.signal), gameApi.catalog(controller.signal)]);
    if (generation.current !== ticket) return;
    setView(fresh);
    setCaseTitle(catalog.find(item => item.caseId === fresh.caseId)?.title ?? fresh.caseId);
    setSaves(await gameApi.saves(runId, controller.signal).catch(() => null));
    setPhase('ready');
    setNotice(fresh.status === 'closed' ? 'Partida cerrada. El informe final está disponible.' : 'La investigación comienza.');
  }, [runId]);

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
        restoreFocusRef.current = lastTriggerRef.current;
        setOrderPhase({ kind: 'idle' });
        return;
      }
      const open = (Object.keys(windows.windows) as WindowId[]).filter(id => windows.windows[id].open);
      const last = open[open.length - 1];
      if (last) windows.close(last);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [orderPhase, windows.windows, windows.moving, windows.close]);

  function applyResponse(response: ActionResponseDto, offerLabel: string, offer?: PublicActionOffer) {
    const previous = view;
    setView(response);
    const detail = actionResultDetail(response, previous, offer);
    const entries: LogEntry[] = response.events.map(event => ({ minute: event.minute, summary: event.summary }));
    const last = entries[entries.length - 1];
    if (detail && last) entries[entries.length - 1] = { ...last, detail };
    else if (detail) entries.push({ minute: response.clock.minute, summary: offerLabel, detail });
    setLog(current => [...current, ...entries]);
    setNotice(noticeForOutcome(response, offerLabel));
    timeFeedback.apply(previous, response, offer);
    const target = talkTarget(offer, lookupFromView(previous ?? response));
    if (target) openChat(target.id, target.name);
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

  /** Abre la conversación con un personaje: recupera sus turnos y su
   * memoria de esta pestaña o la inicia con su saludo. */
  function openChat(npcId: string, npcName: string) {
    if (!runId) return;
    const key = `meridiano:chat:${runId}:${npcId}`;
    const stored = loadStoredChat(key);
    if (stored) {
      setChatTurns(stored.turns);
      setChatMemory(stored.memory ?? null);
    } else {
      const greeting = npcGreeting(npcId) ?? `Soy ${npcName}. ¿Qué quieres saber?`;
      const turns: ChatTurn[] = [{ from: 'npc', text: greeting }];
      const memory = { schemaVersion: 1, runId, npcId, treatment: 'neutral', turns: [] };
      setChatTurns(turns);
      setChatMemory(memory);
      saveChat(key, turns, memory);
    }
    setChatNpc({ id: npcId, name: npcName });
    setChatError('');
    windows.open('chat', null);
  }

  /** Pregunta lista para enviar al personaje, o null si falta algo. */
  function chatQuestion(): { runId: string; csrfToken: string; npcId: string; name: string; text: string; facts: Array<{ id: string; text: string }>; memory: unknown } | null {
    const text = chatDraft.trim();
    if (!text || !runId || !identity || !chatNpc || chatBusy) return null;
    const npcId = chatNpc.id;
    return { runId, csrfToken: identity.csrfToken, npcId, name: chatNpc.name, text,
      facts: npcKnowledgeFacts(npcId),
      memory: chatMemory ?? { schemaVersion: 1, runId, npcId, treatment: 'neutral', turns: [] } };
  }

  async function sendChatMessage(event: FormEvent) {
    event.preventDefault();
    const question = chatQuestion();
    if (!question) return;
    const factIds = question.facts.map(fact => fact.id);
    const turns: ChatTurn[] = [...chatTurns, { from: 'you', text: question.text }];
    setChatTurns(turns);
    setChatDraft('');
    setChatBusy(true);
    setChatError('');
    const controller = new AbortController();
    try {
      const refusal = npcRefusal(question.npcId);
      const result = await aiApi.converse({ runId: question.runId, text: question.text,
        npc: { id: question.npcId, name: question.name, persona: getNPC(question.npcId)?.persona ?? '', knownFactIds: factIds, revealableFactIds: factIds, ...(refusal ? { refusal } : {}) },
        facts: question.facts, memory: question.memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'] },
      controller.signal, { csrfToken: question.csrfToken });
      const next: ChatTurn[] = [...turns, { from: 'npc', text: result.narrative.text }];
      setChatTurns(next);
      setChatMemory(result.memory);
      saveChat(`meridiano:chat:${question.runId}:${question.npcId}`, next, result.memory);
    } catch {
      setChatError('La IA no responde. Tu pregunta queda registrada; inténtalo de nuevo.');
    } finally {
      setChatBusy(false);
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
        setOrderPhase({ kind: 'recovering', offer, key, message: 'La respuesta se perdió. Puedes recuperar el resultado con la misma clave, sin repetir la acción.' });
      } else {
        setOrderPhase({ kind: 'error', message: errorMessage(error) });
        handleActionError(error);
      }
    }
  }

  async function startPreview(offer: PublicActionOffer, trigger: HTMLElement | null) {
    if (!runId || !identity || !view || busyOffer) return;
    lastTriggerRef.current = trigger;
    setBusyOffer(offer.id);
    setNotice(`Preparando: ${offer.label}…`);
    const controller = new AbortController();
    try {
      const response = await gameApi.preview(runId, offer.action, identity, controller.signal);
      const phase = previewOutcome(response, offer, crypto.randomUUID());
      // Un clic para lo barato y reversible (lote 2): si la acción no pide
      // diálogo, se confirma en el mismo clic, sin mostrarlo. Lo costoso o
      // irreversible sigue enseñando el diálogo, como antes.
      if (phase.kind === 'preview' && !needsConfirmationDialog(response, offer)) {
        await commitOffer(offer, phase.key);
        return;
      }
      setOrderPhase(phase);
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error) });
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
      setOrderPhase({ kind: 'error', message: errorMessage(error) });
      handleActionError(error);
    }
  }

  function cancelOrder() {
    restoreFocusRef.current = lastTriggerRef.current;
    setOrderPhase({ kind: 'idle' });
  }

  async function interpretOrder(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !runId || !identity || !view || orderPhase.kind !== 'idle') return;
    setOrderHistory(current => [text, ...current].slice(0, 20));
    setOrderPhase({ kind: 'interpreting' });
    setNotice('Interpretando la orden…');
    const controller = new AbortController();
    try {
      const result = await aiApi.interpret(text, { location: view.position.location.id, description: view.position.location.description },
        view.offers.map(offer => ({ id: offer.id, label: offer.label })), controller.signal, { csrfToken: identity.csrfToken });
      if (result.kind === 'clarification') {
        setOrderPhase({ kind: 'clarification', question: result.message ?? 'La orden es ambigua.', original: text });
        setNotice('La orden necesita una aclaración.');
        return;
      }
      const offer = view.offers.find(item => item.id === result.actionIds?.[0]);
      if (!offer) {
        setOrderPhase({ kind: 'error', message: 'La interpretación no corresponde a ninguna acción disponible. Elige una de las acciones disponibles.' });
        setNotice('La interpretación no corresponde a ninguna acción disponible.');
        return;
      }
      setNotice(`Interpretado como: ${offer.label}.`);
      await startPreview(offer, orderInputRef.current);
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error) });
      setNotice(errorMessage(error));
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
      setNotice(summary.replayed ? 'Guardado ya existente (reintento).' : `Guardado «${summary.name}» confirmado.`);
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
      setLog(current => [...current, { minute: response.clock.minute, summary: `Cargado el guardado «${target.name}».` }]);
      setNotice(`Cargado «${target.name}»: vuelves al minuto ${response.clock.minute}. El progreso posterior queda en la rama anterior.`);
      await reloadSaves();
    } catch (error) {
      handleActionError(error);
    }
  }

  async function removeSave(save: SaveListItem) {
    if (!runId || !identity) return;
    try {
      await gameApi.deleteSave(runId, save.saveId, save.metadataVersion, crypto.randomUUID(), identity, new AbortController().signal);
      setNotice(`Guardado «${save.name}» borrado.`);
      await reloadSaves();
      await reloadView();
    } catch (error) {
      handleActionError(error);
    }
  }

  async function sendCommunication(event: FormEvent) {
    event.preventDefault();
    if (!runId || !identity || !view || !commRecipient || !commText.trim()) return;
    const offer: PublicActionOffer = { id: `communicate:${commRecipient}:${commChannel}`,
      label: `Contactar con ${commRecipient} por ${channelLabels[commChannel] ?? commChannel}`,
      action: { type: 'communicate', params: { channel: commChannel, recipientId: commRecipient, requestText: commText.trim() } } };
    setCommText('');
    await startPreview(offer, null);
  }

  if (phase !== 'ready' || !view) {
    return <UnavailableScreen phase={phase} notice={notice} />;
  }

  const closed = view.status === 'closed';
  const busy = busyOffer !== null || orderPhase.kind !== 'idle';
  const windowProps = {
    moving: windows.moving, onMoveStart: windows.setMoving, onMoveEnd: () => windows.setMoving(null),
    onMoveBy: windows.moveBy, onMinimize: windows.minimize, onRestore: windows.restore, onClose: windows.close,
  };

  return <main className={`game${highContrast ? ' game-high-contrast' : ''}`} data-testid="game-screen" style={{ fontSize: `${16 * textScale / 100}px` }}>
    <HeaderSection view={view} caseTitle={caseTitle} detective={identity?.profile.displayName ?? '—'} clockPulse={timeFeedback.clockPulse} onLogout={identity ? () => {
      void archiveApi.logout(identity.csrfToken, new AbortController().signal).finally(() => navigate('/'));
    } : null} />

    <p className="game-notice" role="status">{notice}</p>

    <IntroPanel view={view} open={introOpen} onDismiss={dismissIntro} />

    <div className="game-toolbar" role="toolbar" aria-label="Herramientas">
      <IntroButton view={view} onOpen={() => setIntroOpen(true)} />
      {(Object.keys(windowLabels) as WindowId[]).map(id => (
        <button key={id} type="button" aria-pressed={windows.windows[id].open}
          onClick={event => windows.open(id, event.currentTarget)}>{windowLabels[id]}</button>
      ))}
      <button type="button" onClick={windows.resetLayout}>Restablecer distribución</button>
      <button type="button" onClick={() => void refresh()}>Actualizar vista</button>
    </div>

    <ObjectivesSection view={view} />
    <SceneSection view={view} disabled={busy} clockPulse={timeFeedback.clockPulse} onOffer={(offer, trigger) => void startPreview(offer, trigger)} />
    <ConsoleSection log={log} orderHistory={orderHistory} />
    <OrderSection draft={draft} closed={closed} busy={orderPhase.kind !== 'idle'} orderPhase={orderPhase} inputRef={orderInputRef}
      onDraft={setDraft} onSubmit={interpretOrder} onKeyDown={onOrderKeyDown} onCancel={cancelOrder} onRecover={() => void recoverCommit()} />

    <TravelOverlaySlot travel={timeFeedback.travel} onDismiss={timeFeedback.dismissTravel} />

    {orderPhase.kind === 'preview' && <PreviewDialog phase={orderPhase} confirmRef={confirmButtonRef}
      onConfirm={() => void confirmPreview()} onCancel={cancelOrder} />}
    {orderPhase.kind === 'committing' && <p className="game-notice" role="status">Confirmando… No cierres la pestaña.</p>}

    <MinimizedBar windows={windows.windows} onRestore={windows.restore} />

    <GameWindow id="map" title="Mapa" state={windows.windows.map} {...windowProps}>
      <MapContent view={view} busy={busy} onOffer={(offer, trigger) => void startPreview(offer, trigger)} />
    </GameWindow>
    <GameWindow id="dossier" title="Dossier" state={windows.windows.dossier} {...windowProps}>
      <DossierContent view={view} />
    </GameWindow>
    <GameWindow id="lab" title="Laboratorio y comunicaciones" state={windows.windows.lab} {...windowProps}>
      <LabContent view={view} contacts={contacts} recipient={commRecipient} channel={commChannel} text={commText} busy={busy}
        onRecipient={setCommRecipient} onChannel={setCommChannel} onText={setCommText} onSend={sendCommunication} />
    </GameWindow>
    <GameWindow id="saves" title="Guardados" state={windows.windows.saves} {...windowProps}>
      <SavesContent view={view} saves={saves} savePhase={savePhase} saveName={saveName} replaceTarget={replaceTarget} loadTarget={loadTarget}
        onSaveName={setSaveName} onCreate={() => void createSave()} onLoad={setLoadTarget} onDelete={save => void removeSave(save)}
        onReplace={setReplaceTarget} onConfirmLoad={() => void confirmLoad()} onCancelLoad={() => setLoadTarget(null)} />
    </GameWindow>
    <GameWindow id="settings" title="Ajustes" state={windows.windows.settings} {...windowProps}>
      <SettingsContent identity={identity} textScale={textScale} highContrast={highContrast} onScale={setTextScale} onContrast={setHighContrast} />
    </GameWindow>
    <GameWindow id="report" title="Informe final" state={windows.windows.report} {...windowProps}>
      <ReportContent view={view} />
    </GameWindow>
    <GameWindow id="chat" title="Conversación" state={windows.windows.chat} {...windowProps}>
      <ChatContent npc={chatNpc} turns={chatTurns} draft={chatDraft} busy={chatBusy} error={chatError}
        onDraft={setChatDraft} onSend={event => void sendChatMessage(event)} />
    </GameWindow>
  </main>;
}
