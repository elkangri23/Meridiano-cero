import { useEffect, useRef } from 'react';
import type { AiInterpretation } from '../ai/client';

interface Props { request: string | null; interpretation: AiInterpretation | null; cancel: () => void; confirm: () => void }

export function Confirmation({ request, interpretation, cancel, confirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (request && !element.open) element.showModal();
    if (!request && element.open) element.close();
  }, [request]);

  if (!request) return null;

  return <dialog className="request-dialog" ref={dialog} onCancel={cancel} aria-labelledby="confirmation-title">
    <p className="overline">REVISAR SOLICITUD</p><h2 id="confirmation-title">Antes de actuar</h2>
    <p className="request-text">{request}</p>
    {interpretation && interpretation.kind === 'actions' && (
      <dl className="request-facts">
        <div><dt>Acción</dt><dd>{interpretation.actionIds?.join(', ')}</dd></div>
        <div><dt>Duración</dt><dd>Pendiente de estimación</dd></div>
        <div><dt>Estado</dt><dd>Vista previa desde IA</dd></div>
      </dl>
    )}
    {interpretation && interpretation.kind === 'clarification' && (
      <dl className="request-facts">
        <div><dt>Aclaración</dt><dd>{interpretation.message}</dd></div>
        <div><dt>Motivo</dt><dd>{interpretation.reason}</dd></div>
      </dl>
    )}
    <p>Esta vista permite revisar la presentación de una orden. Confirmarla no cambia el reloj, las pruebas ni el expediente.</p>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={cancel}>Volver</button><button type="button" className="primary-button" onClick={confirm}>Probar confirmación</button></div>
  </dialog>;
}
