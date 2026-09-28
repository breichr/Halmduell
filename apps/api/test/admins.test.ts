import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AdminEintrag, AngemeldeterUser } from '@halmduell/shared';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

describe.skipIf(!mitDatenbank)('Admins verwalten', () => {
  let chef: User;
  let anna: User;
  let ben: User;
  const vorher = process.env.ADMIN_USERNAMES;

  afterAll(() => {
    process.env.ADMIN_USERNAMES = vorher;
  });

  beforeEach(async () => {
    await leereDatenbank();
    [chef, anna, ben] = [await neuerUser('chef'), await neuerUser('anna'), await neuerUser('ben')];
    // fester Admin per Umgebungsvariable (plus ein Name ohne Konto)
    process.env.ADMIN_USERNAMES = `${chef.username.toUpperCase()}, gibtsnicht`;
  });

  const liste = async (u: User) => (await anfrage('/admin/admins', { cookie: u.cookie })).json as AdminEintrag[];
  const ernennen = (von: User, username: string) => anfrage('/admin/admins', { method: 'POST', cookie: von.cookie, body: { username } });
  const entfernen = (von: User, id: number) => anfrage(`/admin/admins/${id}`, { method: 'DELETE', cookie: von.cookie });
  const me = async (u: User) => (await anfrage('/auth/me', { cookie: u.cookie })).json as AngemeldeterUser;

  test('nur Admins sehen und ändern die Liste', async () => {
    expect((await anfrage('/admin/admins', { cookie: anna.cookie })).status).toBe(403);
    expect((await ernennen(anna, anna.username)).status).toBe(403);
    expect(await liste(chef)).toEqual([{ id: chef.id, username: chef.username, fest: true, ich: true }]);
  });

  test('ernennen: wirkt sofort für Portal und /me', async () => {
    expect((await me(anna)).istAdmin).toBe(false);
    const res = await ernennen(chef, anna.username.toUpperCase());
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ id: anna.id, username: anna.username, fest: false, ich: false });
    expect((await me(anna)).istAdmin).toBe(true);
    expect((await anfrage('/admin/fragen', { cookie: anna.cookie })).status).toBe(200);

    // die neue Admin darf selbst ernennen und sieht sich als „ich“
    expect((await ernennen(anna, ben.username)).status).toBe(201);
    expect((await liste(anna)).map((a) => [a.username, a.fest, a.ich])).toEqual(
      [[anna.username, false, true], [ben.username, false, false], [chef.username, true, false]],
    );
  });

  test('Fehlerfälle beim Ernennen', async () => {
    expect((await ernennen(chef, 'niemand')).status).toBe(404);
    expect((await ernennen(chef, '')).status).toBe(400);
    expect((await ernennen(chef, chef.username)).status).toBe(409); // fester Admin
    await ernennen(chef, anna.username);
    const doppelt = await ernennen(chef, anna.username);
    expect(doppelt.status).toBe(409);
    expect(doppelt.json.error).toContain('schon Admin');
  });

  test('entfernen: wirkt sofort; nicht sich selbst, nicht feste Admins', async () => {
    await ernennen(chef, anna.username);
    await ernennen(chef, ben.username);
    expect((await entfernen(anna, anna.id)).status).toBe(400); // sich selbst
    const fest = await entfernen(anna, chef.id);
    expect(fest.status).toBe(400);
    expect(fest.json.error).toContain('ADMIN_USERNAMES');

    expect((await entfernen(anna, ben.id)).status).toBe(204);
    expect((await anfrage('/admin/fragen', { cookie: ben.cookie })).status).toBe(403);
    expect((await me(ben)).istAdmin).toBe(false);
    expect((await entfernen(anna, ben.id)).status).toBe(404); // kein Admin mehr
    expect((await entfernen(anna, 999999)).status).toBe(404);
  });

  test('Login liefert istAdmin auch für im Portal ernannte Admins', async () => {
    await ernennen(chef, anna.username);
    const login = await anfrage('/auth/login', { method: 'POST', body: { username: anna.username, password: 'geheim123' } });
    expect(login.json.istAdmin).toBe(true);
  });
});
