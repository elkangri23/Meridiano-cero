// Tipos puros del expediente. Sin secretos de solución en PlayerView.

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ExplorationMode = 'guided' | 'free';
export type ContentMode = 'fixed' | 'generated';
export type CaseStatus = 'active' | 'closed';

export interface City {
  id: string;
  name: string;
  country: string;
}

export interface Location {
  id: string;
  cityId: string;
  name: string;
  description: string;
  accessible: boolean;
}

export interface NPC {
  id: string;
  name: string;
  cityId: string;
  knowledge: string[];
  cooperation: number;
}

export interface Evidence {
  id: string;
  type: 'object' | 'observation' | 'testimony' | 'analysis' | 'record';
  origin: string;
  minute: number;
  admissible: boolean;
  relations: string[];
}

export interface Objective {
  id: string;
  description: string;
  achieved: boolean;
}

export interface TravelDuration {
  fromCityId: string;
  toCityId: string;
  minutes: number;
}

export interface ScheduledResult {
  id: string;
  dueMinute: number;
  type: string;
  payload: unknown;
}

export interface CaseDefinition {
  id: string;
  schemaVersion: number;
  engineCompatibility: number;
  contentVersion: number;
  seed: number;
  contentMode: ContentMode;
  difficulty: Difficulty;
  explorationMode: ExplorationMode;
  catalogVersion: string;
  deadlineMinutes: number;
  solution: string;
  objectives: Objective[];
  cities: City[];
  locations: Location[];
  npcs: NPC[];
  facts: string[];
  evidence: Evidence[];
  rules: string[];
  travelDurations: TravelDuration[];
  scheduledResults: ScheduledResult[];
  validationReport: ValidationReport;
}

export interface ValidationReport {
  validatorVersion: string;
  scenarios: string[];
  errors: string[];
  status: 'validated' | 'rejected';
}

export interface CaseRun {
  id: string;
  ownerId: string;
  definitionId: string;
  definitionHash: string;
  engineVersion: number;
  version: number;
  minute: number;
  status: CaseStatus;
  position: { cityId: string; locationId: string };
  discoveries: string[];
  inventory: string[];
  admissibility: Record<string, boolean>;
  npcRelations: Record<string, number>;
  conversationRecords: string[];
  pendingRequests: ScheduledResult[];
  warrants: string[];
  detentions: string[];
  recoveredObjects: string[];
  pendingBatch: string[] | null;
  finalReport: FinalReport | null;
}

export interface FinalReport {
  result: 'complete' | 'partial' | 'incorrect' | 'unresolved';
  objectivesAchieved: string[];
  reason: 'finished' | 'deadline';
  minute: number;
}

export interface PlayerView {
  runId: string;
  version: number;
  minute: number;
  deadlineMinutes: number;
  position: { cityId: string; locationId: string };
  visibleCities: string[];
  discoveredLocations: string[];
  discoveredObjects: string[];
  dossier: string[];
  conversation: string[];
  pendingRequests: ScheduledResult[];
  warrants: string[];
  detentions: string[];
  finalReport: FinalReport | null;
}