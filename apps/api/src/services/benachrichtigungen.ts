import { KATEGORIE_NAMEN, type DuellAusgang, type DuellKategorie, type PushNachricht } from '@halmduell/shared';

/** Fragetext für die Benachrichtigung kürzen */
function kurz(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// Texte aller Push-Benachrichtigungen an einem Ort. Ein Tag je Duell sorgt dafür,
// dass auf dem Gerät immer nur die neueste Nachricht zu einem Duell steht.

const duellTag = (duelId: number) => `duell-${duelId}`;
const duellUrl = (duelId: number) => `/duell/${duelId}`;

export const nachricht = {
  herausgefordert: (duelId: number, von: string, kategorie: DuellKategorie): PushNachricht => ({
    titel: `${von} fordert dich heraus!`,
    text: `${KATEGORIE_NAMEN[kategorie]} – ${von} hat die Runde gespielt, jetzt bist du dran.`,
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  beendet: (duelId: number, gegner: string, meine: number, seine: number, ausgang: DuellAusgang): PushNachricht => ({
    titel: ausgang === 'sieg' ? `Gewonnen gegen ${gegner}!` : ausgang === 'niederlage' ? `Verloren gegen ${gegner}` : `Unentschieden gegen ${gegner}`,
    text: `${meine} : ${seine} – schau dir den Vergleich an.`,
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  aufgegeben: (duelId: number, von: string): PushNachricht => ({
    titel: `${von} hat aufgegeben`,
    text: 'Das Duell geht an dich.',
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  fristGewonnen: (duelId: number, gegner: string): PushNachricht => ({
    titel: `Gewonnen gegen ${gegner}`,
    text: `${gegner} hat die Frist verpasst.`,
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  fristVerloren: (duelId: number, gegner: string): PushNachricht => ({
    titel: 'Frist verpasst',
    text: `Das Duell gegen ${gegner} ist leider verloren.`,
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  erinnerung: (duelId: number, gegner: string | null): PushNachricht => ({
    titel: 'Nur noch 24 Stunden',
    text: gegner ? `Dein Zug gegen ${gegner} läuft bald ab.` : 'Deine Runde im offenen Duell läuft bald ab.',
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  angestupst: (duelId: number, von: string): PushNachricht => ({
    titel: `${von} stupst dich an`,
    text: 'Du bist dran – spiel deine Runde!',
    url: duellUrl(duelId),
    tag: duellTag(duelId),
  }),

  freundschaftsanfrage: (von: string): PushNachricht => ({
    titel: 'Neue Freundschaftsanfrage',
    text: `${von} möchte mit dir befreundet sein.`,
    url: '/freunde',
    tag: 'freunde',
  }),

  meldungErledigt: (frage: string, antwort: string | null, duelId: number | null): PushNachricht => ({
    titel: 'Danke für deine Meldung!',
    text: `Wir haben „${kurz(frage)}“ überarbeitet.${antwort ? ` ${antwort}` : ''}`,
    url: duelId ? duellUrl(duelId) : '/',
    tag: 'meldungen',
  }),

  meldungVerworfen: (frage: string, antwort: string | null, duelId: number | null): PushNachricht => ({
    titel: 'Deine Meldung wurde geprüft',
    text: `„${kurz(frage)}“ bleibt so, wie sie ist.${antwort ? ` ${antwort}` : ''}`,
    url: duelId ? duellUrl(duelId) : '/',
    tag: 'meldungen',
  }),

  frageFreigegeben: (frage: string, rueckmeldung: string | null): PushNachricht => ({
    titel: 'Deine Frage ist im Spiel!',
    text: `„${kurz(frage)}“ wurde freigegeben.${rueckmeldung ? ` ${rueckmeldung}` : ''}`,
    url: '/fragen/eigene',
    tag: 'eigene-fragen',
  }),

  frageAbgelehnt: (frage: string, rueckmeldung: string | null): PushNachricht => ({
    titel: 'Deine Frage wurde nicht übernommen',
    text: `„${kurz(frage)}“${rueckmeldung ? ` – ${rueckmeldung}` : ' passt leider nicht in den Katalog.'}`,
    url: '/fragen/eigene',
    tag: 'eigene-fragen',
  }),

  anfrageAngenommen: (von: string): PushNachricht => ({
    titel: `Du und ${von} seid jetzt Freunde`,
    text: 'Fordere gleich zu einem Duell heraus!',
    url: '/freunde',
    tag: 'freunde',
  }),
};
