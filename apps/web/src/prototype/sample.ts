import type { PlayerView } from '@meridiano/contracts';

// Public presentation data only: never import the complete engine fixture here.
export const sampleView: PlayerView = {
  runId: 'T3_PUBLIC_PREVIEW_ONLY', version: 1, minute: 40, deadlineMinutes: 2880,
  position: { cityId: 'madrid', locationId: 'MAD-SALA' },
  visibleCities: ['madrid', 'paris', 'lisboa'], discoveredLocations: ['MAD-SALA'],
  discoveredObjects: [], dossier: ['observacion-sala'],
  conversation: ['La sala de embalaje está en silencio. Sobre la mesa hay una caja de transporte y una carpeta de recepción.'],
  pendingRequests: [], warrants: [], detentions: [], finalReport: null,
};
export const destinations = [
  { id: 'madrid', name: 'Madrid', country: 'España', x: 43, y: 67 },
  { id: 'paris', name: 'París', country: 'Francia', x: 59, y: 29 },
  { id: 'lisboa', name: 'Lisboa', country: 'Portugal', x: 23, y: 75 },
] as const;
export type Tool = 'dossier' | 'mapa' | 'laboratorio' | 'comunicaciones' | 'ajustes';
export const tools: { id: Tool; label: string; short: string }[] = [
  { id: 'dossier', label: 'Dossier', short: '01' },
  { id: 'mapa', label: 'Atlas y viajes', short: '02' },
  { id: 'laboratorio', label: 'Laboratorio', short: '03' },
  { id: 'comunicaciones', label: 'Comunicaciones', short: '04' },
  { id: 'ajustes', label: 'Lectura y contraste', short: '05' },
];
export function clockLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  return String(hours).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}
