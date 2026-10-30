import { describe, it, expect } from 'vitest';
import { createRouteSimulator, DEFAULT_SIMULATION_CONFIG } from './simulator.js';

describe('RouteSimulator (T4-03)', () => {
  describe('DEFAULT_SIMULATION_CONFIG', () => {
    it('tiene configuración por defecto correcta', () => {
      expect(DEFAULT_SIMULATION_CONFIG.runsPerScenario).toBe(10);
      expect(DEFAULT_SIMULATION_CONFIG.cooperationLevels).toEqual([3, 5, 7, 9]);
      expect(DEFAULT_SIMULATION_CONFIG.delayScenarios).toEqual([0, 30, 60, 120]);
      expect(DEFAULT_SIMULATION_CONFIG.simulateTransportErrors).toBe(true);
      expect(DEFAULT_SIMULATION_CONFIG.simulateAIErrors).toBe(true);
      expect(DEFAULT_SIMULATION_CONFIG.seeds.length).toBeGreaterThan(0);
      expect(DEFAULT_SIMULATION_CONFIG.maxBudgetByDifficulty).toEqual({
        easy: 300,
        normal: 480,
        hard: 600,
      });
    });
  });

  describe('createRouteSimulator', () => {
    it('crea simulador con configuración por defecto', () => {
      const simulator = createRouteSimulator({});
      expect(simulator).toBeInstanceOf(Object);
    });

    it('permite sobrescribir configuración', () => {
      const simulator = createRouteSimulator({ runsPerScenario: 5, cooperationLevels: [5] });
      expect((simulator as any).config.runsPerScenario).toBe(5);
      expect((simulator as any).config.cooperationLevels).toEqual([5]);
    });
  });

  describe('generateScenarios', () => {
    it('genera escenarios base sin errores', () => {
      const simulator = createRouteSimulator({});
      const scenarios = simulator.generateScenarios({
        crimeType: 'robo',
        difficulty: 'normal',
        explorationMode: 'guided',
        duration: 'medium',
        region: 'europa',
        surpriseMode: 'familiar',
        seed: 42,
        catalogVersion: '1.0.0',
      });

      // Con 4 niveles cooperación x 4 retrasos x 8 semillas = 128 base
      // Sin errores de transporte/IA = 128
      // Con error transporte = 128
      // Con error IA = 128
      // Con ambos = 128
      // Total = 512
      expect(scenarios.length).toBeGreaterThan(100);
    });

    it('genera menos escenarios si se desactivan errores', () => {
      const simulator = createRouteSimulator({ simulateTransportErrors: false, simulateAIErrors: false });

      const scenarios = simulator.generateScenarios({
        crimeType: 'robo',
        difficulty: 'normal',
        explorationMode: 'guided',
        duration: 'medium',
        region: 'europa',
        surpriseMode: 'familiar',
        seed: 42,
        catalogVersion: '1.0.0',
      });

      // Solo 4 cooperación x 4 retrasos x 8 semillas = 128
      expect(scenarios.length).toBe(128);
    });
  });

  describe('runSimulation', () => {
    it('ejecuta simulación y devuelve resultado', async () => {
      const simulator = createRouteSimulator(
        { runsPerScenario: 1, cooperationLevels: [7], delayScenarios: [0], seeds: [42], simulateTransportErrors: false, simulateAIErrors: false }
      );

      const result = await simulator.runSimulation({
        crimeType: 'robo',
        difficulty: 'normal',
        explorationMode: 'guided',
        duration: 'medium',
        region: 'europa',
        surpriseMode: 'familiar',
        seed: 42,
        catalogVersion: '1.0.0',
      }, {
        cooperation: 7,
        delay: 0,
        transportError: false,
        aiError: false,
        seed: 42,
      }, {
        maxRetriesPerStage: 2,
        stageTimeoutMs: 5000,
        enableSemanticReview: false,
        enableSimulation: true,
      });

      expect(result).toBeDefined();
      expect(result.scenarioId).toContain('normal');
      expect(result.success).toBe(true);
      expect(result.route).toBe('success');
      expect(result.completedStages).toBe(9);
      expect(result.budgetUsed).toBeLessThanOrEqual(480);
    });

    it('maneja presupuesto excedido', async () => {
      const simulator = createRouteSimulator(
        { runsPerScenario: 1, cooperationLevels: [3], delayScenarios: [120], seeds: [42], simulateTransportErrors: false, simulateAIErrors: false }
      );

      // easy budget = 300, con cooperación baja + retraso alto puede exceder
      const result = await simulator.runSimulation({
        crimeType: 'robo',
        difficulty: 'easy',
        explorationMode: 'guided',
        duration: 'medium',
        region: 'europa',
        surpriseMode: 'familiar',
        seed: 42,
        catalogVersion: '1.0.0',
      }, {
        cooperation: 3,
        delay: 120,
        transportError: false,
        aiError: false,
        seed: 42,
      }, {
        maxRetriesPerStage: 2,
        stageTimeoutMs: 5000,
        enableSemanticReview: false,
        enableSimulation: true,
      });

      expect(result.route).toBeOneOf(['budget_exceeded', 'failed', 'partial', 'detention', 'timeout']);
    });
  });

  describe('runFullSuite', () => {
    it('ejecuta suite completa y devuelve resultados agregados', async () => {
      const simulator = createRouteSimulator(
        { runsPerScenario: 2, cooperationLevels: [5, 7], delayScenarios: [0, 30], seeds: [42, 123], simulateTransportErrors: false, simulateAIErrors: false }
      );

      const result = await simulator.runFullSuite({
        crimeType: 'robo',
        difficulty: 'normal',
        explorationMode: 'guided',
        duration: 'medium',
        region: 'europa',
        surpriseMode: 'familiar',
        seed: 42,
        catalogVersion: '1.0.0',
      }, {
        maxRetriesPerStage: 2,
        stageTimeoutMs: 5000,
        enableSemanticReview: false,
        enableSimulation: true,
      });

      expect(result.totalRuns).toBeGreaterThan(0);
      expect(result.successfulRuns).toBeGreaterThanOrEqual(0);
      expect(result.failedRuns).toBeGreaterThanOrEqual(0);
      expect(result.byDifficulty).toBeDefined();
      expect(result.byCooperation).toBeDefined();
      expect(result.byDelay).toBeDefined();
      expect(result.summary.overallSuccessRate).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallSuccessRate).toBeLessThanOrEqual(1);
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});