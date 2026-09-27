import { Hono } from 'hono';
import { ABZEICHEN, type AbzeichenListe } from '@halmduell/shared';
import { db } from '../db/client';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { ermittleWerte, erreichteKeys, pruefeAbzeichen, stand } from '../services/abzeichen';

export const abzeichenRoute = new Hono<AuthEnv>();

abzeichenRoute.use(requireAuth);

/**
 * Alle Abzeichen mit Status und Fortschritt. Prüft vorher nach – so kommen auch
 * Saison-Abzeichen an, die erst mit dem Saisonende erreicht sind.
 */
abzeichenRoute.get('/', async (c) => {
  const ich = c.var.userId;
  await pruefeAbzeichen(db, ich);
  const [werte, erreicht] = await Promise.all([ermittleWerte(db, ich), erreichteKeys(db, ich)]);

  const abzeichen = ABZEICHEN.map((a) => {
    const am = erreicht.get(a.key);
    return {
      ...a,
      erreichtAt: am ? am.toISOString() : null,
      // Fortschritt nur, solange es noch nicht erreicht ist (und nie über dem Ziel)
      stand: am || a.ziel === undefined ? null : Math.min(stand(a.key, werte) ?? 0, a.ziel),
    };
  });
  return c.json({ abzeichen, erreicht: abzeichen.filter((a) => a.erreichtAt).length } satisfies AbzeichenListe);
});
