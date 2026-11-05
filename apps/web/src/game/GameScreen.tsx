import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { archiveApi } from '../archive/client';
import { aiApi, AiError } from '../ai/client';
import { gameApi, GameError } from './client';
import type { GameErrorKind, SaveListDto, SaveListItem } from './client';
import { GameWindow, MinimizedBar, useWindows } from './windows';
import type { WindowId } from './windows';
import type { ActionResponseDto, PlayerViewDto, PublicActionOffer, SessionDto } from '@meridiano/contracts';
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
  map: 'Mapa', dossier: 'Dossier', lab: 'Laboratorio y comunicaciones', saves: 'Guardados', settings: 'Ajustes', report: 'Informe final',
};
const channelLabels: Record<string, string> = { call: 'Llamada', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Correo', fax: 'Fax' };
const requestTypeLabels: Record<string, string> = { analysis: 'Análisis', query: 'Consulta', request: 'Solicitud' };
const evidenceTypeLabels: Record<string, string> = { object: 'objeto', observation: 'observación', testimony: 'testimonio', analysis: 'análisis', record: 'registro' };

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
  const names = new Map<string, string>();
  for (const offer of view.offers) {
    if (offer.action.type !== 'talk' || typeof offer.action.params.npcId !== 'string') continue;
    const label = /^Hablar con (.+) sobre su identidad$/.exec(offer.label)?.[1];
    if (label) names.set(offer.action.params.npcId, label);
  }
  return [...met].map(id => ({ id, name: names.get(id) ?? id }));
}

function previewOutcome(response: ActionResponseDto, offer: PublicActionOffer, key: string): OrderPhase {
  if (response.outcome === 'impossible') return { kind: 'error', message: response.reason ?? 'Acción no disponible.' };
  if (response.outcome === 'clarification_required') return { kind: 'clarification', question: response.question ?? 'Hace falta aclarar la orden.', original: offer.label };
  return { kind: 'preview', offer, response, key };
}

// ── Secciones presentacionales ──────────────────────────────────────────────────

function HeaderSection({ view, caseTitle, detective, onLogout }: { view: PlayerViewDto; caseTitle: string | null; detective: string; onLogout: (() => void) | null }) {
  return <header className="game-header">
    <div>
      <p className="game-eyebrow">A.C.M.E. · {caseTitle ?? view.caseId}</p>
      <h1>{view.position.city.name} — {view.position.location.name}</h1>
      <p>Detective: {detective} · Referencia: <code>{view.runId.slice(0, 8)}</code> · Revisión {view.version}</p>
    </div>
    <div className="game-clock" data-testid="clock" aria-label={`Reloj del caso: ${view.clock.minute} minutos de ${view.clock.deadlineMinutes}`}>
      <strong>{view.clock.minute} min</strong><span> / {view.clock.deadlineMinutes} min</span>
      <span className="game-clock-state">{view.status === 'closed' ? 'Cerrada' : 'Activa'}</span>
    </div>
    <Link to="/">Archivo</Link>
    {onLogout && <button type="button" onClick={onLogout}>Cerrar sesión</button>}
  </header>;
}

function SceneSection({ view }: { view: PlayerViewDto }) {
  return <section className="game-scene" aria-labelledby="scene-heading">
    <h2 id="scene-heading">Escena</h2>
    <p>{view.position.location.description}</p>
    <p>Ciudad: {view.position.city.name}, {view.position.city.country} · Lugar: {view.position.location.name}</p>
    {view.objects.length > 0 && <p>En tu poder: {view.objects.map(item => item.id).join(', ')}</p>}
    {view.pendingRequests.length > 0 && <p>Solicitudes pendientes: {view.pendingRequests.map(item => `${requestTypeLabels[item.type] ?? item.type} (min ${item.dueMinute})`).join(', ')}</p>}
    {view.warrants.length > 0 && <p>Órdenes: {view.warrants.join(', ')}</p>}
    {view.detentions.length > 0 && <p>Detenciones: {view.detentions.join(', ')}</p>}
  </section>;
}

function OffersSection({ view, disabled, onOffer }: { view: PlayerViewDto; disabled: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const closed = view.status === 'closed';
  const offers = view.offers.filter(offer => offer.action.type !== 'travel' && offer.action.type !== 'finish');
  const finishOffer = view.offers.find(offer => offer.action.type === 'finish');
  return <section className="game-offers" aria-labelledby="offers-heading">
    <h2 id="offers-heading">Acciones disponibles</h2>
    {closed
      ? <p>La partida está cerrada. Consulta el informe final.</p>
      : offers.length === 0
        ? <p>No hay acciones disponibles en este momento.</p>
        : <ul>{offers.map(offer => (
          <li key={offer.id}>
            <button type="button" data-testid={`offer-${offer.id}`} disabled={disabled}
              onClick={event => onOffer(offer, event.currentTarget)}>
              {offer.label}{offer.detail ? ` · ${offer.detail}` : ''}
            </button>
          </li>))}</ul>}
    {finishOffer && !closed && <p><button type="button" data-testid="offer-finish" disabled={disabled}
      onClick={event => onOffer(finishOffer, event.currentTarget)}>{finishOffer.label}</button></p>}
  </section>;
}

function ConsoleSection({ log, orderHistory }: { log: Array<{ minute: number; summary: string }>; orderHistory: string[] }) {
  return <section className="game-console" aria-labelledby="console-heading">
    <h2 id="console-heading">Consola narrativa</h2>
    <ol aria-live="polite">
      {log.length === 0 && <li>La investigación comienza. Inspecciona la escena o elige una acción.</li>}
      {log.map((entry, index) => <li key={index}>[min {entry.minute}] {entry.summary}</li>)}
    </ol>
    {orderHistory.length > 0 && <details><summary>Historial de órdenes</summary><ol>{orderHistory.map((item, index) => <li key={index}>{item}</li>)}</ol></details>}
  </section>;
}

function OrderSection({ draft, closed, busy, orderPhase, inputRef, onDraft, onSubmit, onKeyDown, onCancel, onRecover }: {
  draft: string; closed: boolean; busy: boolean; orderPhase: OrderPhase; inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void; onSubmit: (event: FormEvent) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCancel: () => void; onRecover: () => void;
}) {
  return <section className="game-order" aria-labelledby="order-heading">
    <h2 id="order-heading">Orden en texto libre</h2>
    <form onSubmit={onSubmit}>
      <label htmlFor="order-input">Escribe lo que quieres hacer (Ctrl+Enter para enviar)</label>
      <textarea id="order-input" data-testid="order-input" ref={inputRef} rows={3} value={draft}
        onChange={event => onDraft(event.target.value)} onKeyDown={onKeyDown}
        disabled={closed || busy} placeholder="p. ej. inspeccionar la sala, hablar con Lucía…" />
      <button type="submit" data-testid="order-submit" disabled={closed || !draft.trim() || busy}>
        {orderPhase.kind === 'interpreting' ? 'Interpretando…' : 'Interpretar orden'}
      </button>
    </form>
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
      {phase.response.preview && <p>Duración estimada: {phase.response.preview.estimatedMinutes} min · Hora prevista: min {phase.response.preview.estimatedEndTime}</p>}
      <div className="game-preview-actions">
        <button type="button" ref={confirmRef} data-testid="preview-confirm" onClick={onConfirm}>Confirmar</button>
        <button type="button" data-testid="preview-cancel" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  </div>;
}

// ── Contenidos de ventanas ──────────────────────────────────────────────────────

function MapContent({ view, busy, onOffer }: { view: PlayerViewDto; busy: boolean; onOffer: (offer: PublicActionOffer, trigger: HTMLElement | null) => void }) {
  const travelOffers = view.offers.filter(offer => offer.action.type === 'travel');
  return <div>
    <label>Buscar ciudad <input type="search" data-testid="map-search" placeholder="Madrid, París, Lisboa…"
      onChange={event => {
        const query = event.target.value.toLowerCase();
        event.currentTarget.closest('div')?.querySelectorAll<HTMLElement>('[data-city]')?.forEach(el => {
          el.hidden = query !== '' && !el.textContent?.toLowerCase().includes(query);
        });
      }} /></label>
    <ul>
      {view.cities.map(city => {
        const travel = travelOffers.find(offer => offer.action.params.toCityId === city.id);
        const current = city.id === view.position.city.id;
        return <li key={city.id} data-city={city.id}>
          <strong>{city.name}, {city.country}</strong>{current ? ' (aquí)' : ''}
          {travel && !current && <span> — <button type="button" data-testid={`travel-${city.id}`}
            disabled={busy}
            onClick={event => onOffer(travel, event.currentTarget)}>Viajar · {travel.detail ?? ''}</button></span>}
        </li>;
      })}
    </ul>
    <h4>Lugares conocidos</h4>
    <ul>{view.locations.map(location => <li key={location.id}>{location.name}{location.id === view.position.location.id ? ' (aquí)' : ''} — {location.description}</li>)}</ul>
  </div>;
}

function DossierContent({ view }: { view: PlayerViewDto }) {
  return <div>
    <h4>Evidencias en tu poder</h4>
    {view.objects.length === 0
      ? <p>Sin evidencias recogidas.</p>
      : <table><thead><tr><th>ID</th><th>Tipo</th><th>Procedencia</th><th>Minuto</th><th>Admisible</th></tr></thead>
        <tbody>{view.objects.map(item => <tr key={item.id}><td>{item.id}</td><td>{evidenceTypeLabels[item.type] ?? item.type}</td><td>{item.origin}</td><td>{item.minute}</td><td>{item.admissible ? 'Sí' : 'No'}</td></tr>)}</tbody></table>}
    <h4>Hallazgos</h4>
    {view.dossier.length === 0 ? <p>Sin hallazgos todavía.</p> : <ul>{view.dossier.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}
    <h4>Conversación registrada</h4>
    {view.conversation.length === 0 ? <p>Sin conversaciones registradas.</p> : <ul>{view.conversation.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}
  </div>;
}

function LabContent({ view, contacts, recipient, channel, text, busy, onRecipient, onChannel, onText, onSend }: {
  view: PlayerViewDto; contacts: Array<{ id: string; name: string }>; recipient: string; channel: string; text: string; busy: boolean;
  onRecipient: (value: string) => void; onChannel: (value: string) => void; onText: (value: string) => void; onSend: (event: FormEvent) => void;
}) {
  return <div>
    <h4>Solicitudes pendientes</h4>
    {view.pendingRequests.length === 0
      ? <p>Sin solicitudes pendientes. Los análisis tardan 90 min y las consultas 30 min de juego.</p>
      : <ul>{view.pendingRequests.map(item => <li key={item.id}>{requestTypeLabels[item.type] ?? item.type} · responde en el minuto {item.dueMinute} (ahora {view.clock.minute})</li>)}</ul>}
    <h4>Contactar</h4>
    {contacts.length === 0
      ? <p>Habla primero con alguien en persona para poder contactarlo después.</p>
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
  </div>;
}

function SaveList({ saves, atLimit, closed, onLoad, onDelete, onReplace }: {
  saves: SaveListDto | null; atLimit: boolean; closed: boolean;
  onLoad: (save: SaveListItem) => void; onDelete: (save: SaveListItem) => void; onReplace: (save: SaveListItem) => void;
}) {
  if (!saves) return <p>Cargando guardados…</p>;
  if (saves.items.length === 0) return <p>Sin guardados manuales.</p>;
  return <ul data-testid="save-list">
    {saves.items.map(save => <li key={save.saveId}>
      <strong>{save.name}</strong> · {save.cityName} · min {save.minute} · {new Date(save.createdAt).toLocaleString('es-ES')}
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
    <p>Manuales: {view.saveCapabilities.manualCount} / {view.saveCapabilities.manualLimit}. Guardar no avanza el reloj.</p>
    {closed && <p role="status" data-testid="save-closed-notice">Esta partida está cerrada porque el caso ya está
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

function SettingsContent({ textScale, highContrast, onScale, onContrast }: {
  textScale: number; highContrast: boolean; onScale: (value: number) => void; onContrast: (value: boolean) => void;
}) {
  return <div>
    <h4>Proveedor de IA</h4>
    <p>Actual: <strong>Mock determinista</strong> (incluido en la Fase A: se puede jugar sin modelo real).</p>
    <label>Proveedor
      <select disabled aria-describedby="provider-note">
        <option>Mock determinista (actual)</option>
        <option>Ollama local</option>
        <option>LM Studio (OpenAI-compatible)</option>
        <option>FreeLLMAPI</option>
      </select>
    </label>
    <p id="provider-note">La configuración del proveedor por usuario llega en la Fase C: cada persona elegirá su LLM y su clave. En esta fase el selector está desactivado a propósito.</p>
    <h4>Presentación</h4>
    <label>Tamaño de texto
      <select value={textScale} onChange={event => onScale(Number(event.target.value))}>
        {[100, 125, 150, 175, 200].map(scale => <option key={scale} value={scale}>{scale}%</option>)}
      </select>
    </label>
    <label><input type="checkbox" checked={highContrast} onChange={event => onContrast(event.target.checked)} /> Alto contraste</label>
  </div>;
}

function ReportContent({ view }: { view: PlayerViewDto }) {
  if (!view.finalReport) return <p>El informe final estará disponible al cerrar el caso.</p>;
  return <div>
    <p>Resultado: <strong>{view.finalReport.result}</strong> · Motivo: {view.finalReport.reason} · Minuto: {view.finalReport.minute}</p>
    <h4>Objetivos logrados</h4>
    {view.finalReport.objectivesAchieved.length === 0
      ? <p>Ningún objetivo registrado.</p>
      : <ul>{view.finalReport.objectivesAchieved.map((item, index) => <li key={index}>{item}</li>)}</ul>}
    <p>El informe completo (verdad y omisiones) solo se muestra tras el cierre, y ya está cerrado.</p>
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
  const [log, setLog] = useState<Array<{ minute: number; summary: string }>>([]);
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

  function applyResponse(response: ActionResponseDto, offerLabel: string) {
    setView(response);
    setLog(current => [...current, ...response.events.map(event => ({ minute: event.minute, summary: event.summary }))]);
    if (response.outcome === 'case_closed') setNotice(`Caso cerrado: ${offerLabel}. El informe final está disponible.`);
    else if (response.outcome === 'impossible') setNotice(`No se pudo: ${response.reason ?? offerLabel}.`);
    else if (response.outcome === 'clarification_required') setNotice(response.question ?? 'Hace falta aclarar la orden.');
    else setNotice(`${offerLabel} · Reloj: ${response.clock.minute} min.`);
  }

  async function startPreview(offer: PublicActionOffer, trigger: HTMLElement | null) {
    if (!runId || !identity || !view || busyOffer) return;
    lastTriggerRef.current = trigger;
    setBusyOffer(offer.id);
    setNotice(`Preparando: ${offer.label}…`);
    const controller = new AbortController();
    try {
      const response = await gameApi.preview(runId, offer.action, identity, controller.signal);
      setOrderPhase(previewOutcome(response, offer, crypto.randomUUID()));
    } catch (error) {
      setOrderPhase({ kind: 'error', message: errorMessage(error) });
      handleActionError(error);
    } finally {
      setBusyOffer(null);
    }
  }

  async function confirmPreview() {
    if (orderPhase.kind !== 'preview' || !runId || !identity || !view) return;
    const { offer, key } = orderPhase;
    setOrderPhase({ kind: 'committing', offer, key });
    const controller = new AbortController();
    try {
      const response = await gameApi.commit(runId, offer.action, view.version, key, identity, controller.signal);
      applyResponse(response, offer.label);
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

  async function recoverCommit() {
    if (orderPhase.kind !== 'recovering' || !runId || !identity || !view) return;
    const { offer, key } = orderPhase;
    const controller = new AbortController();
    try {
      const response = await gameApi.commit(runId, offer.action, view.version, key, identity, controller.signal);
      applyResponse(response, offer.label);
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
      setNotice(`Interpretado como: ${offer.label}. Revisa y confirma.`);
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
    <HeaderSection view={view} caseTitle={caseTitle} detective={identity?.profile.displayName ?? '—'} onLogout={identity ? () => {
      void archiveApi.logout(identity.csrfToken, new AbortController().signal).finally(() => navigate('/'));
    } : null} />

    <p className="game-notice" role="status">{notice}</p>

    <div className="game-toolbar" role="toolbar" aria-label="Herramientas">
      {(Object.keys(windowLabels) as WindowId[]).map(id => (
        <button key={id} type="button" aria-pressed={windows.windows[id].open}
          onClick={event => windows.open(id, event.currentTarget)}>{windowLabels[id]}</button>
      ))}
      <button type="button" onClick={windows.resetLayout}>Restablecer distribución</button>
      <button type="button" onClick={() => void refresh()}>Actualizar vista</button>
    </div>

    <SceneSection view={view} />
    <OffersSection view={view} disabled={busy} onOffer={(offer, trigger) => void startPreview(offer, trigger)} />
    <ConsoleSection log={log} orderHistory={orderHistory} />
    <OrderSection draft={draft} closed={closed} busy={orderPhase.kind !== 'idle'} orderPhase={orderPhase} inputRef={orderInputRef}
      onDraft={setDraft} onSubmit={interpretOrder} onKeyDown={onOrderKeyDown} onCancel={cancelOrder} onRecover={() => void recoverCommit()} />

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
      <SettingsContent textScale={textScale} highContrast={highContrast} onScale={setTextScale} onContrast={setHighContrast} />
    </GameWindow>
    <GameWindow id="report" title="Informe final" state={windows.windows.report} {...windowProps}>
      <ReportContent view={view} />
    </GameWindow>
  </main>;
}
