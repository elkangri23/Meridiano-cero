// Glosario, reglas, costes y FAQ: el contenido vive en `locales/es.ts`
// y aquí solo quedan las claves, en el mismo orden en que se enseñan.
// Traducir el glosario es traducir esas claves; la página no cambia.
import type { LocaleKey } from '@meridiano/contracts';

export interface GlossaryTerm {
  termKey: LocaleKey;
  definitionKey: LocaleKey;
}

export interface FaqItem {
  questionKey: LocaleKey;
  answerKey: LocaleKey;
}

export const GLOSSARY: GlossaryTerm[] = [
  { termKey: 'glossary.term.caso', definitionKey: 'glossary.def.caso' },
  { termKey: 'glossary.term.partida', definitionKey: 'glossary.def.partida' },
  { termKey: 'glossary.term.detective', definitionKey: 'glossary.def.detective' },
  { termKey: 'glossary.term.reloj', definitionKey: 'glossary.def.reloj' },
  { termKey: 'glossary.term.plazo', definitionKey: 'glossary.def.plazo' },
  { termKey: 'glossary.term.evidencia', definitionKey: 'glossary.def.evidencia' },
  { termKey: 'glossary.term.npc', definitionKey: 'glossary.def.npc' },
  { termKey: 'glossary.term.laboratorio', definitionKey: 'glossary.def.laboratorio' },
  { termKey: 'glossary.term.orden', definitionKey: 'glossary.def.orden' },
  { termKey: 'glossary.term.lote', definitionKey: 'glossary.def.lote' },
  { termKey: 'glossary.term.autoguardado', definitionKey: 'glossary.def.autoguardado' },
  { termKey: 'glossary.term.guardado', definitionKey: 'glossary.def.guardado' },
  { termKey: 'glossary.term.primerResultado', definitionKey: 'glossary.def.primerResultado' },
  { termKey: 'glossary.term.carrera', definitionKey: 'glossary.def.carrera' },
  { termKey: 'glossary.term.archivo', definitionKey: 'glossary.def.archivo' },
  { termKey: 'glossary.term.localizador', definitionKey: 'glossary.def.localizador' },
];

export const REGLES: LocaleKey[] = [
  'glossary.rule.1', 'glossary.rule.2', 'glossary.rule.3', 'glossary.rule.4',
  'glossary.rule.5', 'glossary.rule.6', 'glossary.rule.7', 'glossary.rule.8',
  'glossary.rule.9', 'glossary.rule.10', 'glossary.rule.11', 'glossary.rule.12',
];

export const COSTES: LocaleKey[] = [
  'glossary.cost.1', 'glossary.cost.2', 'glossary.cost.3',
  'glossary.cost.4', 'glossary.cost.5', 'glossary.cost.6',
];

export const FAQ: FaqItem[] = [
  { questionKey: 'glossary.faq.q1', answerKey: 'glossary.faq.a1' },
  { questionKey: 'glossary.faq.q2', answerKey: 'glossary.faq.a2' },
  { questionKey: 'glossary.faq.q3', answerKey: 'glossary.faq.a3' },
  { questionKey: 'glossary.faq.q4', answerKey: 'glossary.faq.a4' },
  { questionKey: 'glossary.faq.q5', answerKey: 'glossary.faq.a5' },
  { questionKey: 'glossary.faq.q6', answerKey: 'glossary.faq.a6' },
  { questionKey: 'glossary.faq.q7', answerKey: 'glossary.faq.a7' },
  { questionKey: 'glossary.faq.q8', answerKey: 'glossary.faq.a8' },
  { questionKey: 'glossary.faq.q9', answerKey: 'glossary.faq.a9' },
  { questionKey: 'glossary.faq.q10', answerKey: 'glossary.faq.a10' },
];
