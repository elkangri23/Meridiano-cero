// Confirmación solo para lo costoso o irreversible (lote 2): las acciones
// baratas y reversibles se ejecutan en un clic; el diálogo queda para las
// caras (60 min o más) y las irreversibles, cuesten lo que cuesten.
import { describe, expect, it } from 'vitest';
import type { ActionResponseDto, PublicActionOffer } from '@meridiano/contracts';
import { CONFIRM_COST_MINUTES, needsConfirmationDialog } from './action-confirmation';

function response(estimatedMinutes?: number, requiresConfirmation?: boolean): ActionResponseDto {
  return {
    requiresConfirmation,
    ...(estimatedMinutes === undefined ? {} : {
      preview: { actionType: 'inspect', estimatedMinutes, estimatedEndTime: 10, description: 'Confirmar acción.' },
    }),
  } as unknown as ActionResponseDto;
}

function offer(type: PublicActionOffer['action']['type']): PublicActionOffer {
  return { id: `test:${type}`, label: 'Acción de prueba', action: { type, params: {} } as PublicActionOffer['action'] };
}

describe('needsConfirmationDialog: un clic para lo barato, diálogo para lo costoso o irreversible', () => {
  it('inspeccionar (10-20 min), hablar, recoger, consultar y esperar (30 min) van en un clic', () => {
    expect(needsConfirmationDialog(response(10, true), offer('inspect'))).toBe(false);
    expect(needsConfirmationDialog(response(20, true), offer('inspect'))).toBe(false);
    expect(needsConfirmationDialog(response(undefined, false), offer('inspect'))).toBe(false);
    expect(needsConfirmationDialog(response(undefined, false), offer('talk'))).toBe(false);
    expect(needsConfirmationDialog(response(undefined, false), offer('collect'))).toBe(false);
    expect(needsConfirmationDialog(response(undefined, false), offer('query'))).toBe(false);
    expect(needsConfirmationDialog(response(undefined, false), offer('analyze'))).toBe(false);
    expect(needsConfirmationDialog(response(30, true), offer('wait'))).toBe(false);
  });

  it('viajar (120-180 min) pide confirmación por coste', () => {
    expect(needsConfirmationDialog(response(120, true), offer('travel'))).toBe(true);
    expect(needsConfirmationDialog(response(180, true), offer('travel'))).toBe(true);
    expect(needsConfirmationDialog(response(CONFIRM_COST_MINUTES, true), offer('travel'))).toBe(true);
    expect(needsConfirmationDialog(response(CONFIRM_COST_MINUTES - 1, true), offer('travel'))).toBe(false);
  });

  it('detener, recuperar, cerrar y pedir orden piden confirmación aunque cuesten poco', () => {
    expect(needsConfirmationDialog(response(15, true), offer('detain'))).toBe(true);
    expect(needsConfirmationDialog(response(20, true), offer('recover'))).toBe(true);
    expect(needsConfirmationDialog(response(0, true), offer('finish'))).toBe(true);
    expect(needsConfirmationDialog(response(undefined, false), offer('request_warrant'))).toBe(true);
  });

  it('las secuencias conservan la decisión del motor', () => {
    expect(needsConfirmationDialog(response(30, true), offer('batch'))).toBe(true);
    expect(needsConfirmationDialog(response(undefined, false), offer('batch'))).toBe(false);
    expect(needsConfirmationDialog(response(30, true), offer('batch_decision'))).toBe(true);
    expect(needsConfirmationDialog(response(undefined, false), offer('batch_decision'))).toBe(false);
  });
});
