// Validadores de DTO de carrera con rangos y reputación traducidos: la API
// devuelve el rango y las etiquetas en el idioma del jugador, así que el
// validador del cliente debe aceptarlos en español, inglés y francés.
// Regresión del lote i18n: con las listas solo en español, la vista en
// inglés o francés no validaba (`isPlayerViewDto` falso) y la pantalla de
// juego caía a «Partida no disponible» al cambiar de idioma.
import { describe, expect, it } from 'vitest';
import { isCareerProfileDto, isOfficialResultDto } from './index.js';
import type { CareerProfileDto, OfficialResultDto } from './index.js';

function officialResult(rankBefore: string, rankAfter: string): OfficialResultDto {
  return {
    caseId: 'astrolabio-tres-ciudades',
    caseTitle: 'El astrolabio de las tres ciudades',
    contentHash: 'a'.repeat(64),
    result: 'complete',
    reason: 'finished',
    minute: 470,
    points: 100,
    medal: 'medalla-oro',
    prestigeDelta: 15,
    integrityDelta: 3,
    trustDelta: 2,
    irregularActs: 0,
    countries: ['Portugal', 'España'],
    places: ['Almacén de depósito', 'Sala de embalaje'],
    rankBefore,
    rankAfter,
    isThisRun: false,
    createdAt: '2026-11-08T09:08:33.149Z',
  };
}

function careerProfile(rank: string, labels: [string, string, string]): CareerProfileDto {
  return {
    rank,
    points: 100,
    prestige: 15,
    integrity: 3,
    trust: 2,
    prestigeLabel: labels[0],
    integrityLabel: labels[1],
    trustLabel: labels[2],
    totalCases: 1,
    completedCases: 1,
    medals: ['medalla-oro'],
    countries: ['Portugal', 'España'],
    places: ['Almacén de depósito', 'Sala de embalaje'],
    sanctions: [],
    results: [],
  };
}

describe('validadores de carrera con idiomas', () => {
  it('el resultado oficial acepta rangos en español, inglés y francés', () => {
    expect(isOfficialResultDto(officialResult('Aspirante', 'Detective'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Aspirant', 'Detective'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Aspirant', 'Détective'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Aspirante', 'Sargento'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Aspirant', 'Sergeant'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Aspirant', 'Sergent'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Inspector', 'Inspector'))).toBe(true);
    expect(isOfficialResultDto(officialResult('Inspecteur', 'Inspecteur'))).toBe(true);
  });

  it('el perfil de carrera acepta rango y reputación en los tres idiomas', () => {
    expect(isCareerProfileDto(careerProfile('Aspirante', ['Ejemplar', 'Sólida', 'Discreta']))).toBe(true);
    expect(isCareerProfileDto(careerProfile('Aspirant', ['Exemplary', 'Solid', 'Discreet']))).toBe(true);
    expect(isCareerProfileDto(careerProfile('Inspecteur', ['Exemplaire', 'Solide', 'Discrète']))).toBe(true);
    expect(isCareerProfileDto(careerProfile('Détective', ['Exemplaire', 'Douteuse', 'Entachée']))).toBe(true);
  });

  it('sigue rechazando rangos y etiquetas que no existen en ningún idioma', () => {
    expect(isOfficialResultDto(officialResult('Gran Detective', 'Detective'))).toBe(false);
    expect(isCareerProfileDto(careerProfile('Gran Detective', ['Ejemplar', 'Sólida', 'Discreta']))).toBe(false);
    expect(isCareerProfileDto(careerProfile('Aspirante', ['Legendaria', 'Sólida', 'Discreta']))).toBe(false);
  });
});
