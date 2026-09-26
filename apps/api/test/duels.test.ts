import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser } from './helpers';

describe.skipIf(!mitDatenbank)('POST /duels/:id/complete', () => {
  let anna: Awaited<ReturnType<typeof neuerUser>>;
  let ben: Awaited<ReturnType<typeof neuerUser>>;
  let fremd: Awaited<ReturnType<typeof neuerUser>>;
  let duelId: number;

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben, fremd] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('fremd')];

    const { db } = await import('../src/db/client');
    const [duel] = await db.execute<{ id: number }>(sql`
      insert into duels (spieler_a_id, spieler_b_id, kategorie, status)
      values (${anna.id}, ${ben.id}, 'wissen', 'abgeschlossen') returning id`);
    duelId = duel!.id;
    const [frage] = await db.execute<{ id: number }>(sql`
      insert into questions (kategorie, typ, frage_text) values ('wissen', 'text', 'Testfrage') returning id`);
    await db.execute(sql`insert into duel_questions values (${duelId}, ${frage!.id}, 1)`);
    await db.execute(sql`insert into duel_answers values
      (${duelId}, ${anna.id}, ${frage!.id}, null, 1000, true),
      (${duelId}, ${ben.id}, ${frage!.id}, null, null, false)`);
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage(`/duels/${duelId}/complete`, { method: 'POST' })).status).toBe(401);
  });

  test('Nicht-Teilnehmer 403', async () => {
    expect((await anfrage(`/duels/${duelId}/complete`, { method: 'POST', cookie: fremd.cookie })).status).toBe(403);
  });

  test('Teilnehmer wertet das Duell, zweiter Aufruf 409', async () => {
    const res = await anfrage(`/duels/${duelId}/complete`, { method: 'POST', cookie: ben.cookie });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      punkteA: 1,
      punkteB: 0,
      ratings: { gesamt: { a: 1020, b: 980 }, wissen: { a: 1020, b: 980 } },
    });
    expect((await anfrage(`/duels/${duelId}/complete`, { method: 'POST', cookie: anna.cookie })).status).toBe(409);
  });
});
