import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { env } from '../env';

export const SESSION_COOKIE = 'halmduell_session';
const SESSION_DAUER_S = 60 * 60 * 24 * 30; // 30 Tage

export function hashPasswort(passwort: string): Promise<string> {
  return Bun.password.hash(passwort, { algorithm: 'argon2id' });
}

export function pruefePasswort(passwort: string, hash: string): Promise<boolean> {
  return Bun.password.verify(passwort, hash);
}

// Für unbekannte Benutzernamen trotzdem einen Hash prüfen, damit die Antwortzeit
// nicht verrät, ob ein Name existiert.
const dummyHash = hashPasswort('halmduell-dummy-passwort');
export async function pruefeDummyPasswort(passwort: string): Promise<false> {
  await pruefePasswort(passwort, await dummyHash);
  return false;
}

export async function setzeSession(c: Context, userId: number): Promise<void> {
  const jetzt = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: String(userId), iat: jetzt, exp: jetzt + SESSION_DAUER_S }, env.jwtSecret, 'HS256');
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.istProduktion,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAUER_S,
  });
}

export function loescheSession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: env.istProduktion });
}

/** User-ID aus dem Session-Cookie, oder null bei fehlendem/ungültigem/abgelaufenem Token */
export async function leseSession(c: Context): Promise<number | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const payload = await verify(token, env.jwtSecret, 'HS256');
    const userId = Number(payload.sub);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
