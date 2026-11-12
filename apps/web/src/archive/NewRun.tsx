import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { CaseSummary, LocaleKey } from '@meridiano/contracts';
import { deadlineMinutesForDifficulty, GDD_CRIME_TYPES, CRIME_TYPE_KEYS, CONTENT_RATING_KEYS, caseLabel } from '@meridiano/contracts';
import type { ContentRating, CrimeType } from '@meridiano/contracts';
import type { ArchiveState, createArchiveModel } from './model';
import type { Difficulty } from './creation';
import { repeatPreselect } from './creation';
import type { ExplorationMode } from './client';
import { displayCaseTitle, shortCaseRef } from './case-title';
import { useTranslation } from '../i18n';

type Props = { state: ArchiveState; model: ReturnType<typeof createArchiveModel> };
const difficultyOptions: { id: Difficulty; labelKey: LocaleKey; noteKey: LocaleKey }[] = [
  { id: 'easy', labelKey: 'labels.difficulty.easy', noteKey: 'newRun.difficulty.easyNote' },
  { id: 'normal', labelKey: 'labels.difficulty.normal', noteKey: 'newRun.difficulty.normalNote' },
  { id: 'hard', labelKey: 'labels.difficulty.hard', noteKey: 'newRun.difficulty.hardNote' },
];
const explorationOptions: { id: ExplorationMode; labelKey: LocaleKey; noteKey: LocaleKey }[] = [
  { id: 'guided', labelKey: 'labels.exploration.guided', noteKey: 'newRun.exploration.guidedNote' },
  { id: 'free', labelKey: 'labels.exploration.free', noteKey: 'newRun.exploration.freeNote' },
];
const hours = (minutes: number) => `${Math.round(minutes / 60)} h`;
const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
function randomOf<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}
export function NewRun({ state, model }: Props) {
  const t = useTranslation();
  return <section className="archive-create" aria-labelledby="new-run-title"><p className="archive-overline">{t('newRun.overline')}</p><h2 id="new-run-title">{t('newRun.title')}</h2><p>{t('newRun.intro')}</p><CreationContent state={state} model={model} /><CaseExchange state={state} model={model} /></section>;
}
/** Descarga del expediente propio (DEC-011): el fichero contiene la
 * solución, así que solo lo ve su dueño y nunca sale en la proyección. */
async function downloadExport(model: ReturnType<typeof createArchiveModel>, caseId: string): Promise<void> {
  const file = await model.exportCase(caseId);
  if (!file) return;
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
/** Entrada de importar: un fichero .json de expediente; el servidor lo
 * valida (v1.5) antes de registrarlo en el catálogo. */
function CaseExchange({ state, model }: Props) {
  const t = useTranslation();
  const busy = state.phase === 'loading';
  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await model.importCase(await file.text());
    event.target.value = '';
  }
  return <div>
    <h3>{t('newRun.importTitle')}</h3>
    <p>{t('newRun.importHelp')}</p>
    <label>{t('newRun.importLabel')} <input type="file" accept=".json,application/json" disabled={busy} onChange={event => void onFile(event)} /></label>
  </div>;
}
function openCreatedRun(previousPhase: string, phase: string, runId: string | null, navigate: (path: string) => void): void {
  if (previousPhase !== 'created' && phase === 'created' && runId) navigate('/runs/' + runId);
}
function useCrimeChoice(playableCrimes: CrimeType[]) {
  const [crime, setCrime] = useState<CrimeType>('robo');
  const [resolvedCrime, setResolvedCrime] = useState<CrimeType>('robo');
  const [surprised, setSurprised] = useState(false);
  function chooseCrime(next: CrimeType) {
    setCrime(next);
    setSurprised(false);
    if (next === 'aleatorio') {
      const pick = randomOf(playableCrimes);
      if (pick) setResolvedCrime(pick);
    } else {
      setResolvedCrime(next);
    }
  }
  function markSurprised() { setSurprised(true); }
  function resetChoice() { setCrime('robo'); setResolvedCrime('robo'); setSurprised(false); }
  return { crime, resolvedCrime, surprised, chooseCrime, markSurprised, resetChoice };
}
function CreationContent({ state, model }: Props) {
  const t = useTranslation();
  const [content, setContent] = useState<ContentRating>('familiar');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [exploration, setExploration] = useState<ExplorationMode>('guided');
  const [caseId, setCaseId] = useState<string | null>(null);
  const navigate = useNavigate();
  const previousPhase = useRef(state.creation.phase);
  const busy = state.phase === 'loading';
  // Delitos con al menos un expediente validado y jugable: hoy solo robo.
  // Los demás se muestran desactivados, no se prometen.
  const playableCrimes = GDD_CRIME_TYPES.filter(item => item !== 'aleatorio' && state.cases.some(entry => entry.canStart && entry.crimeType === item));
  const choice = useCrimeChoice(playableCrimes);
  const { crime, resolvedCrime, surprised } = choice;
  const location = useLocation();
  const repeatApplied = useRef(false);
  const chooseCrimeRef = useRef(choice.chooseCrime);
  chooseCrimeRef.current = choice.chooseCrime;
  // Expedientes del delito y contenido elegidos; si hay varios, se elige.
  const matchingCases = state.cases.filter(item => item.canStart && item.crimeType === resolvedCrime && item.contentRating === content);
  const selectedCase = matchingCases.find(item => item.caseId === caseId) ?? matchingCases[0];
  const hasGeneral = state.cases.some(item => item.canStart && item.crimeType === resolvedCrime && item.contentRating === 'general');
  function chooseContent(next: ContentRating) {
    setContent(next);
    setCaseId(null);
  }
  function chooseCrimeAndReset(next: CrimeType) {
    choice.chooseCrime(next);
    setCaseId(null);
  }
  function surprise() {
    // SORPRÉNDEME sortea entre TODO lo disponible, incluidos los generados:
    // un expediente concreto (delito + contenido), no solo un delito.
    const available = state.cases.filter(item => item.canStart);
    const pick = randomOf(available);
    if (pick) {
      choice.chooseCrime(pick.crimeType);
      choice.markSurprised();
      setContent(pick.contentRating);
      setCaseId(pick.caseId);
    }
    setDifficulty(randomOf(difficulties) ?? 'normal');
  }
  // Al confirmarse una creación nueva, se abre su pantalla de juego. Al volver
  // al archivo después, la creación ya no está en transición y no se navega sola.
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = state.creation.phase;
    openCreatedRun(previous, state.creation.phase, state.creation.runId, navigate);
  }, [state.creation.phase, state.creation.runId, navigate]);
  // «Repetir este expediente» (informe final, fase 4): el estado de
  // navegación trae el expediente y la dificultad; se aplica una sola vez
  // cuando el catálogo ya trae el expediente (puede llegar vacío al
  // montar). Un expediente que ya no está no preselecciona nada.
  useEffect(() => {
    if (repeatApplied.current) return;
    const navigationState = location.state as { repeatCaseId?: unknown; difficulty?: unknown } | null;
    const repeat = repeatPreselect(state.cases, navigationState?.repeatCaseId, navigationState?.difficulty);
    if (!repeat) return;
    repeatApplied.current = true;
    chooseCrimeRef.current(repeat.crimeType);
    setContent(repeat.contentRating);
    setDifficulty(repeat.difficulty);
    setCaseId(repeat.caseId);
  }, [location.state, state.cases]);
  function submit(event: FormEvent) { event.preventDefault(); if (selectedCase) void model.createCase(selectedCase.caseId, difficulty, { crimeType: resolvedCrime, contentRating: content, explorationMode: exploration }); }
  if (state.creation.phase !== 'idle') return <CreationPhaseView state={state} model={model} busy={busy} onPrepareAnother={() => { choice.resetChoice(); setContent('familiar'); setDifficulty('normal'); setExploration('guided'); setCaseId(null); model.prepareCreation(); }} />;
  return <form onSubmit={submit}>
    <DifficultyField busy={busy} difficulty={difficulty} selectedCase={selectedCase} onChange={setDifficulty} />
    <ExplorationField busy={busy} exploration={exploration} onChange={setExploration} />
    <CrimeField playableCrimes={playableCrimes} crime={crime} resolvedCrime={resolvedCrime} busy={busy} surprised={surprised} selectedCase={selectedCase} onChoose={chooseCrimeAndReset} onSurprise={surprise} />
    <ContentField content={content} busy={busy} hasGeneral={hasGeneral} onChange={chooseContent} />
    {matchingCases.length > 1 && <CaseField cases={matchingCases} selectedCase={selectedCase} busy={busy} onChange={setCaseId} />}
    {selectedCase && <p>{t('newRun.caseLine', { title: displayCaseTitle(selectedCase.title), label: caseLabel(selectedCase.crimeType, selectedCase.contentRating, t), hours: hours(selectedCase.deadlineMinutes), ref: shortCaseRef(selectedCase.caseId) })}{selectedCase.hasMultipleRoutes ? '' : t('newRun.caseSingleRoute')}</p>}
    <ExportOwnCaseButton model={model} selectedCase={selectedCase} busy={busy} />
    {!selectedCase && state.cases.length > 0 && <p>{t('newRun.noMatching')}</p>}
    <button type="submit" disabled={busy || !selectedCase}>{t('newRun.start')}</button>{state.cases.length === 0 && <p>{t('newRun.noCases')}</p>}
  </form>;
}
type DifficultyFieldProps = { busy: boolean; difficulty: Difficulty; selectedCase: { deadlineMinutes: number } | undefined; onChange: (next: Difficulty) => void };
function ExportOwnCaseButton({ model, selectedCase, busy }: { model: ReturnType<typeof createArchiveModel>; selectedCase: CaseSummary | undefined; busy: boolean }) {
  const t = useTranslation();
  if (!selectedCase?.ownedByMe) return null;
  return <p><button type="button" disabled={busy} onClick={() => void downloadExport(model, selectedCase.caseId)}>{t('newRun.export')}</button>{t('newRun.exportHelp')}</p>;
}
function DifficultyField({ busy, difficulty, selectedCase, onChange }: DifficultyFieldProps) {
  const t = useTranslation();
  return <fieldset disabled={busy} className="difficulty-field"><legend>{t('newRun.difficulty')}</legend><div className="difficulty-options">{difficultyOptions.map(option => <label key={option.id}><input type="radio" name="difficulty" value={option.id} checked={difficulty === option.id} onChange={() => onChange(option.id)} /> <span><strong>{t(option.labelKey)}{selectedCase ? t('newRun.deadline', { hours: hours(deadlineMinutesForDifficulty(selectedCase.deadlineMinutes, option.id)) }) : ''}</strong> — {t(option.noteKey)}</span></label>)}</div></fieldset>;
}
/** Modo de exploración (GDD §5): independiente de la dificultad; en libre
 * las ciudades del expediente se descubren investigando. */
function ExplorationField({ busy, exploration, onChange }: { busy: boolean; exploration: ExplorationMode; onChange: (next: ExplorationMode) => void }) {
  const t = useTranslation();
  return <fieldset disabled={busy} className="difficulty-field"><legend>{t('newRun.exploration')}</legend><div className="difficulty-options">{explorationOptions.map(option => <label key={option.id}><input type="radio" name="exploration" value={option.id} checked={exploration === option.id} onChange={() => onChange(option.id)} /> <span><strong>{t(option.labelKey)}</strong> — {t(option.noteKey)}</span></label>)}</div><p>{t('newRun.explorationHelp')}</p></fieldset>;
}
type PhaseViewProps = Props & { busy: boolean; onPrepareAnother: () => void };
function CreationPhaseView({ state, model, busy, onPrepareAnother }: PhaseViewProps) {
  const t = useTranslation();
  if (state.creation.phase === 'created') return <div><p>{t('newRun.created', { ref: state.creation.runId?.slice(0, 8) ?? '' })}</p><div className="archive-actions"><Link to={'/runs/' + state.creation.runId}>{t('newRun.playNow')}</Link><button type="button" disabled={busy} onClick={onPrepareAnother}>{t('newRun.prepareAnother')}</button></div></div>;
  if (state.creation.phase === 'blocked') return <div><p>{t('newRun.blocked')}</p><div className="archive-actions"><button type="button" disabled={busy} onClick={() => { void model.discardCreation(); }}>{t('newRun.discard')}</button></div></div>;
  if (state.creation.phase === 'uncertain' || state.creation.phase === 'sending') return <PendingCreation state={state} model={model} />;
  return null;
}
type CrimeFieldProps = { playableCrimes: CrimeType[]; crime: CrimeType; resolvedCrime: CrimeType; busy: boolean; surprised: boolean; selectedCase: { crimeType: CrimeType; contentRating: ContentRating } | undefined; onChoose: (next: CrimeType) => void; onSurprise: () => void };
function CrimeField({ playableCrimes, crime, resolvedCrime, busy, surprised, selectedCase, onChoose, onSurprise }: CrimeFieldProps) {
  const t = useTranslation();
  return <><fieldset disabled={busy}><legend>{t('newRun.crime')}</legend>{GDD_CRIME_TYPES.map(item => {
    const playable = item === 'aleatorio' ? playableCrimes.length > 0 : playableCrimes.includes(item);
    return <label key={item}><input type="radio" name="crime" value={item} checked={crime === item} disabled={!playable} onChange={() => onChoose(item)} /> {t(CRIME_TYPE_KEYS[item])}{item === 'aleatorio' && crime === 'aleatorio' && resolvedCrime ? ` → ${t(CRIME_TYPE_KEYS[resolvedCrime])}` : ''}{!playable ? t('newRun.noValidated') : ''}</label>;
  })}</fieldset>
  <p><button type="button" disabled={busy || playableCrimes.length === 0} onClick={onSurprise}>{t('newRun.surprise')}</button>{t('newRun.surpriseHelp')}{surprised && selectedCase ? t('newRun.surprisePicked', { label: caseLabel(selectedCase.crimeType, selectedCase.contentRating, t) }) : ''}</p></>;
}
type ContentFieldProps = { content: ContentRating; busy: boolean; hasGeneral: boolean; onChange: (next: ContentRating) => void };
function ContentField({ content, busy, hasGeneral, onChange }: ContentFieldProps) {
  const t = useTranslation();
  return <fieldset disabled={busy} className="content-field"><legend>{t('newRun.content')}</legend>
    <label><input type="radio" name="content" value="familiar" checked={content === 'familiar'} onChange={() => onChange('familiar')} /> {t(CONTENT_RATING_KEYS.familiar)} — {t('newRun.contentFamiliarNote')}</label>
    <label><input type="radio" name="content" value="general" checked={content === 'general'} disabled={!hasGeneral} onChange={() => onChange('general')} /> {t(CONTENT_RATING_KEYS.general)}{hasGeneral ? t('newRun.contentGeneralHelp') : t('newRun.contentGeneralEmpty')}</label>
  </fieldset>;
}
type CaseFieldProps = { cases: { caseId: string; title: string; crimeType: CrimeType; contentRating: ContentRating; deadlineMinutes: number; hasMultipleRoutes: boolean }[]; selectedCase: { caseId: string } | undefined; busy: boolean; onChange: (caseId: string) => void };
function CaseField({ cases, selectedCase, busy, onChange }: CaseFieldProps) {
  const t = useTranslation();
  return <fieldset disabled={busy}><legend>{t('newRun.case')}</legend>{cases.map(item => <label key={item.caseId}><input type="radio" name="case" value={item.caseId} checked={selectedCase?.caseId === item.caseId} onChange={() => onChange(item.caseId)} /> {t('newRun.caseOption', { title: displayCaseTitle(item.title), label: caseLabel(item.crimeType, item.contentRating, t), hours: hours(item.deadlineMinutes), ref: shortCaseRef(item.caseId) })}{item.hasMultipleRoutes ? '' : t('newRun.caseSingleRoute')}</label>)}</fieldset>;
}
function PendingCreation({ state, model }: Props) {
  const t = useTranslation();
  const busy = state.phase === 'loading';
  const title = state.cases.find(item => item.caseId === state.creation.caseId)?.title ?? t('newRun.pendingTitle');
  return <div><p>{t('newRun.pending', { title })}</p><div className="archive-actions"><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(); }}>{t('newRun.checkCreation')}</button><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(true); }}>{t('newRun.retryCreation')}</button><button type="button" disabled={busy} onClick={() => { void model.discardCreation(); }}>{t('newRun.discard')}</button></div></div>;
}
