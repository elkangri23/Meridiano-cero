// La charla libre con NPC generados llegaba al director sin hechos ni
// persona (la web solo conocía el catálogo fijo): cada pregunta salía
// como «He registrado tu consulta.». La vista trae ahora los datos por
// personaje (`npcChat`) y estos resolutores les dan precedencia sobre el
// respaldo del catálogo, que quien llama pasa como argumento.
import { describe, expect, it } from 'vitest';
import type { PlayerViewDto } from '@meridiano/contracts';
import { chatFacts, chatGreeting, chatNpcName, chatPersona, chatRefusal, chatRole, findChatEntry } from './npc-chat';

const marcos = {
  id: 'marcos',
  name: 'Marcos',
  role: 'Comerciante',
  persona: 'Soy comerciante y conozco el mercado de antigüedades de la zona.',
  knowledge: [
    { id: 'identity', text: 'Soy Marcos, Comerciante.' },
    { id: 'mercado-negro', text: 'Conocimiento del mercado de antigüedades y canales de venta.' },
  ],
  greeting: 'Buenos días, soy Marcos. Me dedico al comercio de antigüedades.',
};

const catalogFallback = {
  facts: [{ id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' }],
  persona: 'Sospechosa. Restauradora contratada para el traslado del astrolabio.',
  greeting: 'Soy Inés Valera, restauradora. Puedo confirmar mi identidad, pero no voy a declarar sobre el robo.',
  refusal: 'No voy a declarar sobre el robo.',
  role: 'Sospechosa',
  name: 'Inés Valera',
};

function viewWith(entry: Record<string, unknown>): PlayerViewDto {
  return { npcChat: [entry] } as unknown as PlayerViewDto;
}

describe('datos de charla libre desde la vista (npcChat)', () => {
  it('un NPC generado usa los datos de su entrada, no el respaldo del catálogo', () => {
    const view = viewWith(marcos);
    const entry = findChatEntry(view, 'marcos');
    expect(entry?.name).toBe('Marcos');
    expect(chatFacts(entry, catalogFallback.facts)).toEqual(marcos.knowledge);
    expect(chatPersona(entry, catalogFallback.persona)).toBe('Soy comerciante y conozco el mercado de antigüedades de la zona.');
    expect(chatGreeting(entry, catalogFallback.greeting, 'Marcos')).toBe('Buenos días, soy Marcos. Me dedico al comercio de antigüedades.');
    // Un generado no tiene negativa de catálogo: sin ella, el director usa su genérica.
    expect(chatRefusal(entry, undefined)).toBeUndefined();
    expect(chatRole(entry, catalogFallback.role)).toBe('Comerciante');
    expect(chatNpcName(entry, catalogFallback.name)).toBe('Marcos');
  });

  it('sin entrada en la vista, se usa el respaldo del catálogo', () => {
    const view = viewWith(marcos);
    const entry = findChatEntry(view, 'ines');
    expect(entry).toBeUndefined();
    expect(chatFacts(entry, catalogFallback.facts)).toEqual(catalogFallback.facts);
    expect(chatPersona(entry, catalogFallback.persona)).toBe(catalogFallback.persona);
    expect(chatGreeting(entry, catalogFallback.greeting, 'Inés Valera')).toBe(catalogFallback.greeting);
    expect(chatRefusal(entry, catalogFallback.refusal)).toBe('No voy a declarar sobre el robo.');
    expect(chatRole(entry, catalogFallback.role)).toBe('Sospechosa');
    expect(chatNpcName(entry, catalogFallback.name)).toBe('Inés Valera');
  });

  it('sin entrada ni respaldo, el saludo genérico usa el nombre', () => {
    expect(chatFacts(undefined, [])).toEqual([]);
    expect(chatPersona(undefined, '')).toBe('');
    expect(chatGreeting(undefined, undefined, 'Alguien')).toBe('Soy Alguien. ¿Qué quieres saber?');
    expect(chatRefusal(undefined, undefined)).toBeUndefined();
    expect(chatRole(undefined, '')).toBe('');
  });
});
