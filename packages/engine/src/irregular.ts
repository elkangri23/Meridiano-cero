// Acciones irregulares (GDD §14, SPEC-008): forzar un acceso, sobornar o
// suplantar. Son intenciones de juego, no un tutorial de delito: el motor
// no enseña cómo cometerlas en el mundo real, solo resuelve lo que pasa
// en la partida cuando el jugador las intenta.
//
// Reglas (deterministas, sin detector omnisciente):
// - Cada acto cuesta 30 min y queda registrado para siempre (no se puede
//   deshacer: por eso siempre pide confirmación, con los riesgos conocidos).
// - Testigos: solo personajes que están en la misma ciudad y podrían verlo.
//   Forzar un acceso lo ven los NPC de esa ciudad; sobornar lo ven los
//   demás NPC de la ciudad; suplantar lo acaba descubriendo además la
//   propia víctima (compara notas con la persona suplantada).
// - Ser visto: advertencia de A.C.M.E. y la cooperación de los testigos
//   cae a 0 (sus temas que exigen cooperación dejan de ofrecerse). A la
//   tercera vez que te ven, A.C.M.E. retira el caso y la partida se cierra.
// - Lo obtenido por vía irregular no es admisible: lo que se recupera tras
//   forzar el acceso ya era inadmisible (`recover` lo marca) y lo que un
//   personaje cuenta sobornado o suplantado se marca inadmisible aquí, así
//   que no puede sostener una orden (las órdenes ya exigen admisibilidad).
// - Ningún acto revela la solución: sobornar o suplantar solo revela lo
//   mismo que una conversación normal con ese personaje (sus hechos
//   autorizados), saltándose el bloqueo por cooperación perdida. Inés, por
//   ejemplo, sigue sin declarar sobre el robo: su negativa no se compra.
// - «Entrar sin permiso» no tiene acción propia: no hay ubicaciones
//   inaccesibles en los expedientes (todas son `accessible: true`); el
//   acceso restringido es el del lugar de recuperación con orden, y se
//   fuerza con `force_entry`.
import type { CaseDefinition, CaseRun, IrregularKind, MisconductRecord } from '@meridiano/case-schema';
import { IRREGULAR_MINUTES, isIrregularKind, caseText, resolveMessage, type Language } from '@meridiano/case-schema';
import type { Action, ActionPreview, ActionResult, EngineEvent } from './types.js';
import { isFixedCase } from './fixed-case.js';
import { knowsEvidence, revealTalk } from './fixed-evidence.js';
import { revealGeneratedTalk } from './generated-mechanics.js';
import { buildFinalReport } from './final-report.js';
import { misconductOf, witnessedCount, irregularTargetName, WITNESSED_WITHDRAWAL_COUNT } from './misconduct.js';

export { IRREGULAR_MINUTES };
export { misconductOf, witnessedCount, irregularTargetName, WITNESSED_WITHDRAWAL_COUNT } from './misconduct.js';

export const IRREGULAR_KIND_LABELS: Record<IrregularKind, string> = {
  force_entry: 'forzar el acceso',
  bribe: 'sobornar',
  impersonate: 'suplantar',
};

function nextMisconductId(run: CaseRun): string {
  return 'irr-' + (misconductOf(run).length + 1);
}

/** Lugar de recuperación del expediente, si exige orden de acceso. */
function recoveryLocation(def: CaseDefinition): { locationId: string; cityId: string } | undefined {
  if (isFixedCase(def)) return { locationId: 'LIS-ALM', cityId: 'lisboa' };
  const recovery = def.mechanics?.recovery;
  if (!recovery || !recovery.requiresAccessWarrant) return undefined;
  return { locationId: recovery.locationId, cityId: recovery.cityId };
}

function locationName(def: CaseDefinition, locationId: string, language: Language = 'es'): string {
  return caseText(def.id, 'location.' + locationId + '.name', language)
    ?? def.locations.find(location => location.id === locationId)?.name ?? locationId;
}

function npcName(def: CaseDefinition, npcId: string): string {
  return def.npcs.find(npc => npc.id === npcId)?.name ?? npcId;
}

/** ¿Tiene este personaje algo que contar por conversación y aún no lo ha
 * contado? (identidad o temas de su mecánica). Sin nada que revelar, ni
 * hablar ni sobornar ni suplantar tienen sentido. */
export function hasUnrevealedTalkFacts(def: CaseDefinition, run: CaseRun, npcId: string): boolean {
  if (!run.discoveries.includes('identity:' + npcId)) return true;
  if (isFixedCase(def)) return npcId === 'lucia' && !knowsEvidence(run, 'EV-09');
  return (def.mechanics?.talkEvidence ?? [])
    .some(entry => entry.npcId === npcId && !knowsEvidence(run, entry.evidenceId));
}

export interface IrregularPlan {
  ok: boolean;
  reason?: string;
  witnesses?: string[];
  targetLabel?: string;
}

/** El plan de un acto irregular: si se puede intentar, quién podría
 * verlo y cómo se llama el objetivo. Lo usan las ofertas, la vista previa
 * y el handler, para que los tres digan lo mismo. */
export function irregularPlan(def: CaseDefinition, run: CaseRun, kind: IrregularKind, targetId: string, language: Language = 'es'): IrregularPlan {
  if (run.status !== 'active') return { ok: false, reason: resolveMessage(language, 'engine.reason.runClosed') };
  return kind === 'force_entry' ? forceEntryPlan(def, run, targetId, language) : npcPlan(def, run, kind, targetId, language);
}

function forceEntryPlan(def: CaseDefinition, run: CaseRun, targetId: string, language: Language): IrregularPlan {
  const recovery = recoveryLocation(def);
  if (!recovery || recovery.locationId !== targetId) return { ok: false, reason: resolveMessage(language, 'engine.reason.accessUnavailable') };
  if (run.position.locationId !== targetId) return { ok: false, reason: resolveMessage(language, 'engine.reason.notThere') };
  if (run.warrants.includes('warrant:access')) return { ok: false, reason: resolveMessage(language, 'engine.reason.accessWarrantHave') };
  if (run.discoveries.includes('forced-entry')) return { ok: false, reason: resolveMessage(language, 'engine.reason.accessForced') };
  return { ok: true, witnesses: def.npcs.filter(npc => npc.cityId === recovery.cityId).map(npc => npc.id),
    targetLabel: locationName(def, targetId, language) };
}

function npcPlan(def: CaseDefinition, run: CaseRun, kind: IrregularKind, targetId: string, language: Language): IrregularPlan {
  const npc = def.npcs.find(item => item.id === targetId);
  if (!npc || npc.cityId !== run.position.cityId) return { ok: false, reason: resolveMessage(language, 'engine.reason.npcUnavailable') };
  if (!hasUnrevealedTalkFacts(def, run, targetId)) return { ok: false, reason: resolveMessage(language, 'engine.reason.npcToldAll') };
  const others = def.npcs.filter(item => item.cityId === npc.cityId && item.id !== targetId).map(item => item.id);
  return { ok: true, witnesses: kind === 'impersonate' ? [targetId, ...others] : others,
    targetLabel: npcName(def, targetId) };
}

export function isIrregularParams(value: unknown): value is { kind: IrregularKind; targetId: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'kind,targetId') return false;
  if (!isIrregularKind(data.kind)) return false;
  return typeof data.targetId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(data.targetId);
}

/** Lo que el personaje cuenta cuando se le soborna o suplanta: exactamente
 * lo que contaría en una conversación normal (identidad + sus temas),
 * saltándose el bloqueo por cooperación perdida. La cooperación NO se
 * restaura: el soborno no arregla la relación, solo compra esa charla.
 * Lo revelado queda marcado inadmisible por quien lo aplica. */
function revealIrregularTalk(def: CaseDefinition, run: CaseRun, npcId: string): { run: CaseRun; revealedEvidence: string[] } {
  const before = new Set(run.discoveries);
  // La charla normal exige cooperación para algunos temas; el acto
  // irregular la salta solo para esta revelación y se restaura después.
  let current: CaseRun = { ...run,
    npcRelations: { ...run.npcRelations, [npcId]: Math.max(1, run.npcRelations[npcId] ?? 0) } };
  current = isFixedCase(def)
    ? revealTalk(def, current, npcId, 'identidad')
    : revealGeneratedTalk(def, current, npcId, 'identidad');
  if (isFixedCase(def)) {
    if (npcId === 'lucia') current = revealTalk(def, current, npcId, 'caja');
  } else {
    for (const entry of def.mechanics?.talkEvidence.filter(item => item.npcId === npcId) ?? []) {
      current = revealGeneratedTalk(def, current, npcId, entry.topicId);
    }
  }
  const revealedEvidence = current.discoveries
    .filter(id => !before.has(id) && def.evidence.some(evidence => evidence.id === id));
  return { run: { ...current, npcRelations: run.npcRelations }, revealedEvidence };
}

function irregularDescription(def: CaseDefinition, run: CaseRun, kind: IrregularKind, targetId: string, witnesses: string[], language: Language): string {
  const seen = witnessedCount(run);
  const target = irregularTargetName(def, kind, targetId, language);
  const witnessNames = witnesses.map(id => npcName(def, id)).join(resolveMessage(language, 'engine.irregular.witnessJoin'));
  const seenText = seen === 0
    ? resolveMessage(language, 'engine.irregular.seenNone')
    : seen === 1
      ? resolveMessage(language, 'engine.irregular.seenOnce')
      : resolveMessage(language, 'engine.irregular.seenMany', { count: seen });
  const withdrawalText = resolveMessage(language, 'engine.irregular.withdrawal', { count: WITNESSED_WITHDRAWAL_COUNT });
  const vars = { target, minutes: IRREGULAR_MINUTES, seen: seenText, withdrawal: withdrawalText };
  if (kind === 'force_entry') {
    const who = witnessNames.length === 0
      ? resolveMessage(language, 'engine.irregular.whoNobodyCity')
      : resolveMessage(language, 'engine.irregular.whoSome', { names: witnessNames });
    return resolveMessage(language, 'engine.irregular.forceDescription', { ...vars, who });
  }
  const who = witnesses.length === 0
    ? resolveMessage(language, 'engine.irregular.whoNobodyElse')
    : resolveMessage(language, 'engine.irregular.whoSome', { names: witnessNames });
  if (kind === 'bribe') {
    return resolveMessage(language, 'engine.irregular.bribeDescription', { ...vars, who });
  }
  return resolveMessage(language, 'engine.irregular.impersonateDescription', { ...vars, who });
}

export function irregularPreview(def: CaseDefinition, run: CaseRun, action: Action, language: Language = 'es'): ActionPreview | undefined {
  if (!isIrregularParams(action.params)) return undefined;
  const plan = irregularPlan(def, run, action.params.kind, action.params.targetId, language);
  if (!plan.ok || !plan.witnesses) return undefined;
  return { actionType: 'irregular', estimatedMinutes: IRREGULAR_MINUTES, estimatedEndTime: run.minute + IRREGULAR_MINUTES,
    description: irregularDescription(def, run, action.params.kind, action.params.targetId, plan.witnesses, language) };
}

function irregularRecordText(kind: IrregularKind, targetId: string, minute: number): string {
  return `irregular:${kind}:${targetId}@${minute}`;
}

/** Hechos autorizados extra para charlar con un personaje sobre lo que
 * pasó con él: solo lo que ese personaje sabe de verdad (lo que le hiciste
 * o lo que vio). El director los usa si el jugador pregunta por ello; no
 * inventan nada del caso. */
export function misconductFactsForNpc(def: CaseDefinition, run: CaseRun, npcId: string, language: Language = 'es'): Array<{ id: string; text: string }> {
  const facts: Array<{ id: string; text: string }> = [];
  for (const record of misconductOf(run)) {
    const target = irregularTargetName(def, record.kind, record.targetId, language);
    if (record.targetId === npcId) {
      facts.push({ id: `misconduct:${record.id}`,
        text: record.kind === 'force_entry'
          ? resolveMessage(language, 'engine.misconduct.forceTarget', { target, minute: record.minute })
          : record.kind === 'bribe'
            ? resolveMessage(language, 'engine.misconduct.bribeTarget', { minute: record.minute })
            : resolveMessage(language, 'engine.misconduct.impersonateTarget', { minute: record.minute }) });
    } else if (record.seenBy.includes(npcId)) {
      facts.push({ id: `misconduct:${record.id}`,
        text: record.kind === 'force_entry'
          ? resolveMessage(language, 'engine.misconduct.forceSeen', { target, minute: record.minute })
          : record.kind === 'bribe'
            ? resolveMessage(language, 'engine.misconduct.bribeSeen', { target: irregularTargetName(def, record.kind, record.targetId, language), minute: record.minute })
            : resolveMessage(language, 'engine.misconduct.impersonateSeen', { target: irregularTargetName(def, record.kind, record.targetId, language), minute: record.minute }) });
    }
  }
  return facts;
}

/** Efecto propio del acto sobre el estado: forzar el acceso marca el
 * marcador que habilita `recover`; sobornar o suplantar revela lo que el
 * personaje contaría en una charla normal y mancha lo revelado. */
function applyIrregularEffect(def: CaseDefinition, current: CaseRun, kind: IrregularKind, targetId: string): CaseRun {
  if (kind === 'force_entry') return { ...current, discoveries: [...current.discoveries, 'forced-entry'] };
  const revealed = revealIrregularTalk(def, current, targetId);
  const admissibility = { ...revealed.run.admissibility };
  for (const id of revealed.revealedEvidence) admissibility[id] = false;
  return { ...revealed.run, admissibility };
}

/** Consecuencias de que te vean: advertencia de A.C.M.E. (marcador en el
 * dossier + registro) y la cooperación de los testigos cae a 0. */
function applySeenConsequences(current: CaseRun, record: MisconductRecord, witnesses: string[], minute: number): CaseRun {
  const relations = { ...current.npcRelations };
  for (const witness of witnesses) relations[witness] = 0;
  return { ...current,
    npcRelations: relations,
    discoveries: current.discoveries.includes('warning') ? current.discoveries : [...current.discoveries, 'warning'],
    conversationRecords: [...current.conversationRecords, `warning:${record.id}@${minute}`] };
}

/** Retirada del caso por A.C.M.E.: la partida se cierra con el informe de
 * retirada y el evento que la cronología enseña. */
function closeWithdrawn(def: CaseDefinition, current: CaseRun, events: EngineEvent[], minute: number, language: Language): ActionResult {
  const report = buildFinalReport(def, current, 'withdrawn', language);
  const closedRun: CaseRun = { ...current, status: 'closed', finalReport: report };
  return { status: 'case_closed', run: closedRun,
    events: [...events, { ordinal: 0, minute, type: 'case_withdrawn', payload: { reason: 'withdrawn' } }], report };
}

export function submitIrregular(def: CaseDefinition, run: CaseRun, params: Record<string, unknown>, language: Language = 'es'): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  if (!isIrregularParams(params)) return refuse(resolveMessage(language, 'engine.reason.irregularUnavailable'));
  const plan = irregularPlan(def, run, params.kind, params.targetId, language);
  if (!plan.ok || !plan.witnesses) return refuse(plan.reason ?? resolveMessage(language, 'engine.reason.irregularUnavailable'));
  const witnesses = plan.witnesses;
  const seen = witnesses.length > 0;
  const record: MisconductRecord = { id: nextMisconductId(run), kind: params.kind, targetId: params.targetId,
    minute: run.minute, seenBy: [...witnesses] };

  let current: CaseRun = { ...run, version: run.version + 1,
    misconduct: [...misconductOf(run), record],
    conversationRecords: [...run.conversationRecords, irregularRecordText(params.kind, params.targetId, run.minute)] };
  current = applyIrregularEffect(def, current, params.kind, params.targetId);
  if (seen) current = applySeenConsequences(current, record, witnesses, run.minute);
  const events = [{ ordinal: 0, minute: run.minute, type: 'irregular',
    payload: { kind: params.kind, targetId: params.targetId, seenBy: [...witnesses] } }];

  if (seen && witnessedCount(current) >= WITNESSED_WITHDRAWAL_COUNT) return closeWithdrawn(def, current, events, run.minute, language);
  return { status: 'applied', run: current, events };
}
