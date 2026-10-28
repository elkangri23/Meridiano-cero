import { useEffect, useRef } from 'react';

interface Props { request: string | null; cancel: () => void; confirm: () => void }
export function Confirmation({ request, cancel, confirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (request && !element.open) element.showModal();
    if (!request && element.open) element.close();
  }, [request]);
  return <dialog className="request-dialog" ref={dialog} onCancel={cancel} aria-labelledby="confirmation-title">
    <p className="overline">REVISAR SOLICITUD</p><h2 id="confirmation-title">Antes de actuar</h2>
    <p className="request-text">{request}</p>
    <dl className="request-facts"><div><dt>Duración</dt><dd>Pendiente de estimación</dd></div><div><dt>Estado</dt><dd>Solo vista previa</dd></div></dl>
    <p>Esta vista permite revisar la presentación de una orden. Confirmarla no cambia el reloj, las pruebas ni el expediente.</p>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={cancel}>Volver</button><button type="button" className="primary-button" onClick={confirm}>Probar confirmación</button></div>
  </dialog>;
}
