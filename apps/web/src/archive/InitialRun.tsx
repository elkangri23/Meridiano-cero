import { useEffect, useRef } from 'react';
import type { InitialPlayerViewDto } from '@meridiano/contracts';

/** Ficha de lectura: no representa una escena interactiva ni calcula reglas. */
export function InitialRun({ view, close }: { view: InitialPlayerViewDto; close: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [view.runId]);
  return <section className="archive-initial" aria-labelledby="initial-heading">
    <h2 id="initial-heading" tabIndex={-1} ref={heading}>Ficha inicial de la partida</h2>
    <p>Referencia: <code>{view.runId.slice(0, 8)}</code> · Revisión {view.version}</p>
    <p>Reloj del caso: {view.clock.minute} min · Plazo: {view.clock.deadlineMinutes} min</p>
    <h3>{view.position.city.name}, {view.position.city.country}</h3>
    <h3>{view.position.location.name}</h3><p>{view.position.location.description}</p>
    <h3>Ciudades visibles</h3><ul>{view.cities.map(city => <li key={city.id}>{city.name}, {city.country}</li>)}</ul>
    <p>Consulta de lectura. Las órdenes de investigación y los guardados todavía no están disponibles.</p>
    <button type="button" onClick={close}>Cerrar ficha</button>
  </section>;
}
