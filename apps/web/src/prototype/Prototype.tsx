import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { sampleView, clockLabel, tools } from './sample';
import type { Tool } from './sample';
import { Scene } from './Scene';
import { ToolPanel } from './ToolPanel';
import { Confirmation } from './Confirmation';
import './prototype.css';

export function Prototype() {
  const [tool, setTool] = useState<Tool>('dossier');
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<string | null>(null);
  const [notice, setNotice] = useState('Las herramientas no consumen tiempo.');
  const [contrast, setContrast] = useState(false);
  const [scale, setScale] = useState(100);
  const [readableFont, setReadableFont] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function prepare(text: string) {
    setDraft(text); setNotice('Orden preparada en el campo de entrada.');
    input.current?.focus();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim()) setRequest(draft.trim());
  }
  function confirm() {
    setRequest(null);
    setNotice('Confirmación revisada. La vista de muestra conserva el estado inicial.');
  }
  return <main className="prototype" data-font={readableFont ? 'readable' : 'retro'} data-contrast={contrast ? 'high' : 'normal'} style={{ fontSize: scale + '%' }}>
    <a className="skip-link" href="#command-input">Ir a la entrada de órdenes</a>
    <div className="sample-banner"><span>VISTA DE MUESTRA</span><p>Explora la interfaz. Las acciones no modifican la investigación.</p><a href="/">Volver al inicio</a></div>
    <header className="agency-header"><div className="agency-brand"><span className="agency-mark" aria-hidden="true">M<span>0</span></span><div><p className="overline">AGENCIA DE INVESTIGACIÓN INTERNACIONAL</p><h1>MERIDIANO CERO</h1></div></div><div className="detective"><span className="avatar" aria-hidden="true">D</span><div><strong>Detective</strong><small>Cuenta de muestra</small></div></div></header>
    <section className="case-strip" aria-label="Estado del expediente">
      <div><p className="overline">EXPEDIENTE 001</p><strong>El astrolabio ausente</strong></div>
      <div className="current-city"><p className="overline">DESTINO ACTUAL</p><strong>Madrid, España</strong></div>
      <div className="case-clock"><p className="overline">TIEMPO TRANSCURRIDO / PLAZO</p><strong><time>{clockLabel(sampleView.minute)}</time><span> / {clockLabel(sampleView.deadlineMinutes)}</span></strong><small>El reloj avanza solo al actuar</small></div>
    </section>
    <div className="investigation-grid">
      <div className="scene-column"><Scene /><section className="narrative" aria-labelledby="narrative-title"><p className="overline" id="narrative-title">CUADERNO DE CAMPO</p>{sampleView.conversation.map((line, index) => <p key={index}>{line}</p>)}<span className="narrative-cursor" aria-hidden="true">_</span></section></div>
      <aside className="tools-column" aria-label="Herramientas del detective">
        <nav className="tool-navigation" aria-label="Abrir herramienta">{tools.map(item => <button key={item.id} type="button" aria-pressed={tool === item.id} onClick={() => { setTool(item.id); }}><span aria-hidden="true">{item.short}</span>{item.label}</button>)}</nav>
        <div className="tool-content"><ToolPanel tool={tool} draft={prepare} contrast={contrast} setContrast={setContrast} scale={scale} setScale={setScale} readableFont={readableFont} setReadableFont={setReadableFont} /></div>
      </aside>
    </div>
    <section className="command-section" aria-labelledby="command-title"><div className="command-label"><label id="command-title" htmlFor="command-input">Tu siguiente acción</label><span>ESCRIBE CON TUS PALABRAS</span></div>
      <form onSubmit={submit}><span className="prompt-symbol" aria-hidden="true">&gt;</span><input id="command-input" ref={input} value={draft} onChange={event => { setDraft(event.target.value); }} maxLength={4000} placeholder="¿Qué quieres hacer o preguntar?" autoComplete="off" /><button className="primary-button" type="submit" disabled={!draft.trim()}>Revisar orden <span aria-hidden="true">↵</span></button></form>
      <div className="command-bottom"><p role="status" aria-live="polite">{notice}</p><button className="text-button" type="button" onClick={() => { prepare('Examinar la sala'); }}>Ejemplo de orden</button></div>
    </section>
    <footer className="agency-footer"><span>A.C.M.E. · IDENTIDAD PROVISIONAL</span><span>OBSERVAR · PREGUNTAR · DEDUCIR</span><span>EL MUNDO GUARDA SUS PISTAS</span></footer>
    <Confirmation request={request} cancel={() => { setRequest(null); }} confirm={confirm} />
  </main>;
}
