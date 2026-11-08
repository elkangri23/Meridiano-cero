import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { LocaleKey } from '@meridiano/contracts';
import { useTranslation } from '../i18n';

export type WindowId = 'map' | 'dossier' | 'lab' | 'comms' | 'team' | 'saves' | 'settings' | 'report' | 'intel';

export interface WindowState {
  open: boolean;
  minimized: boolean;
  x: number;
  y: number;
}

const initialPositions: Record<WindowId, { x: number; y: number }> = {
  map: { x: 24, y: 120 },
  dossier: { x: 360, y: 140 },
  lab: { x: 120, y: 220 },
  comms: { x: 300, y: 240 },
  team: { x: 340, y: 280 },
  saves: { x: 420, y: 100 },
  settings: { x: 200, y: 180 },
  report: { x: 300, y: 160 },
  intel: { x: 260, y: 300 },
};

/** Claves i18n de los títulos de ventana (el texto vive en `locales/es.ts`). */
export const WINDOW_KEYS: Record<WindowId, LocaleKey> = {
  map: 'windows.map', dossier: 'windows.dossier', lab: 'windows.lab',
  comms: 'windows.comms', team: 'windows.team', saves: 'windows.saves',
  settings: 'windows.settings', report: 'windows.report',
  intel: 'windows.intel',
};

export function useWindows() {
  const [windows, setWindows] = useState<Record<WindowId, WindowState>>(() => {
    const state = {} as Record<WindowId, WindowState>;
    (Object.keys(initialPositions) as WindowId[]).forEach(id => {
      state[id] = { open: false, minimized: false, ...initialPositions[id] };
    });
    return state;
  });
  const [moving, setMoving] = useState<WindowId | null>(null);
  const openerRefs = useRef<Partial<Record<WindowId, HTMLElement | null>>>({});
  // Contador por ventana (§15): abrir o restaurar incrementa su contador y
  // la ventana mueve el foco a su título; así el foco no se queda en el
  // botón que abrió algo que ya no está visible.
  const [focusSeq, setFocusSeq] = useState<Record<WindowId, number>>(() => {
    const seq = {} as Record<WindowId, number>;
    (Object.keys(initialPositions) as WindowId[]).forEach(id => { seq[id] = 0; });
    return seq;
  });
  // Última ventana minimizada (§15): al minimizar, el foco va a su botón
  // «Restaurar» de la barra de minimizadas (el botón Minimizar desaparece).
  const [lastMinimized, setLastMinimized] = useState<WindowId | null>(null);

  const open = useCallback((id: WindowId, opener: HTMLElement | null) => {
    openerRefs.current[id] = opener;
    setWindows(current => ({ ...current, [id]: { ...current[id], open: true, minimized: false } }));
    setFocusSeq(current => ({ ...current, [id]: current[id] + 1 }));
    setLastMinimized(current => (current === id ? null : current));
  }, []);
  const close = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], open: false, minimized: false } }));
    setMoving(current => (current === id ? null : current));
    setLastMinimized(current => (current === id ? null : current));
    // El foco vuelve a quien abrió la ventana; si se abrió sola
    // (laboratorio, terminal), al botón de la barra que la abre.
    const opener = openerRefs.current[id];
    if (opener) opener.focus();
    else document.querySelector<HTMLElement>(`[data-testid="toolbar-${id}"]`)?.focus();
  }, []);
  const minimize = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], minimized: true } }));
    setLastMinimized(id);
  }, []);
  const restore = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], minimized: false } }));
    setFocusSeq(current => ({ ...current, [id]: current[id] + 1 }));
    setLastMinimized(current => (current === id ? null : current));
  }, []);
  const moveBy = useCallback((id: WindowId, dx: number, dy: number) => {
    setWindows(current => {
      const win = current[id];
      const maxX = Math.max(0, window.innerWidth - 120);
      const maxY = Math.max(0, window.innerHeight - 60);
      return { ...current, [id]: { ...win, x: Math.min(Math.max(0, win.x + dx), maxX), y: Math.min(Math.max(0, win.y + dy), maxY) } };
    });
  }, []);
  const resetLayout = useCallback(() => {
    setWindows(current => {
      const next = { ...current };
      (Object.keys(initialPositions) as WindowId[]).forEach(id => {
        next[id] = { ...next[id], ...initialPositions[id], minimized: false };
      });
      return next;
    });
    setMoving(null);
  }, []);

  return { windows, moving, setMoving, open, close, minimize, restore, moveBy, resetLayout, focusSeq, lastMinimized };
}

interface GameWindowProps {
  id: WindowId;
  title: string;
  state: WindowState;
  moving: WindowId | null;
  focusSeqs: Record<WindowId, number>;
  onMoveStart: (id: WindowId) => void;
  onMoveEnd: () => void;
  onMoveBy: (id: WindowId, dx: number, dy: number) => void;
  onMinimize: (id: WindowId) => void;
  onRestore: (id: WindowId) => void;
  onClose: (id: WindowId) => void;
  children: ReactNode;
}

/**
 * Ventana de herramienta: movible por arrastre y por teclado (botón Mover:
 * flechas desplazan, Enter termina, Escape cancela), minimizable y cerrable.
 * En pantalla estrecha se apila a ancho completo (sin coordenadas).
 */
export function GameWindow({ id, title, state, moving, focusSeqs, onMoveStart, onMoveEnd, onMoveBy, onMinimize, onRestore, onClose, children }: GameWindowProps) {
  const t = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const isMoving = moving === id;
  const focusSeq = focusSeqs[id];

  useEffect(() => {
    if (isMoving) titleRef.current?.focus();
  }, [isMoving]);

  // Al abrir o restaurar, el foco entra en la ventana (su título): quien
  // navega con teclado no tiene que buscarla. Con el ratón no se ve el
  // contorno (focus-visible solo se aplica al tabular).
  useEffect(() => {
    if (state.open && !state.minimized && focusSeq > 0) titleRef.current?.focus();
  }, [state.open, state.minimized, focusSeq]);

  function onTitlePointerDown(event: PointerEvent<HTMLHeadingElement>) {
    if (event.button !== 0 || isMoving) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: state.x, baseY: state.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onTitlePointerMove(event: PointerEvent<HTMLHeadingElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onMoveBy(id, event.clientX - drag.startX - (state.x - drag.baseX), event.clientY - drag.startY - (state.y - drag.baseY));
  }
  function onTitlePointerUp(event: PointerEvent<HTMLHeadingElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }
  function onTitleKeyDown(event: KeyboardEvent<HTMLHeadingElement>) {
    if (!isMoving) return;
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') { event.preventDefault(); onMoveBy(id, -step, 0); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); onMoveBy(id, step, 0); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); onMoveBy(id, 0, -step); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); onMoveBy(id, 0, step); }
    else if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); onMoveEnd(); }
  }

  if (!state.open) return null;
  return <section className="game-window" role="dialog" aria-label={title} aria-modal="false"
    style={{ left: state.x, top: state.y }} data-minimized={state.minimized ? 'true' : undefined}>
    <div className="game-window-titlebar">
      <h3 ref={titleRef} tabIndex={-1}
        onPointerDown={onTitlePointerDown} onPointerMove={onTitlePointerMove} onPointerUp={onTitlePointerUp}
        onKeyDown={onTitleKeyDown}
        title={t('windows.dragHint')}>{title}</h3>
      <div className="game-window-controls">
        {isMoving
          ? <span className="game-window-moving">{t('windows.moving')}</span>
          : <button type="button" onClick={() => onMoveStart(id)}>{t('windows.move')}</button>}
        {state.minimized
          ? <button type="button" onClick={() => onRestore(id)}>{t('windows.restore')}</button>
          : <button type="button" onClick={() => onMinimize(id)} aria-label={t('windows.minimizeTitle', { title })}>_</button>}
        <button type="button" onClick={() => onClose(id)} aria-label={t('windows.closeTitle', { title })}>×</button>
      </div>
    </div>
    {!state.minimized && <div className="game-window-body">{children}</div>}
  </section>;
}

export function MinimizedBar({ windows, lastMinimized, onRestore }: { windows: Record<WindowId, WindowState>; lastMinimized: WindowId | null; onRestore: (id: WindowId) => void }) {
  const t = useTranslation();
  const minimized = (Object.keys(windows) as WindowId[]).filter(id => windows[id].open && windows[id].minimized);
  // Al minimizar, el foco sigue al botón «Restaurar» de esa ventana.
  useEffect(() => {
    if (lastMinimized) document.querySelector<HTMLElement>(`[data-testid="minimized-restore-${lastMinimized}"]`)?.focus();
  }, [lastMinimized]);
  if (!minimized.length) return null;
  return <div className="game-minimized-bar" role="group" aria-label={t('windows.minimizedBar')}>
    {minimized.map(id => <button key={id} type="button" data-testid={`minimized-restore-${id}`} onClick={() => onRestore(id)}>{t('windows.restoreTitle', { title: t(WINDOW_KEYS[id]) })}</button>)}
  </div>;
}
