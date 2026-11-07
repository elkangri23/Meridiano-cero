import type { ContentRating, CrimeType, FinalReport } from '@meridiano/contracts';
import type { RemoteChannel } from './npc-catalog.js';
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
  /** Canales remotos por los que se puede contactar a este personaje
   * (vocabulario de la acción `communicate`: call/whatsapp/sms/email/
   * fax). Opcional: el caso fijo los resuelve por catálogo y un generado
   * sin ellos hereda llamada y correo. */
  channels?: RemoteChannel[];
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

/** Un envío de la central de comunicaciones (GDD §10): el mensaje tal
 * como lo escribió el jugador, el documento adjunto si lo hay (solo una
 * evidencia en su poder) y sus minutos de envío y de respuesta. El texto
 * libre del jugador vive aquí, no en `conversationRecords`: los registros
 * de conversación nunca llevan texto libre (T2). */
export interface CommunicationRecord {
  id: string;
  channel: RemoteChannel;
  recipientId: string;
  requestText: string;
  documentId?: string;
  sentMinute: number;
  dueMinute: number;
  receivedMinute?: number;
}

/** Una acción irregular cometida por el jugador (GDD §14): forzar un
 * acceso, sobornar o suplantar. `seenBy` son los personajes que pudieron
 * verla (testigos con conocimiento plausible, nunca un detector
 * omnisciente): vacío si nadie la vio. El registro nunca se borra; el
 * informe final lo enseña y lo descuenta en la puntuación. */
export type IrregularKind = 'force_entry' | 'bribe' | 'impersonate';

export interface MisconductRecord {
  id: string;
  kind: IrregularKind;
  targetId: string;
  minute: number;
  seenBy: string[];
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
  /** Tipo forense del laboratorio (GDD §11): huellas, documentos,
   * fotografías, audio, muestras o materiales. Lo declaran los
   * expedientes generados nuevos; los anteriores no lo traen y el motor
   * lo deriva del tipo de la evidencia de entrada (ver forensics.ts). */
  forensicType?: string;
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
  /** Historial de envíos de la central de comunicaciones. Opcional: las
   * partidas anteriores a la central no lo traen y se comportan como si
   * estuviera vacío. */
  communications?: CommunicationRecord[];
  /** Acciones irregulares cometidas en la partida (GDD §14). Opcional:
   * las partidas anteriores no lo traen y se comportan como si estuviera
   * vacío. */
  misconduct?: MisconductRecord[];
  pendingRequests: ScheduledResult[];
  warrants: string[];
  detentions: string[];
  recoveredObjects: string[];
  pendingBatch: string[] | null;
  finalReport: FinalReport | null;
}
