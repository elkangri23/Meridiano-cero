import { describe, it, expect } from 'vitest';
import {
  RECURRENT_NPCS, COMMUNICATION_CHANNELS, QUERY_TYPES, getNPC, getNPCsByCity, getQueryType,
  getChannelCost, searchNPCs,
} from './npc-catalog.js';

describe('npc-catalog', () => {
  it('contiene NPCs recurrentes con conocimiento definido', () => {
    expect(RECURRENT_NPCS.length).toBeGreaterThanOrEqual(5);
    const lucia = getNPC('lucia');
    expect(lucia).toBeDefined();
    expect(lucia?.knowledge).toContain('authorized-persons');
  });

  it('getNPCsByCity devuelve NPCs de la ciudad correcta', () => {
    const madridNPCs = getNPCsByCity('madrid');
    expect(madridNPCs.length).toBeGreaterThanOrEqual(1);
    expect(madridNPCs.every(npc => npc.cityId === 'madrid')).toBe(true);
  });

  it('getQueryType devuelve el tipo de consulta correcto', () => {
    const registry = getQueryType('registry');
    expect(registry).toBeDefined();
    expect(registry?.costMinutes).toBe(30);
    expect(registry?.label).toBe('Registro de herramientas');
  });

  it('getQueryType devuelvo undefined para consulta inexistente', () => {
    expect(getQueryType('inexistente')).toBeUndefined();
  });

  it('getChannelCost devuelve costes no negativos', () => {
    for (const channel of COMMUNICATION_CHANNELS) {
      expect(getChannelCost(channel)).toBeGreaterThanOrEqual(0);
    }
  });

  it('searchNPCs encuentra por nombre', () => {
    const results = searchNPCs('Luc');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.name).toBe('Lucía');
  });

  it('searchNPCs encuentra por conocimiento', () => {
    const results = searchNPCs('tool-registry');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect(first?.knowledge).toContain('tool-registry');
  });

  it('searchNPCs con consulta vacío devuelve vacío', () => {
    expect(searchNPCs('')).toEqual([]);
  });

  it('QUERY_TYPES tiene costes positivos', () => {
    for (const query of QUERY_TYPES) {
      expect(query.costMinutes).toBeGreaterThan(0);
    }
  });

  it('RECURRENT_NPCS tiene IDs únicos', () => {
    const ids = RECURRENT_NPCS.map(npc => npc.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(RECURRENT_NPCS.length);
  });
});