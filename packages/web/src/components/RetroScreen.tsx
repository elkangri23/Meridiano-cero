import React, { useState, useEffect, useRef } from 'react';
import { City, Location, NPC, Evidence, Objective, TravelDuration, ScheduledResult, CaseDefinition, CaseRun, PlayerView } from '../components/RetroScreen.types';

interface RetroScreenProps {
  definition: CaseDefinition;
  run: CaseRun;
  playerView: PlayerView;
  onCommand: (command: string) => void;
  onNavigate: (cityId: string) => void;
}

export const RetroScreen: React.FC<RetroScreenProps> = ({
  definition,
  run,
  playerView,
  onCommand,
  onNavigate,
}) => {
  const [focus, setFocus] = useState<'command' | 'inventory' | 'dossier' | 'map' | 'communications'>('command');
  const [input, setInput] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [discoveredLocations, setDiscoveredLocations] = useState<string[]>([]);
  const [visibleCities, setVisibleCities] = useState<string[]>(playerView.visibleCities);
  const [discoveredObjects, setDiscoveredObjects] = useState<string[]>(playerView.discoveredObjects);
  const [npcRelations, setNpcRelations] = useState<Record<string, number>>({});

  // Actualizar relaciones NPC desde el run
  useEffect(() => {
    setNpcRelations(run.npcRelations);
  }, [run.npcRelations]);

  // Actualizar inventario
  useEffect(() => {
    setInventory(run.inventory);
  }, [run.inventory]);

  // Actualizar discovered locations
  useEffect(() => {
    setDiscoveredLocations(run.discoveries);
  }, [run.discoveries]);

  // Manejar comandos
  const handleCommand = (command: string) => {
    onCommand(command);
    setInput('');
  };

  // Navegar a ciudad
  const handleNavigate = (cityId: string) => {
    onNavigate(cityId);
  };

  // Formatear minute a formato de tiempo
  const formatMinute = (minute: number): string => {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    return `${hours > 0 ? `${hours}h` : ''}${mins > 0 ? `${mins}m` : ''}`;
  };

  // Formatear resultado
  const formatResult = (result: string): string => {
    switch (result) {
      case 'complete': return '✅ Completa - Todos los objetivos logrados';
      case 'partial': return '⚠️ Parcial - Algunos objetivos logrados';
      case 'incorrect': return '❌ Incorrecta - Detención injusta';
      case 'unresolved': return '❓ Sin resolver - No se alcanzaron objetivos';
      case 'deadline': return '⏰ Vencimiento - Plazo agotado';
      default: return result;
    }
  };

  // Comandos disponibles
  const availableCommands = [
    { key: 'i', label: 'inspect', description: 'Inspeccionar lugar/objeto' },
    { key: 'c', label: 'collect', description: 'Recoger evidencia' },
    { key: 't', label: 'talk', description: 'Hablar con NPC' },
    { key: 'w', label: 'wait', description: 'Pasar tiempo' },
    { key: 'd', label: 'detain', description: 'Detener sospechoso' },
    { key: 'r', label: 'recover', description: 'Recuperar objeto' },
    { key: 'f', label: 'finish', description: 'Cerrar caso' },
  ];

  return (
    <div className="retro-screen" aria-label="Retro screen">
      {/* Cabecera */}
      <header className="retro-header">
        <div className="retro-header-left">
          <span className="detective-name">A.C.M.E. Detective</span>
          <span className="case-name">Caso: {definition.objectives[0]?.description.split(' ')[0]}</span>
        </div>
        <div className="retro-header-right">
          <span className="city-display">{run.position.cityId}</span>
          <span className="clock-display">{formatMinute(run.minute)}/{formatMinute(definition.deadlineMinutes)}</span>
        </div>
      </header>

      {/* Escenario central */}
      <main className="retro-main">
        {/* Mapa de ciudades */}
        <section className="retro-map" aria-label="Mapa de ciudades">
          <h3>Mapa</h3>
          <div className="retro-map-grid">
            {definition.cities.map((city) => (
              <div
                key={city.id}
                className={`retro-city ${playerView.visibleCities.includes(city.id) ? 'visited' : ''}`
                onClick={() => onNavigate(city.id)}
                title={city.name}
              >
                {city.name}
              </div>
            ))}
          </div>
        </section>

        {/* Dossier/maletín */}
        <section className="retro-dossier" aria-label="Dossier de evidencias">
          <h3>Dossier</h3>
          <div className="retro-dossier-content">
            <p>Evidencias recogidas: {inventory.length}</p>
            <div className="retro-evidence-list">
              {inventory.map((evId) => {
                const ev = definition.evidence.find((e) => e.id === evId);
                if (!ev) return null;
                return (
                  <div key={ev.id} className="retro-evidence-item">
                    <span className="evidence-type">{ev.type}</span>
                    <span className="evidence-desc">{ev.origin}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Laboratorio y comunicaciones */}
        <section className="retro-lab-communications" aria-label="Laboratorio y comunicaciones">
          <h3>Laboratorio</h3>
          <div className="retro-lab-content">
            <p>NPCs conocidos:</p>
            <ul>
              {definition.npcs.map((npc) => (
                <li key={npc.id}>
                  {npc.name}: cooperación {npc.cooperation}
                </li>
              ))}
            </ul>
          </div>
          <section className="retro-communications" aria-label="Comunicaciones">
            <h3>Comunicaciones</h3>
            <p>Registros de conversación:</p>
            <ul>
              {playerView.conversation.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </section>
        </section>

        {/* Consola narrativa */}
        <section className="retro-console" aria-label="Consola narrativa">
          <h3>Consola</h3>
          <div className="retro-console-log" role="log" aria-live="polite">
            {log.map((entry, idx) => (
              <div key={idx} className="retro-log-entry">
                {entry}
              </div>
            ))}
          </div>
          <div className="retro-command-input">
            <input
              type="text"
              value={input}
              onChange=(e) => setInput(e.target.value)
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFocus('command');
                }
              }}
              aria-label="Command input"
              autoFocus
            />
          </div>
        </section>
      </main>

      {/* Panel de confirmaciones */}
      <footer className="retro-footer">
        <p>
          Resultado: {run.finalReport 
            ? formatResult(run.finalReport.result) 
            : 'En curso'
          }</p>
        <p>
          Minute: {formatMinute(run.minute)} / {formatMinute(definition.deadlineMinutes)}
        </p>
      </footer>
    </div>
  );
};

export default RetroScreen;