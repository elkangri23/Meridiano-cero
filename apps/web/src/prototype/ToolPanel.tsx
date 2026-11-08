import type { Tool } from './sample';
import { destinations } from './sample';
import { useTranslation } from '../i18n';
import type { LocaleKey } from '@meridiano/contracts';

/** Nombre del país de un destino de muestra, en el idioma del jugador. */
const countryKeys: Record<string, LocaleKey> = { es: 'engine.country.es', fr: 'engine.country.fr', pt: 'engine.country.pt' };

interface Props {
  readableFont: boolean; setReadableFont: (enabled: boolean) => void;
  tool: Tool; draft: (text: string) => void; contrast: boolean;
  setContrast: (enabled: boolean) => void; scale: number; setScale: (scale: number) => void;
}
export function ToolPanel({ tool, draft, contrast, setContrast, scale, setScale, readableFont, setReadableFont }: Props) {
  const t = useTranslation();
  if (tool === 'mapa') return <section aria-labelledby="tool-title">
    <p className="overline">{t('prototype.map.overline')}</p><h2 id="tool-title">{t('prototype.map.title')}</h2>
    <p>{t('prototype.map.help')}</p>
    <div className="atlas" aria-hidden="true"><div className="atlas-land" />{destinations.map(city =>
      <span key={city.id} className="atlas-city" style={{ left: city.x + '%', top: city.y + '%' }}>{city.name}</span>)}</div>
    <ul className="destination-list">{destinations.map(city => <li key={city.id}>
      <span><strong>{city.name}</strong><small>{t(countryKeys[city.code] ?? 'engine.country.es')}</small></span>
      <button type="button" onClick={() => { draft(t('prototype.map.travelDraft', { city: city.name })); }}>{t('prototype.map.prepare')}<span className="sr-only">{t('prototype.map.prepareTo', { city: city.name })}</span></button>
    </li>)}</ul>
  </section>;
  if (tool === 'laboratorio') return <section aria-labelledby="tool-title">
    <p className="overline">{t('prototype.lab.overline')}</p><h2 id="tool-title">{t('prototype.lab.title')}</h2>
    <div className="empty-state"><span className="empty-glyph" aria-hidden="true">⌁</span><h3>{t('prototype.lab.emptyTitle')}</h3><p>{t('prototype.lab.emptyHelp')}</p></div>
    <p className="panel-note">{t('prototype.lab.note')}</p>
  </section>;
  if (tool === 'comunicaciones') return <section aria-labelledby="tool-title">
    <p className="overline">{t('prototype.comms.overline')}</p><h2 id="tool-title">{t('prototype.comms.title')}</h2>
    <article className="contact-card"><span className="avatar" aria-hidden="true">MS</span><div><h3>Margaret Sullivan</h3><p>{t('prototype.comms.role')}</p></div></article>
    <blockquote>{t('prototype.comms.quote')}</blockquote>
    <button type="button" className="secondary-button" onClick={() => { draft(t('prototype.comms.draft')); }}>{t('prototype.comms.prepare')}</button>
    <p className="panel-note">{t('prototype.comms.note')}</p>
  </section>;
  if (tool === 'ajustes') return <section aria-labelledby="tool-title">
    <p className="overline">{t('prototype.settings.overline')}</p><h2 id="tool-title">{t('prototype.settings.title')}</h2>
    <label className="setting"><span>{t('prototype.settings.font')}</span><input type="checkbox" checked={readableFont} onChange={event => { setReadableFont(event.target.checked); }} /></label>
    <label className="setting"><span>{t('prototype.settings.contrast')}</span><input type="checkbox" checked={contrast} onChange={event => { setContrast(event.target.checked); }} /></label>
    <label className="setting" htmlFor="reading-scale"><span>{t('prototype.settings.scale')}</span><output>{scale}%</output></label>
    <input id="reading-scale" type="range" min="100" max="140" step="10" value={scale} onChange={event => { setScale(Number(event.target.value)); }} />
    <p>{t('prototype.settings.help')}</p>
    <p className="panel-note">{t('prototype.settings.motion')}</p>
  </section>;
  return <section aria-labelledby="tool-title">
    <p className="overline">{t('prototype.dossier.overline')}</p><h2 id="tool-title">{t('prototype.dossier.title')}</h2>
    <p>{t('prototype.dossier.intro')}</p>
    <div className="dossier-heading"><h3>{t('prototype.dossier.notes')}</h3><span>{t('prototype.dossier.records')}</span></div>
    <article className="evidence-card"><span className="evidence-kind">{t('prototype.dossier.kind')}</span><h3>{t('prototype.dossier.cardTitle')}</h3><p>{t('prototype.dossier.cardText')}</p><footer>{t('prototype.dossier.origin')}</footer></article>
    <p className="panel-note">{t('prototype.dossier.note')}</p>
  </section>;
}
