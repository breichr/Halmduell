import { describe, expect, test } from 'bun:test';
import { erwartetesErgebnis, liga, saisonalerSoftReset, updateElo } from './elo';

describe('updateElo', () => {
  test('gleich starke Spieler: Sieg bringt K/2', () => {
    expect(updateElo(1000, 1000, 1, 0)).toBe(1020); // K = 40
    expect(updateElo(1000, 1000, 1, 20)).toBe(1010); // K = 20
  });

  test('Unentschieden gegen gleich starken Gegner ändert nichts', () => {
    expect(updateElo(1200, 1200, 0.5, 5)).toBe(1200);
  });

  test('Summe der Änderungen ist bei gleichem K null', () => {
    const a = updateElo(1100, 950, 0, 30);
    const b = updateElo(950, 1100, 1, 30);
    expect(a - 1100 + (b - 950)).toBe(0);
  });
});

test('erwartetesErgebnis ist symmetrisch', () => {
  expect(erwartetesErgebnis(1400, 1000) + erwartetesErgebnis(1000, 1400)).toBeCloseTo(1);
});

test('saisonalerSoftReset halbiert den Abstand zu 1000', () => {
  expect(saisonalerSoftReset(1400)).toBe(1200);
  expect(saisonalerSoftReset(800)).toBe(900);
});

test('liga-Grenzen', () => {
  expect(liga(899)).toBe('Bronze');
  expect(liga(900)).toBe('Silber');
  expect(liga(1100)).toBe('Gold');
  expect(liga(1300)).toBe('Platin');
  expect(liga(1500)).toBe('Meister');
});
