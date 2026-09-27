import { app } from './app';
import { verarbeiteFristen, verschickeErinnerungen } from './services/duell-ende';

const FRISTEN_INTERVALL_MS = 10 * 60 * 1000;

async function fristenJob() {
  try {
    const { beendet } = await verarbeiteFristen();
    if (beendet > 0) console.log(`Fristen: ${beendet} Duell(e) beendet`);
    const { erinnert } = await verschickeErinnerungen();
    if (erinnert > 0) console.log(`Fristen: ${erinnert} Erinnerung(en) verschickt`);
  } catch (fehler) {
    console.error('Fristen-Job fehlgeschlagen', fehler);
  }
}

void fristenJob();
setInterval(fristenJob, FRISTEN_INTERVALL_MS);

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
