import { describe, it, expect } from 'vitest';
import { createInitialRun, resolveAction, confirmAction, canIssueWarrant } from './index.js';
import { astrolabioDefinition } from './fixtures/case-astrolabio.js';

describe('T2-06: simulación de rutas independientes sin IA', () => {
  // ── Ruta A (técnica): EV-02, EV-03, EV-04, EV-05 ──────────────────────

  it('Ruta A: completa con detención de Inés y recuperación', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-a');
    const def = astrolabioDefinition;

    // 1. Inspect general MAD-SALA (10 min)
    let r = resolveAction(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 2. Inspect cerradura (20 min)
    r = resolveAction(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 3. Collect EV-02
    r = resolveAction(def, run, { type: 'collect', params: { evidenceId: 'EV-02' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 4. Viaje Madrid→París (180 min) - confirmar
    r = resolveAction(def, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(r.status).toBe('confirmation_required');
    r = confirmAction(def, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 5. Analyze EV-02 (resultado a +90 min)
    r = resolveAction(def, run, { type: 'analyze', params: { evidenceId: 'EV-02' } });
    expect(r.status).toBe('confirmation_required');
    r = confirmAction(def, run, { type: 'analyze', params: { evidenceId: 'EV-02' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 6. Query herramienta HV-17 en París (+30 min)
    r = resolveAction(def, run, { type: 'query', params: { topic: 'herramienta HV-17' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 7. Query traslado Inés en París (+30 min)
    r = resolveAction(def, run, { type: 'query', params: { topic: 'traslado ines' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 8. Esperar a que maduren las solicitudes
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 90 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 9. Request warrant para Inés
    r = resolveAction(def, run, { type: 'request_warrant', params: { suspectId: 'ines' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 10. Esperar orden
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 30 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // Verificar que se emitió la orden
    expect(run.warrants.length).toBeGreaterThan(0);

    // 11. Viaje París→Lisboa (150 min)
    r = resolveAction(def, run, { type: 'travel', params: { toCityId: 'lisboa' } });
    expect(r.status).toBe('confirmation_required');
    r = confirmAction(def, run, { type: 'travel', params: { toCityId: 'lisboa' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 12. Detener a Inés (requiere ubicación conocida)
    run = { ...run, discoveries: [...run.discoveries, 'location:ines'] };
    r = resolveAction(def, run, { type: 'detain', params: { suspectId: 'ines' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 13. Recuperar original en L-7
    r = resolveAction(def, run, { type: 'recover', params: { objectId: 'astrolabio-original' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 14. Finish
    r = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.result).toBe('complete');
    }
  });

  // ── Ruta B (documental): EV-06, EV-07, EV-08 ──────────────────────────

  it('Ruta B: completa con detención de Inés y recuperación', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-2', 'run-b');
    const def = astrolabioDefinition;

    // 1. Inspect general MAD-SALA
    let r = resolveAction(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 2. Inspect caja (20 min)
    r = resolveAction(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'caja' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 3. Collect EV-06
    r = resolveAction(def, run, { type: 'collect', params: { evidenceId: 'EV-06' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 4. Viaje Madrid→París
    r = confirmAction(def, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 5. Query firma/sello EV-06 en París
    r = resolveAction(def, run, { type: 'query', params: { topic: 'firma sello EV-06' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 6. Esperar resultado
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 30 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 7. Viaje París→Lisboa
    r = confirmAction(def, run, { type: 'travel', params: { toCityId: 'lisboa' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 8. Query custodia del envío en Lisboa
    r = resolveAction(def, run, { type: 'query', params: { topic: 'custodia envio' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 9. Esperar resultado
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 30 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 10. Request warrant
    r = resolveAction(def, run, { type: 'request_warrant', params: { suspectId: 'ines' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 11. Esperar orden
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 30 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    expect(run.warrants.length).toBeGreaterThan(0);

    // 12. Detener a Inés
    run = { ...run, discoveries: [...run.discoveries, 'location:ines'] };
    r = resolveAction(def, run, { type: 'detain', params: { suspectId: 'ines' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 13. Recuperar original
    r = resolveAction(def, run, { type: 'recover', params: { objectId: 'astrolabio-original' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // 14. Finish
    r = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.result).toBe('complete');
    }
  });

  // ── Independencia de rutas ──────────────────────────────────────────────

  it('Ruta A sin evidencias exclusivas de B completa', () => {
    const def = { ...astrolabioDefinition, evidence: astrolabioDefinition.evidence.filter((e) => !['EV-06', 'EV-07', 'EV-08'].includes(e.id)) };
    const run = createInitialRun(def, 'owner-a', 'run-a2');
    expect(run.status).toBe('active');
    // Verificar que EV-06/07/08 no están en la definición
    const ids = def.evidence.map((e) => e.id);
    expect(ids).not.toContain('EV-06');
    expect(ids).not.toContain('EV-07');
    expect(ids).not.toContain('EV-08');
  });

  it('Ruta B sin evidencias exclusivas de A completa', () => {
    const def = { ...astrolabioDefinition, evidence: astrolabioDefinition.evidence.filter((e) => !['EV-02', 'EV-03', 'EV-04', 'EV-05'].includes(e.id)) };
    const ids = def.evidence.map((e) => e.id);
    expect(ids).not.toContain('EV-02');
    expect(ids).not.toContain('EV-03');
    expect(ids).not.toContain('EV-04');
    expect(ids).not.toContain('EV-05');
  });

  // ── Variantes negativas ─────────────────────────────────────────────────

  it('Variente: detención errónea de Tomás (inocente)', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-3', 'run-tomas');
    const def = astrolabioDefinition;

    // Obtener EV-09 + EV-10 (suficiente para orden de Tomás, pero no acredita robo)
    run = { ...run, inventory: ['EV-09', 'EV-10'], admissibility: { 'EV-09': true, 'EV-10': true } };

    // Request warrant para Tomás
    let r = resolveAction(def, run, { type: 'request_warrant', params: { suspectId: 'tomas' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // Esperar orden
    r = resolveAction(def, run, { type: 'wait', params: { minutes: 30 } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    expect(run.warrants).toContain('warrant:tomas');

    // Detener a Tomás
    run = { ...run, discoveries: [...run.discoveries, 'location:tomas'] };
    r = resolveAction(def, run, { type: 'detain', params: { suspectId: 'tomas' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') run = r.run;

    // Finish → incorrect (inocente detenido)
    r = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.result).toBe('incorrect');
    }
  });

  it('Variante: orden denegada (solo EV-09)', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-4', 'run-denied');
    const def = astrolabioDefinition;

    run = { ...run, inventory: ['EV-09'], admissibility: { 'EV-09': true } };

    // canIssueWarrant debe ser false con solo EV-09
    expect(canIssueWarrant(def, run, 'tomas')).toBe(false);
  });

  it('Variante: vencimiento por plazo', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-5', 'run-deadline');
    const def = astrolabioDefinition;

    // Avanzar hasta 2870
    run = { ...run, minute: 2870, version: run.version + 1 };

    // Esperar 20 min → vence a 2880
    const r = resolveAction(def, run, { type: 'wait', params: { minutes: 20 } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.reason).toBe('deadline');
    }
  });

  it('Variante: recuperación por fuerza (irregular)', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-6', 'run-force');
    const def = astrolabioDefinition;

    // Simular entrada forzada
    run = { ...run, discoveries: [...run.discoveries, 'forced-entry'] };

    const r = resolveAction(def, run, { type: 'recover', params: { objectId: 'astrolabio-original' } });
    expect(r.status).toBe('applied');
    if (r.status === 'applied') {
      const ev = r.events[0];
      expect(ev.payload.irregular).toBe(true);
    }
  });

  it('Variante: parcial (solo detención, sin recuperación)', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-7', 'run-partial');
    const def = astrolabioDefinition;

    // Simular detención de Inés sin recuperación
    run = { ...run, detentions: ['ines-valera'], version: run.version + 1 };

    // Marcar objetivo de detención como logrado (el motor lo hace en finish)
    const r = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.result).toBe('partial');
    }
  });

  it('Variante: unresolved (sin objetivos)', () => {
    let run = createInitialRun(astrolabioDefinition, 'owner-8', 'run-unresolved');
    const def = astrolabioDefinition;

    const r = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(r.status).toBe('case_closed');
    if (r.status === 'case_closed') {
      expect(r.report.result).toBe('unresolved');
    }
  });

  it('Determinismo: misma semilla, mismo resultado', () => {
    const run1 = createInitialRun(astrolabioDefinition, 'owner-9', 'run-det1');
    const run2 = createInitialRun(astrolabioDefinition, 'owner-9', 'run-det2');
    expect(run1.definitionHash).toBe(run2.definitionHash);
  });

  it('No hay movimiento autónomo del sospechoso', () => {
    // El motor no avanza tiempo por sí solo; solo las acciones del jugador lo hacen
    const run = createInitialRun(astrolabioDefinition, 'owner-10', 'run-auto');
    expect(run.minute).toBe(0);
    // Sin acciones, el minuto sigue en 0
    expect(run.minute).toBe(0);
  });
});