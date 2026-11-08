import { check, identifier, integer, isRecord, text, type DataRecord } from './validation-fields.js';
import { hasKnowledgeContent, isKnowledgeLabelText, knowledgeContentAnchors, type KnowledgeContentAnchors } from '@meridiano/contracts';
import { FORENSIC_TYPES, type ForensicType } from './forensics.js';
import type { EntityGroups } from './validation-entities.js';

/**
 * Valida la mecánica declarativa y los textos de un expediente generado
 * (T4-08). El caso fijo no trae `mechanics` ni `texts` y queda exento: su
 * mecánica vive hardcodeada en el motor y sus textos en `fact-texts.ts`.
 * Todo identificador referenciado debe existir; las combinaciones de orden
 * deben ser no vacías y referenciar evidencias conocidas; la recuperación
 * debe apuntar a un objeto del lugar declarado; cada evidencia, cada hecho
 * de conocimiento y cada NPC deben tener su texto narrativo.
 */

function recordList(value: unknown): DataRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function inspectables(mechanics: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entries = recordList(mechanics.inspectables);
  check(Array.isArray(mechanics.inspectables), 'mechanics.inspectables', errors);
  const seen = new Set<string>();
  for (const entry of entries) {
    check(identifier(entry.locationId) && groups.locations.some(location => location.id === entry.locationId), 'mechanics.inspectables.locationId inexistente', errors);
    check(typeof entry.elementId === 'string' && /^[A-Za-z0-9._:-]{0,64}$/.test(entry.elementId), 'mechanics.inspectables.elementId inválido', errors);
    check(text(entry.label), 'mechanics.inspectables.label', errors);
    check(identifier(entry.evidenceId) && groups.evidence.some(evidence => evidence.id === entry.evidenceId), 'mechanics.inspectables.evidenceId inexistente', errors);
    const key = `${entry.locationId}:${entry.elementId}`;
    check(!seen.has(key), 'mechanics.inspectables duplicado', errors);
    seen.add(key);
    if (entry.reveals !== undefined) {
      for (const marker of stringList(entry.reveals)) check(identifier(marker), 'mechanics.inspectables.reveals inválido', errors);
    }
  }
}

function queries(mechanics: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entries = recordList(mechanics.queries);
  check(Array.isArray(mechanics.queries), 'mechanics.queries', errors);
  const seen = new Set<string>();
  for (const entry of entries) {
    check(identifier(entry.id), 'mechanics.queries.id inválido', errors);
    check(!seen.has(String(entry.id)), 'mechanics.queries.id duplicado', errors);
    seen.add(String(entry.id));
    check(text(entry.label), 'mechanics.queries.label', errors);
    check(identifier(entry.cityId) && groups.cities.some(city => city.id === entry.cityId), 'mechanics.queries.cityId inexistente', errors);
    check(identifier(entry.locationId) && groups.locations.some(location => location.id === entry.locationId && location.cityId === entry.cityId), 'mechanics.queries.locationId inexistente o en otra ciudad', errors);
    check(identifier(entry.evidenceId) && groups.evidence.some(evidence => evidence.id === entry.evidenceId), 'mechanics.queries.evidenceId inexistente', errors);
    const requires = stringList(entry.requires);
    check(Array.isArray(entry.requires), 'mechanics.queries.requires', errors);
    for (const id of requires) check(groups.evidence.some(evidence => evidence.id === id), 'mechanics.queries.requires inexistente', errors);
    check(integer(entry.delayMinutes, 1) && Number(entry.delayMinutes) <= 240, 'mechanics.queries.delayMinutes fuera de rango', errors);
    if (entry.reveals !== undefined) {
      for (const marker of stringList(entry.reveals)) check(identifier(marker), 'mechanics.queries.reveals inválido', errors);
    }
  }
}

function analyses(mechanics: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entries = recordList(mechanics.analyses);
  check(Array.isArray(mechanics.analyses), 'mechanics.analyses', errors);
  for (const entry of entries) {
    check(identifier(entry.inputEvidenceId) && groups.evidence.some(evidence => evidence.id === entry.inputEvidenceId), 'mechanics.analyses.inputEvidenceId inexistente', errors);
    check(identifier(entry.resultEvidenceId) && groups.evidence.some(evidence => evidence.id === entry.resultEvidenceId), 'mechanics.analyses.resultEvidenceId inexistente', errors);
    check(entry.inputEvidenceId !== entry.resultEvidenceId, 'mechanics.analyses entrada y resultado iguales', errors);
    check(integer(entry.delayMinutes, 1) && Number(entry.delayMinutes) <= 240, 'mechanics.analyses.delayMinutes fuera de rango', errors);
    // El tipo forense es opcional (los expedientes generados antes de esta
    // entrega no lo declaran y el motor lo deriva); si está presente debe
    // ser uno de los seis canónicos del GDD §11.
    if (entry.forensicType !== undefined) {
      check(typeof entry.forensicType === 'string' && FORENSIC_TYPES.includes(entry.forensicType as ForensicType),
        'mechanics.analyses.forensicType no canónico', errors);
    }
  }
}

function talkEvidence(mechanics: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entries = recordList(mechanics.talkEvidence);
  check(Array.isArray(mechanics.talkEvidence), 'mechanics.talkEvidence', errors);
  for (const entry of entries) {
    check(identifier(entry.npcId) && groups.npcs.some(npc => npc.id === entry.npcId), 'mechanics.talkEvidence.npcId inexistente', errors);
    check(identifier(entry.topicId) && entry.topicId !== 'identidad', 'mechanics.talkEvidence.topicId inválido (identidad es el tema reservado)', errors);
    check(text(entry.label), 'mechanics.talkEvidence.label', errors);
    check(identifier(entry.evidenceId) && groups.evidence.some(evidence => evidence.id === entry.evidenceId), 'mechanics.talkEvidence.evidenceId inexistente', errors);
    if (entry.requiresRelation !== undefined) check(typeof entry.requiresRelation === 'boolean', 'mechanics.talkEvidence.requiresRelation', errors);
  }
}

function checkWarrantCombinations(entry: DataRecord, groups: EntityGroups, errors: string[]): void {
  const combinations = Array.isArray(entry.warrantCombinations) ? entry.warrantCombinations : [];
  check(combinations.length >= 1, 'mechanics.suspects.warrantCombinations vacío', errors);
  for (const combination of combinations) {
    const ids = stringList(combination);
    check(Array.isArray(combination) && ids.length >= 1, 'mechanics.suspects.warrantCombinations combinación vacía', errors);
    for (const id of ids) check(groups.evidence.some(evidence => evidence.id === id), 'mechanics.suspects.warrantCombinations evidencia inexistente', errors);
  }
}

function checkSuspect(entry: DataRecord, groups: EntityGroups, errors: string[]): void {
  check(identifier(entry.id) && groups.npcs.some(npc => npc.id === entry.id), 'mechanics.suspects.id inexistente', errors);
  check(identifier(entry.cityId) && groups.cities.some(city => city.id === entry.cityId), 'mechanics.suspects.cityId inexistente', errors);
  check(identifier(entry.locationId) && groups.locations.some(location => location.id === entry.locationId && location.cityId === entry.cityId), 'mechanics.suspects.locationId inexistente o en otra ciudad', errors);
  const known = stringList(entry.knownFromEvidence);
  check(Array.isArray(entry.knownFromEvidence) && known.length >= 1, 'mechanics.suspects.knownFromEvidence vacío', errors);
  for (const id of known) check(groups.evidence.some(evidence => evidence.id === id), 'mechanics.suspects.knownFromEvidence inexistente', errors);
  checkWarrantCombinations(entry, groups, errors);
  if (entry.accessEvidenceIds !== undefined) {
    for (const id of stringList(entry.accessEvidenceIds)) check(groups.evidence.some(evidence => evidence.id === id), 'mechanics.suspects.accessEvidenceIds inexistente', errors);
  }
}

function suspects(mechanics: DataRecord, def: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entries = recordList(mechanics.suspects);
  check(Array.isArray(mechanics.suspects) && entries.length >= 1, 'mechanics.suspects: al menos un sospechoso', errors);
  check(entries.some(entry => entry.id === def.solution), 'mechanics.suspects debe incluir la solución', errors);
  for (const entry of entries) checkSuspect(entry, groups, errors);
}

function recovery(mechanics: DataRecord, groups: EntityGroups, errors: string[]): void {
  const entry = mechanics.recovery;
  if (!isRecord(entry)) { errors.push('mechanics.recovery: objeto obligatorio.'); return; }
  check(identifier(entry.objectId), 'mechanics.recovery.objectId inválido', errors);
  check(text(entry.label), 'mechanics.recovery.label', errors);
  check(identifier(entry.cityId) && groups.cities.some(city => city.id === entry.cityId), 'mechanics.recovery.cityId inexistente', errors);
  check(identifier(entry.locationId) && groups.locations.some(location => location.id === entry.locationId && location.cityId === entry.cityId), 'mechanics.recovery.locationId inexistente o en otra ciudad', errors);
  const evidence = groups.evidence.find(item => item.id === entry.evidenceId);
  check(evidence !== undefined, 'mechanics.recovery.evidenceId inexistente', errors);
  check(evidence?.type === 'object', 'mechanics.recovery.evidenceId debe ser un objeto', errors);
  check(evidence?.origin === entry.locationId, 'mechanics.recovery.evidenceId debe originarse en el lugar de recuperación', errors);
  check(typeof entry.requiresAccessWarrant === 'boolean', 'mechanics.recovery.requiresAccessWarrant', errors);
}

function checkEvidenceTexts(value: DataRecord, evidenceIds: Set<string>, errors: string[]): void {
  if (!isRecord(value.evidence)) { errors.push('texts.evidence: objeto obligatorio.'); return; }
  for (const id of Object.keys(value.evidence)) check(evidenceIds.has(id), 'texts.evidence referencia desconocida', errors);
  for (const id of evidenceIds) check(text((value.evidence as DataRecord)[id]), `texts.evidence falta el texto de ${id}`, errors);
}

// Contenido real (tercera vuelta, 2026-11-07): el texto debe nombrar al
// menos un elemento concreto del mundo del caso; si solo nombra el tema,
// el modelo solo puede parafrasearlo y nunca da información.
function checkKnowledgeContent(id: string, entry: string, anchors: KnowledgeContentAnchors | undefined, errors: string[]): void {
  if (!anchors || isKnowledgeLabelText(entry) || hasKnowledgeContent(entry, anchors)) return;
  errors.push(`texts.knowledge ${id} no nombra ningún elemento concreto del mundo del caso (lugar, objeto, procedimiento o suceso de las evidencias)`);
}

function checkKnowledgeTexts(value: DataRecord, groups: EntityGroups, errors: string[], anchors?: KnowledgeContentAnchors): void {
  if (!isRecord(value.knowledge)) { errors.push('texts.knowledge: objeto obligatorio.'); return; }
  for (const id of Object.keys(value.knowledge)) check(typeof id === 'string' && id.length > 0, 'texts.knowledge clave inválida', errors);
  for (const id of Object.keys(value.knowledge)) {
    const entry = (value.knowledge as DataRecord)[id];
    if (typeof entry === 'string' && isKnowledgeLabelText(entry)) {
      errors.push(`texts.knowledge ${id} es una etiqueta de tema, no una frase que diría el personaje`);
    }
    if (typeof entry === 'string') checkKnowledgeContent(id, entry, anchors, errors);
  }
  for (const npc of groups.npcs) {
    for (const token of stringList(npc.knowledge)) check(text((value.knowledge as DataRecord)[token]), `texts.knowledge falta el texto de ${token}`, errors);
  }
}

function checkGreetingTexts(value: DataRecord, npcIds: Set<string>, errors: string[]): void {
  if (!isRecord(value.greetings)) { errors.push('texts.greetings: objeto obligatorio.'); return; }
  for (const id of Object.keys(value.greetings)) check(npcIds.has(id), 'texts.greetings referencia desconocida', errors);
  for (const id of npcIds) check(text((value.greetings as DataRecord)[id]), `texts.greetings falta el saludo de ${id}`, errors);
  if (value.refusals !== undefined) {
    if (isRecord(value.refusals)) {
      for (const id of Object.keys(value.refusals)) check(npcIds.has(id), 'texts.refusals referencia desconocida', errors);
    } else {
      errors.push('texts.refusals: objeto obligatorio cuando está presente.');
    }
  }
}

function stringValues(value: unknown): string[] {
  return isRecord(value) ? Object.values(value).filter((entry): entry is string => typeof entry === 'string') : [];
}

function briefingParagraphs(def: DataRecord): string[] {
  if (!isRecord(def.briefing) || !Array.isArray(def.briefing.paragraphs)) return [];
  return def.briefing.paragraphs.filter((entry): entry is string => typeof entry === 'string');
}

function recoveryLabel(def: DataRecord): string[] {
  if (!isRecord(def.mechanics) || !isRecord(def.mechanics.recovery)) return [];
  return typeof def.mechanics.recovery.label === 'string' ? [def.mechanics.recovery.label] : [];
}

function contentAnchorsFor(def: DataRecord, groups: EntityGroups, value: DataRecord): KnowledgeContentAnchors {
  return knowledgeContentAnchors({
    locations: groups.locations.map(entry => ({ name: typeof entry.name === 'string' ? entry.name : undefined, description: typeof entry.description === 'string' ? entry.description : undefined })),
    cities: groups.cities.map(entry => ({ name: typeof entry.name === 'string' ? entry.name : undefined })),
    npcs: groups.npcs.map(entry => ({ name: typeof entry.name === 'string' ? entry.name : undefined, persona: typeof entry.persona === 'string' ? entry.persona : undefined })),
    evidenceTexts: stringValues(value.evidence),
    greetings: stringValues(value.greetings),
    briefing: briefingParagraphs(def),
    labels: [
      ...recordList(isRecord(def.mechanics) ? def.mechanics.inspectables : undefined).map(entry => entry.label),
      ...recordList(isRecord(def.mechanics) ? def.mechanics.queries : undefined).map(entry => entry.label),
      ...recordList(isRecord(def.mechanics) ? def.mechanics.talkEvidence : undefined).map(entry => entry.label),
      ...recoveryLabel(def),
    ].filter((entry): entry is string => typeof entry === 'string'),
  });
}

function texts(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  const value = def.texts;
  if (!isRecord(value)) { errors.push('texts: objeto obligatorio en un expediente generado.'); return; }
  const evidenceIds = new Set(groups.evidence.map(entry => String(entry.id)));
  const npcIds = new Set(groups.npcs.map(entry => String(entry.id)));
  checkEvidenceTexts(value, evidenceIds, errors);
  checkKnowledgeTexts(value, groups, errors, contentAnchorsFor(def, groups, value));
  checkGreetingTexts(value, npcIds, errors);
}

/** Mecánica y textos de un expediente generado; el caso fijo queda exento. */
export function validateMechanics(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  if (def.mechanics === undefined) return;
  if (!isRecord(def.mechanics)) { errors.push('mechanics: objeto obligatorio cuando está presente.'); return; }
  inspectables(def.mechanics, groups, errors);
  queries(def.mechanics, groups, errors);
  analyses(def.mechanics, groups, errors);
  talkEvidence(def.mechanics, groups, errors);
  suspects(def.mechanics, def, groups, errors);
  recovery(def.mechanics, groups, errors);
  texts(def, groups, errors);
}
