import { expect, test } from 'bun:test';
import { aktuelleSaison, saisonBeginn, saisonBezeichnung, saisonEnde } from './saison';

test('Saisons sind Kalenderquartale ab Q1 2026', () => {
  expect(aktuelleSaison(new Date('2026-02-15T12:00:00Z'))).toBe(1);
  expect(aktuelleSaison(new Date('2026-05-15T12:00:00Z'))).toBe(2);
  expect(aktuelleSaison(new Date('2026-08-15T12:00:00Z'))).toBe(3);
  expect(aktuelleSaison(new Date('2026-11-15T12:00:00Z'))).toBe(4);
  expect(aktuelleSaison(new Date('2027-01-15T12:00:00Z'))).toBe(5);
});

test('Wechsel um Mitternacht deutscher Zeit, nicht UTC', () => {
  // 31.3. 23:30 UTC = 1.4. 01:30 MESZ → schon Q2
  expect(aktuelleSaison(new Date('2026-03-31T23:30:00Z'))).toBe(2);
  // 30.6. 21:59 UTC = 23:59 MESZ → noch Q2; eine Minute später Q3
  expect(aktuelleSaison(new Date('2026-06-30T21:59:00Z'))).toBe(2);
  expect(aktuelleSaison(new Date('2026-06-30T22:00:00Z'))).toBe(3);
  // Silvester: 31.12. 23:00 UTC = 1.1. 00:00 MEZ → neues Jahr
  expect(aktuelleSaison(new Date('2026-12-31T22:59:00Z'))).toBe(4);
  expect(aktuelleSaison(new Date('2026-12-31T23:00:00Z'))).toBe(5);
});

test('saisonBezeichnung', () => {
  expect(saisonBezeichnung(1)).toBe('Q1 2026');
  expect(saisonBezeichnung(3)).toBe('Q3 2026');
  expect(saisonBezeichnung(4)).toBe('Q4 2026');
  expect(saisonBezeichnung(5)).toBe('Q1 2027');
  for (const d of ['2026-09-26', '2027-04-02', '2031-12-30']) {
    const datum = new Date(`${d}T12:00:00Z`);
    const q = Math.floor(datum.getUTCMonth() / 3) + 1;
    expect(saisonBezeichnung(aktuelleSaison(datum))).toBe(`Q${q} ${datum.getUTCFullYear()}`);
  }
});

test('saisonBeginn/saisonEnde liegen auf Mitternacht deutscher Zeit', () => {
  expect(saisonBeginn(1).toISOString()).toBe('2025-12-31T23:00:00.000Z'); // MEZ
  expect(saisonBeginn(2).toISOString()).toBe('2026-03-31T22:00:00.000Z'); // MESZ
  expect(saisonEnde(3).toISOString()).toBe('2026-09-30T22:00:00.000Z');
  expect(saisonEnde(4).toISOString()).toBe('2026-12-31T23:00:00.000Z');
  for (let s = 1; s <= 40; s++) {
    expect(aktuelleSaison(saisonBeginn(s))).toBe(s);
    expect(aktuelleSaison(new Date(saisonEnde(s).getTime() - 1))).toBe(s);
  }
});
