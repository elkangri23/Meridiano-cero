export * from './types.js';
export * from './validator.js';
export { LEGACY_ASTROLABIO_ID, legacyAstrolabioSuspect } from './legacy-astrolabio.js';
// Re-export catalog types without duplication - catalog.ts re-exports types from types.js
export { validateCatalogParams, getBudgetForParams, getSuggestedDuration, type CatalogParams, type CatalogValidationResult } from './catalog.js';
export { GEOGRAPHIC_CATALOG, DEFAULT_TRAVEL_ROUTES, getCity, getRoute, getReachableCities, searchCities, type GeographicCity, type TravelRoute } from './geography-catalog.js';
export { RECURRENT_NPCS, COMMUNICATION_CHANNELS, QUERY_TYPES, getNPC, getNPCsByCity, getQueryType, getChannelCost, searchNPCs, type NPCProfile, type CommunicationChannel, type QueryType } from './npc-catalog.js';
export { calculateCaseOutcome, createInitialCareer, applyOutcome, applySanction, resolveSanction, getActiveSanctions, getRank, type CaseResult, type CareerRecord, type SanctionRecord, type CaseOutcome } from './career.js';
