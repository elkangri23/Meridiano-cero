import { useEffect, useState } from 'react';
import type { CareerProfileDto } from '@meridiano/contracts';
import { reportReasonText, reportResultText } from '@meridiano/contracts';
import { archiveApi } from './client';

/** Etiqueta legible de una medalla de carrera. */
function medalLabel(medal: string): string {
  if (medal === 'medalla-oro') return 'Medalla de oro';
  if (medal === 'medalla-plata') return 'Medalla de plata';
  return medal;
}

/** Lista unida por comas, o el texto de vacío cuando no hay nada. */
function joinOrNone(values: string[], none: string): string {
  return values.length === 0 ? none : values.join(', ');
}

function CareerSanctions({ sanctions }: { sanctions: CareerProfileDto['sanctions'] }) {
  if (sanctions.length === 0) return null;
  return <>
    <h3>Sanciones</h3>
    <ul>{sanctions.map(sanction =>
      <li key={sanction.id}>{sanction.reason} · {sanction.active ? 'activa' : 'resuelta'}</li>)}</ul>
  </>;
}

function CareerResults({ results }: { results: CareerProfileDto['results'] }) {
  return <>
    <h3>Resultados oficiales</h3>
    {results.length === 0
      ? <p>Aún no tienes casos cerrados. Tu carrera empieza con el primer informe oficial.</p>
      : <ul>{results.map(result =>
        <li key={result.caseId}>{result.caseTitle} — {reportResultText(result.result)} · {reportReasonText(result.reason)} · min {result.minute} · {result.points} puntos{result.medal ? ` · ${medalLabel(result.medal)}` : ''}</li>)}</ul>}
  </>;
}

/** Perfil de carrera del detective (GDD §13): rango, puntos, reputación
 * (con etiquetas cualitativas, no con barras), medallas, casos, países,
 * lugares, sanciones y resultados oficiales. Se deriva de los resultados
 * oficiales; sin cierres, el perfil está vacío (rango Aspirante, cero
 * casos): la carrera empieza con el primer informe oficial. */
export function CareerSection() {
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
    <section className="archive-list" aria-label="Carrera" data-testid="career-section">
      <p className="archive-overline">Carrera</p>
      <h2>Mi carrera</h2>
      {failed && <p role="alert">No se pudo cargar tu carrera.</p>}
      {!failed && !career && <p>Cargando carrera…</p>}
      {career && <>
        <p data-testid="career-rank">Rango: <strong>{career.rank}</strong> · <span data-testid="career-points">{career.points} puntos</span> · <span data-testid="career-cases">{career.totalCases} {career.totalCases === 1 ? 'caso' : 'casos'}</span> ({career.completedCases} {career.completedCases === 1 ? 'resuelto' : 'resueltos'})</p>
        <p>Prestigio: {career.prestigeLabel} · Integridad: {career.integrityLabel} · Confianza: {career.trustLabel}</p>
        <p>Medallas: {joinOrNone(career.medals.map(medalLabel), 'ninguna todavía')}</p>
        <p>Países: {joinOrNone(career.countries, 'ninguno todavía')}</p>
        <p>Lugares: {joinOrNone(career.places, 'ninguno todavía')}</p>
        <CareerSanctions sanctions={career.sanctions} />
        <CareerResults results={career.results} />
      </>}
    </section>
  );
}
