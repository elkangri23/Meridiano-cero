// Textos legibles del caso fijo: cada identificador que el motor puede
// revelar tiene su frase (SPEC-003). Si el motor revela algo sin texto, el
// jugador vería un ID crudo: este test lo impide para el caso fijo.
import { describe, expect, it } from 'vitest';
import { RECURRENT_NPCS } from './npc-catalog.js';
import {
  EVIDENCE_TEXTS, KNOWLEDGE_TEXTS, NPC_GREETINGS, conversationRecordText,
  discoveryText, evidenceText, npcGreeting, npcKnowledgeFacts,
} from './fact-texts.js';

const lookup = {
  locationName: (id: string) => ({ 'MAD-SALA': 'Sala de embalaje', 'PAR-ARCH': 'Archivo de conservación', 'LIS-ALM': 'Almacén de depósito' }[id]),
  cityName: (id: string) => ({ madrid: 'Madrid', paris: 'París', lisboa: 'Lisboa' }[id]),
  npcName: (id: string) => ({ lucia: 'Lucía', emile: 'Émile', marta: 'Marta', tomas: 'Tomás Ríos', ines: 'Inés Valera' }[id]),
};

describe('textos legibles del caso fijo', () => {
  it('todas las evidencias EV-01..EV-11 tienen texto sin spoilers de la solución', () => {
    for (let n = 1; n <= 11; n++) {
      const id = `EV-${String(n).padStart(2, '0')}`;
      const text = evidenceText(id);
      expect(text, id).toBeTruthy();
      expect(text, id).not.toMatch(/Inés (es|fue) la culpable|la culpable es/i);
    }
    expect(Object.keys(EVIDENCE_TEXTS)).toHaveLength(11);
  });

  it('cada personaje tiene saludo y cada conocimiento suyo tiene hecho declarable', () => {
    for (const npc of RECURRENT_NPCS) {
      expect(npcGreeting(npc.id), npc.id).toBeTruthy();
      expect(NPC_GREETINGS[npc.id], npc.id).toBeTruthy();
      const facts = npcKnowledgeFacts(npc.id);
      expect(facts.map(fact => fact.id).sort()).toEqual([...npc.knowledge].sort());
      for (const fact of facts) {
        expect(fact.text.length, fact.id).toBeGreaterThan(10);
        expect(KNOWLEDGE_TEXTS[fact.id], fact.id).toBe(fact.text);
      }
    }
  });

  it('ningún hallazgo del motor se muestra como ID crudo', () => {
    const ids = [
      'EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11',
      'MAD-SALA', 'PAR-ARCH', 'LIS-ALM', 'madrid', 'paris', 'lisboa',
      'identity:lucia', 'identity:tomas', 'identity:ines', 'location:tomas', 'location:ines',
      'analysis:EV-03', 'communication_received:req-2', 'warrant-denied:req-3',
    ];
    for (const id of ids) {
      const text = discoveryText(id, lookup);
      expect(text, id).not.toBe(id);
      expect(text.length, id).toBeGreaterThan(5);
    }
    // Un identificador desconocido se devuelve tal cual: nunca se oculta.
    expect(discoveryText('algo-nuevo', lookup)).toBe('algo-nuevo');
  });

  it('los registros de conversación se leen como frases', () => {
    expect(conversationRecordText('talk:tomas@0', lookup.npcName)).toBe('Hablaste con Tomás Ríos (min 0).');
    expect(conversationRecordText('talk:lucia@30', lookup.npcName)).toBe('Hablaste con Lucía (min 30).');
    expect(conversationRecordText('communication_received:req-2@30', lookup.npcName)).toBe('Respuesta recibida (min 30).');
    expect(conversationRecordText('algo-raro', lookup.npcName)).toBe('algo-raro');
  });
});
