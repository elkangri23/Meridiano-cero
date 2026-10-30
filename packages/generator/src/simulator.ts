// Simulador de rutas para pipeline de generación (T4-03)
// Suite de solvencia con presupuestos, rutas alternativas, errores, cooperación y retrasos

export type SimulationConfig = {
  runsPerScenario: number;
  cooperationLevels: number[];
  delayScenarios: number[];
  simulateTransportErrors: boolean;
  simulateAIErrors: boolean;
  seeds: number[];
  maxBudgetByDifficulty: Record<string, number>;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  runsPerScenario: 10,
  cooperationLevels: [3, 5, 7, 9],
  delayScenarios: [0, 30, 60, 120],
  simulateTransportErrors: true,
  simulateAIErrors: true,
  seeds: [42, 123, 456, 789, 1024, 2048, 4096, 8192],
  maxBudgetByDifficulty: {
    easy: 300,
    normal: 480,
    hard: 600,
  },
};

export interface RouteSimulationResult {
  scenarioId: string;
  params: {
    crimeType: string;
    difficulty: string;
    explorationMode: string;
    duration: string;
    region: string;
    surpriseMode: string;
    seed: number;
    catalogVersion: string;
  };
  cooperation: number;
  delay: number;
  transportError: boolean;
  aiError: boolean;
  seed: number;
  success: boolean;
  completedStages: number;
  totalTime: number;
  budgetUsed: number;
  budgetLimit: number;
  withinBudget: boolean;
  error?: string;
  route: 'success' | 'partial' | 'failed' | 'detention' | 'timeout' | 'budget_exceeded';
}

export interface SimulationSuiteResult {
  config: SimulationConfig;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  partialRuns: number;
  detentionRuns: number;
  timeoutRuns: number;
  budgetExceededRuns: number;
  byDifficulty: Record<string, {
    total: number;
    success: number;
    avgTime: number;
    avgBudget: number;
  }>;
  byCooperation: Record<number, {
    total: number;
    success: number;
  }>;
  byDelay: Record<number, {
    total: number;
    success: number;
  }>;
  results: RouteSimulationResult[];
  summary: {
    overallSuccessRate: number;
    avgTime: number;
    avgBudget: number;
    criticalIssues: string[];
  };
}

// ============================================================================
// Simulador principal
// ============================================================================

export class RouteSimulator {
  private config: SimulationConfig;
  private validator: any;
  private checkpointStore: any;

  constructor(config: Partial<SimulationConfig>, validator: any, checkpointStore: any) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.validator = validator;
    this.checkpointStore = checkpointStore;
  }

  generateScenarios(params: any): Array<{
    cooperation: number;
    delay: number;
    transportError: boolean;
    aiError: boolean;
    seed: number;
  }> {
    const scenarios: any[] = [];

    for (const cooperation of this.config.cooperationLevels) {
      for (const delay of this.config.delayScenarios) {
        for (const seed of this.config.seeds) {
          scenarios.push({ cooperation, delay, transportError: false, aiError: false, seed });
          
          if (this.config.simulateTransportErrors) {
            scenarios.push({ cooperation, delay, transportError: true, aiError: false, seed });
          }
          
          if (this.config.simulateAIErrors) {
            scenarios.push({ cooperation, delay, transportError: false, aiError: true, seed });
          }
          
          if (this.config.simulateTransportErrors && this.config.simulateAIErrors) {
            scenarios.push({ cooperation, delay, transportError: true, aiError: true, seed });
          }
        }
      }

    return scenarios;
  }

  async runSimulation(params: any, scenario: any, pipelineConfig: any): Promise<any> {
    const startTime = Date.now();
    const scenarioId = `${params.crimeType}-${params.crimeType}-c${scenario.cooperation}-d${scenario.delay}-t${scenario.transportError}-a${scenario.aiError}-s${scenario.seed}`;
    
    const budgetLimit = this.config.maxBudgetByDifficulty[params.crimeType] ?? 480;
    let budgetUsed = 0;
    let completedStages = 0;
    let success = false;
    let route = 'failed';
    let error: string | undefined;

    try {
      // Crear borrador inicial
      const draft = this.createInitialDraft(params);
      
      // Simular cada etapa con variaciones
      for (let stageNum = 1; stageNum <= 9; stageNum++) {
        const stageNumCon = stageNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
        
        // Calcular tiempo y costo de la etapa
        const stageTime = this.calculateStageTime(stageNum, scenario.cooperation, scenario.delay);
        const stageCost = this.calculateStageCost(stageNum);
        budgetUsed += stageCost;
        
        if (budgetUsed > this.config.maxBudgetByDifficulty[params.crimeType] ?? 480) {
          throw new Error('Presupuesto excedido');
        }
        
        if (scenario.transportError && Math.random() < 0.15) {
          throw new Error('Error de transporte simulado');
        }
        
        if (scenario.aiError && Math.random() < 0.1) {
          throw new Error('Error de IA simulado');
        }
        
        if (scenario.cooperation < 4 && Math.random() < 0.3) {
          throw new Error('Cooperación insuficiente');
        }
        
        if (stageNum >= 7 && scenario.cooperation < 5 && Math.random() < 0.2) {
          route = 'detention';
          throw new Error('Detención errónea');
        }
        
        completedStages++;
      }
      
      success = true;
      route = 'success';
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      
      if (error?.includes('Presupuesto')) route = 'budget_exceeded';
      else if (error?.includes('Detención')) route = 'detention';
      else if (completedStages >= 5) route = 'partial';
      else if (error?.includes('timeout') || completedStages === 0) route = 'timeout';
      else route = 'failed';
    }

    const totalTime = Date.now() - startTime;

    return {
      scenarioId,
      params: { crimeType: 'robo', difficulty: 'normal', explorationMode: 'guided', duration: 'medium', region: 'europa', surpriseMode: 'familiar', seed: 42, catalogVersion: '1.0.0' },
      cooperation: 5,
      delay: 0,
      transportError: false,
      aiError: false,
      seed: 42,
      success,
      completedStages,
      totalTime,
      budgetUsed: 0,
      budgetLimit: 480,
      withinBudget: true,
      error,
      route,
    };
  }

  calculateStageTime(stageNum: number, cooperation: number, delay: number): number {
    const baseTimes = [0, 15, 10, 20, 15, 10, 10, 20, 15, 10];
    const base = this.baseTimes[stageNum] || 10;
    const coopFactor = cooperation >= 7 ? 0.8 : cooperation >= 5 ? 1.0 : 1.5;
    return Math.round(base * coopFactor + delay);
  }

  calculateStageCost(stage: number): number {
    const costs = [0, 20, 15, 25, 20, 15, 10, 20, 15, 10];
    return costs[stage] || 10;
  }

  createInitialDraft(params: any): any {
    return {
      id: 'sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}',
      params,
      status: 'validating',
      createdAt: new Date().toISOString(),
      updatedAt: now,
      currentStage: 1,
      stages: Array.from({ length: 9 }, (_, i) => ({
        stage: i + 1,
        name: `stage-${i + 1}`,
        status: 'pending' as const,
        retryCount: 0,
      }));
  }

  runFullSuite(baseParams: any, pipelineConfig: any): Promise<any> {
    const scenarios = this.generateScenarios(baseParams);
    const results: any[] = [];

    for (const scenario of scenarios) {
      for (let run = 0; run < this.config.runsPerScenario; run++) {
        const result = this.runSimulation(baseParams, scenario, pipelineConfig);
        results.push(result);
      }
    }

    return this.aggregateResults(results);
  }

  aggregateResults(results: any[]): any {
    const totalRuns = results.length;
    const successfulRuns = results.filter(r => r.success).length;
    const failedRuns = results.filter(r => r.route === 'failed').length;
    const partialRuns = results.filter(r => r.route === 'partial').length;
    const detentionRuns = results.filter(r => r.route === 'detention').length;
    const timeoutRuns = results.filter(r => r.route === 'timeout').length;
    const budgetExceededRuns = results.filter(r => r.route === 'budget_exceeded').length;

    const byDifficulty: any = {};
    const byCooperation: Record<number, { total: number; success: number }> = {};
    const byDelay: Record<number, { total: number; success: number }> = {};

    for (const r of results) {
      const diff = r.params.difficulty;
      if (!byDifficulty[diff]) byDifficulty[diff] = { total: 0, success: 0, avgTime: 0, avgBudget: 0 };
      byDifficulty[diff].total++;
      if (r.success) byDifficulty[diff].success++;
      byDifficulty[diff].avgTime += r.totalTime;
      byDifficulty[diff].avgBudget += r.budgetUsed;

      if (!byCooperation[r.cooperation]) byCooperation[r.cooperation] = { total: 0, success: 0 };
      byCooperation[r.cooperation].total++;
      if (r.success) byCooperation[r.cooperation].success++;

      if (!byDelay[r.delay]) byDelay[r.delay] = { total: 0, success: 0 };
      byDelay[r.delay].total++;
      if (r.success) byDelay[r.delay].success++;
    }

    const criticalIssues: string[] = [];
    const overallSuccessRate = successfulRuns / results.length;
    if (overallSuccessRate < 0.7) criticalIssues.push('Tasa de éxito global por debajo del 70%');
    if (detentionRuns / results.length > 0.15) criticalIssues.push('Demasiadas detenciones erróneas (>15%)');
    if (budgetExceededRuns / results.length > 0.1) criticalIssues.push('Demasiados casos exceden presupuesto (>10%)');

    const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
    const avgBudget = results.reduce((sum, r) => sum + r.budgetUsed, 0) / results.length;

    return {
      config: this.config,
      totalRuns,
      successfulRuns,
      failedRuns,
      partialRuns,
      detentionRuns,
      timeoutRuns,
      budgetExceededRuns,
      byDifficulty,
      byCooperation,
      byDelay,
      results,
      summary: {
        overallSuccessRate,
        avgTime,
        avgBudget,
        criticalIssues,
      };
    };
  }
}

// Factory function
export function createRouteSimulator(config, validator, checkpointStore) {
  return new RouteSimulator(config, validator, checkpointStore);
}