import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { authApi } from '../auth/client';
import type { Language, SessionDto } from '@meridiano/contracts';
import { useTranslation } from '../i18n';
import { usePreferences } from '../preferences';
import './landing.css';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

/** Landing pública en `/` (fase 2 del rediseño A2).
 * Solo hechos verificados del juego; sin estadísticas de jugadores,
 * testimonios ni cifras inventadas. Con sesión, la visita no se queda
 * aquí: va directa al archivo en `/archivo`. */
export function Landing() {
  const t = useTranslation();
  const { preferences, updatePreferences } = usePreferences();
  const [session, setSession] = useState<SessionDto | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    void authApi.me(controller.signal).then(setSession).catch(() => setSession(null));
    return () => controller.abort();
  }, []);
  if (session) return <Navigate to="/archivo" replace />;
  if (session === undefined) {
    return <main className="landing"><p role="status" className="landing-loading">{t('landing.loading')}</p></main>;
  }
  return (
    <main className="landing">
      <a className="skip-link" href="#landing-contenido">{t('landing.skipLink')}</a>
      <header className="landing-header">
        <span className="landing-mark" aria-hidden="true">M<span>0</span></span>
        <p className="landing-brand">{t('landing.brand')}</p>
        <div className="landing-actions">
          <Link to="/login">{t('archive.login')}</Link>
          <Link className="landing-primary" to="/registro">{t('archive.createAccount')}</Link>
        </div>
      </header>

      <div id="landing-contenido">
        <section className="landing-hero" aria-labelledby="landing-titulo">
          <p className="landing-overline">{t('landing.hero.overline')}</p>
          <h1 id="landing-titulo">{t('landing.hero.title')}</h1>
          <p className="landing-lede">{t('landing.hero.lede')}</p>
          <div className="landing-cta">
            <Link className="landing-primary" to="/registro">{t('archive.createAccount')}</Link>
            <Link className="landing-secondary" to="/login">{t('archive.login')}</Link>
          </div>
          <p className="landing-free">{t('landing.hero.free')}</p>
        </section>

        <section className="landing-facts" aria-label={t('landing.hero.overline')}>
          <ul>
            <li><strong>{t('landing.facts.cases')}</strong><span>{t('landing.facts.casesNote')}</span></li>
            <li><strong>{t('landing.facts.cities')}</strong></li>
            <li><strong>{t('landing.facts.routes')}</strong></li>
            <li><strong>{t('landing.facts.languages')}</strong><span>{t('landing.facts.languagesNote')}</span></li>
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="landing-como">
          <h2 id="landing-como">{t('landing.how.title')}</h2>
          <ol className="landing-steps">
            <li><h3>{t('landing.how.investigate.title')}</h3><p>{t('landing.how.investigate.body')}</p></li>
            <li><h3>{t('landing.how.interrogate.title')}</h3><p>{t('landing.how.interrogate.body')}</p></li>
            <li><h3>{t('landing.how.travel.title')}</h3><p>{t('landing.how.travel.body')}</p></li>
            <li><h3>{t('landing.how.solve.title')}</h3><p>{t('landing.how.solve.body')}</p></li>
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="landing-necesitas">
          <h2 id="landing-necesitas">{t('landing.requirements.title')}</h2>
          <div className="landing-cards">
            <article><h3>{t('landing.requirements.browser.title')}</h3><p>{t('landing.requirements.browser.body')}</p></article>
            <article><h3>{t('landing.requirements.llm.title')}</h3><p>{t('landing.requirements.llm.body')}</p></article>
            <article><h3>{t('landing.requirements.cases.title')}</h3><p>{t('landing.requirements.cases.body')}</p></article>
          </div>
        </section>

        <section className="landing-case" aria-labelledby="landing-caso">
          <p className="landing-overline">{t('landing.case.cities')}</p>
          <h2 id="landing-caso">{t('landing.case.title')}</h2>
          <p>{t('landing.case.body')}</p>
        </section>
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-links">
          <Link to="/glosario">{t('archive.glossary')}</Link>
          <Link to="/creditos">{t('archive.credits')}</Link>
          <Link to="/login">{t('archive.login')}</Link>
          <Link to="/registro">{t('archive.createAccount')}</Link>
        </div>
        <div className="landing-language">
          <span>{t('landing.language')}</span>
          {LANGUAGES.map(language => (
            <button key={language.id} type="button" aria-pressed={preferences.language === language.id} onClick={() => updatePreferences({ language: language.id })}>
              {language.label}
            </button>
          ))}
        </div>
        <p>{t('landing.footer.note')}</p>
      </footer>
    </main>
  );
}
