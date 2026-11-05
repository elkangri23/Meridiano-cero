import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ArchiveState, createArchiveModel } from './model';

type Props = { state: ArchiveState; model: ReturnType<typeof createArchiveModel> };
export function NewRun({ state, model }: Props) {
  return <section className="archive-create" aria-labelledby="new-run-title"><h2 id="new-run-title">Nueva partida</h2><p>Elige un expediente para empezar a investigar.</p><CreationContent state={state} model={model} /></section>;
}
function CreationContent({ state, model }: Props) {
  const [selected, setSelected] = useState('');
  const navigate = useNavigate();
  const previousPhase = useRef(state.creation.phase);
  const busy = state.phase === 'loading';
  // Con un único expediente disponible, se preselecciona para no pedir un clic de más.
  useEffect(() => {
    if (!selected) {
      const startable = state.cases.filter(item => item.canStart);
      if (startable.length === 1 && startable[0]) setSelected(startable[0].caseId);
    }
  }, [selected, state.cases]);
  // Al confirmarse una creación nueva, se abre su pantalla de juego. Al volver
  // al archivo después, la creación ya no está en transición y no se navega sola.
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = state.creation.phase;
    if (previous !== 'created' && state.creation.phase === 'created' && state.creation.runId) {
      navigate('/runs/' + state.creation.runId);
    }
  }, [state.creation.phase, state.creation.runId, navigate]);
  function submit(event: FormEvent) { event.preventDefault(); if (selected) void model.createCase(selected); }
  if (state.creation.phase === 'created') return <div><p>Partida creada · referencia {state.creation.runId?.slice(0, 8)}</p><div className="archive-actions"><Link to={'/runs/' + state.creation.runId}>Jugar ahora</Link><button type="button" disabled={busy} onClick={() => { setSelected(''); model.prepareCreation(); }}>Preparar otra creación</button></div></div>;
  if (state.creation.phase === 'blocked') return <p>No se puede leer o conservar la referencia local. Actualiza la sesión o revisa el almacenamiento de esta pestaña antes de crear.</p>;
  if (state.creation.phase === 'uncertain' || state.creation.phase === 'sending') return <PendingCreation state={state} model={model} />;
  return <form onSubmit={submit}><label>Expediente <select value={selected} disabled={busy} onChange={event => setSelected(event.currentTarget.value)}><option value="">Selecciona un expediente</option>{state.cases.map(item => <option key={item.caseId} value={item.caseId} disabled={!item.canStart}>{item.title}{item.canStart ? '' : ' · No disponible'}</option>)}</select></label><button type="submit" disabled={busy || !selected}>Empezar partida</button>{state.cases.length === 0 && <p>No hay expedientes disponibles.</p>}</form>;
}
function PendingCreation({ state, model }: Props) {
  const busy = state.phase === 'loading';
  const title = state.cases.find(item => item.caseId === state.creation.caseId)?.title ?? 'Expediente pendiente';
  return <div><p>{title} · Creación pendiente de confirmar. No se asignará otra referencia automáticamente.</p><div className="archive-actions"><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(); }}>Comprobar creación</button><button type="button" disabled={busy} onClick={() => { void model.recoverCreation(true); }}>Reintentar misma creación</button></div></div>;
}
