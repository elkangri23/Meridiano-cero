// Resolución de los datos de charla libre de un NPC desde la vista del
// jugador. Antes la web solo conocía el catálogo fijo del astrolabio, así
// que un NPC generado llegaba al director sin hechos ni persona y cada
// pregunta salía como «He registrado tu consulta.». La vista trae ahora
// esos datos por personaje (`npcChat`); si no trae la entrada (o el
// personaje es del catálogo fijo), quien llama pasa los valores del
// catálogo como respaldo. Este módulo no importa el catálogo: solo resuelve
// la precedencia (entrada de la vista > respaldo) y es testeable sin
// montar el componente.
import type { NpcChatEntry, PlayerViewDto } from '@meridiano/contracts';
import type { TranslateFn } from '@meridiano/contracts';

export function findChatEntry(view: PlayerViewDto | null | undefined, npcId: string): NpcChatEntry | undefined {
  return view?.npcChat.find(entry => entry.id === npcId);
}

/** Hechos que el NPC puede declarar, con su texto: los de su entrada en la
 * vista del caso en curso, o el respaldo si no la trae. */
export function chatFacts(entry: NpcChatEntry | undefined, fallback: Array<{ id: string; text: string }>): Array<{ id: string; text: string }> {
  return entry?.knowledge ?? fallback;
}

export function chatPersona(entry: NpcChatEntry | undefined, fallback: string): string {
  return entry?.persona ?? fallback;
}

export function chatGreeting(entry: NpcChatEntry | undefined, fallback: string | undefined, npcName: string, t: TranslateFn): string {
  return entry?.greeting ?? fallback ?? t('chat.fallbackGreeting', { name: npcName });
}

export function chatRefusal(entry: NpcChatEntry | undefined, fallback: string | undefined): string | undefined {
  return entry?.refusal ?? fallback;
}

export function chatRole(entry: NpcChatEntry | undefined, fallback: string): string {
  return entry?.role ?? fallback;
}

export function chatNpcName(entry: NpcChatEntry | undefined, fallback: string | undefined): string | undefined {
  return entry?.name ?? fallback;
}
