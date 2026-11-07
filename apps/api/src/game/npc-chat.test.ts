// La charla libre con NPC generados llegaba al director sin hechos ni
// persona (la web solo conocía el catálogo fijo del astrolabio): cada
// pregunta salía como «He registrado tu consulta.». La vista del jugador
// lleva ahora los datos de conversación de cada personaje, construidos
// desde la definición del caso en curso.
import { describe, expect, it } from 'vitest';
import type { CaseDefinition } from '@meridiano/case-schema';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition, createInitialRun } from '@meridiano/engine';
import { npcChatForDefinition } from './npc-chat.ts';

function generatedDefinition(): CaseDefinition {
  const definition = structuredClone(astrolabioDefinition) as unknown as CaseDefinition;
  definition.npcs = [
    { id: 'marcos', name: 'Marcos', cityId: 'bilbao',
      knowledge: ['mercado-negro', 'movimiento-objeto'], cooperation: 6,
      role: 'Comerciante', persona: 'Soy comerciante y conozco el mercado de antigüedades de la zona.' },
    { id: 'elena', name: 'Elena', cityId: 'barcelona',
      knowledge: ['restauracion', 'sin-texto'], cooperation: 4,
      role: 'Restauradora', persona: 'Soy restauradora y trabajo con piezas históricas.' },
  ];
  definition.texts = {
    evidence: {},
    knowledge: {
      'mercado-negro': 'Conocimiento del mercado de antigüedades y canales de venta.',
      'movimiento-objeto': 'Información sobre traslados y movimientos de objetos valiosos.',
      restauracion: 'Conocimiento sobre técnicas de restauración de piezas históricas.',
    },
    greetings: {
      marcos: 'Buenos días, soy Marcos. Me dedico al comercio de antigüedades.',
      elena: 'Hola, soy Elena. Trabajo como restauradora con piezas históricas.',
    },
  };
  return definition;
}

describe('datos de conversación de los NPC (npcChat)', () => {
  it('un NPC generado trae persona, conocimiento con textos, saludo y hecho de identidad', () => {
    const [marcos] = npcChatForDefinition(generatedDefinition());
    expect(marcos).toMatchObject({
      id: 'marcos',
      name: 'Marcos',
      role: 'Comerciante',
      persona: 'Soy comerciante y conozco el mercado de antigüedades de la zona.',
      greeting: 'Buenos días, soy Marcos. Me dedico al comercio de antigüedades.',
    });
    expect(marcos?.refusal).toBeUndefined();
    // La identidad va primero: sin ella el modelo no puede responder
    // «¿Cómo te llamas?» con `state` (el director exige un hecho).
    expect(marcos?.knowledge[0]).toEqual({ id: 'identity', text: 'Soy Marcos, Comerciante.' });
    expect(marcos?.knowledge.slice(1)).toEqual([
      { id: 'mercado-negro', text: 'Conocimiento del mercado de antigüedades y canales de venta.' },
      { id: 'movimiento-objeto', text: 'Información sobre traslados y movimientos de objetos valiosos.' },
    ]);
    // Sin canales declarados ni entrada en el catálogo: llamada y correo.
    expect(marcos?.channels).toEqual(['call', 'email']);
  });

  it('un hecho de conocimiento sin texto no se ofrece (y no rompe la entrada)', () => {
    const [, elena] = npcChatForDefinition(generatedDefinition());
    expect(elena?.knowledge).toEqual([
      { id: 'identity', text: 'Soy Elena, Restauradora.' },
      { id: 'restauracion', text: 'Conocimiento sobre técnicas de restauración de piezas históricas.' },
    ]);
  });

  it('el caso fijo usa el catálogo: Inés confirma su identidad y se niega sobre el robo', () => {
    const entries = npcChatForDefinition(astrolabioDefinition);
    expect(entries.map(entry => entry.id)).toEqual(['lucia', 'emile', 'marta', 'tomas', 'ines']);
    const ines = entries.find(entry => entry.id === 'ines');
    expect(ines).toMatchObject({
      name: 'Inés Valera',
      role: 'Sospechosa',
      persona: 'Sospechosa. Restauradora contratada para el traslado del astrolabio. Confirma su identidad y su tarea, pero se niega a declarar sobre el robo.',
      greeting: 'Soy Inés Valera, restauradora. Puedo confirmar mi identidad, pero no voy a declarar sobre el robo.',
      refusal: 'No voy a declarar sobre el robo.',
    });
    // Sin hecho de identidad sintético: su identidad ya la cubre `truth`
    // y su respuesta debe seguir siendo esa frase, no una sintética.
    expect(ines?.knowledge).toEqual([
      { id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' },
    ]);
    // Inés no tiene ningún canal remoto: la central no la ofrece.
    expect(ines?.channels).toEqual([]);
    const lucia = entries.find(entry => entry.id === 'lucia');
    expect(lucia?.channels).toEqual(['email', 'fax']);
    const tomas = entries.find(entry => entry.id === 'tomas');
    expect(tomas?.channels).toEqual(['call', 'whatsapp', 'sms']);
  });

  it('con conducta irregular, cada personaje lleva solo lo que sabe de verdad', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', '22222222-2222-4222-8222-222222222222',
      hashDefinition(astrolabioDefinition));
    const withMisconduct = { ...run, misconduct: [
      { id: 'irr-1', kind: 'bribe' as const, targetId: 'lucia', minute: 30, seenBy: ['tomas'] },
      { id: 'irr-2', kind: 'force_entry' as const, targetId: 'LIS-ALM', minute: 150, seenBy: ['marta', 'ines'] },
    ] };
    const entries = npcChatForDefinition(astrolabioDefinition, withMisconduct);
    const lucia = entries.find(entry => entry.id === 'lucia');
    expect(lucia?.knowledge).toContainEqual({ id: 'misconduct:irr-1', text: 'El detective intentó sobornarme en el minuto 30.' });
    const tomas = entries.find(entry => entry.id === 'tomas');
    expect(tomas?.knowledge).toContainEqual({ id: 'misconduct:irr-1', text: 'Vi al detective sobornar a Lucía en el minuto 30.' });
    const marta = entries.find(entry => entry.id === 'marta');
    expect(marta?.knowledge).toContainEqual({ id: 'misconduct:irr-2', text: 'Vi al detective forzar el acceso a Almacén de depósito en el minuto 150.' });
    // Émile no sabe nada de esto: no estaba ni fue objetivo.
    const emile = entries.find(entry => entry.id === 'emile');
    expect(emile?.knowledge.some(fact => fact.id.startsWith('misconduct:'))).toBe(false);
    // Sin partida no hay hechos de conducta.
    expect(npcChatForDefinition(astrolabioDefinition).every(entry =>
      entry.knowledge.every(fact => !fact.id.startsWith('misconduct:')))).toBe(true);
  });

  it('con una detención, los testigos de la ciudad y el detenido llevan el hecho', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', '22222222-2222-4222-8222-222222222222',
      hashDefinition(astrolabioDefinition));
    // Tomás detenido en Madrid: Lucía (Madrid) lo vio; Inés (Lisboa), no.
    const withDetention = { ...run, detentions: ['tomas'] };
    const entries = npcChatForDefinition(astrolabioDefinition, withDetention);
    const lucia = entries.find(entry => entry.id === 'lucia');
    expect(lucia?.knowledge).toContainEqual({ id: 'arrest:tomas', text: 'Las autoridades detuvieron a Tomás Ríos por orden de A.C.M.E.' });
    const tomas = entries.find(entry => entry.id === 'tomas');
    expect(tomas?.knowledge).toContainEqual({ id: 'arrest:tomas', text: 'Las autoridades me detuvieron por orden de A.C.M.E.' });
    const ines = entries.find(entry => entry.id === 'ines');
    expect(ines?.knowledge.some(fact => fact.id.startsWith('arrest:'))).toBe(false);
    // Sin partida no hay hechos de detención.
    expect(npcChatForDefinition(astrolabioDefinition).every(entry =>
      entry.knowledge.every(fact => !fact.id.startsWith('arrest:')))).toBe(true);
  });
});
