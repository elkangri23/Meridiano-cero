import type { CaseRun, FinalReport } from '@meridiano/case-schema';

export type ActionType =
  | 'inspect'
  | 'collect'
  | 'talk'
  | 'travel'
  | 'analyze'
  | 'communicate'
  | 'query'
  | 'wait'
  | 'request_warrant'
  | 'detain'
  | 'recover'
  | 'finish'
  | 'batch'
  | 'batch_decision';

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

export type ActionResult =
  | { status: 'applied'; run: CaseRun; events: EngineEvent[] }
  | { status: 'clarification_required'; run: CaseRun; events: EngineEvent[]; question: string }
  | { status: 'impossible'; run: CaseRun; events: EngineEvent[]; reason: string }
  | { status: 'confirmation_required'; run: CaseRun; events: EngineEvent[]; preview: ActionPreview }
  | { status: 'case_closed'; run: CaseRun; events: EngineEvent[]; report: FinalReport }
  | { status: 'batch_paused'; run: CaseRun; events: EngineEvent[]; pausedAt: number; reason: string };

export interface EngineEvent {
  ordinal: number;
  minute: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface ActionPreview {
  actionType: ActionType;
  estimatedMinutes: number;
  estimatedEndTime: number;
  description: string;
}

export interface BatchStep {
  ordinal: number;
  dependsOn: number[];
  action: Action;
  status: 'pending' | 'applied' | 'impossible' | 'skipped';
  reason?: string;
}
