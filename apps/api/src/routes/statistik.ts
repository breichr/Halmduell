import { Hono } from 'hono';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import {
  FORM_LAENGE,
  FRAGEN_KATEGORIEN,
  RATING_KATEGORIEN,
  aktuelleSaison,
  liga,
  type DuellAusgang,
  type Statistik,
} from '@halmduell/shared';
import { db } from '../db/client';
import { duelAnswers, duels, questions, ratings } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';

export const statistikRoute = new Hono<AuthEnv>();

statistikRoute.use(requireAuth);

/** Eigene Statistik: Duellbilanz, Form, Trefferquote je Kategorie und Ratings der Saison */
statistikRoute.get('/', async (c) => {
  const ich = c.var.userId;
  const saison = aktuelleSaison();

  const richtigeVon = (spieler: typeof duels.spielerAId | typeof duels.spielerBId) => sql<number>`(
    select count(*)::int from ${duelAnswers}
    where ${duelAnswers.duelId} = ${duels.id} and ${duelAnswers.userId} = ${spieler} and ${duelAnswers.istRichtig})`;

  const [ergebnisse, antworten, ratingZeilen] = await Promise.all([
    // gewertete Duelle, neueste zuerst
    db.select({
      a: duels.spielerAId,
      aufgegebenVon: duels.aufgegebenVon,
      punkteA: richtigeVon(duels.spielerAId),
      punkteB: richtigeVon(duels.spielerBId),
    }).from(duels)
      .where(and(eq(duels.status, 'abgeschlossen'), isNotNull(duels.spielerBId), or(eq(duels.spielerAId, ich), eq(duels.spielerBId, ich))))
      .orderBy(desc(duels.abgeschlossenAt), desc(duels.id)),
    // beantwortete Fragen je Kategorie (auch aus abgebrochenen Duellen)
    db.select({
      kategorie: questions.kategorie,
      beantwortet: sql<number>`count(*)::int`,
      richtig: sql<number>`count(*) filter (where ${duelAnswers.istRichtig})::int`,
      abgelaufen: sql<number>`count(*) filter (where ${duelAnswers.answerOptionId} is null)::int`,
      summeRichtigMs: sql<number>`coalesce(sum(${duelAnswers.antwortzeitMs}) filter (where ${duelAnswers.istRichtig}), 0)::float8`,
    }).from(duelAnswers)
      .innerJoin(questions, eq(questions.id, duelAnswers.questionId))
      .where(and(eq(duelAnswers.userId, ich), isNotNull(duelAnswers.istRichtig)))
      .groupBy(questions.kategorie),
    db.select({ kategorie: ratings.kategorie, rating: ratings.rating }).from(ratings)
      .where(and(eq(ratings.userId, ich), eq(ratings.saison, saison))),
  ]);

  const ausgaenge: DuellAusgang[] = ergebnisse.map((d) => {
    const binA = d.a === ich;
    if (d.aufgegebenVon !== null) return d.aufgegebenVon === ich ? 'niederlage' : 'sieg';
    const [meine, seine] = binA ? [d.punkteA, d.punkteB] : [d.punkteB, d.punkteA];
    return meine > seine ? 'sieg' : meine < seine ? 'niederlage' : 'unentschieden';
  });
  const anzahl = (ausgang: DuellAusgang) => ausgaenge.filter((x) => x === ausgang).length;

  let laenge = 0;
  while (laenge < ausgaenge.length && ausgaenge[laenge] === ausgaenge[0]) laenge++;

  const jeKategorie = new Map(antworten.map((z) => [z.kategorie, z]));
  const summe = (feld: 'beantwortet' | 'richtig' | 'abgelaufen' | 'summeRichtigMs') => antworten.reduce((s, z) => s + z[feld], 0);
  const richtig = summe('richtig');
  const ratingVon = new Map(ratingZeilen.map((r) => [r.kategorie, r.rating]));

  return c.json({
    duelle: {
      gespielt: ausgaenge.length,
      siege: anzahl('sieg'),
      unentschieden: anzahl('unentschieden'),
      niederlagen: anzahl('niederlage'),
    },
    form: ausgaenge.slice(0, FORM_LAENGE),
    serie: laenge >= 2 ? { ausgang: ausgaenge[0]!, laenge } : null,
    fragen: {
      beantwortet: summe('beantwortet'),
      richtig,
      abgelaufen: summe('abgelaufen'),
      schnittRichtigMs: richtig ? Math.round(summe('summeRichtigMs') / richtig) : null,
    },
    kategorien: FRAGEN_KATEGORIEN.map((kategorie) => ({
      kategorie,
      beantwortet: jeKategorie.get(kategorie)?.beantwortet ?? 0,
      richtig: jeKategorie.get(kategorie)?.richtig ?? 0,
    })),
    ratings: RATING_KATEGORIEN.map((kategorie) => {
      const rating = ratingVon.get(kategorie) ?? null;
      return { kategorie, rating, liga: rating === null ? null : liga(rating) };
    }),
    saison,
  } satisfies Statistik);
});
