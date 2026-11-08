export * from './types.js';
export * from './validator.js';
export { LEGACY_ASTROLABIO_ID, legacyAstrolabioSuspect } from './legacy-astrolabio.js';
// El catálogo vive en `@meridiano/contracts` (`catalog.ts`); se
// re-exporta aquí para el motor, la API y el generador.
export { validateCatalogParams, getBudgetForParams, getSuggestedDuration, deadlineMinutesForDifficulty, DIFFICULTY_DEADLINE_FACTOR, GDD_CRIME_TYPES, GENERAL_ONLY_CRIMES, crimeAllowedForRating, CRIME_TYPE_KEYS, CONTENT_RATING_KEYS, caseLabel, type CatalogParams, type CatalogValidationResult, type Duration, type CrimeType, type ContentRating } from '@meridiano/contracts';
export { GEOGRAPHIC_CATALOG, DEFAULT_TRAVEL_ROUTES, getCity, getRoute, getReachableCities, searchCities, type GeographicCity, type TravelRoute } from './geography-catalog.js';
export { RECURRENT_NPCS, COMMUNICATION_CHANNELS, REMOTE_CHANNELS, REMOTE_CHANNEL_LABELS, QUERY_TYPES, getNPC, getNPCsByCity, getQueryType, getChannelCost, searchNPCs, type NPCProfile, type CommunicationChannel, type RemoteChannel, type QueryType } from '@meridiano/contracts';
export { channelsForNpc, isRemoteChannel, normalizeRemoteChannels, isCommunicationRecord, LEGACY_REMOTE_CHANNELS, DOCUMENT_SEND_MINUTES, IRREGULAR_MINUTES, IRREGULAR_KINDS, isIrregularKind, isMisconductRecord } from './communications.js';
export { calculateCaseOutcome, outcomeFromReport, createInitialCareer, applyOutcome, applySanction, resolveSanction, getActiveSanctions, getRank, rankForTotals, reputationLabel, deriveCareerProfile, type CaseResult, type CareerRecord, type SanctionRecord, type CaseOutcome, type CareerResultEntry, type DerivedCareerProfile } from './career.js';
export { createDefaultPreferences, normalizePreferences, clampScale, clampVolume, clampRate, createPreferenceStore, type PresentationPreferences, type FontMode, type PaletteMode, type Language, type AudioSettings, type TTSSettings, type AccessibilitySettings, type PreferenceStore, type StorageLike } from '@meridiano/contracts';
export { createTTSController, createNoopTTSController, type TTSController, type TTSVoice, type TTSStatus, type TTSOptions } from '@meridiano/contracts';
export { CAREER_VERSION, isCareerVersionCompatible, assertCasesIsolated, sanitizeText } from './borders.js';
export type { VersionedOutcome, CaseRunSummary, TextSanitizationOptions, SanitizedText, TTSSession } from './borders.js';
export { createTTSSession } from './borders.js';
export { validateCatalogBoundary, validateCareerBoundary } from './catalog-bounds.js';
export type { CatalogBoundaryResult, CareerBoundaryResult } from './catalog-bounds.js';
export { runInitialSetup, runHealthChecks, getAdminPanelConfig, type SetupConfig, type AiProviderConfig, type SetupResult, type HealthCheckResult, type AdminPanelConfig } from './setup-admin.js';
export { hashPassword, verifyPassword } from './auth-utils.js';
export { planMigrations, runHealthReport, checkSaveCompatibility, RUNBOOK_CLEAN_INSTALL, RUNBOOK_MIGRATION_UPGRADE, RUNBOOK_ROLLBACK, type MigrationPlan, type HealthReport, type SaveCompatibilityResult, type RunbookStep } from './migration-health.js';
export { createBackupConfig, runFullBackup, runIncrementalBackup, restoreBackup, measureRPO_RTO, recordRestoreTest, computeChecksum, type BackupConfig, type BackupMetadata, type RestoreResult, type RPO_RTO_Metrics } from './backup-restore.js';export { EVIDENCE_TEXTS, KNOWLEDGE_TEXTS, NPC_GREETINGS, NPC_REFUSALS, OBJECTIVE_TEXT, REPORT_REASON_KEYS, REPORT_RESULT_KEYS, IRREGULAR_KIND_KEYS, resolveMessage, evidenceText, npcKnowledgeFacts, npcGreeting, npcRefusal, discoveryText, conversationRecordText, travelText, reportResultText, reportReasonText, objectiveText, isKnowledgeLabelText, knowledgeContentAnchors, hasKnowledgeContent, type KnowledgeContentWorld, type KnowledgeContentAnchors, type DiscoveryLookup, type CaseTexts } from '@meridiano/contracts';
export { validateMechanics } from './validation-mechanics.js';
export { FORENSIC_TYPES, FORENSIC_TYPE_KEYS, isForensicType, type ForensicType } from '@meridiano/contracts';
export { forensicTypeForEvidenceType, forensicTypeForAnalysis } from './forensics.js';
export { ARREST_TYPES, ARREST_COORDINATION_MINUTES, arrestTypeOf, arrestTypeForCaseId, isArrestType, type ArrestType } from './arrest.js';
export { TEAM_MEMBERS, TEAM_MEMBER_IDS, TEAM_SERVICES, teamMember, isTeamMemberId, isTeamServiceId, isTeamRecord } from '@meridiano/contracts';
export { FAMILY_FORBIDDEN_TERMS, validateGeneratedContent } from './validation-content.js';
