import { beforeAll, describe, expect, test } from 'bun:test';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser } from './helpers';

describe.skipIf(!mitDatenbank)('Auth', () => {
  beforeAll(leereDatenbank);

  test('Registrierung setzt httpOnly-Session-Cookie', async () => {
    const res = await anfrage('/auth/register', { method: 'POST', body: { username: 'Anna', password: 'geheim123' } });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ id: expect.any(Number), username: 'Anna' });
    expect(res.setCookie).toContain('halmduell_session=');
    expect(res.setCookie).toContain('HttpOnly');
    expect(res.setCookie).toContain('SameSite=Lax');
    expect(res.json).not.toHaveProperty('passwortHash');
  });

  test('Benutzername ist ohne Groß-/Kleinschreibung eindeutig', async () => {
    const res = await anfrage('/auth/register', { method: 'POST', body: { username: 'anna', password: 'geheim123' } });
    expect(res.status).toBe(409);
  });

  test('ungültige Eingaben liefern Feldfehler', async () => {
    const res = await anfrage('/auth/register', { method: 'POST', body: { username: 'a!', password: 'kurz' } });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.felder).sort()).toEqual(['password', 'username']);
  });

  test('Login mit falschem und richtigem Passwort', async () => {
    const falsch = await anfrage('/auth/login', { method: 'POST', body: { username: 'Anna', password: 'falsch123' } });
    expect(falsch.status).toBe(401);
    expect(falsch.setCookie).toBe('');

    const unbekannt = await anfrage('/auth/login', { method: 'POST', body: { username: 'niemand', password: 'geheim123' } });
    expect(unbekannt.status).toBe(401);
    expect(unbekannt.json.error).toBe(falsch.json.error);

    const richtig = await anfrage('/auth/login', { method: 'POST', body: { username: 'ANNA', password: 'geheim123' } });
    expect(richtig.status).toBe(200);
    expect(richtig.json.username).toBe('Anna');
    expect(richtig.cookie).toStartWith('halmduell_session=');
  });

  test('/me braucht eine gültige Session', async () => {
    expect((await anfrage('/auth/me')).status).toBe(401);
    expect((await anfrage('/auth/me', { cookie: 'halmduell_session=kaputt' })).status).toBe(401);

    const { cookie, username } = await neuerUser();
    const me = await anfrage('/auth/me', { cookie });
    expect(me.status).toBe(200);
    expect(me.json.username).toBe(username);

    // Signatur manipulieren
    const manipuliert = cookie.slice(0, -2) + (cookie.endsWith('AA') ? 'BB' : 'AA');
    expect((await anfrage('/auth/me', { cookie: manipuliert })).status).toBe(401);
  });

  test('Logout löscht das Cookie', async () => {
    const res = await anfrage('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(204);
    expect(res.setCookie).toContain('Max-Age=0');
  });

  test('zu viele Fehlversuche werden gebremst', async () => {
    const { username } = await neuerUser('limit');
    const versuche = [];
    for (let i = 0; i < 11; i++) {
      versuche.push((await anfrage('/auth/login', { method: 'POST', body: { username, password: 'falsch123' } })).status);
    }
    expect(versuche.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(versuche[10]).toBe(429);
  });
});
