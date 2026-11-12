// Informe final como recorrido interactivo (rediseño Norte, fase 4): la
// misma pantalla entera y los mismos datos del informe —veredicto,
// puntuación, cronología, pruebas halladas y omitidas, detenciones y
// carrera—, presentados para revivir la partida en vez de leer un parte:
// desglose de puntos pulsable, línea de tiempo andable, ruta por ciudades
// desplegable, galería de pruebas (también las omitidas) con cada carta
// independiente, verdad por secciones y cierre con archivo, repetición y
// cronología completa. Nada se inventa: cada cifra y cada texto sale del
// informe que trae la vista (el motor) o de la vista misma; la corroboración
// no se muestra porque el motor no la expone, y la cronología del delito
// tampoco existe en ningún expediente, así que su sección lo dice en vez
// de fabular un relato.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FinalReport, FinalReportEvidenceEntry, FinalReportRouteCity, FinalReportScoreEntry, PlayerViewDto } from '@meridiano/contracts';
import { IRREGULAR_KIND_KEYS, objectiveText, reportReasonText, reportResultText } from '@meridiano/contracts';
import type { TranslateFn } from '@meridiano/contracts';
import { useTranslation } from '../i18n';
import { usePreferences } from '../preferences';
import { medalLabel } from './team';
import { clampTimelineIndex, routeCities, scoreExplanation, timelineEvidence } from './report-journey';
import type { ScoreExplanationContext } from './report-journey';
import { travelCityPoint, travelRoutePath } from './travel-animation';

function ReportList({ items, empty }: { items: string[]; empty: string }) {
  return items.length === 0
    ? <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{empty}</p></div>
    : <ul className="game-report-objectives">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

/** Delta con signo para el informe: +3, 0, −2. */
function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/** Sufijo de medalla para una línea de resultado oficial, o vacío. */
function medalSuffix(medal: string | null | undefined, t: TranslateFn): string {
  return medal ? ` · ${medalLabel(medal, t)}` : '';
}

/** Consecuencias de carrera del cierre (GDD §13, DEC-020): el cierre
 * oficial fija el resultado y enseña puntos/medalla/rango antes→después;
 * el de práctica recuerda el oficial existente; una partida cerrada antes
 * de la carrera no tiene resultado oficial. */
function CareerConsequences({ officialResult }: { officialResult: PlayerViewDto['officialResult'] }) {
  const t = useTranslation();
  return <>
    <h4>{t('game.careerConsequences')}</h4>
    {!officialResult && <p>{t('game.careerNoResult')}</p>}
    {officialResult?.isThisRun && <>
      <p>{t('game.careerOfficialResult')}: <strong>{reportResultText(officialResult.result, t)}</strong> · {officialResult.points} {t('game.careerPoints')}{medalSuffix(officialResult.medal, t)} · {t('game.careerRank')}: {officialResult.rankBefore} → {officialResult.rankAfter}</p>
      <p>{t('game.careerDeltas', { prestige: signedDelta(officialResult.prestigeDelta), integrity: signedDelta(officialResult.integrityDelta), trust: signedDelta(officialResult.trustDelta) })}</p>
      <p>{t('game.careerOfficialNote')}</p>
    </>}
    {officialResult && !officialResult.isThisRun && <>
      <p>{t('game.careerPracticeLine', {
        caseTitle: officialResult.caseTitle, result: reportResultText(officialResult.result, t), points: officialResult.points,
        medal: officialResult.medal ? `, ${medalLabel(officialResult.medal, t)}` : '',
      })}</p>
    </>}
  </>;
}

// ── Puntuación ──────────────────────────────────────────────────────────────

/** Componentes del desglose en el orden que emite el motor, y su máximo:
 * respaldo cuando una entrada llega con la forma antigua (solo etiqueta y
 * puntos, sin id ni máximo). La API actual siempre emite la forma nueva. */
const SCORE_IDS: Array<FinalReportScoreEntry['id']> = ['objectives', 'evidence', 'detention', 'wrongDetentions', 'irregular', 'time'];
const SCORE_MAX: Record<FinalReportScoreEntry['id'], number> = { objectives: 50, evidence: 25, detention: 15, wrongDetentions: 0, irregular: 0, time: 10 };

function normalizeScoreEntry(entry: FinalReportScoreEntry, index: number): FinalReportScoreEntry {
  const raw = entry as unknown as Record<string, unknown>;
  const id = typeof raw.id === 'string' && (SCORE_IDS as string[]).includes(raw.id)
    ? raw.id as FinalReportScoreEntry['id'] : SCORE_IDS[index] ?? 'objectives';
  const max = typeof raw.max === 'number' ? raw.max : SCORE_MAX[id];
  return { ...entry, id, max };
}

/** Puntos de un componente: «22 / 30» cuando tiene máximo; la cifra sola
 * en los de penalización, que solo restan (su máximo es 0). */
function formatScorePoints(entry: FinalReportScoreEntry): string {
  return entry.max > 0 ? `${entry.points} / ${entry.max}` : String(entry.points);
}

function ScoreHero({ view, report }: { view: PlayerViewDto; report: FinalReport }) {
  const t = useTranslation();
  const [open, setOpen] = useState(0);
  const entries = report.score.breakdown;
  const context: ScoreExplanationContext = {
    objectivesAchieved: report.objectivesAchieved.length,
    objectivesTotal: view.objectives.length,
    evidenceFound: report.evidenceFound.length,
    evidenceTotal: report.evidenceFound.length + report.evidenceMissed.length,
    correctDetentions: report.detentions.filter(detention => detention.correct).length,
    wrongDetentions: report.detentions.filter(detention => !detention.correct).length,
    irregularActs: report.irregularActs.length,
    minute: report.minute,
    deadlineMinutes: view.clock.deadlineMinutes,
    reason: report.reason,
  };
  const currentIndex = clampTimelineIndex(open, entries.length);
  const current = entries[currentIndex];
  return <section className="game-report-score" aria-label={t('game.reportScore')}>
    <h2>{t('game.reportScore')}</h2>
    <div className="game-score-hero">
      <div className="game-score-big">
        <div className="game-score-number">{report.score.total}</div>
        <div className="game-score-of">/ {report.score.max}</div>
      </div>
      <div className="game-score-parts" role="group" aria-label={t('game.reportScore')}>
        {entries.map((entry, index) => {
          const normalized = normalizeScoreEntry(entry, index);
          return <button key={normalized.id} type="button" className="game-score-part" data-testid={`report-score-${normalized.id}`}
            aria-pressed={index === currentIndex} onClick={() => setOpen(index)}>
            <span className="game-score-part-label">{entry.label}</span>
            <span className="game-score-part-value">{formatScorePoints(normalized)}</span>
            <span className="game-score-part-why">{t('game.reportJourney.scoreWhy')}</span>
          </button>;
        })}
      </div>
      {current && <p className="game-score-detail" data-testid="report-score-detail" aria-live="polite">
        {scoreExplanation(normalizeScoreEntry(current, currentIndex), context, t)}
      </p>}
    </div>
    <p>{t('game.reportTotal')}: <strong>{report.score.total} / {report.score.max}</strong></p>
    <CareerConsequences officialResult={view.officialResult} />
  </section>;
}

// ── Tu recorrido ────────────────────────────────────────────────────────────

function JourneyTimeline({ report }: { report: FinalReport }) {
  const t = useTranslation();
  const [index, setIndex] = useState(0);
  const timeline = report.timeline;
  if (timeline.length === 0) {
    return <section className="game-report-journey" aria-label={t('game.reportJourney.journeyTitle')}>
      <h2>{t('game.reportJourney.journeyTitle')}</h2>
      <p>{t('game.reportJourney.journeyEmpty')}</p>
    </section>;
  }
  const currentIndex = clampTimelineIndex(index, timeline.length);
  const current = timeline[currentIndex];
  const evidence = current ? timelineEvidence(report, current.evidenceIds) : [];
  return <section className="game-report-journey" aria-label={t('game.reportJourney.journeyTitle')}>
    <h2>{t('game.reportJourney.journeyTitle')}</h2>
    <p>{t('game.reportJourney.journeyIntro')}</p>
    <div className="game-timeline-nav">
      <button type="button" data-testid="journey-prev" disabled={currentIndex <= 0}
        onClick={() => setIndex(value => clampTimelineIndex(value - 1, timeline.length))}>{t('game.reportJourney.journeyPrev')}</button>
      <button type="button" className="game-primary-button" data-testid="journey-next" disabled={currentIndex >= timeline.length - 1}
        onClick={() => setIndex(value => clampTimelineIndex(value + 1, timeline.length))}>{t('game.reportJourney.journeyNext')}</button>
      <span className="game-timeline-pos" data-testid="journey-pos">{t('game.reportJourney.journeyOf', { current: currentIndex + 1, total: timeline.length })}</span>
    </div>
    <ol className="game-timeline-list">
      {timeline.map((entry, i) => (
        <li key={entry.sequence}>
          <button type="button" className="game-timeline-item" data-testid={`journey-milestone-${entry.sequence}`}
            aria-pressed={i === currentIndex} onClick={() => setIndex(i)}>
            <span className="game-timeline-minute">{t('game.reportJourney.journeyMinute', { minute: entry.minute })}</span>
            <span className="game-timeline-summary">{entry.summary}</span>
            {entry.evidenceIds && entry.evidenceIds.length > 0 && <span className="game-timeline-evidence">{entry.evidenceIds.join(', ')}</span>}
          </button>
        </li>
      ))}
    </ol>
    {current && <div className="game-timeline-detail" data-testid="journey-detail" aria-live="polite">
      <p className="game-timeline-minute">{t('game.reportJourney.journeyMinute', { minute: current.minute })}</p>
      <h3>{current.summary}</h3>
      {evidence.length > 0
        ? <>
          <p><strong>{t('game.reportJourney.journeyEvidence')}</strong></p>
          <ul className="game-report-objectives">{evidence.map(item => <li key={item.id}>{item.id} · {item.text}</li>)}</ul>
        </>
        : <p>{t('game.reportJourney.journeyNoEvidence')}</p>}
    </div>}
  </section>;
}

// ── Tu ruta ─────────────────────────────────────────────────────────────────

function RouteMap({ cities }: { cities: FinalReportRouteCity[] }) {
  const t = useTranslation();
  const points = cities.map(city => ({ city, point: travelCityPoint(city.cityId) }));
  return <svg className="game-travel-svg" viewBox="0 0 100 100" role="img" aria-label={t('game.reportJourney.routeMapLabel')}>
    {points.map((item, i) => {
      if (i === 0) return null;
      const from = points[i - 1]?.point;
      const to = item.point;
      if (!from || !to) return null;
      return <path key={item.city.cityId} className="game-travel-svg-live" d={travelRoutePath(from, to)} />;
    })}
    {points.map(item => item.point ? <g key={item.city.cityId}>
      <circle className="game-travel-svg-dot" r="3.5" cx={item.point.x} cy={item.point.y} />
      <text className="game-travel-svg-label" x={item.point.x} y={item.point.y + 9} textAnchor="middle">{item.city.cityName}</text>
    </g> : null)}
  </svg>;
}

function RouteSection({ report }: { report: FinalReport }) {
  const t = useTranslation();
  const cities = routeCities(report);
  const [open, setOpen] = useState(0);
  const evidenceById = new Map(report.evidenceFound.map(entry => [entry.id, entry]));
  if (cities.length === 0) {
    return <section className="game-report-route" aria-label={t('game.reportJourney.routeTitle')}>
      <h2>{t('game.reportJourney.routeTitle')}</h2>
      <p>{t('game.reportJourney.routeEmpty')}</p>
    </section>;
  }
  const currentIndex = clampTimelineIndex(open, cities.length);
  const current = cities[currentIndex];
  return <section className="game-report-route" aria-label={t('game.reportJourney.routeTitle')}>
    <h2>{t('game.reportJourney.routeTitle')}</h2>
    <p>{t('game.reportJourney.routeIntro')}</p>
    <RouteMap cities={cities} />
    <div className="game-route-cities" role="group" aria-label={t('game.reportJourney.routeTitle')}>
      {cities.map((city, i) => (
        <button key={city.cityId} type="button" className="game-route-city" data-testid={`route-city-${city.cityId}`}
          aria-expanded={i === currentIndex} onClick={() => setOpen(i)}>
          <span className="game-route-city-name">{city.cityName}</span>
          <span className="game-route-city-sub">{city.arrivedMinute === null
            ? t('game.reportJourney.routeStart')
            : t('game.reportJourney.routeArrived', { minute: city.arrivedMinute })}</span>
        </button>
      ))}
    </div>
    {current && <div className="game-route-panel" data-testid={`route-panel-${current.cityId}`}>
      <h3>{current.cityName}</h3>
      {current.inspected.length === 0 && current.talkedTo.length === 0 && current.evidenceIds.length === 0
        ? <p>{t('game.reportJourney.routeNothing')}</p>
        : <ul className="game-report-objectives">
          {current.inspected.length > 0 && <li><strong>{t('game.reportJourney.routeInspected')}:</strong> {current.inspected.join(', ')}</li>}
          {current.talkedTo.length > 0 && <li><strong>{t('game.reportJourney.routeTalked')}:</strong> {current.talkedTo.join(', ')}</li>}
          {current.evidenceIds.length > 0 && <li><strong>{t('game.reportJourney.routeFound')}:</strong> {current.evidenceIds.map(id => evidenceById.get(id)?.text ?? id).join(' · ')}</li>}
        </ul>}
    </div>}
  </section>;
}

// ── Las pruebas ─────────────────────────────────────────────────────────────

/** Etiqueta de procedencia de una prueba: el lugar donde se reveló (o
 * donde habría estado, en las omitidas), resuelto a su nombre con los
 * mismos mapas que el dossier; el id crudo solo si no está en la vista. */
function originLabelFor(view: PlayerViewDto): (origin: string | undefined) => string | null {
  const locations = new Map(view.locations.map(location => [location.id, location.name]));
  const cities = new Map(view.cities.map(city => [city.id, city.name]));
  for (const city of view.atlas) cities.set(city.id, city.name);
  return origin => {
    if (!origin) return null;
    return locations.get(origin) ?? cities.get(origin) ?? origin;
  };
}

/** Una carta de la galería, con su propio estado abierto/cerrado: pulsar
 * una carta nunca abre las demás (defecto de la maqueta, donde «ver lo que
 * te perdiste» en una carta abría las tres). */
function EvidenceCard({ entry, missed, originLabel }: {
  entry: FinalReportEvidenceEntry;
  missed: boolean;
  originLabel: (origin: string | undefined) => string | null;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const origin = originLabel(entry.origin);
  const prefix = missed ? 'missed' : 'evidence';
  return <article className={`game-evidence-card${missed ? ' game-evidence-card--missed' : ''}`} data-testid={`${prefix}-card-${entry.id}`}>
    <p className="game-journey-evidence-title"><span className="game-evidence-code">{entry.id}</span> · <span className="game-evidence-text">{entry.text}</span></p>
    <button type="button" className="game-evidence-toggle" data-testid={`${prefix}-toggle-${entry.id}`}
      aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? t('game.reportJourney.evidenceHide') : missed ? t('game.reportJourney.missedShow') : t('game.reportJourney.evidenceShow')}
    </button>
    {open && <div className="game-evidence-detail" data-testid={`${prefix}-detail-${entry.id}`}>
      {origin && <p>{t('game.reportJourney.evidenceOrigin', { origin })}</p>}
      {!missed && entry.minute !== undefined && <p>{t('game.reportJourney.evidenceMinute', { minute: entry.minute })}</p>}
    </div>}
  </article>;
}

function EvidenceGalleries({ view, report }: { view: PlayerViewDto; report: FinalReport }) {
  const t = useTranslation();
  const originLabel = originLabelFor(view);
  return <>
    <section className="game-report-evidence" aria-label={t('game.reportEvidenceFound')}>
      <h2>{t('game.reportEvidenceFound')}</h2>
      {report.evidenceFound.length === 0
        ? <p>{t('game.reportNoEvidenceFound')}</p>
        : <div className="game-evidence-gallery">{report.evidenceFound.map(entry =>
          <EvidenceCard key={entry.id} entry={entry} missed={false} originLabel={originLabel} />)}</div>}
    </section>
    <section className="game-report-evidence" aria-label={t('game.reportEvidenceMissed')}>
      <h2>{t('game.reportEvidenceMissed')}</h2>
      {report.evidenceMissed.length === 0
        ? <p>{t('game.reportNoEvidenceMissed')}</p>
        : <div className="game-evidence-gallery">{report.evidenceMissed.map(entry =>
          <EvidenceCard key={entry.id} entry={entry} missed originLabel={originLabel} />)}</div>}
    </section>
  </>;
}

// ── La verdad ───────────────────────────────────────────────────────────────

function TruthSection({ report }: { report: FinalReport }) {
  const t = useTranslation();
  return <section className="game-report-truth" aria-label={t('game.reportTruth')}>
    <h2>{t('game.reportTruth')}</h2>
    <details className="game-truth-details" data-testid="truth-who">
      <summary>{t('game.reportJourney.truthWho')}</summary>
      <p>{t('game.reportCulprit')}: <strong>{report.truth.culpritName}</strong></p>
      {report.truth.objectLabel && <p>{t('game.reportStolenObject', { label: report.truth.objectLabel })}</p>}
    </details>
    <details className="game-truth-details" data-testid="truth-how">
      <summary>{t('game.reportJourney.truthHow')}</summary>
      <p>{t('game.reportJourney.truthHowIntro')}</p>
      <ReportList items={report.truth.keyEvidence.map(entry => entry.text)} empty={t('game.reportNoKeyEvidence')} />
    </details>
    <details className="game-truth-details" data-testid="truth-timeline">
      <summary>{t('game.reportJourney.truthTimeline')}</summary>
      <p>{t('game.reportJourney.truthNoTimeline')}</p>
    </details>
  </section>;
}

// ── Recorrido completo ──────────────────────────────────────────────────────

export function ReportJourney({ view, caseTitle, onViewRun, onRepeat }: {
  view: PlayerViewDto;
  caseTitle: string | null;
  onViewRun: () => void;
  onRepeat: () => void;
}) {
  const t = useTranslation();
  const { preferences } = usePreferences();
  const [showChrono, setShowChrono] = useState(false);
  if (!view.finalReport) {
    return <main className="game game-report-full" data-testid="report-full">
      <div className="game-empty-state"><span className="game-empty-glyph" aria-hidden="true">⌁</span><p>{t('game.reportNotAvailable')}</p></div>
    </main>;
  }
  const report = view.finalReport;
  const objectiveDescription = (id: string) =>
    view.objectives.find(objective => objective.id === id)?.description ?? objectiveText(id, view.caseId, preferences.language);
  return <main className="game game-report-full" data-testid="report-full">
    <header className="game-report-full-head">
      <div>
        <p className="game-overline">{t('game.dock.report')}</p>
        <h1>{caseTitle ?? view.caseId}</h1>
        <p>{t('game.reportJourney.intro')}</p>
      </div>
      <span className="game-state-pill game-state-pill--closed" data-testid="run-state">{t('game.header.stateClosed')}</span>
      <div className="game-report-full-actions">
        <button type="button" className="game-primary-button" data-testid="report-view-run" onClick={onViewRun}>{t('game.reportFull.viewRun')}</button>
      </div>
    </header>
    <p className="game-report-result">{t('game.reportResult')}: <strong>{reportResultText(report.result, t)}</strong> · {t('game.reportReason')}: {reportReasonText(report.reason, t)} · {t('game.reportMinute')}: {report.minute}</p>
    <ScoreHero view={view} report={report} />
    <JourneyTimeline report={report} />
    <RouteSection report={report} />
    <EvidenceGalleries view={view} report={report} />
    <TruthSection report={report} />
    <section className="game-report-detentions" aria-label={t('game.reportDetentions')}>
      <h2>{t('game.reportDetentions')}</h2>
      <ReportList
        items={report.detentions.map(detention =>
          `${detention.suspectName} — ${detention.correct ? t('game.reportDetentionCorrect') : t('game.reportDetentionWrong')}${detention.withWarrant ? t('game.reportDetentionWithWarrant') : t('game.reportDetentionWithoutWarrant')}`)}
        empty={t('game.reportNoDetentions')} />
    </section>
    <section className="game-report-irregular" aria-label={t('game.reportIrregular')}>
      <h2>{t('game.reportIrregular')}</h2>
      <ReportList
        items={(report.irregularActs ?? []).map(act => {
          const kindKey = IRREGULAR_KIND_KEYS[act.kind];
          return `${kindKey ? t(kindKey) : act.kind} — ${act.targetName} · min ${act.minute}${act.seen ? t('game.reportIrregularSeen') : t('game.reportIrregularUnseen')}`;
        })}
        empty={t('game.reportNoIrregular')} />
    </section>
    <section className="game-report-objectives" aria-label={t('game.reportObjectives')}>
      <h2>{t('game.reportObjectives')}</h2>
      <ReportList items={report.objectivesAchieved.map(objectiveDescription)} empty={t('game.reportNoObjectives')} />
    </section>
    {showChrono && <section className="game-report-chrono" id="chrono-full" data-testid="chrono-full" aria-label={t('game.reportJourney.chronoTitle')}>
      <h2>{t('game.reportJourney.chronoTitle')}</h2>
      <p>{t('game.reportJourney.chronoIntro')}</p>
      <ol className="game-chrono-full-list">
        {report.timeline.map(entry => <li key={entry.sequence}>
          [min {entry.minute}] {entry.summary}{entry.evidenceIds && entry.evidenceIds.length > 0 ? ` (${entry.evidenceIds.join(', ')})` : ''}
        </li>)}
      </ol>
    </section>}
    <div className="game-report-closing">
      <Link to="/archivo" data-testid="report-back-archive">{t('glossary.backArchive')}</Link>
      <button type="button" className="game-primary-button" data-testid="report-repeat" onClick={onRepeat}>{t('game.reportJourney.repeat')}</button>
      <button type="button" data-testid="report-full-chrono" aria-expanded={showChrono} aria-controls="chrono-full"
        onClick={() => setShowChrono(value => !value)}>{showChrono ? t('game.reportJourney.chronoHide') : t('game.reportJourney.chronoShow')}</button>
    </div>
  </main>;
}
