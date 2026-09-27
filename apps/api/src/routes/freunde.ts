import { Hono } from 'hono';
import { and, asc, count, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import {
  OFFENE_ANFRAGEN_MAX,
  aktuelleSaison,
  feldFehler,
  freundHinzufuegenSchema,
  liga,
  type ApiFehler,
  type Freund,
  type FreundHinzugefuegt,
  type Freundesliste,
} from '@halmduell/shared';
import { db } from '../db/client';
import { duels, friendships, ratings, users } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { pruefeAbzeichen } from '../services/abzeichen';
import { andere } from '../services/freunde';

/** Wie viele zuletzt gespielte Gegner als Vorschlag erscheinen */
const VORSCHLAEGE = 5;

export const freundeRoute = new Hono<AuthEnv>();

freundeRoute.use(requireAuth);

const fehler = (error: string): ApiFehler => ({ error });

function parseId(roh: string): number | null {
  const id = Number(roh);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Bedingung für die Zeile zwischen zwei Spielern, egal wer angefragt hat */
const paar = (a: number, b: number) => or(
  and(eq(friendships.userId, a), eq(friendships.friendId, b)),
  and(eq(friendships.userId, b), eq(friendships.friendId, a)),
);

freundeRoute.get('/', async (c) => {
  const ich = c.var.userId;
  const saison = aktuelleSaison();

  const beziehungen = await db.select({
    von: friendships.userId,
    an: friendships.friendId,
    status: friendships.status,
    seit: friendships.erstelltAt,
    username: users.username,
  }).from(friendships)
    .innerJoin(users, eq(users.id, andere(ich)))
    .where(or(eq(friendships.userId, ich), eq(friendships.friendId, ich)))
    .orderBy(desc(friendships.erstelltAt));

  const bestaetigt = beziehungen.filter((b) => b.status === 'bestaetigt').map((b) => ({ id: b.von === ich ? b.an : b.von, username: b.username }));
  const ids = bestaetigt.map((f) => f.id);
  const bekannte = beziehungen.map((b) => (b.von === ich ? b.an : b.von));

  const [ratingZeilen, laufende, gegner] = await Promise.all([
    ids.length
      ? db.select({ id: ratings.userId, rating: ratings.rating }).from(ratings)
        .where(and(inArray(ratings.userId, ids), eq(ratings.kategorie, 'gesamt'), eq(ratings.saison, saison)))
      : [],
    ids.length
      ? db.select({ id: duels.id, a: duels.spielerAId, b: duels.spielerBId, status: duels.status }).from(duels)
        .where(and(
          inArray(duels.status, ['wartet_a', 'wartet_b']),
          or(
            and(eq(duels.spielerAId, ich), inArray(duels.spielerBId, ids)),
            and(eq(duels.spielerBId, ich), inArray(duels.spielerAId, ids)),
          ),
        ))
        .orderBy(asc(duels.id))
      : [],
    // Zuletzt gespielte Gegner (nach dem jüngsten gemeinsamen Duell)
    db.select({ id: users.id, username: users.username, zuletzt: sql`max(${duels.erstelltAt})` }).from(duels)
      .innerJoin(users, eq(users.id, sql`case when ${duels.spielerAId} = ${ich} then ${duels.spielerBId} else ${duels.spielerAId} end`))
      .where(and(or(eq(duels.spielerAId, ich), eq(duels.spielerBId, ich)), isNotNull(duels.spielerBId)))
      .groupBy(users.id, users.username)
      .orderBy(desc(sql`max(${duels.erstelltAt})`))
      .limit(VORSCHLAEGE + bekannte.length),
  ]);

  const ratingVon = new Map(ratingZeilen.map((r) => [r.id, r.rating]));
  const duellMit = new Map<number, Freund['laufendesDuell']>();
  for (const d of laufende) {
    const gid = d.a === ich ? d.b! : d.a;
    if (duellMit.has(gid)) continue;
    const duBistDran = (d.status === 'wartet_a' && d.a === ich) || (d.status === 'wartet_b' && d.b === ich);
    duellMit.set(gid, { id: d.id, duBistDran });
  }

  const freunde: Freund[] = bestaetigt
    .map((f) => {
      const rating = ratingVon.get(f.id) ?? null;
      return { ...f, rating, liga: rating === null ? null : liga(rating), laufendesDuell: duellMit.get(f.id) ?? null };
    })
    .sort((x, y) => x.username.localeCompare(y.username, 'de', { sensitivity: 'base' }));

  const anfrage = (b: (typeof beziehungen)[number]) => ({ id: b.von === ich ? b.an : b.von, username: b.username, seit: b.seit.toISOString() });

  return c.json({
    freunde,
    anfragen: beziehungen.filter((b) => b.status === 'angefragt' && b.an === ich).map(anfrage),
    gesendet: beziehungen.filter((b) => b.status === 'angefragt' && b.von === ich).map(anfrage),
    vorschlaege: gegner.filter((g) => !bekannte.includes(g.id)).slice(0, VORSCHLAEGE).map((g) => ({ id: g.id, username: g.username })),
  } satisfies Freundesliste);
});

/** Anzahl offener Anfragen an mich (für den Punkt in der Navigation) */
freundeRoute.get('/anfragen/anzahl', async (c) => {
  const [zeile] = await db.select({ anzahl: count() }).from(friendships)
    .where(and(eq(friendships.friendId, c.var.userId), eq(friendships.status, 'angefragt')));
  return c.json({ anzahl: zeile?.anzahl ?? 0 });
});

/**
 * Anfrage per Benutzername verschicken. Hatte die andere Seite mich schon
 * angefragt, gilt das als Annahme – dann seid ihr sofort befreundet.
 */
freundeRoute.post('/', async (c) => {
  const eingabe = freundHinzufuegenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) {
    return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const ich = c.var.userId;
  const [ziel] = await db.select({ id: users.id, username: users.username }).from(users)
    .where(eq(sql`lower(${users.username})`, eingabe.data.username.toLowerCase()));
  if (!ziel) return c.json(fehler('Diesen Benutzernamen gibt es nicht'), 404);
  if (ziel.id === ich) return c.json(fehler('Mit dir selbst bist du schon befreundet'), 400);

  // Zweiter Durchlauf nur, falls die andere Seite gleichzeitig angefragt hat
  for (let versuch = 0; versuch < 2; versuch++) {
    const [bestehend] = await db.select().from(friendships).where(paar(ich, ziel.id));
    if (bestehend?.status === 'bestaetigt') return c.json(fehler(`Du bist schon mit ${ziel.username} befreundet`), 409);
    if (bestehend?.userId === ich) return c.json(fehler(`Du hast ${ziel.username} schon angefragt`), 409);
    if (bestehend) {
      await db.update(friendships).set({ status: 'bestaetigt' }).where(paar(ich, ziel.id));
      await Promise.all([pruefeAbzeichen(db, ich), pruefeAbzeichen(db, ziel.id)]);
      return c.json({ ...ziel, status: 'bestaetigt' } satisfies FreundHinzugefuegt);
    }

    const [offen] = await db.select({ anzahl: count() }).from(friendships)
      .where(and(eq(friendships.userId, ich), eq(friendships.status, 'angefragt')));
    if ((offen?.anzahl ?? 0) >= OFFENE_ANFRAGEN_MAX) {
      return c.json(fehler('Zu viele offene Anfragen – warte, bis ein paar beantwortet sind'), 429);
    }

    const eingefuegt = await db.insert(friendships).values({ userId: ich, friendId: ziel.id })
      .onConflictDoNothing().returning({ id: friendships.friendId });
    if (eingefuegt.length) return c.json({ ...ziel, status: 'angefragt' } satisfies FreundHinzugefuegt, 201);
  }
  return c.json(fehler('Bitte versuch es noch einmal'), 409);
});

/** Anfrage von :id annehmen */
freundeRoute.post('/:id/annehmen', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Anfrage nicht gefunden'), 404);
  const ich = c.var.userId;
  const angenommen = await db.update(friendships).set({ status: 'bestaetigt' })
    .where(and(eq(friendships.userId, id), eq(friendships.friendId, ich), eq(friendships.status, 'angefragt')))
    .returning({ id: friendships.userId });
  if (!angenommen.length) return c.json(fehler('Anfrage nicht gefunden'), 404);
  await Promise.all([pruefeAbzeichen(db, ich), pruefeAbzeichen(db, id)]);
  return c.body(null, 204);
});

/** Freundschaft beenden, Anfrage ablehnen oder zurückziehen – je nachdem, was besteht */
freundeRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Keine Freundschaft oder Anfrage gefunden'), 404);
  const geloescht = await db.delete(friendships).where(paar(c.var.userId, id)).returning({ id: friendships.userId });
  if (!geloescht.length) return c.json(fehler('Keine Freundschaft oder Anfrage gefunden'), 404);
  return c.body(null, 204);
});
