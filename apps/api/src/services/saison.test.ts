import { expect, test } from 'bun:test';
import { aktuelleSaison } from './saison';

test('Saisons laufen quartalsweise ab Q1 2026', () => {
  expect(aktuelleSaison(new Date('2026-01-01T00:00:00Z'))).toBe(1);
  expect(aktuelleSaison(new Date('2026-03-31T23:59:59Z'))).toBe(1);
  expect(aktuelleSaison(new Date('2026-04-01T00:00:00Z'))).toBe(2);
  expect(aktuelleSaison(new Date('2027-01-01T00:00:00Z'))).toBe(5);
});
