import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deadlineMinutesForDifficulty, GDD_CRIME_TYPES, CRIME_TYPE_LABELS, caseLabel } from '@meridiano/case-schema';
import type { ContentRating, CrimeType } from '@meridiano/case-schema';
import type { ArchiveState, createArchiveModel } from './model';
import type { Difficulty } from './creation';

type Props = { state: ArchiveState; model: ReturnType<typeof createArchiveModel> };
const difficultyOptions: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Fácil', note: 'El doble de tiempo para resolver el caso.' },
  { id: 'normal', label: 'Normal', note: 'El plazo con el que se diseñó el expediente.' },
  { id: 'hard', label: 'Difícil', note: 'La mitad de tiempo. Para quien ya conoce el caso.' },
];
const hours = (minutes: number) => `${Math.round(minutes / 60)} h`;
const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
function randomOf<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}
export function NewRun({ state, model }: Props) {
  return <section className="archive-create" aria-labelledby="new-run-title"><p className="archive-overline">Nueva investigación</p><h2 id="new-run-title">Nueva partida</h2><p>Elige un delito y una dificultad para empezar a investigar.</p><CreationContent state={state} model={model} /></section>;
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
  function surpriseChoice() {
    const pick = randomOf(playableCrimes);
    if (pick) { setCrime('aleatorio'); setResolvedCrime(pick); }
    setSurprised(true);
  }
  function resetChoice() { setCrime('robo'); setResolvedCrime('robo'); setSurprised(false); }
  return { crime, resolvedCrime, surprised, chooseCrime, surpriseChoice, resetChoice };
}
function CreationContent({ state, model }: Props) {
  const [content, setContent] = useState<ContentRating>('familiar');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const navigate = useNavigate();
  const previousPhase = useRef(state.creation.phase);
  const busy = state.phase === 'loading';
  // Delitos con al menos un expediente validado y jugable: hoy solo robo.
  // Los demás se muestran desactivados, no se prometen.
  const playableCrimes = GDD_CRIME_TYPES.filter(item => item !== 'aleatorio' && state.cases.some(entry => entry.canStart && entry.crimeType === item));
  const choice = useCrimeChoice(playableCrimes);
  const { crime, resolvedCrime, surprised } = choice;
  const selectedCase = state.cases.find(item => item.canStart && item.crimeType === resolvedCrime);
  function surprise() {
    choice.surpriseChoice();
    setDifficulty(randomOf(difficulties) ?? 'normal');
    setContent('familiar');
  }
  // Al confirmarse una creación nueva, se abre su pantalla de juego. Al volver
  // al archivo después, la creación ya no está en transición y no se navega sola.
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = state.creation.phase;
    openCreatedRun(previous, state.creation.phase, state.creation.runId, navigate);
  }, [state.creation.phase, state.creation.runId, navigate]);
  function submit(event: FormEvent) { event.preventDefault(); if (selectedCase) void model.createCase(selectedCase.caseId, difficulty, { crimeType: resolvedCrime, contentRating: content }); }
  if (state.creation.phase !== 'idle') return <CreationPhaseView state={state} model={model} busy={busy} onPrepareAnother={() => { choice.resetChoice(); setContent('familiar'); setDifficulty('normal'); model.prepareCreation(); }} />;
  return <form onSubmit={submit}>
    <CrimeField playableCrimes={playableCrimes} crime={crime} resolvedCrime={resolvedCrime} busy={busy} surprised={surprised} selectedCase={selectedCase} onChoose={choice.chooseCrime} onSurprise={surprise} />
    <ContentField content={content} busy={busy} onChange={setContent} />
    {selectedCase && <p>Expediente: {selectedCase.title} — {caseLabel(selectedCase.crimeType, selectedCase.contentRating)}. Otros delitos llegarán cuando la generación de casos esté conectada a la partida.</p>}
    {!selectedCase && state.cases.length > 0 && <p>Todavía no hay expedientes validados de este delito.</p>}
    <DifficultyField busy={busy} difficulty={difficulty} selectedCase={selectedCase} onChange={setDifficulty} />
    <button type="submit" disabled={busy || !selectedCase}>Empezar partida</button>{state.cases.length === 0 && <p>No hay expedientes disponibles.</p>}
  </form>;
}
type DifficultyFieldProps = { busy: boolean; difficulty: Difficulty; selectedCase: { deadlineMinutes: number } | undefined; onChange: (next: Difficulty) => void };
function DifficultyField({ busy, difficulty, selectedCase, onChange }: DifficultyFieldProps) {
  return <fieldset disabled={busy}><legend>Dificultad</legend>{difficultyOptions.map(option => <label key={option.id}><input type="radio" name="difficulty" value={option.id} checked={difficulty === option.id} onChange={() => onChange(option.id)} /> {option.label}{selectedCase ? ` · plazo ${hours(deadlineMinutesForDifficulty(selectedCase.deadlineMinutes, option.id))}` : ''} — {option.note}</label>)}</fieldset>;
}
type PhaseViewProps = Props & { busy: boolean; onPrepareAnother: () => void };
function CreationPhaseView({ state, model, busy, onPrepareAnother }: PhaseViewProps) {
  if (state.creation.phase === 'created') return <div><p>Partida creada · referencia {state.creation.runId?.slice(0, 8)}</p><div className="archive-actions"><Link to={'/runs/' + state.creation.runId}>Jugar ahora</Link><button type="button" disabled={busy} onClick={onPrepareAnother}>Preparar otra creación</button></div></div>;
  if (state.creation.phase === 'blocked') return <div><p>No se puede leer o conservar la referencia local. Actualiza la sesión o revisa el almacenamiento de esta pestaña antes de crear.</p><div className="archive-actions"><button type="button" disabled={busy} onClick={() => { void model.discardCreation(); }}>Descartar y empezar de nuevo</button></div></div>;
  if (state.creation.phase === 'uncertain' || state.creation.phase === 'sending') return <PendingCreation state={state} model={model} />;
  return null;
}
type CrimeFieldProps = { playableCrimes: CrimeType[]; crime: CrimeType; resolvedCrime: CrimeType; busy: boolean; surprised: boolean; selectedCase: { crimeType: CrimeType; contentRating: ContentRating } | undefined; onChoose: (next: CrimeType) => void; onSurprise: () => void };
function CrimeField({ playableCrimes, crime, resolvedCrime, busy, surprised, selectedCase, onChoose, onSurprise }: CrimeFieldProps) {
  return <><fieldset disabled={busy}><legend>Delito</legend>{GDD_CRIME_TYPES.map(item => {
    const playable = item === 'aleatorio' ? playableCrimes.length > 0 : playableCrimes.includes(item);
    return <label key={item}><input type="radio" name="crime" value={item} checked={crime === item} disabled={!playable} onChange={() => onChoose(item)} /> {CRIME_TYPE_LABELS[item]}{item === 'aleatorio' && crime === 'aleatorio' && resolvedCrime ? ` → ${CRIME_TYPE_LABELS[resolvedCrime]}` : ''}{!playable ? ' · Sin expedientes validados todavía' : ''}</label>;
  })}</fieldset>
  <p><button type="button" disabled={busy || playableCrimes.length === 0} onClick={onSurprise}>SORPRÉNDEME</button> Aleatoriza delito y dificultad entre lo disponible.{surprised && selectedCase ? ` Ha elegido: ${caseLabel(selectedCase.crimeType, selectedCase.contentRating)}.` : ''}</p></>;
}
type ContentFieldProps = { content: ContentRating; busy: boolean; onChange: (next: ContentRating) => void };
function ContentField({ content, busy, onChange }: ContentFieldProps) {
  return <fieldset disabled={busy}><legend>Contenido</legend>
    <label><input type="radio" name="content" value="familiar" checked={content === 'familiar'} onChange={() => onChange('familiar')} /> Familiar — sin asesinatos ni temas perturbadores.</label>
    <label><input type="radio" name="content" value="general" checked={content === 'general'} disabled onChange={() => onChange('general')} /> General · Sin expedientes validados todavía — el único expediente disponible es apto para Familiar.</label>
  </fieldset>;
}
function PendingCreation({ state, model }: Props) {
  const busy = state.phase === 'loading';
  const title = state.cases.find(item => item.caseId === state.creation.caseId)?.title ?? 'Expediente pendiente';
  return <div><p>{title} · Creación pendiente de confirmar. No se asignará otra referencia automáticamente.</p><div className="archive-actions"><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(); }}>Comprobar creación</button><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(true); }}>Reintentar misma creación</button><button type="button" disabled={busy} onClick={() => { void model.discardCreation(); }}>Descartar y empezar de nuevo</button></div></div>;
}
