import { speechActs } from './context.ts';

export const interpretationSchema = {
  type: 'object', additionalProperties: false,
  required: ['kind', 'actionIds'],
  properties: {
    kind: { enum: ['actions', 'clarification'] },
    actionIds: { type: 'array', maxItems: 8, items: { type: 'string' } },
  },
};
export const factualSchema = {
  type: 'object', additionalProperties: false, required: ['act', 'factIds'],
  properties: {
    act: { enum: [...speechActs] },
    factIds: { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string' } },
  },
};
export const MAX_CONVERSE_TEXT_LENGTH = 600;

/** Conversación libre: como factualSchema más el texto escrito por el
 * modelo, que solo se muestra cuando el acto es `acknowledge` (charla o
 * desvío no probatorio, 1-3 frases). Para `state` el servidor muestra los
 * textos factuales autorizados; para `decline` y `silence`, sus líneas
 * fijas (CONVERSACIONES.md: no se acepta texto probatorio libre). */
export const converseSchema = {
  type: 'object', additionalProperties: false, required: ['act', 'factIds', 'text'],
  properties: {
    act: { enum: [...speechActs] },
    factIds: { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string' } },
    text: { type: 'string', maxLength: MAX_CONVERSE_TEXT_LENGTH },
  },
};
