import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GLOSSARY, REGLES, COSTES, FAQ } from './glosario';
import './glosario.css';

type SectionId = 'glosario' | 'reglas' | 'costes' | 'faq';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'glosario', label: 'Glosario' },
  { id: 'reglas', label: 'Reglas' },
  { id: 'costes', label: 'Costes y tiempos' },
  { id: 'faq', label: 'FAQ' },
];

export function Glosario() {
  const [active, setActive] = useState<SectionId>('glosario');

  return (
    <main className="glosario" aria-label="Glosario y reglas del juego">
      <a className="skip-link" href="#glosario-contenido">Ir al contenido del glosario</a>
      <header className="glosario-header">
        <span className="glosario-mark" aria-hidden="true">M<span>0</span></span>
        <div>
          <p>AGENCIA DE INVESTIGACIÓN INTERNACIONAL</p>
          <h1>Archivo · Glosario y reglas</h1>
        </div>
      </header>
      <nav className="glosario-nav" aria-label="Secciones del glosario">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            aria-pressed={active === section.id}
            onClick={() => setActive(section.id)}
          >
            {section.label}
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
        <Link to="/">Volver al archivo</Link>
        <Link to="/prototype">Volver a la vista de muestra</Link>
        <span>Un detective por partida · El mundo guarda sus pistas</span>
      </footer>
    </main>
  );
}

function GlossarySection() {
  return (
    <section className="glosario-section" aria-labelledby="glosario-titulo">
      <h2 id="glosario-titulo">Glosario</h2>
      {GLOSSARY.map(term => (
        <dl key={term.term} className="glosario-definition">
          <dt>{term.term}</dt>
          <dd>{term.definition}</dd>
        </dl>
      ))}
    </section>
  );
}

function ReglasSection() {
  return (
    <section className="glosario-section" aria-labelledby="reglas-titulo">
      <h2 id="reglas-titulo">Reglas fundamentales</h2>
      {REGLES.map((rule, index) => (
        <div key={index} className="glosario-rule">
          <span className="num" aria-hidden="true">{index + 1}.</span>
          <p>{rule}</p>
        </div>
      ))}
    </section>
  );
}

function CostesSection() {
  return (
    <section className="glosario-section" aria-labelledby="costes-titulo">
      <h2 id="costes-titulo">Costes y tiempos</h2>
      {COSTES.map((cost, index) => (
        <div key={index} className="glosario-rule">
          <span className="num" aria-hidden="true">{index + 1}.</span>
          <p>{cost}</p>
        </div>
      ))}
    </section>
  );
}

function FaqSection() {
  return (
    <section className="glosario-section glosario-faq" aria-labelledby="faq-titulo">
      <h2 id="faq-titulo">Preguntas frecuentes</h2>
      {FAQ.map((item, index) => (
        <details key={index}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
