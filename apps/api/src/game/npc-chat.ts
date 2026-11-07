// Datos de conversación de los NPC de un expediente para la charla libre.
// La web construía la petición converse solo desde el catálogo fijo del
// astrolabio: un NPC generado no está en RECURRENT_NPCS, así que llegaba
// al director sin hechos ni persona y cada pregunta salía como
// «He registrado tu consulta.». La vista del jugador lleva ahora estos
// datos, construidos aquí desde la definición del caso en curso.
import type { CaseDefinition, CaseRun, NPC } from '@meridiano/case-schema';
import { channelsForNpc, getNPC, npcGreeting, npcKnowledgeFacts, npcRefusal } from '@meridiano/case-schema';
import type { NpcChatEntry } from '@meridiano/contracts';
import { misconductFactsForNpc, arrestFactsForNpc } from '@meridiano/engine';

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

function generatedEntry(definition: CaseDefinition, npc: NPC, texts: NonNullable<CaseDefinition['texts']>): NpcChatEntry {
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
    // Canales remotos de la central (GDD §10): los de la definición del
    // personaje o, si no los trae, los heredados de su medio.
    channels: channelsForNpc(definition, npc),
  };
}

function fixedEntry(definition: CaseDefinition, npc: NPC): NpcChatEntry {
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
    // Canales remotos de la central (GDD §10): los de la definición del
    // personaje o, si no los trae, los del catálogo fijo.
    channels: channelsForNpc(definition, npc),
  };
}

/** Datos de conversación de cada personaje del expediente, en el orden de
 * su definición. El caso fijo usa el catálogo (mismos valores que la web
 * calculaba antes); el generado usa su definición. Con la partida (`run`),
 * cada personaje lleva además los hechos de conducta irregular que conoce
 * de verdad (lo que le hiciste o lo que vio, GDD §14) y los de detención
 * (lo que vio detener o su propia detención, GDD §12): el director los
 * usa si el jugador pregunta por ello, sin inventar nada. Sin partida no
 * hay hechos de conducta (la vista inicial no tiene actos que contar). */
export function npcChatForDefinition(definition: CaseDefinition, run?: CaseRun): NpcChatEntry[] {
  return definition.npcs.map(npc => {
    const entry = definition.texts ? generatedEntry(definition, npc, definition.texts) : fixedEntry(definition, npc);
    if (!run) return entry;
    // El validador de la vista admite 16 hechos por personaje: los de
    // conducta y detención se añaden solo si caben, sin desplazar el
    // conocimiento. La detención va primero: es un hecho del caso, no un
    // acto del jugador.
    const extra = [...arrestFactsForNpc(definition, run, npc.id), ...misconductFactsForNpc(definition, run, npc.id)]
      .filter(fact => !entry.knowledge.some(item => item.id === fact.id));
    const room = Math.max(0, 16 - entry.knowledge.length);
    return { ...entry, knowledge: [...entry.knowledge, ...extra.slice(0, room)] };
  });
}
