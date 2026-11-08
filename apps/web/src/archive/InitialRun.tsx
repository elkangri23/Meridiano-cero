import { useEffect, useRef } from 'react';
import type { PlayerViewDto } from '@meridiano/contracts';
import { caseLabel } from '@meridiano/contracts';
import { useTranslation } from '../i18n';

/** Ficha de lectura: no representa una escena interactiva ni calcula reglas. */
export function InitialRun({ view, close }: { view: PlayerViewDto; close: () => void }) {
  const t = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [view.runId]);
  return <section className="archive-initial" aria-labelledby="initial-heading">
    <p className="archive-overline">{t('initialRun.overline')}</p>
    <h2 id="initial-heading" tabIndex={-1} ref={heading}>{t('initialRun.title')}</h2>
    <p>{t('initialRun.ref', { ref: view.runId.slice(0, 8), version: view.version })}</p>
    <p>{t('initialRun.crime', { label: caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating, t) })}</p>
    <p>{t('initialRun.clock', { minute: view.clock.minute, deadline: view.clock.deadlineMinutes })}</p>
    {view.briefing && <div><h3>{t('initialRun.briefingTitle')}</h3><p><em>{t('initialRun.briefingIntro', { speaker: view.briefing.speaker })}</em></p>{view.briefing.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
    <h3>{view.position.city.name}, {view.position.city.country}</h3>
    <h3>{view.position.location.name}</h3><p>{view.position.location.description}</p>
    <h3>{t('initialRun.visibleCities')}</h3><ul>{view.cities.map(city => <li key={city.id}>{city.name}, {city.country}</li>)}</ul>
    <p>{t('initialRun.readOnly')}<a href={'/runs/' + view.runId}>{t('initialRun.playScreen')}</a>.</p>
    <button type="button" onClick={close}>{t('initialRun.close')}</button>
  </section>;
}
