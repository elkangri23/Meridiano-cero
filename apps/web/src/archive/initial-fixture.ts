import type { InitialPlayerViewDto } from '@meridiano/contracts';

export const initialView: InitialPlayerViewDto = {
  schemaVersion: 1, runId: '22222222-2222-4222-8222-222222222222', branchId: '33333333-3333-4333-8333-333333333333', version: 1,
  status: 'active', clock: { minute: 0, deadlineMinutes: 100 },
  position: { city: { id: 'synthetic-city', name: 'Ciudad sintética', country: 'País de prueba' },
    location: { id: 'synthetic-room', name: 'Sala sintética', description: 'Descripción pública de prueba.' } },
  cities: [{ id: 'synthetic-city', name: 'Ciudad sintética', country: 'País de prueba' }],
  locations: [{ id: 'synthetic-room', name: 'Sala sintética', description: 'Descripción pública de prueba.' }],
  objects: [], dossier: [], conversation: [], pendingRequests: [], warrants: [], detentions: [], batch: null, finalReport: null, officialResult: null,
  saveCapabilities: { manualLimit: 10, manualCount: 0, canSave: false, canLoad: false },
  recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
};
