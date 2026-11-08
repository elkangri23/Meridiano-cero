import { useEffect, useRef } from 'react';
import type { AiInterpretation } from '../ai/client';
import { useTranslation } from '../i18n';

interface Props { request: string | null; interpretation: AiInterpretation | null; cancel: () => void; confirm: () => void }

export function Confirmation({ request, interpretation, cancel, confirm }: Props) {
  const t = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (request && !element.open) element.showModal();
    if (!request && element.open) element.close();
  }, [request]);

  if (!request) return null;

  return <dialog className="request-dialog" ref={dialog} onCancel={cancel} aria-labelledby="confirmation-title">
    <p className="overline">{t('prototype.confirm.overline')}</p><h2 id="confirmation-title">{t('prototype.confirm.title')}</h2>
    <p className="request-text">{request}</p>
    {interpretation && interpretation.kind === 'actions' && (
      <dl className="request-facts">
        <div><dt>{t('prototype.confirm.action')}</dt><dd>{interpretation.actionIds?.join(', ')}</dd></div>
        <div><dt>{t('prototype.confirm.duration')}</dt><dd>{t('prototype.confirm.pending')}</dd></div>
        <div><dt>{t('prototype.confirm.status')}</dt><dd>{t('prototype.confirm.preview')}</dd></div>
      </dl>
    )}
    {interpretation && interpretation.kind === 'clarification' && (
      <dl className="request-facts">
        <div><dt>{t('prototype.confirm.clarification')}</dt><dd>{interpretation.message}</dd></div>
        <div><dt>{t('prototype.confirm.reason')}</dt><dd>{interpretation.reason}</dd></div>
      </dl>
    )}
    <p>{t('prototype.confirm.note')}</p>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={cancel}>{t('prototype.confirm.back')}</button><button type="button" className="primary-button" onClick={confirm}>{t('prototype.confirm.try')}</button></div>
  </dialog>;
}
