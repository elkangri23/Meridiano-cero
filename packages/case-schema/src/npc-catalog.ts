// Catálogo de NPCs recurrentes, canales y consultas (T5-03)
// SPEC-008: NPC y gestiones con conocimiento/tiempos definidos

export interface NPCProfile {
  id: string;
  name: string;
  role: string;
  cityId: string;
  knowledge: string[];
  cooperation: number;
  availability: { from: number; to: number }; // minutos del reloj interno
  channels: CommunicationChannel[];
}

export type CommunicationChannel = 'verbal' | 'escrito' | 'telefonico' | 'digital';

export interface QueryType {
  id: string;
  label: string;
  costMinutes: number;
  description: string;
}

// NPCs recurrentes del equipo de investigación
export const RECURRENT_NPCS: NPCProfile[] = [
  {
    id: 'lucia', name: 'Lucía', role: 'Asistente de investigación', cityId: 'madrid',
    knowledge: ['authorized-persons', 'tomas-moved-box'],
    cooperation: 7,
    availability: { from: 0, to: 1440 },
    channels: ['verbal', 'escrito'],
  },
  {
    id: 'emile', name: 'Émile', role: 'Archivo de conservación', cityId: 'paris',
    knowledge: ['tool-registry'],
    cooperation: 5,
    availability: { from: 0, to: 1440 },
    channels: ['verbal', 'escrito'],
  },
  {
    id: 'marta', name: 'Marta', role: 'Depósito de custodia', cityId: 'lisboa',
    knowledge: ['deposit-record', 'locker-l7'],
    cooperation: 6,
    availability: { from: 0, to: 1440 },
    channels: ['verbal', 'escrito'],
  },
  {
    id: 'tomas', name: 'Tomás Ríos', role: 'Transportista', cityId: 'madrid',
    knowledge: ['his-task'],
    cooperation: 8,
    availability: { from: 0, to: 1440 },
    channels: ['verbal', 'telefonico'],
  },
  {
    id: 'ines', name: 'Inés Valera', role: 'Sospechosa', cityId: 'lisboa',
    knowledge: ['truth'],
    cooperation: 3,
    availability: { from: 0, to: 1440 },
    channels: ['verbal'],
  },
];

// Canales de comunicación disponibles
export const COMMUNICATION_CHANNELS: CommunicationChannel[] = ['verbal', 'escrito', 'telefonico', 'digital'];

// Tipos de consulta con coste en minutos
export const QUERY_TYPES: QueryType[] = [
  { id: 'registry', label: 'Registro de herramientas', costMinutes: 30, description: 'Consulta el registro de herramientas del archivo.' },
  { id: 'deposit', label: 'Registro de depósito', costMinutes: 30, description: 'Consulta el registro del depósito de custodia.' },
  { id: 'manifest', label: 'Manifiesto de carga', costMinutes: 30, description: 'Consulta el manifiesto de carga del transportista.' },
  { id: 'witness', label: 'Testimonio', costMinutes: 30, description: 'Consulta un testimonio disponible.' },
];

export function getNPC(id: string): NPCProfile | undefined {
  return RECURRENT_NPCS.find(npc => npc.id === id);
}

export function getNPCsByCity(cityId: string): NPCProfile[] {
  return RECURRENT_NPCS.filter(npc => npc.cityId === cityId);
}

export function getQueryType(id: string): QueryType | undefined {
  return QUERY_TYPES.find(q => q.id === id);
}

export function getChannelCost(channel: CommunicationChannel): number {
  // Coste base en minutos por canal
  switch (channel) {
    case 'verbal': return 0;
    case 'escrito': return 0;
    case 'telefonico': return 30;
    case 'digital': return 30;
  }
}

export function searchNPCs(query: string): NPCProfile[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];
  return RECURRENT_NPCS.filter(npc =>
    npc.name.toLowerCase().includes(q) ||
    npc.role.toLowerCase().includes(q) ||
    npc.knowledge.some(k => k.toLowerCase().includes(q))
  );
}