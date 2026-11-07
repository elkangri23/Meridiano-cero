import type { PlayerViewDto } from '@meridiano/contracts';

/** Resolución de nombres para traducir hallazgos (la misma forma que el
 * `DiscoveryLookup` de case-schema, sin importar el paquete: la pantalla de
 * juego ya trae `discoveryText` y lo pasa aquí). */
export interface ResumeLookup {
  locationName: (id: string) => string | undefined;
  cityName: (id: string) => string | undefined;
  npcName: (id: string) => string | undefined;
}

/** Resumen al retomar la partida (§13): dónde se quedó el jugador, construido
 * solo con datos reales de la vista del jugador y del estado del motor — sin
 * inventar nada. Las ciudades visitadas son la actual más las que aparecen
 * en los viajes registrados en el dossier (`travel:<ciudad>`); los últimos
 * descubrimientos son las entradas del dossier traducidas con el mismo
 * `discoveryText` del dossier, no sus IDs crudos. El `lookup` y el
 * `discover` son los que ya usa la pantalla de juego para traducir
 * hallazgos; este módulo no importa case-schema. */
export interface ResumeSummary {
  minute: number;
  deadlineMinutes: number;
  remainingMinutes: number;
  currentCity: string;
  currentLocation: string;
  visitedCities: string[];
  objectives: Array<{ description: string; achieved: boolean }>;
  lastDiscoveries: string[];
  detentions: number;
  warrants: number;
  pendingRequests: Array<{ type: 'analysis' | 'query' | 'request'; dueMinute: number }>;
}

export function resumeSummary(view: PlayerViewDto, lookup: ResumeLookup, discover: (id: string, lookup: ResumeLookup) => string): ResumeSummary {
  const visited = new Set<string>([view.position.city.id]);
  for (const entry of view.dossier) {
    if (entry.startsWith('travel:')) visited.add(entry.slice('travel:'.length));
  }
  const cityName = (id: string) => view.cities.find(city => city.id === id)?.name ?? id;
  return {
    minute: view.clock.minute,
    deadlineMinutes: view.clock.deadlineMinutes,
    remainingMinutes: Math.max(0, view.clock.deadlineMinutes - view.clock.minute),
    currentCity: view.position.city.name,
    currentLocation: view.position.location.name,
    visitedCities: [...visited].map(cityName),
    objectives: view.objectives.map(objective => ({ description: objective.description, achieved: objective.achieved })),
    lastDiscoveries: view.dossier.slice(-5).map(entry => discover(entry, lookup)),
    detentions: view.detentions.length,
    warrants: view.warrants.length,
    pendingRequests: view.pendingRequests.map(request => ({ type: request.type, dueMinute: request.dueMinute })),
  };
}
