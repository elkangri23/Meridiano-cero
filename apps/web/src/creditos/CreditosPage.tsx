import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ASSETS, DIRECT_DEPENDENCIES } from './creditos';
import { useTranslation } from '../i18n';
import type { LocaleKey } from '@meridiano/contracts';
import './creditos.css';

type SectionId = 'authorship' | 'license' | 'dependencies' | 'assets' | 'trademark';

const SECTIONS: { id: SectionId; labelKey: LocaleKey }[] = [
  { id: 'authorship', labelKey: 'credits.section.authorship' },
  { id: 'license', labelKey: 'credits.section.license' },
  { id: 'dependencies', labelKey: 'credits.section.dependencies' },
  { id: 'assets', labelKey: 'credits.section.assets' },
  { id: 'trademark', labelKey: 'credits.section.trademark' },
];

export function Creditos() {
  const t = useTranslation();
  const [active, setActive] = useState<SectionId>('authorship');

  return (
    <main className="creditos" aria-label={t('credits.ariaLabel')}>
      <a className="skip-link" href="#creditos-contenido">{t('credits.skipLink')}</a>
      <header className="creditos-header">
        <span className="creditos-mark" aria-hidden="true">M<span>0</span></span>
        <div>
          <p>{t('credits.agency')}</p>
          <h1>{t('credits.pageTitle')}</h1>
        </div>
      </header>
      <nav className="creditos-nav" aria-label={t('credits.sectionsAria')}>
        {SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            aria-pressed={active === section.id}
            onClick={() => setActive(section.id)}
          >
            {t(section.labelKey)}
          </button>
        ))}
      </nav>
      <div id="creditos-contenido">
        {active === 'authorship' && <section className="creditos-section"><h2>{t('credits.authorTitle')}</h2><p>{t('credits.authorBody')}</p></section>}
        {active === 'license' && <section className="creditos-section"><h2>{t('credits.licenseTitle')}</h2><p>{t('credits.licenseBody')}</p></section>}
        {active === 'dependencies' && (
          <section className="creditos-section">
            <h2>{t('credits.depsTitle')}</h2>
            <p>{t('credits.depsBody')}</p>
            <table>
              <thead><tr><th>{t('credits.table.name')}</th><th>{t('credits.table.license')}</th><th>{t('credits.table.use')}</th></tr></thead>
              <tbody>
                {DIRECT_DEPENDENCIES.map(dep => (
                  <tr key={dep.name}><td>{dep.name}</td><td>{dep.license}</td><td>{t(dep.useKey)}</td></tr>
                ))}
              </tbody>
            </table>
            <p>{t('credits.depsNote')}</p>
          </section>
        )}
        {active === 'assets' && (
          <section className="creditos-section">
            <h2>{t('credits.assetsTitle')}</h2>
            <p>{t('credits.assetsBody')}</p>
            <table>
              <thead><tr><th>{t('credits.table.asset')}</th><th>{t('credits.table.origin')}</th></tr></thead>
              <tbody>
                {ASSETS.map(asset => (
                  <tr key={asset.nameKey}><td>{t(asset.nameKey)}<br />{t(asset.descriptionKey)}</td><td>{t(asset.licenseKey)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {active === 'trademark' && <section className="creditos-section"><h2>{t('credits.trademarkTitle')}</h2><p>{t('credits.trademarkBody')}</p></section>}
      </div>
      <footer className="creditos-footer">
        <Link to="/">{t('credits.backArchive')}</Link>
        <Link to="/glosario">{t('credits.backGlossary')}</Link>
        <span>{t('credits.footer')}</span>
      </footer>
    </main>
  );
}
