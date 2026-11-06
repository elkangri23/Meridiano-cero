// La charla libre con NPC generados llegaba al director sin hechos ni
// persona (la web solo conocía el catálogo fijo del astrolabio): cada
// pregunta salía como «He registrado tu consulta.». La vista del jugador
// lleva ahora los datos de conversación de cada personaje, construidos
// desde la definición del caso en curso.
import { describe, expect, it } from 'vitest';
import type { CaseDefinition } from '@meridiano/case-schema';
import { astrolabioDefinition } from '@meridiano/engine';
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
  });
});
