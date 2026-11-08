import { useEffect, useState } from 'react';
import type { CareerProfileDto } from '@meridiano/contracts';
import { reportReasonText, reportResultText } from '@meridiano/contracts';
import { archiveApi } from './client';
import { medalLabel } from '../game/team';
import { useTranslation } from '../i18n';
import type { TranslateFn } from '@meridiano/contracts';

/** Lista unida por comas, o el texto de vacío cuando no hay nada. */
function joinOrNone(values: string[], none: string): string {
  return values.length === 0 ? none : values.join(', ');
}

function CareerSanctions({ sanctions }: { sanctions: CareerProfileDto['sanctions'] }) {
  const t = useTranslation();
  if (sanctions.length === 0) return null;
  return <>
    <h3>{t('career.sanctions')}</h3>
    <ul>{sanctions.map(sanction =>
      <li key={sanction.id}>{sanction.reason} · {sanction.active ? t('career.sanctionActive') : t('career.sanctionResolved')}</li>)}</ul>
  </>;
}

function CareerResults({ results, t }: { results: CareerProfileDto['results']; t: TranslateFn }) {
  return <>
    <h3>{t('career.results')}</h3>
    {results.length === 0
      ? <p>{t('career.noResults')}</p>
      : <ul>{results.map(result =>
        <li key={result.caseId}>{t('career.resultLine', {
          title: result.caseTitle, result: reportResultText(result.result, t), reason: reportReasonText(result.reason, t),
          minute: result.minute, points: result.points, medal: result.medal ? ` · ${medalLabel(result.medal, t)}` : '',
        })}</li>)}</ul>}
  </>;
}

/** Perfil de carrera del detective (GDD §13): rango, puntos, reputación
 * (con etiquetas cualitativas, no con barras), medallas, casos, países,
 * lugares, sanciones y resultados oficiales. Se deriva de los resultados
 * oficiales; sin cierres, el perfil está vacío (rango Aspirante, cero
 * casos): la carrera empieza con el primer informe oficial. */
export function CareerSection() {
  const t = useTranslation();
  const [career, setCareer] = useState<CareerProfileDto | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const profile = await archiveApi.career(controller.signal).catch(() => null);
      if (controller.signal.aborted) return;
      if (profile) setCareer(profile);
      else setFailed(true);
    })();
    return () => controller.abort();
  }, []);

  return (
    <section className="archive-list" aria-label={t('career.title')} data-testid="career-section">
      <p className="archive-overline">{t('career.title')}</p>
      <h2>{t('career.title')}</h2>
      {failed && <p role="alert">{t('career.loadError')}</p>}
      {!failed && !career && <p>{t('career.loading')}</p>}
      {career && <>
        <p data-testid="career-rank">{t('career.rank')} <strong>{career.rank}</strong> · <span data-testid="career-points">{t('career.points', { points: career.points })}</span> · <span data-testid="career-cases">{career.totalCases} {t(career.totalCases === 1 ? 'career.caseSingular' : 'career.casePlural')}</span> ({career.completedCases} {t(career.completedCases === 1 ? 'career.resolvedSingular' : 'career.resolvedPlural')})</p>
        <p>{t('career.reputation', { prestige: career.prestigeLabel, integrity: career.integrityLabel, trust: career.trustLabel })}</p>
        <p>{t('career.medals', { list: joinOrNone(career.medals.map(medal => medalLabel(medal, t)), t('career.noneFeminine')) })}</p>
        <p>{t('career.countries', { list: joinOrNone(career.countries, t('career.noneMasculine')) })}</p>
        <p>{t('career.places', { list: joinOrNone(career.places, t('career.noneMasculine')) })}</p>
        <CareerSanctions sanctions={career.sanctions} />
        <CareerResults results={career.results} t={t} />
      </>}
    </section>
  );
}
