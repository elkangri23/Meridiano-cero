import type { PlayerView } from '@meridiano/case-schema';
// AI Adapters - Contratos y tipos para integración de IA
// SPEC-005: Integración de IA y fidelidad narrativa

export type ProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'freellmapi' | string;

export type AIFunction =
  | 'generateCase'
  | 'validateCase'
  | 'interpretAction'
  | 'narrateResult'
  | 'converse';

export type AIErrorCode =
  | 'TRANSPORT_ERROR'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_UNAVAILABLE';

export interface AIContext {
  providerId: ProviderId;
  model: string;
  function: AIFunction;
  schemaVersion: number;
  authorizedContext: unknown;
  limits: AILimits;
  cancellationSignal?: AbortSignal;
  requestId: string;
}

export interface AILimits {
  maxTokens?: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface AIResponse<T = unknown> {
  payload: T | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'cancelled' | 'content_filter' | 'error';
  error?: {
    code: AIErrorCode;
    message: string;
  };
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly capabilities: AIFunction[];
  readonly maxContextTokens: number;
  readonly defaultModel: string;

  /** Ejecuta una función de IA con el contexto autorizado */
  execute<T>(context: AIContext): Promise<AIResponse<T>>;

  /** Verifica disponibilidad y capacidades del proveedor */
  healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }>;

  /** Estima tokens para un prompt */
  estimateTokens(text: string): number;
}

export interface AIAgentConfig {
  providerId: ProviderId;
  model: string;
  role: 'generator' | 'reviewer' | 'director' | 'interpreter' | 'narrator';
  maxContextTokens: number;
  timeoutMs: number;
  maxRetries: number;
  systemPrompt?: string;
}

export type AICancellationSignal = AbortSignal;

export interface FactId {
  id: string;
  type: string;
  content: string;
  confidence: number;
}

export interface AuthorizedFact {
  id: string;
  content: string;
  source: string;
  minute: number;
}

export interface NarrativeContext {
  publicEvents: ReadonlyArray<{
    ordinal: number;
    minute: number;
    type: string;
    payload: Record<string, unknown>;
  }>;
  authorizedScenes: ReadonlyArray<string>;
  style: 'brief' | 'detailed' | 'ambient';
}

export interface NPCPersona {
  id: string;
  name: string;
  knownFacts: ReadonlyArray<string>;
  cooperation: number;
  conversationHistory: ReadonlyArray<{
    speaker: 'player' | 'npc';
    text: string;
    minute: number;
  }>;
  receivedTreatment: 'friendly' | 'neutral' | 'hostile' | 'pressured';
}

export interface InterpretActionInput {
  text: string;
  playerView: Omit<PlayerView, 'finalReport'>;
  availableActions: ReadonlyArray<{
    type: string;
    params: Record<string, unknown>;
    description: string;
  }>;
}

export interface InterpretActionOutput {
  actionType: string;
  params: Record<string, unknown>;
  confidence: number;
  clarificationQuestion?: string;
}

export interface ConverseOutput {
  text: string;
  factIds?: string[];
  actOfSpeech: 'inform' | 'question' | 'refusal' | 'evasion' | 'silence';
  cooperationChange?: number;
  newKnowledge?: string[];
}

export interface NarrateResultOutput {
  narrative: string;
  factReferences: ReadonlyArray<string>;
  style: 'brief' | 'detailed' | 'ambient';
}

export interface GenerateCaseInput {
  seed: number;
  difficulty: 'easy' | 'normal' | 'hard';
  explorationMode: 'guided' | 'free';
  region: string;
  duration: 'short' | 'medium' | 'long';
  contentMode: 'fixed' | 'generated';
  catalogVersion: string;
}

export interface GenerateCaseOutput {
  definition: unknown; // CaseDefinition completo
  validationReport: {
    validatorVersion: string;
    scenarios: string[];
    errors: string[];
    status: 'validated' | 'rejected';
  };
}

export interface ValidateCaseInput {
  definition: unknown;
}

export interface ValidateCaseOutput {
  valid: boolean;
  errors: string[];
}

// Re-export from providers
export { OllamaProvider, createOllamaProvider, type OllamaConfig } from './providers/index.js';
export { DeterministicMockProvider, createDeterministicMockProvider } from './providers/index.js';