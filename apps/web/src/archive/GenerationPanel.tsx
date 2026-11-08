import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CRIME_TYPE_KEYS, GDD_CRIME_TYPES, CONTENT_RATING_KEYS } from '@meridiano/contracts';
import type { ContentRating, CrimeType, GenerationJobDto, LocaleKey } from '@meridiano/contracts';
import type { ArchiveState } from './model';
import type { createArchiveModel } from './model';
import { displayCaseTitle } from './case-title';
import { useTranslation } from '../i18n';

type Props = { state: ArchiveState; model: ReturnType<typeof createArchiveModel> };

const STATUS_KEYS: Record<GenerationJobDto['status'], LocaleKey> = {
  queued: 'labels.generation.queued',
  running: 'labels.generation.running',
  done: 'labels.generation.done',
  failed: 'labels.generation.failed',
  cancelled: 'labels.generation.cancelled',
};
const DURATION_KEYS = { short: 'labels.duration.short', medium: 'labels.duration.medium', long: 'labels.duration.long' } as const;
type Duration = keyof typeof DURATION_KEYS;

function stageProgress(job: GenerationJobDto): { done: number; total: number; current: string | null } {
  const progress = job.progress as { stages?: Array<{ stage: number; name: string; status: string }> };
  const stages = Array.isArray(progress.stages) ? progress.stages : [];
  const done = stages.filter(stage => stage.status === 'completed').length;
  const current = stages.find(stage => stage.status === 'running')?.name ?? null;
  return { done, total: stages.length || 9, current };
}

function JobItem({ job, caseTitle, busy, onCancel }: { job: GenerationJobDto; caseTitle: string | null; busy: boolean; onCancel: (jobId: string) => void }) {
  const t = useTranslation();
  const progress = stageProgress(job);
  const active = job.status === 'queued' || job.status === 'running';
  return <li>
    <p>{t('generation.jobLine', {
      crime: t(CRIME_TYPE_KEYS[job.crimeType]),
      rating: t(job.contentRating === 'familiar' ? CONTENT_RATING_KEYS.familiar : CONTENT_RATING_KEYS.general),
      duration: t(DURATION_KEYS[job.duration]),
      status: t(STATUS_KEYS[job.status]),
      stage: active ? t('generation.stage', { done: progress.done, total: progress.total, current: progress.current ? ` · ${progress.current}` : '' }) : '',
    })}
    </p>
    {job.status === 'done' && <p>{t('generation.jobDone', { title: caseTitle ? `: ${displayCaseTitle(caseTitle)}` : '' })}</p>}
    {job.status === 'failed' && <p>{t('generation.jobFailed', { error: job.error ? `: ${job.error}` : '.' })}</p>}
    {active && <button type="button" disabled={busy} onClick={() => onCancel(job.jobId)}>{t('common.cancel')}</button>}
  </li>;
}

export function GenerationPanel({ state, model }: Props) {
  const t = useTranslation();
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
    <p className="archive-overline">{t('generation.overline')}</p>
    <h2 id="generation-title">{t('generation.title')}</h2>
    <p>{t('generation.intro')}</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy || active}><legend>{t('newRun.crime')}</legend>
        <label><input type="radio" name="gen-crime" value="aleatorio" checked={crime === 'aleatorio'} onChange={() => setCrime('aleatorio')} /> {t('generation.surprise')}</label>
        {GDD_CRIME_TYPES.filter(item => item !== 'aleatorio').map(item => <label key={item}><input type="radio" name="gen-crime" value={item} checked={crime === item} onChange={() => setCrime(item)} /> {t(CRIME_TYPE_KEYS[item])}</label>)}
      </fieldset>
      <fieldset disabled={busy || active}><legend>{t('newRun.content')}</legend>
        <label><input type="radio" name="gen-content" value="familiar" checked={content === 'familiar'} onChange={() => setContent('familiar')} /> {t(CONTENT_RATING_KEYS.familiar)} — {t('newRun.contentFamiliarNote')}</label>
        <label><input type="radio" name="gen-content" value="general" checked={content === 'general'} onChange={() => setContent('general')} /> {t(CONTENT_RATING_KEYS.general)} — {t('generation.generalNote')}</label>
      </fieldset>
      <fieldset disabled={busy || active}><legend>{t('generation.duration')}</legend>
        {(Object.keys(DURATION_KEYS) as Duration[]).map(item => <label key={item}><input type="radio" name="gen-duration" value={item} checked={duration === item} onChange={() => setDuration(item)} /> {t(DURATION_KEYS[item])}</label>)}
      </fieldset>
      <button type="submit" disabled={busy || active}>{t('generation.submit')}</button>
    </form>
    {state.jobs.length > 0 && <div>
      <h3>{t('generation.myJobs')}</h3>
      <ul>
        {state.jobs.map(job => <JobItem key={job.jobId} job={job} caseTitle={job.caseId ? state.cases.find(item => item.caseId === job.caseId)?.title ?? null : null} busy={busy} onCancel={jobId => void model.cancelGeneration(jobId)} />)}
      </ul>
    </div>}
  </section>;
}
