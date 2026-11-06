// Adaptador entre la frontera de IA de la API (AiProvider) y la del
// generador (StageLlm). El proveedor es el defecto del administrador
// (FreeLLMAPI en el VPS): generar funciona para cualquier usuario registrado
// sin clave propia. El esquema de la etapa viaja dentro del contexto, porque
// el adaptador de compatibilidad no lo pasa por separado y el prompt de
// generación lo espera ahí.
import { randomUUID } from 'node:crypto';
import type { StageLlm } from '@meridiano/generator';
import { record, type AiProvider } from '../ai/provider.ts';

export function createStageLlm(provider: AiProvider): StageLlm {
  return {
    async generate({ stage, context, schema, signal }) {
      const response = await provider.request({
        operation: 'generateCase',
        requestId: randomUUID(),
        schema,
        context: { stage, schema, ...context },
        ...(signal ? { signal } : {}),
      });
      if (!record(response.payload)) throw new Error('La generación devolvió una salida no válida.');
      return response.payload;
    },
  };
}
