import { beforeAll, describe, expect, test } from 'bun:test';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser } from './helpers';

describe.skipIf(!mitDatenbank)('Auth', () => {
  beforeAll(leereDatenbank);

  test('Registrierung setzt httpOnly-Session-Cookie', async () => {
    const res = await anfrage('/auth/register', { method: 'POST', body: { username: 'Anna', password: 'geheim123' } });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ id: expect.any(Number), username: 'Anna', istAdmin: false, wiederherstellungsCode: expect.any(String) });
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

  test('zu viele Fehlversuche sperren nur die angreifende IP', async () => {
    const { username } = await neuerUser('limit');
    const login = (password: string, ip: string) => anfrage('/auth/login', { method: 'POST', ip, body: { username, password } });
    const versuche = [];
    for (let i = 0; i < 11; i++) versuche.push((await login('falsch123', '192.0.2.1')).status);
    expect(versuche.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(versuche[10]).toBe(429);
    // auch das richtige Passwort wird von dieser IP gerade abgelehnt …
    expect((await login('geheim123', '192.0.2.1')).status).toBe(429);
    // … der echte Nutzer von einer anderen IP kommt aber rein
    expect((await login('geheim123', '192.0.2.2')).status).toBe(200);
  });

  test('viele Fehlversuche über verschiedene Konten sperren die IP', async () => {
    const ip = '192.0.2.50';
    for (let i = 0; i < 50; i++) {
      await anfrage('/auth/login', { method: 'POST', ip, body: { username: `probe_${i}`, password: 'falsch123' } });
    }
    const { username } = await neuerUser('opfer');
    expect((await anfrage('/auth/login', { method: 'POST', ip, body: { username, password: 'geheim123' } })).status).toBe(429);
  }, 30_000); // 50 argon2-Prüfungen brauchen ihre Zeit – genau das bremst Angreifer
});

describe.skipIf(!mitDatenbank)('Wiederherstellung und Sessions', () => {
  beforeAll(leereDatenbank);

  test('Registrierung liefert einen Wiederherstellungscode', async () => {
    const { code } = await neuerUser();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}(-[A-HJKMNP-Z2-9]{5}){3}$/);
  });

  test('Passwort mit Wiederherstellungscode zurücksetzen', async () => {
    const user = await neuerUser('vergessen');
    const zuruecksetzen = (code: string, neuesPasswort = 'neues-passwort') =>
      anfrage('/auth/zuruecksetzen', { method: 'POST', body: { username: user.username, code, neuesPasswort } });

    expect((await zuruecksetzen('AAAAA-AAAAA-AAAAA-AAAAA')).status).toBe(401);

    // Eingabe ohne Bindestriche und kleingeschrieben funktioniert
    const res = await zuruecksetzen(user.code.replaceAll('-', '').toLowerCase());
    expect(res.status).toBe(200);
    expect(res.json.username).toBe(user.username);
    expect(res.json.wiederherstellungsCode).not.toBe(user.code);
    expect((await anfrage('/auth/me', { cookie: res.cookie })).status).toBe(200);

    // alte Session ungültig, alter Code verbraucht, altes Passwort ungültig
    expect((await anfrage('/auth/me', { cookie: user.cookie })).status).toBe(401);
    expect((await zuruecksetzen(user.code)).status).toBe(401);
    const login = (password: string) => anfrage('/auth/login', { method: 'POST', body: { username: user.username, password } });
    expect((await login('geheim123')).status).toBe(401);
    expect((await login('neues-passwort')).status).toBe(200);

    // der neue Code funktioniert
    expect((await zuruecksetzen(res.json.wiederherstellungsCode, 'noch-ein-passwort')).status).toBe(200);
  });

  test('Passwort ändern meldet andere Geräte ab', async () => {
    const user = await neuerUser('aendern');
    const zweitesGeraet = (await anfrage('/auth/login', { method: 'POST', body: { username: user.username, password: 'geheim123' } })).cookie;

    const falsch = await anfrage('/auth/passwort', { method: 'POST', cookie: user.cookie, body: { altesPasswort: 'falsch123', neuesPasswort: 'neues-passwort' } });
    expect(falsch.status).toBe(401);

    const res = await anfrage('/auth/passwort', { method: 'POST', cookie: user.cookie, body: { altesPasswort: 'geheim123', neuesPasswort: 'neues-passwort' } });
    expect(res.status).toBe(204);
    expect((await anfrage('/auth/me', { cookie: res.cookie })).status).toBe(200);
    expect((await anfrage('/auth/me', { cookie: zweitesGeraet })).status).toBe(401);
    expect((await anfrage('/auth/me', { cookie: user.cookie })).status).toBe(401);
  });

  test('Abmelden auf allen Geräten', async () => {
    const user = await neuerUser('ueberall');
    const zweitesGeraet = (await anfrage('/auth/login', { method: 'POST', body: { username: user.username, password: 'geheim123' } })).cookie;
    expect((await anfrage('/auth/logout-alle', { method: 'POST', cookie: user.cookie })).status).toBe(204);
    expect((await anfrage('/auth/me', { cookie: zweitesGeraet })).status).toBe(401);
    expect((await anfrage('/auth/me', { cookie: user.cookie })).status).toBe(401);
  });

  test('neuer Wiederherstellungscode macht den alten ungültig', async () => {
    const user = await neuerUser('neuercode');
    expect((await anfrage('/auth/wiederherstellungscode', { method: 'POST', cookie: user.cookie, body: { passwort: 'falsch123' } })).status).toBe(401);
    const res = await anfrage('/auth/wiederherstellungscode', { method: 'POST', cookie: user.cookie, body: { passwort: 'geheim123' } });
    expect(res.status).toBe(200);

    const mitAltemCode = await anfrage('/auth/zuruecksetzen', { method: 'POST', body: { username: user.username, code: user.code, neuesPasswort: 'neues-passwort' } });
    expect(mitAltemCode.status).toBe(401);
    const mitNeuemCode = await anfrage('/auth/zuruecksetzen', { method: 'POST', body: { username: user.username, code: res.json.wiederherstellungsCode, neuesPasswort: 'neues-passwort' } });
    expect(mitNeuemCode.status).toBe(200);
  });
});
