import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

export type WindowId = 'map' | 'dossier' | 'lab' | 'saves' | 'settings' | 'report';

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
  saves: { x: 420, y: 100 },
  settings: { x: 200, y: 180 },
  report: { x: 300, y: 160 },
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

  const open = useCallback((id: WindowId, opener: HTMLElement | null) => {
    openerRefs.current[id] = opener;
    setWindows(current => ({ ...current, [id]: { ...current[id], open: true, minimized: false } }));
  }, []);
  const close = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], open: false, minimized: false } }));
    setMoving(current => (current === id ? null : current));
    openerRefs.current[id]?.focus();
  }, []);
  const minimize = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], minimized: true } }));
  }, []);
  const restore = useCallback((id: WindowId) => {
    setWindows(current => ({ ...current, [id]: { ...current[id], minimized: false } }));
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

  return { windows, moving, setMoving, open, close, minimize, restore, moveBy, resetLayout };
}

interface GameWindowProps {
  id: WindowId;
  title: string;
  state: WindowState;
  moving: WindowId | null;
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
export function GameWindow({ id, title, state, moving, onMoveStart, onMoveEnd, onMoveBy, onMinimize, onRestore, onClose, children }: GameWindowProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const isMoving = moving === id;

  useEffect(() => {
    if (isMoving) titleRef.current?.focus();
  }, [isMoving]);

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
        title="Arrastra para mover o usa el botón Mover para mover con el teclado">{title}</h3>
      <div className="game-window-controls">
        {isMoving
          ? <span className="game-window-moving">Moviendo: flechas, Enter termina, Esc cancela</span>
          : <button type="button" onClick={() => onMoveStart(id)}>Mover</button>}
        {state.minimized
          ? <button type="button" onClick={() => onRestore(id)}>Restaurar</button>
          : <button type="button" onClick={() => onMinimize(id)} aria-label={`Minimizar ${title}`}>_</button>}
        <button type="button" onClick={() => onClose(id)} aria-label={`Cerrar ${title}`}>×</button>
      </div>
    </div>
    {!state.minimized && <div className="game-window-body">{children}</div>}
  </section>;
}

export function MinimizedBar({ windows, onRestore }: { windows: Record<WindowId, WindowState>; onRestore: (id: WindowId) => void }) {
  const minimized = (Object.keys(windows) as WindowId[]).filter(id => windows[id].open && windows[id].minimized);
  if (!minimized.length) return null;
  const labels: Record<WindowId, string> = { map: 'Mapa', dossier: 'Dossier', lab: 'Laboratorio y comunicaciones', saves: 'Guardados', settings: 'Ajustes', report: 'Informe final' };
  return <div className="game-minimized-bar" role="group" aria-label="Ventanas minimizadas">
    {minimized.map(id => <button key={id} type="button" onClick={() => onRestore(id)}>Restaurar {labels[id]}</button>)}
  </div>;
}
