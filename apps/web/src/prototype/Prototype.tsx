import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { sampleView, clockLabel, tools } from './sample';
import type { Tool } from './sample';
import { Scene } from './Scene';
import { ToolPanel } from './ToolPanel';
import { Confirmation } from './Confirmation';
import { aiApi, type AiInterpretation } from '../ai/client';
import { AiError } from '../ai/client';
import { useTranslation } from '../i18n';
import './prototype.css';

export function Prototype() {
  const t = useTranslation();
  const [tool, setTool] = useState<Tool>('dossier');
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<AiInterpretation | null>(null);
  const [notice, setNotice] = useState(t('prototype.notice.idle'));
  const [contrast, setContrast] = useState(false);
  const [scale, setScale] = useState(100);
  const [readableFont, setReadableFont] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function prepare(text: string) {
    setDraft(text); setNotice(t('prototype.notice.prepared'));
    input.current?.focus();
  }

  function applyInterpretation(result: AiInterpretation) {
    if (result.kind === 'actions') {
      const actionIds = result.actionIds ?? [];
      setRequest(t('prototype.action', { actions: actionIds.join(', ') }));
      setNotice(t('prototype.notice.interpreted'));
    } else if (result.kind === 'clarification') {
      setRequest(null);
      setNotice(t('prototype.notice.clarification', { message: result.message ?? t('prototype.notice.ambiguous') }));
    }
  }

  function applySubmitError(error: unknown) {
    setRequest(null);
    if (error instanceof AiError) {
      setNotice(error.kind === 'budget_exceeded' ? t('prototype.notice.tooLong') : error.kind === 'cancelled' ? t('prototype.notice.cancelled') : t('prototype.notice.aiError'));
    } else {
      setNotice(t('prototype.notice.unexpected'));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setNotice(t('prototype.notice.interpreting'));
    const controller = new AbortController();
    try {
      const result = await aiApi.interpret(text, { location: sampleView.position.cityId, description: sampleView.conversation[0] ?? 'Sin descripción' }, tools.map(item => ({ id: item.id, label: t(item.labelKey) })), controller.signal);
      setInterpretation(result);
      applyInterpretation(result);
    } catch (e) {
      applySubmitError(e);
    }
  }

  function confirm() {
    setRequest(null);
    setInterpretation(null);
    setNotice(t('prototype.notice.confirmed'));
  }
  return <main className="prototype" data-font={readableFont ? 'readable' : 'retro'} data-contrast={contrast ? 'high' : 'normal'} style={{ fontSize: scale + '%' }}>
    <a className="skip-link" href="#command-input">{t('prototype.skipLink')}</a>
    <div className="sample-banner"><span>{t('prototype.banner')}</span><p>{t('prototype.bannerText')}</p><a href="/">{t('prototype.backHome')}</a></div>
    <header className="agency-header"><div className="agency-brand"><span className="agency-mark" aria-hidden="true">M<span>0</span></span><div><p className="overline">{t('prototype.agency')}</p><h1>MERIDIANO CERO</h1></div></div><div className="detective"><span className="avatar" aria-hidden="true">D</span><div><strong>{t('prototype.detective')}</strong><small>{t('prototype.sampleAccount')}</small></div></div></header>
    <section className="case-strip" aria-label={t('prototype.caseStrip')}>
      <div><p className="overline">{t('prototype.caseOverline')}</p><strong>{t('prototype.caseTitle')}</strong></div>
      <div className="current-city"><p className="overline">{t('prototype.currentCity')}</p><strong>Madrid, España</strong></div>
      <div className="case-clock"><p className="overline">{t('prototype.clockLabel')}</p><strong><time>{clockLabel(sampleView.minute)}</time><span> / {clockLabel(sampleView.deadlineMinutes)}</span></strong><small>{t('prototype.clockNote')}</small></div>
    </section>
    <div className="investigation-grid">
      <div className="scene-column"><Scene /><section className="narrative" aria-labelledby="narrative-title"><p className="overline" id="narrative-title">{t('prototype.fieldNotes')}</p>{sampleView.conversation.map((line, index) => <p key={index}>{line}</p>)}<span className="narrative-cursor" aria-hidden="true">_</span></section></div>
      <aside className="tools-column" aria-label={t('prototype.toolsAria')}>
        <nav className="tool-navigation" aria-label={t('prototype.openTool')}>{tools.map(item => <button key={item.id} type="button" aria-pressed={tool === item.id} onClick={() => { setTool(item.id); }}><span aria-hidden="true">{item.short}</span>{t(item.labelKey)}</button>)}</nav>
        <div className="tool-content"><ToolPanel tool={tool} draft={prepare} contrast={contrast} setContrast={setContrast} scale={scale} setScale={setScale} readableFont={readableFont} setReadableFont={setReadableFont} /></div>
      </aside>
    </div>
    <section className="command-section" aria-labelledby="command-title"><div className="command-label"><label id="command-title" htmlFor="command-input">{t('prototype.commandTitle')}</label><span>{t('prototype.commandHint')}</span></div>
      <form onSubmit={submit}><span className="prompt-symbol" aria-hidden="true">&gt;</span><input id="command-input" ref={input} value={draft} onChange={event => { setDraft(event.target.value); }} maxLength={4000} placeholder={t('prototype.commandPlaceholder')} autoComplete="off" /><button className="primary-button" type="submit" disabled={!draft.trim()}>{t('prototype.reviewOrder')} <span aria-hidden="true">↵</span></button></form>
      <div className="command-bottom"><p role="status" aria-live="polite">{notice}</p><button className="text-button" type="button" onClick={() => { prepare('Examinar la sala'); }}>{t('prototype.exampleOrder')}</button></div>
    </section>
    <footer className="agency-footer"><span>{t('prototype.footer1')}</span><span>{t('prototype.footer2')}</span><span>{t('prototype.footer3')}</span></footer>
    <Confirmation request={request} interpretation={interpretation} cancel={() => { setRequest(null); }} confirm={confirm} />
  </main>;
}
