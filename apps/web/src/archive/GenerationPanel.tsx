import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CRIME_TYPE_LABELS, GDD_CRIME_TYPES } from '@meridiano/case-schema';
import type { ContentRating, CrimeType, GenerationJobDto } from '@meridiano/contracts';
import type { ArchiveState } from './model';
import type { createArchiveModel } from './model';
import { displayCaseTitle } from './case-title';

type Props = { state: ArchiveState; model: ReturnType<typeof createArchiveModel> };

const STATUS_LABELS: Record<GenerationJobDto['status'], string> = {
  queued: 'En cola',
  running: 'Generando',
  done: 'Listo',
  failed: 'Fallido',
  cancelled: 'Cancelado',
};
const DURATION_LABELS = { short: 'Corta', medium: 'Media', long: 'Larga' } as const;
type Duration = keyof typeof DURATION_LABELS;

function stageProgress(job: GenerationJobDto): { done: number; total: number; current: string | null } {
  const progress = job.progress as { stages?: Array<{ stage: number; name: string; status: string }> };
  const stages = Array.isArray(progress.stages) ? progress.stages : [];
  const done = stages.filter(stage => stage.status === 'completed').length;
  const current = stages.find(stage => stage.status === 'running')?.name ?? null;
  return { done, total: stages.length || 9, current };
}

function JobItem({ job, caseTitle, busy, onCancel }: { job: GenerationJobDto; caseTitle: string | null; busy: boolean; onCancel: (jobId: string) => void }) {
  const progress = stageProgress(job);
  const active = job.status === 'queued' || job.status === 'running';
  return <li>
    <p>{CRIME_TYPE_LABELS[job.crimeType]} · {job.contentRating === 'familiar' ? 'Familiar' : 'General'} · {DURATION_LABELS[job.duration]} — {STATUS_LABELS[job.status]}
      {active && ` · Etapa ${progress.done}/${progress.total}${progress.current ? ` · ${progress.current}` : ''}`}
    </p>
    {job.status === 'done' && <p>Expediente listo{caseTitle ? `: ${displayCaseTitle(caseTitle)}` : ''}. Ya está en el catálogo: elígelo arriba en «Nueva partida».</p>}
    {job.status === 'failed' && <p>No se pudo generar el caso{job.error ? `: ${job.error}` : '.'} Los borradores inválidos se rechazan, no se ofrecen.</p>}
    {active && <button type="button" disabled={busy} onClick={() => onCancel(job.jobId)}>Cancelar</button>}
  </li>;
}

export function GenerationPanel({ state, model }: Props) {
  const [crime, setCrime] = useState<CrimeType | 'aleatorio'>('aleatorio');
  const [content, setContent] = useState<ContentRating>('familiar');
  const [duration, setDuration] = useState<Duration>('medium');
  const busy = state.phase === 'loading';
  const active = state.jobs.some(job => job.status === 'queued' || job.status === 'running');
  // Mientras haya un job activo, el panel pregunta cada 5 s: la generación
  // tarda minutos y el estado vive en el servidor.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { void model.refreshJobs(); }, 5000);
    return () => clearInterval(timer);
  }, [active, model]);
  function submit(event: FormEvent) {
    event.preventDefault();
    void model.createGeneration({
      ...(crime === 'aleatorio' ? {} : { crimeType: crime }),
      contentRating: content,
      duration,
    });
  }
  return <section className="archive-create" aria-labelledby="generation-title">
    <p className="archive-overline">Generador de casos</p>
    <h2 id="generation-title">Generar un caso nuevo</h2>
    <p>La IA escribe un expediente nuevo (delito, sospechosos, pistas y solución) y solo entra en el catálogo si pasa la validación y se puede jugar de punta a punta. Generar tarda unos minutos. Límites: una generación a la vez y tres al día.</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy || active}><legend>Delito</legend>
        <label><input type="radio" name="gen-crime" value="aleatorio" checked={crime === 'aleatorio'} onChange={() => setCrime('aleatorio')} /> Sorpréndeme — sortea entre los 12 delitos.</label>
        {GDD_CRIME_TYPES.filter(item => item !== 'aleatorio').map(item => <label key={item}><input type="radio" name="gen-crime" value={item} checked={crime === item} onChange={() => setCrime(item)} /> {CRIME_TYPE_LABELS[item]}</label>)}
      </fieldset>
      <fieldset disabled={busy || active}><legend>Contenido</legend>
        <label><input type="radio" name="gen-content" value="familiar" checked={content === 'familiar'} onChange={() => setContent('familiar')} /> Familiar — sin asesinatos ni temas perturbadores.</label>
        <label><input type="radio" name="gen-content" value="general" checked={content === 'general'} onChange={() => setContent('general')} /> General — temas serios permitidos, sin detalle explícito ni gore.</label>
      </fieldset>
      <fieldset disabled={busy || active}><legend>Duración</legend>
        {(Object.keys(DURATION_LABELS) as Duration[]).map(item => <label key={item}><input type="radio" name="gen-duration" value={item} checked={duration === item} onChange={() => setDuration(item)} /> {DURATION_LABELS[item]}</label>)}
      </fieldset>
      <button type="submit" disabled={busy || active}>Generar caso</button>
    </form>
    {state.jobs.length > 0 && <div>
      <h3>Mis generaciones</h3>
      <ul>
        {state.jobs.map(job => <JobItem key={job.jobId} job={job} caseTitle={job.caseId ? state.cases.find(item => item.caseId === job.caseId)?.title ?? null : null} busy={busy} onCancel={jobId => void model.cancelGeneration(jobId)} />)}
      </ul>
    </div>}
  </section>;
}
