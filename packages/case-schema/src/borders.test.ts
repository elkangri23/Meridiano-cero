import { describe, it, expect } from 'vitest';
import {
  CAREER_VERSION, isCareerVersionCompatible, assertCasesIsolated,
  sanitizeText, createTTSSession, type CaseRunSummary,
} from './borders.js';

describe('borders', () => {
  it('CAREER_VERSION es 1', () => {
    expect(CAREER_VERSION).toBe(1);
  });

  it('isCareerVersionCompatible acepta versión actual', () => {
    expect(isCareerVersionCompatible(1)).toBe(true);
    expect(isCareerVersionCompatible(2)).toBe(false);
  });

  it('assertCasesIsolated detecta clock compartido', () => {
    const a: CaseRunSummary = { runId: 'r1', language: 'es', mode: 'free', clock: 10, memory: [], clues: [], pending: [] };
    const b: CaseRunSummary = { runId: 'r2', language: 'en', mode: 'guided', clock: 10, memory: [], clues: [], pending: [] };
    expect(assertCasesIsolated(a, b)).toContain('clock compartido');
  });

  it('assertCasesIsolated detecta memoria compartida', () => {
    const a: CaseRunSummary = { runId: 'r1', language: 'es', mode: 'free', clock: 0, memory: ['m1'], clues: [], pending: [] };
    const b: CaseRunSummary = { runId: 'r2', language: 'en', mode: 'guided', clock: 0, memory: ['m1'], clues: [], pending: [] };
    expect(assertCasesIsolated(a, b)).toContain('memoria compartida');
  });

  it('assertCasesIsolated detecta pistas compartidas', () => {
    const a: CaseRunSummary = { runId: 'r1', language: 'es', mode: 'free', clock: 0, memory: [], clues: ['c1'], pending: [] };
    const b: CaseRunSummary = { runId: 'r2', language: 'en', mode: 'guided', clock: 0, memory: [], clues: ['c1'], pending: [] };
    expect(assertCasesIsolated(a, b)).toContain('pistas compartidas');
  });

  it('assertCasesIsolated detecta pendientes compartidos', () => {
    const a: CaseRunSummary = { runId: 'r1', language: 'es', mode: 'free', clock: 0, memory: [], clues: [], pending: ['p1'] };
    const b: CaseRunSummary = { runId: 'r2', language: 'en', mode: 'guided', clock: 0, memory: [], clues: [], pending: ['p1'] };
    expect(assertCasesIsolated(a, b)).toContain('pendientes compartidos');
  });

  it('assertCasesIsolated no reporta violaciones para casos aislados', () => {
    const a: CaseRunSummary = { runId: 'r1', language: 'es', mode: 'free', clock: 10, memory: ['m1'], clues: ['c1'], pending: ['p1'] };
    const b: CaseRunSummary = { runId: 'r2', language: 'en', mode: 'guided', clock: 20, memory: ['m2'], clues: ['c2'], pending: ['p2'] };
    expect(assertCasesIsolated(a, b)).toHaveLength(0);
  });

  it('sanitizeText escapa HTML', () => {
    const r = sanitizeText('<script>alert(1)</script>');
    expect(r.text).not.toContain('<script>');
    expect(r.text).toContain('&lt;script&gt;');
  });

  it('sanitizeText trunca textos largos', () => {
    const r = sanitizeText('a'.repeat(5000), { maxLength: 100 });
    expect(r.text.length).toBe(100);
    expect(r.truncated).toBe(true);
  });

  it('sanitizeText detecta RTL', () => {
    const r = sanitizeText('שלום עולם');
    expect(r.rtl).toBe(true);
  });

  it('sanitizeText detecta fallback lingüístico', () => {
    const r = sanitizeText('こんにちは', { fallbackLanguage: 'en' });
    expect(r.fallbackApplied).toBe(true);
  });

  it('sanitizeText filtra IDs secretos', () => {
    const r = sanitizeText('El secreto es SECRET-123', { secretIds: new Set(['SECRET-123']) });
    expect(r.leakedSecrets).toEqual(['SECRET-123']);
    expect(r.text).not.toContain('SECRET-123');
    expect(r.text).toContain('[redacted]');
  });

  it('sanitizeText no filtra IDs cuando no se proporcionan', () => {
    const r = sanitizeText('El secreto es SECRET-123');
    expect(r.leakedSecrets).toHaveLength(0);
    expect(r.text).toContain('SECRET-123');
  });

  it('createTTSSession cancela y evita hablar después', () => {
    const calls: string[] = [];
    const session = createTTSSession({
      speak: (text) => { calls.push(text); return true; },
      cancel: () => { calls.push('CANCEL'); },
    });
    expect(session.isActive()).toBe(true);
    expect(session.speak('hola')).toBe(true);
    session.cancel();
    expect(session.isActive()).toBe(false);
    expect(session.speak('otra')).toBe(false);
    expect(calls).toEqual(['hola', 'CANCEL']);
  });

  it('createTTSSession genera sessionId único', () => {
    const s1 = createTTSSession({ speak: () => true, cancel: () => undefined });
    const s2 = createTTSSession({ speak: () => true, cancel: () => undefined });
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });
});
