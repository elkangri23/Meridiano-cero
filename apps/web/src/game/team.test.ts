import { describe, expect, it } from 'vitest';
import { initialView } from '../archive/initial-fixture';
import { briefingAnswer, ELENA_REFUSAL, evaluateAnswer, explainAnswer, medalLabel, organizeAnswer, routesAnswer, TEAM_MEMBERS, TEAM_SERVICE_LABELS, teamRequestText, teamServiceAnswer } from './team';
import type { CareerProfileDto, PlayerViewDto } from '@meridiano/contracts';

function viewWith(overrides: Partial<PlayerViewDto>): PlayerViewDto {
  return { ...initialView, ...overrides };
}

function careerWith(overrides: Partial<CareerProfileDto>): CareerProfileDto {
  return {
    rank: 'Detective', points: 140, prestige: 19, integrity: 3, trust: 2,
    prestigeLabel: 'Ejemplar', integrityLabel: 'Discreta', trustLabel: 'Discreta',
    totalCases: 2, completedCases: 1, medals: ['medalla-oro'], countries: ['España', 'Francia'],
    places: ['Sala de embalaje'], sanctions: [], results: [],
    ...overrides,
  };
}

describe('equipo A.C.M.E.: respuestas desde la vista, sin inventar', () => {
  it('tiene los cinco miembros del GDD §8 con su función', () => {
    expect(TEAM_MEMBERS.map(member => member.id)).toEqual(['margaret', 'richter', 'elena', 'david', 'clara']);
    expect(TEAM_MEMBERS.find(member => member.id === 'margaret')?.name).toBe('Margaret Sullivan');
    expect(TEAM_MEMBERS.find(member => member.id === 'richter')?.name).toBe('Dr. Samuel Richter');
    expect(TEAM_MEMBERS.find(member => member.id === 'elena')?.name).toBe('Elena Vázquez');
    expect(TEAM_MEMBERS.find(member => member.id === 'david')?.name).toBe('David Nakamura');
    expect(TEAM_MEMBERS.find(member => member.id === 'clara')?.name).toBe('Clara Beaumont');
    expect(TEAM_SERVICE_LABELS.briefing).toBe('Preguntar sobre el encargo');
    expect(TEAM_SERVICE_LABELS.coordinate).toBe('Coordinar una detención');
  });

  it('Margaret recuerda el encargo y los objetivos con su estado, sin valorar cómo va', () => {
    const view = viewWith({ briefing: { speaker: 'Margaret Sullivan', title: 'El astrolabio robado',
      paragraphs: ['Han robado el astrolabio original en Madrid.'] },
      objectives: [{ id: 'obj-detener', description: 'Detener a Inés con orden válida', achieved: true },
        { id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false }] });
    const answer = briefingAnswer(view);
    expect(answer).toContain('Han robado el astrolabio original en Madrid.');
    expect(answer).toContain('Detener a Inés con orden válida (logrado)');
    expect(answer).toContain('Recuperar el astrolabio original (pendiente)');
    expect(answer).not.toMatch(/vas bien|buen camino|culpable/i);
  });

  it('Richter explica el análisis con su texto y el recordatorio de procedimiento', () => {
    const view = viewWith({ evidenceTexts: { 'EV-03': 'La huella técnica es compatible con una herramienta de la serie HV-17.' },
      objects: [{ id: 'EV-03', type: 'analysis', origin: 'lab', minute: 90, admissible: true }] });
    const answer = explainAnswer(view, 'EV-03');
    expect(answer).toContain('La huella técnica es compatible con una herramienta de la serie HV-17.');
    expect(answer).toContain('Un análisis solo dice lo que la prueba permite decir.');
    expect(answer).not.toMatch(/culpable|Inés/i);
  });

  it('Clara organiza lo recogido con admisibilidad, lo pendiente y los objetivos', () => {
    const view = viewWith({ objects: [{ id: 'EV-02', type: 'object', origin: 'scene', minute: 10, admissible: true }],
      evidenceTexts: { 'EV-02': 'La cerradura de la vitrina tiene residuo de herramienta.' },
      pendingRequests: [{ id: 'req-1', type: 'analysis', dueMinute: 120 }],
      objectives: [{ id: 'obj-recuperar', description: 'Recuperar el astrolabio original', achieved: false }] });
    const answer = organizeAnswer(view);
    expect(answer).toContain('La cerradura de la vitrina tiene residuo de herramienta. (admisible)');
    expect(answer).toContain('analysis (responde en el minuto 120)');
    expect(answer).toContain('Recuperar el astrolabio original (pendiente)');
  });

  it('David enumera solo las rutas que la vista ofrece desde la ciudad actual', () => {
    const view = viewWith({ offers: [{ id: 'travel:paris', label: 'Viajar a París',
      action: { type: 'travel', params: { destination: 'paris' } }, detail: '2 h 15 min' }] });
    expect(routesAnswer(view)).toContain('Viajar a París');
    expect(routesAnswer(view)).toContain('2 h 15 min');
    expect(routesAnswer(viewWith({ offers: [] }))).toContain('no hay rutas de viaje disponibles');
  });

  it('la negativa de Elena es la misma que la de la terminal: sin registro, sin inventar', () => {
    expect(ELENA_REFUSAL).toContain('Sin registro en los archivos consultados');
    expect(ELENA_REFUSAL).toContain('no demuestra inocencia');
  });

  it('las frases de petición son fijas y no llevan la solución', () => {
    expect(teamRequestText('briefing')).toBe('¿Qué me puedes decir del encargo?');
    expect(teamRequestText('explain', 'EV-03')).toContain('EV-03');
    expect(teamRequestText('organize')).toBe('¿Puedes organizar el expediente?');
    expect(teamRequestText('evaluate')).toBe('¿Cómo va mi carrera?');
  });

  it('Margaret evalúa la carrera solo con el perfil oficial, sin valorar el caso en curso', () => {
    const answer = evaluateAnswer(careerWith({}));
    expect(answer).toContain('rango Detective');
    expect(answer).toContain('140 puntos');
    expect(answer).toContain('2 casos');
    expect(answer).toContain('Medalla de oro');
    expect(answer).toContain('Prestigio ejemplar');
    expect(answer).not.toMatch(/vas bien|buen camino|culpable|Inés/i);
    // Sin casos cerrados, lo dice sin inventar.
    expect(evaluateAnswer(careerWith({ totalCases: 0, completedCases: 0, points: 0, rank: 'Aspirante', medals: [] })))
      .toContain('Aún no tienes casos cerrados');
    // teamServiceAnswer pide el perfil: sin él no hay evaluación.
    expect(teamServiceAnswer('evaluate', viewWith({}))).toBeNull();
    expect(teamServiceAnswer('evaluate', viewWith({}), undefined, null)).toBeNull();
    expect(teamServiceAnswer('evaluate', viewWith({}), undefined, careerWith({}))).toContain('rango Detective');
    expect(medalLabel('medalla-plata')).toBe('Medalla de plata');
    expect(medalLabel(null)).toBe('Sin medalla');
  });

  it('Margaret cuenta la suspensión activa y cómo se resuelve', () => {
    const answer = evaluateAnswer(careerWith({
      sanctions: [{ id: 'suspension-abc', caseId: 'generado-1', reason: 'A.C.M.E. retiró el caso por conducta irregular',
        severity: 'suspension', imposedAt: 90, active: true }],
    }));
    expect(answer).toContain('1 suspensión activa');
    expect(answer).toContain('Un caso limpio la resuelve');
    const resolved = evaluateAnswer(careerWith({
      sanctions: [{ id: 'suspension-abc', caseId: 'generado-1', reason: 'A.C.M.E. retiró el caso por conducta irregular',
        severity: 'suspension', imposedAt: 90, resolvedAt: 300, active: false }],
    }));
    expect(resolved).toContain('ya la resolviste con casos limpios');
  });
});
