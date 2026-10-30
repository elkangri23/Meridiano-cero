import { describe, it, expect } from 'vitest';
import { createLaunchChecklist, updateCheck, evaluateLaunchReadiness, generateLaunchReport, OWASP_CHECKS } from './launch-checklist.js';

describe('launch-checklist', () => {
  it('OWASP_CHECKS tiene checks para todas las categorías A01-A10', () => {
    const categories = new Set(OWASP_CHECKS.map(c => c.category));
    expect(categories.has('A01')).toBe(true);
    expect(categories.has('A02')).toBe(true);
    expect(categories.has('A03')).toBe(true);
    expect(categories.has('A04')).toBe(true);
    expect(categories.has('A05')).toBe(true);
    expect(categories.has('A06')).toBe(true);
    expect(categories.has('A07')).toBe(true);
    expect(categories.has('A08')).toBe(true);
    expect(categories.has('A09')).toBe(true);
    expect(categories.has('A10')).toBe(true);
  });

  it('createLaunchChecklist crea checklist con estado pending', () => {
    const checklist = createLaunchChecklist('1.0.0', 'staging', 'test-user');
    expect(checklist.version).toBe('1.0.0');
    expect(checklist.environment).toBe('staging');
    expect(checklist.runBy).toBe('test-user');
    expect(checklist.overallStatus).toBe('pending');
    expect(checklist.checks.length).toBe(OWASP_CHECKS.length);
  });

  it('updateCheck actualiza estado y evidencia', () => {
    const checklist = createLaunchChecklist('1.0.0', 'staging', 'test-user');
    updateCheck(checklist, 'A01-01', 'pass', 'Validado ownership en todas las rutas');
    const check = checklist.checks.find(c => c.id === 'A01-01');
    expect(check?.status).toBe('pass');
    expect(check?.evidence).toBe('Validado ownership en todas las rutas');
  });

  it('evaluateLaunchReadiness bloquea en crítico fallado', () => {
    const checklist = createLaunchChecklist('1.0.0', 'staging', 'test-user');
    updateCheck(checklist, 'A01-01', 'fail');
    const evaluated = evaluateLaunchReadiness(checklist);
    expect(evaluated.overallStatus).toBe('blocked');
    expect(evaluated.blockers.length).toBeGreaterThan(0);
  });

  it('evaluateLaunchReadiness ready cuando todos pasan', () => {
    const checklist = createLaunchChecklist('1.0.0', 'staging', 'test-user');
    for (const check of checklist.checks) {
      updateCheck(checklist, check.id, 'pass');
    }
    const evaluated = evaluateLaunchReadiness(checklist);
    expect(evaluated.overallStatus).toBe('ready');
    expect(evaluated.blockers).toHaveLength(0);
  });

  it('generateLaunchReport produce reporte formateado', () => {
    const checklist = createLaunchChecklist('1.0.0', 'staging', 'test-user');
    updateCheck(checklist, 'A01-01', 'pass');
    const report = generateLaunchReport(checklist);
    expect(report).toContain('# Reporte de Lanzamiento - staging');
    expect(report).toContain('1.0.0');
    expect(report).toContain('Estado general');
  });
});