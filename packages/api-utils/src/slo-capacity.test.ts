import { describe, it, expect } from 'vitest';
import { evaluateLoadTest, createLoadTestResult, DEFAULT_SLO, DEFAULT_CAPACITY, INCIDENT_SCENARIOS, DEFAULT_ALERTS } from './slo-capacity.js';

describe('slo-capacity', () => {
  it('DEFAULT_SLO tiene valores esperados', () => {
    expect(DEFAULT_SLO.availabilityTarget).toBe(99.9);
    expect(DEFAULT_SLO.latencyP95Ms).toBe(2000);
    expect(DEFAULT_SLO.latencyP99Ms).toBe(5000);
    expect(DEFAULT_SLO.errorRateTarget).toBe(0.1);
    expect(DEFAULT_SLO.aiLatencyP95Ms).toBe(10000);
    expect(DEFAULT_SLO.aiErrorRateTarget).toBe(1);
  });

  it('DEFAULT_CAPACITY tiene valores esperados', () => {
    expect(DEFAULT_CAPACITY.concurrentUsers).toBe(100);
    expect(DEFAULT_CAPACITY.requestsPerSecond).toBe(50);
    expect(DEFAULT_CAPACITY.aiRequestsPerMinute).toBe(10);
    expect(DEFAULT_CAPACITY.dbConnections).toBe(20);
    expect(DEFAULT_CAPACITY.memoryMB).toBe(512);
    expect(DEFAULT_CAPACITY.cpuCores).toBe(2);
  });

  it('INCIDENT_SCENARIOS tiene 6 escenarios', () => {
    expect(INCIDENT_SCENARIOS).toHaveLength(6);
    const categories = INCIDENT_SCENARIOS.map(s => s.category);
    expect(categories).toContain('provider_down');
    expect(categories).toContain('db_slow');
    expect(categories).toContain('high_load');
    expect(categories).toContain('quota_exhausted');
    expect(categories).toContain('network_partition');
    expect(categories).toContain('memory_leak');
  });

  it('DEFAULT_ALERTS tiene 7 reglas', () => {
    expect(DEFAULT_ALERTS).toHaveLength(7);
    const actions = DEFAULT_ALERTS.map(a => a.action);
    expect(actions).toContain('email');
    expect(actions).toContain('webhook');
    expect(actions).toContain('log');
    expect(actions).toContain('restart');
  });

  it('evaluateLoadTest pasa cuando todo cumple SLO', () => {
    const result = createLoadTestResult('test', {
      totalRequests: 1000,
      successfulRequests: 1000,
      failedRequests: 0,
      errorRate: 0.05,
      p95LatencyMs: 1500,
      p99LatencyMs: 3000,
      aiRequests: 50,
      aiAvgLatencyMs: 5000,
      aiErrorRate: 0.5,
      dbConnectionsUsed: 10,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.issues).toHaveLength(0);
  });

  it('evaluateLoadTest falla cuando error rate excede objetivo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.5,
      p95LatencyMs: 1500,
      p99LatencyMs: 3000,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Tasa de error'))).toBe(true);
  });

  it('evaluateLoadTest falla cuando p95 latency excede objetivo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.05,
      p95LatencyMs: 3000,
      p99LatencyMs: 3000,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Latencia P95'))).toBe(true);
  });

  it('evaluateLoadTest falla cuando p99 latency excede objetivo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.05,
      p95LatencyMs: 1500,
      p99LatencyMs: 6000,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Latencia P99'))).toBe(true);
  });

  it('evaluateLoadTest falla cuando AI error rate excede objetivo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.05,
      p95LatencyMs: 1500,
      p99LatencyMs: 3000,
      aiRequests: 50,
      aiAvgLatencyMs: 5000,
      aiErrorRate: 2,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Tasa de error IA'))).toBe(true);
  });

  it('evaluateLoadTest falla cuando AI latency excede objetivo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.05,
      p95LatencyMs: 1500,
      p99LatencyMs: 3000,
      aiRequests: 50,
      aiAvgLatencyMs: 15000,
      aiErrorRate: 0.5,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Latencia IA P95'))).toBe(true);
  });

  it('evaluateLoadTest falla cuando conexiones DB exceden máximo', () => {
    const result = createLoadTestResult('test', {
      errorRate: 0.05,
      p95LatencyMs: 1500,
      p99LatencyMs: 3000,
      dbConnectionsUsed: 25,
    });
    const evaluation = evaluateLoadTest(result, DEFAULT_SLO);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('Conexiones DB'))).toBe(true);
  });

  it('createLoadTestResult crea resultado con defaults', () => {
    const result = createLoadTestResult('scenario', { concurrentUsers: 0 });
    expect(result.scenario).toBe('scenario');
    expect(result.totalRequests).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.issues).toEqual([]);
  });
});