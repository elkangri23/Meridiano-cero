import { useEffect, useRef } from 'react';
import type { PlayerViewDto } from '@meridiano/contracts';
import { caseLabel } from '@meridiano/contracts';

/** Ficha de lectura: no representa una escena interactiva ni calcula reglas. */
export function InitialRun({ view, close }: { view: PlayerViewDto; close: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [view.runId]);
  return <section className="archive-initial" aria-labelledby="initial-heading">
    <p className="archive-overline">Ficha de lectura</p>
    <h2 id="initial-heading" tabIndex={-1} ref={heading}>Ficha de la partida</h2>
    <p>Referencia: <code>{view.runId.slice(0, 8)}</code> · Revisión {view.version}</p>
    <p>Delito: {caseLabel(view.caseMeta.crimeType, view.caseMeta.contentRating)}</p>
    <p>Reloj del caso: {view.clock.minute} min · Plazo: {view.clock.deadlineMinutes} min</p>
    {view.briefing && <div><h3>Introducción del caso</h3><p><em>{view.briefing.speaker} te pone en situación:</em></p>{view.briefing.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
    <h3>{view.position.city.name}, {view.position.city.country}</h3>
    <h3>{view.position.location.name}</h3><p>{view.position.location.description}</p>
    <h3>Ciudades visibles</h3><ul>{view.cities.map(city => <li key={city.id}>{city.name}, {city.country}</li>)}</ul>
    <p>Consulta de lectura. Para jugar esta partida, abre su <a href={'/runs/' + view.runId}>pantalla de juego</a>.</p>
    <button type="button" onClick={close}>Cerrar ficha</button>
  </section>;
}
