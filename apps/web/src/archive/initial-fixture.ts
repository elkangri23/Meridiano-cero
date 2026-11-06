import type { PlayerViewDto } from '@meridiano/contracts';

export const initialView: PlayerViewDto = {
  schemaVersion: 1, runId: '22222222-2222-4222-8222-222222222222', branchId: '33333333-3333-4333-8333-333333333333', version: 1,
  status: 'active', caseId: 'astrolabio-tres-ciudades', difficulty: 'normal', clock: { minute: 0, deadlineMinutes: 100 }, briefing: null,
  caseMeta: { crimeType: 'robo', contentRating: 'familiar' },
  position: { city: { id: 'synthetic-city', name: 'Ciudad sintética', country: 'País de prueba' },
    location: { id: 'synthetic-room', name: 'Sala sintética', description: 'Descripción pública de prueba.' } },
  cities: [{ id: 'synthetic-city', name: 'Ciudad sintética', country: 'País de prueba' }],
  locations: [{ id: 'synthetic-room', name: 'Sala sintética', description: 'Descripción pública de prueba.' }],
  objects: [], dossier: [], conversation: [], pendingRequests: [], warrants: [], detentions: [], batch: null, finalReport: null, officialResult: null,
  npcChat: [],
  objectives: [
    { id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: false },
    { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false },
  ], offers: [],
  saveCapabilities: { manualLimit: 10, manualCount: 0, canSave: true, canLoad: false },
  recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
};
