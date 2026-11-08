import { describe, expect, it } from 'vitest';
import { TEAM_MEMBERS, TEAM_SERVICES, teamMember, isTeamMemberId, isTeamServiceId, isTeamRecord } from './team.js';

describe('Equipo A.C.M.E. (GDD §8)', () => {
  it('los cinco miembros del GDD existen con sus funciones', () => {
    expect(TEAM_MEMBERS.map(member => member.id)).toEqual(['margaret', 'richter', 'elena', 'david', 'clara']);
    expect(TEAM_MEMBERS.map(member => member.name)).toEqual([
      'Margaret Sullivan', 'Dr. Samuel Richter', 'Elena Vázquez', 'David Nakamura', 'Clara Beaumont',
    ]);
    expect(teamMember('elena')).toMatchObject({ name: 'Elena Vázquez', role: 'Inteligencia' });
    expect(teamMember('desconocido')).toBeUndefined();
  });
  it('cada miembro solo ofrece sus servicios; coordinar no es un servicio del motor', () => {
    expect(TEAM_SERVICES).toEqual({
      margaret: ['briefing', 'evaluate'],
      richter: ['explain'],
      elena: ['lookup'],
      david: ['routes'],
      clara: ['organize'],
    });
    expect(isTeamMemberId('david')).toBe(true);
    expect(isTeamMemberId('ines')).toBe(false);
    expect(isTeamServiceId('richter', 'explain')).toBe(true);
    expect(isTeamServiceId('richter', 'briefing')).toBe(false);
    expect(isTeamServiceId('david', 'coordinate')).toBe(false);
    // La evaluación de carrera es solo de Margaret (T5-04, GDD §13).
    expect(isTeamServiceId('margaret', 'evaluate')).toBe(true);
    expect(isTeamServiceId('clara', 'evaluate')).toBe(false);
  });
  it('isTeamRecord acepta registros con y sin objetivo, y rechaza el resto', () => {
    expect(isTeamRecord({ id: 'team-1', memberId: 'margaret', serviceId: 'briefing', minute: 0 })).toBe(true);
    expect(isTeamRecord({ id: 'team-2', memberId: 'richter', serviceId: 'explain', targetId: 'EV-03', minute: 120 })).toBe(true);
    expect(isTeamRecord({ id: 'team-3', memberId: 'david', serviceId: 'coordinate', minute: 0 })).toBe(false);
    expect(isTeamRecord({ id: 'team-4', memberId: 'elena', serviceId: 'lookup', minute: 0, question: '¿Qué sabes?' })).toBe(false);
    expect(isTeamRecord({ id: 'team-5', memberId: 'clara', serviceId: 'organize', minute: -1 })).toBe(false);
    expect(isTeamRecord({ id: 'team-6', memberId: 'clara', serviceId: 'organize' })).toBe(false);
    expect(isTeamRecord({ id: 'team-7', memberId: 'clara', serviceId: 'organize', minute: 0, targetId: 'EV 03' })).toBe(false);
  });
});
