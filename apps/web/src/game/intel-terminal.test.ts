import { describe, expect, it } from 'vitest';
import { buildIntelFacts, INTEL_MAX_FACTS, INTEL_NO_RECORD, selectIntelFacts } from './intel-terminal';

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
    expect(INTEL_NO_RECORD).toContain('no demuestra inocencia');
  });

  it('nunca entrega más de 16 hechos al modelo', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: `hecho-${index}`, text: `la cerradura número ${index} tiene residuo` }));
    expect(selectIntelFacts('cerradura', many)).toHaveLength(INTEL_MAX_FACTS);
  });
});
