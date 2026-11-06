import type { ContentRating, CrimeType, FinalReport } from '@meridiano/contracts';
export type { FinalReport, PlayerView } from '@meridiano/contracts';

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
  /** Rol visible en la escena y el chat (p. ej. «Transportista»). Solo lo
   * traen los expedientes generados; el caso fijo lo resuelve por catálogo. */
  role?: string;
  /** Persona que se envía al modelo al conversar (quién es, sobre qué
   * responde y a qué se niega). Solo la traen los expedientes generados. */
  persona?: string;
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

/**
 * Mecánica declarativa de un expediente generado (T4-08). El motor del caso
 * fijo tiene esta misma mecánica hardcodeada en `fixed-evidence.ts`,
 * `warrants.ts` y `offers.ts`; los expedientes generados la declaran aquí y
 * el motor la ejecuta por la vía genérica. `requires` es «cualquiera de»
 * (basta conocer una de las evidencias listadas). `reveals` son marcadores
 * extra de descubrimiento al revelar (p. ej. una ciudad nueva o la
 * ubicación de un sospechoso).
 */
export interface MechanicsInspectable {
  locationId: string;
  elementId: string;
  label: string;
  evidenceId: string;
  reveals?: string[];
}

export interface MechanicsQuery {
  id: string;
  label: string;
  cityId: string;
  locationId: string;
  evidenceId: string;
  requires: string[];
  delayMinutes: number;
  reveals?: string[];
}

export interface MechanicsAnalysis {
  inputEvidenceId: string;
  resultEvidenceId: string;
  delayMinutes: number;
}

export interface MechanicsTalkEvidence {
  npcId: string;
  topicId: string;
  label: string;
  evidenceId: string;
  requiresRelation?: boolean;
}

export interface MechanicsSuspect {
  id: string;
  cityId: string;
  locationId: string;
  /** Evidencias que hacen conocido al sospechoso (además de su identidad). */
  knownFromEvidence: string[];
  /** Combinaciones de evidencias admisibles que autorizan la orden. */
  warrantCombinations: string[][];
  /** Evidencias que, al incluirse en una orden concedida, dan acceso
   * (p. ej. abrir la taquilla del depósito). */
  accessEvidenceIds?: string[];
}

export interface MechanicsRecovery {
  objectId: string;
  /** Etiqueta legible de la acción (p. ej. «Recuperar el astrolabio original»). */
  label: string;
  cityId: string;
  locationId: string;
  evidenceId: string;
  requiresAccessWarrant: boolean;
}

export interface CaseMechanics {
  inspectables: MechanicsInspectable[];
  queries: MechanicsQuery[];
  analyses: MechanicsAnalysis[];
  talkEvidence: MechanicsTalkEvidence[];
  suspects: MechanicsSuspect[];
  recovery: MechanicsRecovery;
}

/**
 * Textos narrativos de un expediente generado (T4-08). El caso fijo los
 * tiene hardcodeados en `fact-texts.ts`; los generados los traen aquí.
 * `evidence` es el hecho revelado por cada evidencia; `knowledge`, lo que
 * cada personaje puede contar sobre lo que sabe (en primera persona);
 * `greetings`, el saludo al hablar con cada NPC; `refusals`, la negativa en
 * personaje (normalmente solo la del sospechoso sobre el delito).
 */
export interface CaseTexts {
  evidence: Record<string, string>;
  knowledge: Record<string, string>;
  greetings: Record<string, string>;
  refusals?: Record<string, string>;
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
  /** Mecánica ejecutable (solo expedientes generados; el caso fijo usa su
   * vía propia). Ausente en el astrolabio: su hash no cambia. */
  mechanics?: CaseMechanics;
  /** Textos narrativos (solo expedientes generados; el caso fijo usa
   * `fact-texts.ts`). Ausente en el astrolabio: su hash no cambia. */
  texts?: CaseTexts;
  /** Introducción del caso (solo expedientes generados; la del astrolabio
   * vive en el catálogo de la API). Sin spoilers. */
  briefing?: { speaker: string; title: string; paragraphs: string[] };
  /** Delito y contenido del expediente (solo generados; el astrolabio los
   * tiene en el catálogo de la API). */
  catalogMeta?: { crimeType: CrimeType; contentRating: ContentRating };
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
  eventOrdinal: number;
  tripCount: number;
  version: number;
  minute: number;
  status: CaseStatus;
  position: { cityId: string; locationId: string };
  discoveries: string[];
  evidenceRecords?: Record<string, { revealedMinute: number; origin: string; method: string; collectedMinute?: number }>;
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
