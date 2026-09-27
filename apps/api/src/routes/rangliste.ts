import { Hono } from 'hono';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  RANGLISTE_LAENGE,
  aktuelleSaison,
  feldFehler,
  liga,
  ranglisteSchema,
  type ApiFehler,
  type Rangliste,
  type RanglistenEintrag,
} from '@halmduell/shared';
import { db } from '../db/client';
import { ratings, users } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { freundIds } from '../services/freunde';
import { plaetzeVonGestern } from '../services/verlauf';

export const ranglisteRoute = new Hono<AuthEnv>();

ranglisteRoute.use(requireAuth);

/**
 * Bestenliste je Kategorie und Saison. Platziert ist, wer in der Saison in der
 * Kategorie mindestens ein gewertetes Duell hat (erst dann gibt es eine Rating-Zeile).
 * Im Kreis „freunde“ zählen nur ich und meine bestätigten Freunde, die Plätze
 * werden innerhalb dieses Kreises vergeben.
 */
ranglisteRoute.get('/', async (c) => {
  const eingabe = ranglisteSchema.safeParse(c.req.query());
  const laufend = aktuelleSaison();
  if (!eingabe.success) {
    return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const { kategorie, kreis } = eingabe.data;
  const saison = eingabe.data.saison ?? laufend;
  if (saison > laufend) return c.json({ error: 'Diese Saison hat noch nicht begonnen' } satisfies ApiFehler, 400);

  const filter = and(
    eq(ratings.kategorie, kategorie),
    eq(ratings.saison, saison),
    kreis === 'freunde' ? inArray(ratings.userId, [c.var.userId, ...await freundIds(c.var.userId)]) : undefined,
  );
  const platziert = db.$with('platziert').as(
    db.select({
      id: ratings.userId,
      username: users.username,
      rating: ratings.rating,
      duelle: ratings.duelleGespielt,
      platz: sql<number>`rank() over (order by ${ratings.rating} desc)::int`.as('platz'),
    }).from(ratings).innerJoin(users, eq(users.id, ratings.userId)).where(filter),
  );
  // Bei gleichem Rating: wer mehr gespielt hat, steht weiter oben
  const reihenfolge = [asc(platziert.platz), desc(platziert.duelle), asc(platziert.username)];

  const [zeilen, [eigene], [anzahl], saisonZeilen] = await Promise.all([
    db.with(platziert).select().from(platziert).orderBy(...reihenfolge).limit(RANGLISTE_LAENGE),
    db.with(platziert).select().from(platziert).where(eq(platziert.id, c.var.userId)),
    db.select({ anzahl: count() }).from(ratings).where(filter),
    db.selectDistinct({ saison: ratings.saison }).from(ratings).orderBy(desc(ratings.saison)),
  ]);

  // Veränderung seit gestern nur, wo der Schnappschuss passt: laufende Saison, alle Spieler
  const vergleichbar = kreis === 'alle' && saison === laufend;
  const gestern = vergleichbar
    ? await plaetzeVonGestern(kategorie, saison, [...new Set([...zeilen, ...(eigene ? [eigene] : [])].map((z) => z.id))])
    : new Map<number, number>();

  const eintrag = (z: Omit<RanglistenEintrag, 'liga' | 'veraenderung'>): RanglistenEintrag => {
    const vorher = gestern.get(z.id);
    return {
      platz: z.platz,
      id: z.id,
      username: z.username,
      rating: z.rating,
      liga: liga(z.rating),
      duelle: z.duelle,
      veraenderung: vorher === undefined ? null : vorher - z.platz,
    };
  };
  const saisons = [...new Set([laufend, ...saisonZeilen.map((z) => z.saison)])].sort((a, b) => b - a);

  return c.json({
    kategorie,
    kreis,
    saison,
    aktuelleSaison: laufend,
    saisons,
    spielerAnzahl: anzahl?.anzahl ?? 0,
    eintraege: zeilen.map(eintrag),
    ich: eigene ? eintrag(eigene) : null,
  } satisfies Rangliste);
});
