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
