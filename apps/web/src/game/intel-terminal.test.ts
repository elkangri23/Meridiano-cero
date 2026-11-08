import { describe, expect, it } from 'vitest';
import { buildIntelFacts, INTEL_MAX_FACTS, intelNoRecord, selectIntelFacts } from './intel-terminal';
import { createTranslator } from '@meridiano/contracts';

const t = createTranslator('es').t;
const tFr = createTranslator('fr').t;

const TEXTS: Record<string, string> = {
  'EV-02': 'La cerradura de la vitrina tiene residuo de herramienta.',
  'analysis:EV-03': 'La huella técnica es compatible con una herramienta de la serie HV-17. No acusa a nadie por sí sola.',
  'identity:ines': 'Inés Valera, restauradora contratada para el traslado del astrolabio.',
};

function facts() {
  return buildIntelFacts({
    dossier: ['EV-02', 'analysis:EV-03', 'identity:ines', 'travel:paris', 'EV-99'],
    objectives: [{ id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: false }],
    briefing: { speaker: 'El director de A.C.M.E.', title: 'El astrolabio robado', paragraphs: ['Han robado el astrolabio original en Madrid.'] },
    heard: [{ id: 'npc:tomas:identidad', text: 'Tomás Ríos: Soy Tomás Ríos, jefe de seguridad del museo.' }],
    textForDiscovery: id => TEXTS[id] ?? id,
    t,
  });
}

function factsFr() {
  return buildIntelFacts({
    dossier: ['EV-02'],
    objectives: [{ id: 'obj-detener', description: 'Arrêter Inés avec un mandat valide', achieved: false }],
    briefing: { speaker: 'Margaret Sullivan', title: 'L\'astrolabe des trois villes', paragraphs: ['Un astrolabe a disparu à Madrid.'] },
    heard: [],
    textForDiscovery: id => TEXTS[id] ?? id,
    t: tFr,
  });
}

describe('terminal de inteligencia: solo hechos autorizados', () => {
  it('construye hechos solo de hallazgos descubiertos, objetivos, resumen y lo oído', () => {
    const built = facts();
    expect(built.map(fact => fact.id)).toEqual([
      'dossier:EV-02', 'dossier:analysis:EV-03', 'dossier:identity:ines',
      'objetivo:obj-detener', 'caso-resumen', 'npc:tomas:identidad',
    ]);
    // Viajes y hallazgos sin texto del expediente no entran.
    expect(built.some(fact => fact.id.includes('travel'))).toBe(false);
    expect(built.some(fact => fact.id.includes('EV-99'))).toBe(false);
  });

  it('responde sobre una prueba con su hecho y no con los demás', () => {
    const selected = selectIntelFacts('¿Qué dice la cerradura de la vitrina?', facts());
    expect(selected.map(fact => fact.id)).toEqual(['dossier:EV-02']);
    expect(selected[0]?.text).toContain('residuo de herramienta');
  });

  it('responde sobre un sospechoso con su identidad y su objetivo', () => {
    const selected = selectIntelFacts('¿Qué se sabe de Inés Valera?', facts());
    expect(selected.map(fact => fact.id)).toContain('dossier:identity:ines');
    expect(selected.map(fact => fact.id)).toContain('objetivo:obj-detener');
  });

  it('sin solapamiento no selecciona nada: la terminal dirá que no hay registro', () => {
    expect(selectIntelFacts('¿Qué se sabe del submarino amarillo?', facts())).toEqual([]);
    expect(intelNoRecord(t)).toContain('no demuestra inocencia');
    expect(intelNoRecord(tFr)).toContain('ne prouve pas l\'innocence');
  });

  it('en francés, el hecho de objetivo sale en francés y las palabras vacías no puntúan', () => {
    const built = factsFr();
    expect(built.find(fact => fact.id === 'objetivo:obj-detener')?.text)
      .toBe('Objectif : Arrêter Inés avec un mandat valide. État : en attente.');
    // «Que dit le dossier ?» son solo palabras vacías en francés: no
    // selecciona nada (antes, «le» puntuaría como contenido).
    expect(selectIntelFacts('Que dit le dossier ?', built)).toEqual([]);
    expect(selectIntelFacts('What does the file say?', built)).toEqual([]);
  });

  it('nunca entrega más de 16 hechos al modelo', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: `hecho-${index}`, text: `la cerradura número ${index} tiene residuo` }));
    expect(selectIntelFacts('cerradura', many)).toHaveLength(INTEL_MAX_FACTS);
  });
});
