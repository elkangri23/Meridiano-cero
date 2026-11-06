// Confirmación solo para lo costoso o irreversible (lote 2 de jugabilidad).
// Antes, toda acción pasaba por escribir → interpretar → confirmar; ahora
// las baratas y reversibles se ejecutan en el mismo clic y el diálogo queda
// solo para las que de verdad lo necesitan.
import type { ActionResponseDto, PublicActionOffer } from '@meridiano/contracts';

/** Coste a partir del cual una acción pide confirmación aunque sea reversible. */
export const CONFIRM_COST_MINUTES = 60;

/** Acciones irreversibles: piden confirmación siempre, cuesten lo que cuesten. */
const IRREVERSIBLE_ACTION_TYPES: ReadonlySet<string> = new Set([
  'finish', // Cierra el caso; no hay vuelta atrás.
  'detain', // Una detención errónea deja el resultado en «incorrecto».
  'recover', // Recuperar el objeto original logra un objetivo.
  'request_warrant', // Compromete la evidencia conocida contra un sospechoso.
]);

/** ¿Pide esta acción diálogo de confirmación? Irreversible, siempre; si no,
 * solo cuando su coste estimado alcanza el umbral. Lo demás (inspeccionar
 * 10-20 min, hablar, recoger, consultar, esperar 30 min) se ejecuta en el
 * mismo clic: el servidor ya permite confirmar sin preview previo y la
 * confirmación usa la misma idempotencia y control de revisión. Las
 * secuencias (batch) conservan la decisión del motor, que ve pasos
 * posteriores que el cliente no puede valorar. */
export function needsConfirmationDialog(response: ActionResponseDto, offer: PublicActionOffer): boolean {
  const type = offer.action.type;
  if (IRREVERSIBLE_ACTION_TYPES.has(type)) return true;
  if (type === 'batch' || type === 'batch_decision') return response.requiresConfirmation === true;
  return (response.preview?.estimatedMinutes ?? 0) >= CONFIRM_COST_MINUTES;
}
