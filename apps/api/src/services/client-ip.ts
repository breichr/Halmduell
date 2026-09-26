import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';
import { env } from '../env';

/**
 * IP-Adresse des Clients. Hinter einem Proxy zählt der letzte Eintrag in
 * X-Forwarded-For – den hat der Proxy selbst angehängt, frühere Einträge kann
 * der Client fälschen.
 */
export function clientIp(c: Context): string {
  if (env.vertraueProxy) {
    const weitergeleitet = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim();
    if (weitergeleitet) return weitergeleitet;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unbekannt';
  } catch {
    return 'unbekannt'; // z. B. app.request() in Tests
  }
}
