// Stammdaten (Abzeichen) + einige Beispielfragen für die Entwicklung.
// Idempotent: kann beliebig oft ausgeführt werden.
import { inArray } from 'drizzle-orm';
import type { FragenKategorie } from '@halmduell/shared';
import { db, sqlClient } from './client';
import { achievements, answerOptions, questions } from './schema';

const abzeichen = [
  { key: 'schaedling_experte', titel: 'Schädlings-Experte', beschreibung: '50 Schädlingsfragen richtig beantwortet', icon: 'kaefer' },
  { key: 'zehn_duelle', titel: 'Warmgelaufen', beschreibung: '10 Duelle gespielt', icon: 'halm' },
  { key: 'saison_top10', titel: 'Saison-Top-10', beschreibung: 'Eine Saison unter den besten 10 abgeschlossen', icon: 'pokal' },
];

interface Beispielfrage {
  kategorie: FragenKategorie;
  frageText: string;
  erklaerung: string;
  richtig: string;
  falsch: [string, string, string];
}

const beispielfragen: Beispielfrage[] = [
  {
    kategorie: 'wissen',
    frageText: 'Wofür stehen die Buchstaben N, P und K bei Düngemitteln?',
    erklaerung: 'N, P und K sind die chemischen Symbole der Hauptnährstoffe Stickstoff, Phosphor und Kalium.',
    richtig: 'Stickstoff, Phosphor, Kalium',
    falsch: ['Natrium, Phosphat, Kalk', 'Nitrat, Pottasche, Kupfer', 'Stickstoff, Pflanzenschutz, Kalk'],
  },
  {
    kategorie: 'wissen',
    frageText: 'Was bezeichnet man als Fruchtfolge?',
    erklaerung: 'Die Fruchtfolge ist die zeitliche Abfolge der Kulturen auf einer Fläche über mehrere Jahre.',
    richtig: 'Die zeitliche Abfolge der Kulturen auf einer Fläche',
    falsch: ['Die Reihenfolge der Ernte innerhalb eines Jahres', 'Den Abstand zwischen den Saatreihen', 'Die Reifestadien einer Frucht'],
  },
  {
    kategorie: 'krankheiten',
    frageText: 'Welcher Pilz verursacht Gelbrost an Weizen?',
    erklaerung: 'Gelbrost wird durch Puccinia striiformis verursacht und bildet typische gelbe Pustelstreifen auf den Blättern.',
    richtig: 'Puccinia striiformis',
    falsch: ['Zymoseptoria tritici', 'Blumeria graminis', 'Fusarium graminearum'],
  },
  {
    kategorie: 'schaedlinge',
    frageText: 'Welcher Käfer ist ein bedeutender Schädling im Winterraps?',
    erklaerung: 'Der Rapsglanzkäfer frisst an den Blütenknospen des Rapses und kann so große Ertragsverluste verursachen.',
    richtig: 'Rapsglanzkäfer',
    falsch: ['Kartoffelkäfer', 'Siebenpunkt-Marienkäfer', 'Buchdrucker'],
  },
  {
    kategorie: 'kulturen',
    frageText: 'Zu welcher Pflanzenfamilie gehört die Ackerbohne?',
    erklaerung: 'Die Ackerbohne ist ein Hülsenfrüchtler (Fabaceae) und kann mit Knöllchenbakterien Luftstickstoff binden.',
    richtig: 'Hülsenfrüchtler',
    falsch: ['Süßgräser', 'Kreuzblütler', 'Nachtschattengewächse'],
  },
  {
    kategorie: 'kulturen',
    frageText: 'Welche dieser Kulturen ist kein Getreide?',
    erklaerung: 'Raps ist ein Kreuzblütler und gehört zu den Ölfrüchten; Gerste, Roggen und Triticale sind Getreide.',
    richtig: 'Raps',
    falsch: ['Gerste', 'Roggen', 'Triticale'],
  },
];

await db.transaction(async (tx) => {
  await tx.insert(achievements).values(abzeichen).onConflictDoNothing({ target: achievements.key });

  const vorhanden = await tx.select({ frageText: questions.frageText }).from(questions)
    .where(inArray(questions.frageText, beispielfragen.map((f) => f.frageText)));
  const vorhandenSet = new Set(vorhanden.map((f) => f.frageText));

  for (const f of beispielfragen.filter((f) => !vorhandenSet.has(f.frageText))) {
    const [frage] = await tx.insert(questions).values({
      kategorie: f.kategorie,
      typ: 'text',
      frageText: f.frageText,
      erklaerung: f.erklaerung,
    }).returning({ id: questions.id });
    await tx.insert(answerOptions).values([
      { questionId: frage!.id, text: f.richtig, istRichtig: true },
      ...f.falsch.map((text) => ({ questionId: frage!.id, text, istRichtig: false })),
    ]);
  }
  console.log(`Seed: ${abzeichen.length} Abzeichen, ${beispielfragen.length - vorhandenSet.size} neue Beispielfragen`);
});
await sqlClient.end();
