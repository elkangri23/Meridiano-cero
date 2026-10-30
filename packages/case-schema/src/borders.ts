// Bordes de motor, catálogo y carrera (T5-07)
// BOR-030/042/073/074: propiedades que no se pueden fijar silenciosamente.

import { escapeHtml } from './text-utils.js';

export const CAREER_VERSION = 1;

// BOR-030: la fórmula de carrera cambia tras un cierre.
// El resultado queda fijado con la versión aplicada; no se recalcular sin migración.

export interface VersionedOutcome {
  version: number;
  result: string;
  points: number;
  medal?: string | undefined;
  prestigeDelta: number;
  integrityDelta: number;
  trustDelta: number;
}

export function isCareerVersionCompatible(careerVersion: number, expected: number = CAREER_VERSION): boolean {
  return careerVersion === expected;
}

// BOR-042: dos casos activos con idioma/modo distintos no comparten reloj, memoria,
// pistas ni pendientes. Esta función detecta violaciones de aislamiento.

export interface CaseRunSummary {
  runId: string;
  language: string;
  mode: 'guided' | 'free';
  clock: number;
  memory: string[];
  clues: string[];
  pending: string[];
}

export function assertCasesIsolated(a: CaseRunSummary, b: CaseRunSummary): string[] {
  const violations: string[] = [];
  if (a.runId === b.runId) return violations;
  if (a.clock === b.clock && a.clock > 0) violations.push('clock compartido');
  if (sharesAny(a.memory, b.memory)) violations.push('memoria compartida');
  if (sharesAny(a.clues, b.clues)) violations.push('pistas compartidas');
  if (sharesAny(a.pending, b.pending)) violations.push('pendientes compartidos');
  return violations;
}

function sharesAny(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some(item => set.has(item));
}

// BOR-073: texto largo, RTL, traducción ausente, contenido hostil.
// Escapa texto y aplica fallback lingüístico sin filtrar IDs secretos.

export interface TextSanitizationOptions {
  maxLength?: number;
  allowRTL?: boolean;
  fallbackLanguage?: string;
  secretIds?: Set<string>;
}

export interface SanitizedText {
  text: string;
  truncated: boolean;
  rtl: boolean;
  fallbackApplied: boolean;
  leakedSecrets: string[];
}

export function sanitizeText(
  input: string,
  options: TextSanitizationOptions = {},
): SanitizedText {
  const maxLength = options.maxLength ?? 4000;
  const allowRTL = options.allowRTL ?? true;
  const fallbackLanguage = options.fallbackLanguage ?? 'es';
  const secretIds = options.secretIds ?? new Set<string>();

  let text = String(input ?? '');
  let truncated = false;
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    truncated = true;
  }

  // Detectar RTL (hebreo/árabe)
  const rtlPattern = /[֑-߿؀-ۿ]/;
  const rtl = rtlPattern.test(text);
  if (!allowRTL && rtl) {
    text = text.split('').reverse().join('');
  }

  // Escapar HTML básico para evitar inyección
  text = escapeHtml(text);

  // Fallback lingüístico: si el texto contiene caracteres no latinos y no es RTL,
  // marcar como fallback (no ocultar IDs secretos)
  const nonLatin = /[^\u0000-ÿ]/;
  const fallbackApplied = nonLatin.test(text) && fallbackLanguage !== 'es';

  // Filtrar IDs secretos
  const leakedSecrets: string[] = [];
  for (const secret of secretIds) {
    if (text.includes(secret)) {
      leakedSecrets.push(secret);
      text = text.split(secret).join('[redacted]');
    }
  }

  return { text, truncated, rtl, fallbackApplied, leakedSecrets };
}

// BOR-074: TTS debe parar al cargar/logout; no repetir spoilers.
// El controlador expone un token de sessión para invalidar colas antiguas.

export interface TTSSession {
  sessionId: string;
  speak(text: string): boolean;
  cancel(): void;
  isActive(): boolean;
}

export interface TTSControllerLike {
  speak(text: string): boolean;
  cancel(): void;
}

export function createTTSSession(controller: TTSControllerLike): TTSSession {
  const sessionId = `tts-${Math.random().toString(36).slice(2, 10)}`;
  let active = true;
  return {
    sessionId,
    speak(text: string): boolean {
      if (!active) return false;
      return controller.speak(text);
    },
    cancel(): void {
      active = false;
      controller.cancel();
    },
    isActive(): boolean {
      return active;
    },
  };
}