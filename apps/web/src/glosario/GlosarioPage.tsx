import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GLOSSARY, REGLES, COSTES, FAQ } from './glosario';
import { useTranslation } from '../i18n';
import type { LocaleKey } from '@meridiano/contracts';
import './glosario.css';

type SectionId = 'glosario' | 'reglas' | 'costes' | 'faq';

const SECTIONS: { id: SectionId; labelKey: LocaleKey }[] = [
  { id: 'glosario', labelKey: 'glossary.section.glossary' },
  { id: 'reglas', labelKey: 'glossary.section.rules' },
  { id: 'costes', labelKey: 'glossary.section.costs' },
  { id: 'faq', labelKey: 'glossary.section.faq' },
];

export function Glosario() {
  const t = useTranslation();
  const [active, setActive] = useState<SectionId>('glosario');

  return (
    <main className="glosario" aria-label={t('glossary.ariaLabel')}>
      <a className="skip-link" href="#glosario-contenido">{t('glossary.skipLink')}</a>
      <header className="glosario-header">
        <span className="glosario-mark" aria-hidden="true">M<span>0</span></span>
        <div>
          <p>{t('glossary.agency')}</p>
          <h1>{t('glossary.pageTitle')}</h1>
        </div>
      </header>
      <nav className="glosario-nav" aria-label={t('glossary.sectionsAria')}>
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
      <div id="glosario-contenido">
        {active === 'glosario' && <GlossarySection />}
        {active === 'reglas' && <ReglasSection />}
        {active === 'costes' && <CostesSection />}
        {active === 'faq' && <FaqSection />}
      </div>
      <footer className="glosario-footer">
        <Link to="/archivo">{t('glossary.backArchive')}</Link>
        <Link to="/prototype">{t('glossary.backPrototype')}</Link>
        <span>{t('glossary.footer')}</span>
      </footer>
    </main>
  );
}

function GlossarySection() {
  const t = useTranslation();
  return (
    <section className="glosario-section" aria-labelledby="glosario-titulo">
      <h2 id="glosario-titulo">{t('glossary.section.glossary')}</h2>
      {GLOSSARY.map(term => (
        <dl key={term.termKey} className="glosario-definition">
          <dt>{t(term.termKey)}</dt>
          <dd>{t(term.definitionKey)}</dd>
        </dl>
      ))}
    </section>
  );
}

function ReglasSection() {
  const t = useTranslation();
  return (
    <section className="glosario-section" aria-labelledby="reglas-titulo">
      <h2 id="reglas-titulo">{t('glossary.rulesTitle')}</h2>
      {REGLES.map((rule, index) => (
        <div key={index} className="glosario-rule">
          <span className="num" aria-hidden="true">{index + 1}.</span>
          <p>{t(rule)}</p>
        </div>
      ))}
    </section>
  );
}

function CostesSection() {
  const t = useTranslation();
  return (
    <section className="glosario-section" aria-labelledby="costes-titulo">
      <h2 id="costes-titulo">{t('glossary.costsTitle')}</h2>
      {COSTES.map((cost, index) => (
        <div key={index} className="glosario-rule">
          <span className="num" aria-hidden="true">{index + 1}.</span>
          <p>{t(cost)}</p>
        </div>
      ))}
    </section>
  );
}

function FaqSection() {
  const t = useTranslation();
  return (
    <section className="glosario-section glosario-faq" aria-labelledby="faq-titulo">
      <h2 id="faq-titulo">{t('glossary.faqTitle')}</h2>
      {FAQ.map((item, index) => (
        <details key={index}>
          <summary>{t(item.questionKey)}</summary>
          <p>{t(item.answerKey)}</p>
        </details>
      ))}
    </section>
  );
}
