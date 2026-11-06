// Datos de conversación de los NPC de un expediente para la charla libre.
// La web construía la petición converse solo desde el catálogo fijo del
// astrolabio: un NPC generado no está en RECURRENT_NPCS, así que llegaba
// al director sin hechos ni persona y cada pregunta salía como
// «He registrado tu consulta.». La vista del jugador lleva ahora estos
// datos, construidos aquí desde la definición del caso en curso.
import type { CaseDefinition, NPC } from '@meridiano/case-schema';
import { getNPC, npcGreeting, npcKnowledgeFacts, npcRefusal } from '@meridiano/case-schema';
import type { NpcChatEntry } from '@meridiano/contracts';

/** Hecho de identidad sintético (solo expedientes generados): los textos
 * de conocimiento generados describen temas («Conocimiento del mercado de
 * antigüedades…»), nunca afirman quién es el personaje, así que sin este
 * hecho el modelo no puede responder «¿Cómo te llamas?» con `state` (el
 * director exige al menos un hecho autorizado para declarar). No inventa
 * nada: nombre y rol ya se enseñan en la escena. Si el conocimiento ya
 * trae un hecho `identity`, no se duplica. En el caso fijo no se añade:
 * la identidad de Inés ya la cubre su hecho `truth` y su respuesta debe
 * seguir siendo esa, no una frase sintética. */
function identityFact(npc: NPC): { id: string; text: string } {
  return { id: 'identity', text: npc.role ? `Soy ${npc.name}, ${npc.role}.` : `Soy ${npc.name}.` };
}

function generatedEntry(npc: NPC, texts: NonNullable<CaseDefinition['texts']>): NpcChatEntry {
  const knowledge = npc.knowledge.flatMap(id => {
    const text = texts.knowledge[id];
    return text ? [{ id, text }] : [];
  });
  const greeting = texts.greetings[npc.id];
  const refusal = texts.refusals?.[npc.id];
  return {
    id: npc.id,
    name: npc.name,
    ...(npc.role ? { role: npc.role } : {}),
    persona: npc.persona ?? '',
    knowledge: npc.knowledge.includes('identity') ? knowledge : [identityFact(npc), ...knowledge],
    ...(greeting ? { greeting } : {}),
    ...(refusal ? { refusal } : {}),
  };
}

function fixedEntry(npc: NPC): NpcChatEntry {
  const profile = getNPC(npc.id);
  const greeting = npcGreeting(npc.id);
  const refusal = npcRefusal(npc.id);
  return {
    id: npc.id,
    name: profile?.name ?? npc.name,
    ...(profile ? { role: profile.role } : {}),
    persona: profile?.persona ?? '',
    knowledge: npcKnowledgeFacts(npc.id),
    ...(greeting ? { greeting } : {}),
    ...(refusal ? { refusal } : {}),
  };
}

/** Datos de conversación de cada personaje del expediente, en el orden de
 * su definición. El caso fijo usa el catálogo (mismos valores que la web
 * calculaba antes); el generado usa su definición. */
export function npcChatForDefinition(definition: CaseDefinition): NpcChatEntry[] {
  return definition.npcs.map(npc => definition.texts ? generatedEntry(npc, definition.texts) : fixedEntry(npc));
}
