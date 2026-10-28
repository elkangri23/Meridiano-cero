import type { Tool } from './sample';
import { destinations } from './sample';

interface Props {
  readableFont: boolean; setReadableFont: (enabled: boolean) => void;
  tool: Tool; draft: (text: string) => void; contrast: boolean;
  setContrast: (enabled: boolean) => void; scale: number; setScale: (scale: number) => void;
}
export function ToolPanel({ tool, draft, contrast, setContrast, scale, setScale, readableFont, setReadableFont }: Props) {
  if (tool === 'mapa') return <section aria-labelledby="tool-title">
    <p className="overline">ATLAS A.C.M.E.</p><h2 id="tool-title">Tres ciudades, un expediente</h2>
    <p>Consulta un destino. Elegirlo prepara una orden; no inicia un viaje.</p>
    <div className="atlas" aria-hidden="true"><div className="atlas-land" />{destinations.map(city =>
      <span key={city.id} className="atlas-city" style={{ left: city.x + '%', top: city.y + '%' }}>{city.name}</span>)}</div>
    <ul className="destination-list">{destinations.map(city => <li key={city.id}>
      <span><strong>{city.name}</strong><small>{city.country}</small></span>
      <button type="button" onClick={() => { draft('Viajar a ' + city.name); }}>Preparar viaje<span className="sr-only"> a {city.name}</span></button>
    </li>)}</ul>
  </section>;
  if (tool === 'laboratorio') return <section aria-labelledby="tool-title">
    <p className="overline">DR. SAMUEL RICHTER</p><h2 id="tool-title">Laboratorio</h2>
    <div className="empty-state"><span className="empty-glyph" aria-hidden="true">⌁</span><h3>Sin análisis pendientes</h3><p>Las solicitudes aparecerán aquí con su hora de entrega. Consultar este panel no consume tiempo.</p></div>
    <p className="panel-note">No hay resultados de laboratorio en esta vista de muestra.</p>
  </section>;
  if (tool === 'comunicaciones') return <section aria-labelledby="tool-title">
    <p className="overline">CENTRAL DE OPERACIONES</p><h2 id="tool-title">Comunicaciones</h2>
    <article className="contact-card"><span className="avatar" aria-hidden="true">MS</span><div><h3>Margaret Sullivan</h3><p>Dirección · A.C.M.E.</p></div></article>
    <blockquote>Empieza por observar el escenario y formar tus propias preguntas. El expediente reúne lo que ya has descubierto.</blockquote>
    <button type="button" className="secondary-button" onClick={() => { draft('Consultar el encargo con Margaret'); }}>Preparar consulta</button>
    <p className="panel-note">Este panel simula comunicaciones del juego. No envía mensajes a personas reales.</p>
  </section>;
  if (tool === 'ajustes') return <section aria-labelledby="tool-title">
    <p className="overline">TU FORMA DE INVESTIGAR</p><h2 id="tool-title">Lectura y contraste</h2>
    <label className="setting"><span>Fuente de lectura accesible</span><input type="checkbox" checked={readableFont} onChange={event => { setReadableFont(event.target.checked); }} /></label>
    <label className="setting"><span>Contraste reforzado</span><input type="checkbox" checked={contrast} onChange={event => { setContrast(event.target.checked); }} /></label>
    <label className="setting" htmlFor="reading-scale"><span>Tamaño de lectura</span><output>{scale}%</output></label>
    <input id="reading-scale" type="range" min="100" max="140" step="10" value={scale} onChange={event => { setScale(Number(event.target.value)); }} />
    <p>Estos ajustes afectan solo a la presentación. También puedes usar el zoom de tu navegador.</p>
    <p className="panel-note">La vista respeta la preferencia de movimiento reducido del sistema.</p>
  </section>;
  return <section aria-labelledby="tool-title">
    <p className="overline">EXPEDIENTE 001 / VISTA DE MUESTRA</p><h2 id="tool-title">El astrolabio ausente</h2>
    <p>Un objeto de la exposición no llegó a su destino. Reconstruye lo ocurrido a partir de observaciones, documentos y conversaciones.</p>
    <div className="dossier-heading"><h3>Notas del detective</h3><span>01 REGISTRO</span></div>
    <article className="evidence-card"><span className="evidence-kind">OBSERVACIÓN</span><h3>La sala de embalaje</h3><p>Sobre la mesa hay una caja de transporte y una carpeta de recepción.</p><footer>Procedencia: escena visible · Madrid</footer></article>
    <p className="panel-note">Aquí solo se muestra información de ejemplo ya visible. No contiene la solución del caso.</p>
  </section>;
}
