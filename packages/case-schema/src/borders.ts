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

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) return { text, truncated: false };
  return { text: text.slice(0, maxLength), truncated: true };
}

function detectRtl(text: string, allowRTL: boolean): { text: string; rtl: boolean } {
  const rtlPattern = /[֑-߿؀-ۿ]/;
  const rtl = rtlPattern.test(text);
  if (!allowRTL && rtl) {
    return { text: text.split('').reverse().join(''), rtl };
  }
  return { text, rtl };
}

/** Caracteres fuera del latín básico (punto de código mayor que 0xFF):
 * la misma condición que el rango negado anterior, sin usar caracteres
 * de control en la expresión regular. */
function hasNonLatin(text: string): boolean {
  return [...text].some(ch => (ch.codePointAt(0) ?? 0) > 0xFF);
}

function redactSecrets(text: string, secretIds: Set<string>): { text: string; leakedSecrets: string[] } {
  const leakedSecrets: string[] = [];
  let redacted = text;
  for (const secret of secretIds) {
    if (redacted.includes(secret)) {
      leakedSecrets.push(secret);
      redacted = redacted.split(secret).join('[redacted]');
    }
  }
  return { text: redacted, leakedSecrets };
}

export function sanitizeText(
  input: string,
  options: TextSanitizationOptions = {},
): SanitizedText {
  const maxLength = options.maxLength ?? 4000;
  const allowRTL = options.allowRTL ?? true;
  const fallbackLanguage = options.fallbackLanguage ?? 'es';
  const secretIds = options.secretIds ?? new Set<string>();

  const truncatedResult = truncateText(String(input ?? ''), maxLength);
  const rtlResult = detectRtl(truncatedResult.text, allowRTL);
  const escaped = escapeHtml(rtlResult.text);

  // Fallback lingüístico: si el texto contiene caracteres no latinos y no es RTL,
  // marcar como fallback (no ocultar IDs secretos)
  const fallbackApplied = hasNonLatin(escaped) && fallbackLanguage !== 'es';

  // Filtrar IDs secretos
  const redacted = redactSecrets(escaped, secretIds);

  return { text: redacted.text, truncated: truncatedResult.truncated, rtl: rtlResult.rtl, fallbackApplied, leakedSecrets: redacted.leakedSecrets };
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
