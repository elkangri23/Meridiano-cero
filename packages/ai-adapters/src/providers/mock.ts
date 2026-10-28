import type {
  AIProvider,
  AIContext,
  AIResponse,
  AIFunction,
  ProviderId,
  InterpretActionInput,
  NPCPersona,
} from '../index.js';

/**
 * Proveedor determinista para CI y tests.
 * No requiere conexión a red; respuestas predefinidas según función y entrada.
 */
export class DeterministicMockProvider implements AIProvider {
  readonly id: ProviderId = 'mock-deterministic';
  readonly capabilities: AIFunction[] = [
    'interpretAction',
    'narrateResult',
    'converse',
    'generateCase',
    'validateCase',
  ];
  readonly maxContextTokens = 8192;
  readonly defaultModel = 'mock-deterministic';

  private callCount = 0;

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    this.callCount++;
    const startTime = Date.now();

    // Simular latencia variable
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

    const payload = this.generateResponse(context.function, context.authorizedContext, context) as T;
    const latencyMs = Date.now() - startTime;

    return {
      payload,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      latencyMs,
      finishReason: 'stop',
    };
  }

  private generateResponse(functionName: AIFunction, input: unknown, _context: AIContext): unknown {
    switch (functionName) {
      case 'interpretAction': {
        const inputTyped = input as InterpretActionInput;
        const text = inputTyped.text.toLowerCase();

        // Inspeccionar
        if (text.includes('inspec') || text.includes('mira') || text.includes('examina')) {
          const target = this.extractTarget(text, [...inputTyped.availableActions]);
          return { actionType: 'inspect', params: { targetId: target }, confidence: 0.9 };
        }

        // Recoger
        if (text.includes('recog') || text.includes('toma') || text.includes('coge')) {
          const target = this.extractTarget(text, [...inputTyped.availableActions]);
          return { actionType: 'collect', params: { evidenceId: target }, confidence: 0.85 };
        }

        // Hablar
        if (text.includes('habl') || text.includes('pregunt') || text.includes('entrevist')) {
          const target = this.extractTarget(text, [...inputTyped.availableActions]);
          return { actionType: 'talk', params: { npcId: target }, confidence: 0.9 };
        }

        // Viajar
        if (text.includes('viaj') || text.includes('ve a') || text.includes('ve hacia')) {
          const target = this.extractTarget(text, [...inputTyped.availableActions]);
          return { actionType: 'travel', params: { toCityId: target }, confidence: 0.8 };
        }

        // Analizar
        if (text.includes('analiz') || text.includes('examina en laboratorio')) {
          const target = this.extractTarget(text, [...inputTyped.availableActions]);
          return { actionType: 'analyze', params: { evidenceId: target }, confidence: 0.85 };
        }

        // Esperar
        if (text.includes('esper') || text.includes('wait')) {
          return { actionType: 'wait', params: { minutes: 30 }, confidence: 0.9 };
        }

        // Por defecto: inspección general
        return { actionType: 'inspect', params: { targetId: 'general' }, confidence: 0.5, clarificationQuestion: '¿Qué quieres inspeccionar exactamente?' };
      }

      case 'narrateResult': {
        const events = (_context as { events?: unknown[] }).events ?? [];
        return {
          narrative: `La acción se ha completado. ${events.length} evento(s) registrado(s).`,
          factReferences: events.map((_e, i) => `fact-${i}`),
          style: 'brief',
        };
      }

      case 'converse': {
        const npc = (_context as { npc?: NPCPersona }).npc as NPCPersona | undefined;
        return {
          text: npc?.name
            ? `${npc.name}: "Te escucho, detective. ¿En qué puedo ayudarte?"`
            : '"Te escucho, detective. ¿En qué puedo ayudarte?"',
          factIds: [],
          actOfSpeech: 'inform',
          cooperationChange: 1,
        };
      }

      case 'generateCase': {
        return {
          definition: {
            id: 'generated-case-' + Date.now(),
            schemaVersion: 1,
            engineCompatibility: 1,
            contentVersion: 1,
            seed: Math.floor(Math.random() * 1000000),
            contentMode: 'generated',
            difficulty: 'normal',
            explorationMode: 'guided',
            catalogVersion: '1.0',
            deadlineMinutes: 2880,
            solution: 'suspect-generated',
            objectives: [
              { id: 'obj-1', description: 'Detener al culpable', achieved: false },
              { id: 'obj-2', description: 'Recuperar el objeto robado', achieved: false },
            ],
            cities: [
              { id: 'city-1', name: 'Ciudad A', country: 'ES' },
              { id: 'city-2', name: 'Ciudad B', country: 'FR' },
              { id: 'city-3', name: 'Ciudad C', country: 'PT' },
            ],
            locations: [],
            npcs: [],
            facts: [],
            evidence: [],
            rules: [],
            travelDurations: [],
            scheduledResults: [],
            validationReport: {
              validatorVersion: '1.0',
              scenarios: ['structural', 'routes'],
              errors: [],
              status: 'validated',
            },
          },
          validationReport: {
            validatorVersion: '1.0',
            scenarios: ['structural', 'routes'],
            errors: [],
            status: 'validated',
          },
        };
      }

      case 'validateCase': {
        return {
          valid: true,
          errors: [],
        };
      }

      default:
        return { error: 'Función no soportada' };
    }
  }

  private extractTarget(text: string, availableActions: unknown[]): string {
    // Buscar coincidencia con acciones disponibles
    const actions = availableActions as Array<{ type: string; params: Record<string, unknown> }>;

    for (const action of actions) {
      const paramValues = Object.values(action.params);
      for (const val of paramValues) {
        if (typeof val === 'string' && text.includes(val.toLowerCase())) {
          return val;
        }
      }
    }

    // Fallback: primer parámetro de la primera acción
    if (actions.length > 0) {
      const firstAction = actions[0];
      if (firstAction) {
        const params = Object.values(firstAction.params) as unknown[];
        if (params.length > 0) {
          const firstParam = params[0];
          if (firstParam !== undefined && typeof firstParam === 'string') {
            return firstParam;
          }
        }
      }
    }

    return 'unknown';
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    return { available: true, latencyMs: 5 };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export function createDeterministicMockProvider(): AIProvider {
  return new DeterministicMockProvider();
}
