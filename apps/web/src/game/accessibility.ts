// Accesibilidad (§15, WCAG 2.2 AA): utilidades puras sin estado de juego.
// Sin imports de paquetes: la web no puede importar case-schema (aislamiento).
import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import type { TranslateFn } from '@meridiano/contracts';

/** Luminancia relativa WCAG de un color #rrggbb (o #rgb). */
export function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized;
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Contraste WCAG entre texto (fg) y fondo (bg): 1–21. AA pide >= 4.5 en
 * texto normal y >= 3 en texto grande e indicadores de foco. */
export function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

/** Movimiento reducido efectivo: el interruptor manual manda si difiere
 * del sistema, y el del sistema vale cuando el manual está apagado. */
export function effectiveReducedMotion(manual: boolean, system: boolean): boolean {
  return manual || system;
}

/** `prefers-reduced-motion` del sistema, en vivo (cambia al conmutarlo). */
export function useSystemReducedMotion(): boolean {
  const [system, setSystem] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return system;
}

/** Equivalente textual del estado de un objetivo (no depender solo de
 * ✓/○ ni del color): lo que oye un lector de pantalla. */
export function objectiveStateText(achieved: boolean, t: TranslateFn): string {
  return achieved ? t('objectives.achieved') : t('objectives.pending');
}

/** Atrapa el Tab dentro de un diálogo modal: al tabular desde el último
 * elemento enfocable se vuelve al primero, y con Shift+Tab al revés. */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const focusables = [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter(el => el.getClientRects().length > 0);
  if (focusables.length === 0) return;
  const first = focusables.at(0);
  const last = focusables.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
