// Textos legibles del caso fijo: cada identificador que el motor puede
// revelar tiene su frase (SPEC-003). Si el motor revela algo sin texto, el
// jugador vería un ID crudo: este test lo impide para el caso fijo.
import { describe, expect, it } from 'vitest';
import { RECURRENT_NPCS } from './npc-catalog.js';
import {
  EVIDENCE_TEXTS, KNOWLEDGE_TEXTS, NPC_GREETINGS, NPC_REFUSALS, OBJECTIVE_TEXT,
  REPORT_REASON_TEXT, REPORT_RESULT_TEXT, conversationRecordText,
  discoveryText, evidenceText, hasKnowledgeContent, isKnowledgeLabelText, knowledgeContentAnchors, npcGreeting, npcKnowledgeFacts, npcRefusal,
  objectiveText, reportReasonText, reportResultText, travelText,
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
    expect(conversationRecordText('communication_sent:req-2:email:lucia@10', lookup.npcName))
      .toBe('Enviaste un mensaje a Lucía por correo (min 10).');
    expect(conversationRecordText('communication_sent:req-3:call:tomas:EV-02@40', lookup.npcName, id => id === 'EV-02' ? 'La cerradura de la vitrina tiene residuo de herramienta.' : undefined))
      .toBe('Enviaste a Tomás Ríos por llamada el documento «La cerradura de la vitrina tiene residuo de herramienta.» (min 40).');
    expect(conversationRecordText('communication_sent:req-3:call:tomas:EV-02@40', lookup.npcName))
      .toBe('Enviaste a Tomás Ríos por llamada el documento «EV-02» (min 40).');
    expect(conversationRecordText('communication_sent:req-2:email:desconocido@10', lookup.npcName))
      .toBe('communication_sent:req-2:email:desconocido@10');
    expect(conversationRecordText('algo-raro', lookup.npcName)).toBe('algo-raro');
  });

  it('los marcadores de conducta irregular se leen como frases, nunca como claves crudas', () => {
    expect(discoveryText('forced-entry', lookup)).toBe('Acceso forzado: entraste sin permiso ni orden de acceso.');
    expect(discoveryText('warning', lookup)).toContain('Advertencia de A.C.M.E.');
    expect(discoveryText('warning', lookup)).toContain('retirarán el caso');
    expect(conversationRecordText('irregular:force_entry:LIS-ALM@150', lookup.npcName, undefined, lookup.locationName))
      .toBe('Forzaste el acceso a Almacén de depósito (min 150).');
    expect(conversationRecordText('irregular:bribe:lucia@30', lookup.npcName)).toBe('Sobornaste a Lucía (min 30).');
    expect(conversationRecordText('irregular:impersonate:tomas@60', lookup.npcName))
      .toBe('Suplantaste a alguien hablando con Tomás Ríos (min 60).');
    expect(conversationRecordText('warning:irr-1@150', lookup.npcName))
      .toBe('Advertencia de A.C.M.E. (min 150): te han visto en una acción irregular.');
    expect(conversationRecordText('irregular:bribe:desconocido@30', lookup.npcName))
      .toBe('irregular:bribe:desconocido@30');
  });

  it('solo Inés tiene negativa en personaje, y negarse no revela la solución', () => {
    expect(Object.keys(NPC_REFUSALS)).toEqual(['ines']);
    expect(npcRefusal('ines')).toBe('No voy a declarar sobre el robo.');
    expect(npcRefusal('tomas')).toBeUndefined();
    expect(npcRefusal('marta')).toBeUndefined();
    expect(NPC_REFUSALS.ines).not.toMatch(/culpable|robé|robaste|astrolabio.*(tengo|tiene|está)/i);
  });

  it('el primer viaje a cada ciudad se lee como frase, nunca como clave cruda', () => {
    // El motor registra el primer viaje como descubrimiento `travel:<ciudad>`.
    for (const city of ['madrid', 'paris', 'lisboa'] as const) {
      const text = discoveryText(`travel:${city}`, lookup);
      expect(text, city).not.toBe(`travel:${city}`);
      expect(text, city).not.toMatch(/travel:/);
      expect(text, city).toContain(lookup.cityName(city));
    }
    expect(discoveryText('travel:desconocida', lookup)).toBe('Viaje realizado.');
  });

  it('la frase de viaje nombra el origen y el destino', () => {
    expect(travelText('Madrid', 'París')).toBe('Sales de Madrid y llegas a París.');
    expect(travelText('París', 'Madrid')).toBe('Sales de París y llegas a Madrid.');
    expect(travelText(undefined, 'Lisboa')).toBe('Llegas a Lisboa.');
    // Sin cambio de ciudad no hay desplazamiento que narrar.
    expect(travelText('Madrid', 'Madrid')).toBe('Llegas a Madrid.');
  });

  it('el informe final se lee en español: resultado, motivo y objetivos', () => {
    // El motor devuelve identificadores en inglés; la pantalla nunca los enseña tal cual.
    expect(Object.keys(REPORT_RESULT_TEXT).sort()).toEqual(['complete', 'incorrect', 'partial', 'unresolved']);
    expect(reportResultText('complete')).toBe('completado');
    expect(reportResultText('partial')).toBe('parcial');
    expect(reportResultText('incorrect')).toBe('incorrecto');
    expect(reportResultText('unresolved')).toBe('sin resolver');
    expect(Object.keys(REPORT_REASON_TEXT).sort()).toEqual(['deadline', 'finished', 'withdrawn']);
    expect(reportReasonText('finished')).toBe('finalizado');
    expect(reportReasonText('deadline')).toBe('plazo agotado');
    expect(reportReasonText('withdrawn')).toBe('retirado por A.C.M.E.');
    expect(Object.keys(OBJECTIVE_TEXT).sort()).toEqual(['obj-detener', 'obj-recuperar']);
    expect(objectiveText('obj-detener')).toBe('Detener a Inés con orden válida');
    expect(objectiveText('obj-recuperar')).toBe('Recuperar el astrolabio original');
    // Sin texto no se oculta el valor: se devuelve tal cual (casos generados).
    expect(reportResultText('desconocido')).toBe('desconocido');
    expect(reportReasonText('desconocido')).toBe('desconocido');
    expect(objectiveText('obj-desconocido')).toBe('obj-desconocido');
    // Nada en español a medias: ningún texto del informe lleva literales en inglés.
    for (const text of [...Object.values(REPORT_RESULT_TEXT), ...Object.values(REPORT_REASON_TEXT), ...Object.values(OBJECTIVE_TEXT)]) {
      expect(text).not.toMatch(/\b(complete|partial|incorrect|unresolved|finished|deadline)\b|obj-/);
    }
  });
});

describe('detector de textos-etiqueta de conocimiento', () => {
  it('detecta las etiquetas de tema de los casos generados', () => {
    for (const label of [
      'Información sobre traslados y movimientos de objetos valiosos.',
      'Conocimiento del mercado de antigüedades y canales de venta.',
      'Datos sobre los registros de acceso.',
      'Descripción de los movimientos en Bilbao.',
    ]) expect(isKnowledgeLabelText(label), label).toBe(true);
  });
  it('acepta las frases en primera persona y todos los textos del caso fijo', () => {
    for (const text of [
      'Conozco el mercado de antigüedades y los canales de venta.',
      'Sé que el cuaderno estuvo en Barcelona.',
      'Llevo el registro de herramientas del archivo y puedo comprobar a quién se asignó cada herramienta.',
      'La taquilla L-7 es un depósito de custodia del almacén.',
      ...Object.values(KNOWLEDGE_TEXTS),
    ]) expect(isKnowledgeLabelText(text), text).toBe(false);
  });
});

describe('contenido real en textos de conocimiento (tercera vuelta)', () => {
  const anchors = knowledgeContentAnchors({
    locations: [
      { name: 'Archivo de conservación', description: 'Archivo de conservación de París' },
      { name: 'Taller del anticuario', description: 'Taller con inventario de piezas y caja de transporte' },
    ],
    cities: [{ name: 'París' }, { name: 'Málaga' }],
    npcs: [{ name: 'Marcos', persona: 'Comerciante de antigüedades de Málaga' }],
    evidenceTexts: [
      'La etiqueta de envío del archivo indica el destino del manuscrito.',
      'El registro de seguridad anota quién entró en el taller.',
    ],
    greetings: ['Soy Marcos, comerciante de antigüedades.'],
    briefing: ['El manuscrito desapareció del archivo de conservación.'],
    labels: ['Inspeccionar el taller', 'Consultar el registro de seguridad'],
  });
  it('rechaza la paráfrasis del tema sin ancla al mundo (el defecto de Marcos)', () => {
    for (const text of [
      'Conozco bien el mercado de antigüedades y los canales de venta, así como los traslados y movimientos de objetos valiosos por la zona.',
      'Sé de los traslados y movimientos de objetos valiosos que se dan por esta zona.',
      'Conozco el mercado de antigüedades y los canales de venta.',
    ]) expect(hasKnowledgeContent(text, anchors), text).toBe(false);
  });
  it('acepta textos que nombran un elemento concreto del mundo', () => {
    for (const text of [
      'Vi a Marcos en el taller, junto a la caja de transporte del manuscrito.',
      'La etiqueta de envío del archivo indica el destino del manuscrito.',
      'Llevo el registro de seguridad del taller y anoto quién entra.',
      'Sé que el manuscrito estuvo en Málaga antes de desaparecer.',
    ]) expect(hasKnowledgeContent(text, anchors), text).toBe(true);
  });
});
