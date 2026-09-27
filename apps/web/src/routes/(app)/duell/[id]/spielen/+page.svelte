<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { AntwortErgebnis, DuellDetails, GestellteFrage } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import AntwortFeedback from '$lib/components/AntwortFeedback.svelte';
	import FrageAnsicht from '$lib/components/FrageAnsicht.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import Timer from '$lib/components/Timer.svelte';

	const duelId = page.params.id;

	type Zustand =
		| { art: 'laedt' }
		| { art: 'frage'; frage: GestellteFrage }
		| { art: 'sendet'; frage: GestellteFrage; gewaehlt: number | null }
		| { art: 'feedback'; frage: GestellteFrage; gewaehlt: number | null; ergebnis: AntwortErgebnis }
		| { art: 'fehler'; meldung: string };

	let zustand = $state<Zustand>({ art: 'laedt' });
	// Ergebnis je Frage (Reihenfolge → richtig?) für die Fortschrittsleiste
	let ergebnisse = $state<Record<number, boolean>>({});
	let restMs = $state(0);
	let ende = 0;
	let rahmen = 0;

	async function zurAuswertung() {
		await Promise.all([invalidate('app:duell'), invalidate('app:duelle')]);
		await goto(`/duell/${duelId}`, { replaceState: true });
	}

	async function naechsteFrage() {
		zustand = { art: 'laedt' };
		try {
			const frage = await api().get<GestellteFrage>(`/duels/${duelId}/frage`);
			zustand = { art: 'frage', frage };
			starteTimer(frage.restzeitMs);
		} catch (e) {
			// nicht (mehr) am Zug, Duell beendet o. Ä. → Auswertung zeigt den Stand
			if (e instanceof ApiError && e.status === 409) return zurAuswertung();
			zustand = { art: 'fehler', meldung: e instanceof ApiError ? e.message : 'Frage konnte nicht geladen werden' };
		}
	}

	function starteTimer(ms: number) {
		cancelAnimationFrame(rahmen);
		ende = performance.now() + ms;
		const tick = () => {
			restMs = Math.max(0, ende - performance.now());
			if (restMs <= 0) {
				if (zustand.art === 'frage') void antworten(null);
				return;
			}
			rahmen = requestAnimationFrame(tick);
		};
		tick();
	}

	async function antworten(antwortId: number | null) {
		if (zustand.art !== 'frage') return;
		const frage = zustand.frage;
		cancelAnimationFrame(rahmen);
		zustand = { art: 'sendet', frage, gewaehlt: antwortId };
		try {
			const ergebnis = await api().post<AntwortErgebnis>(`/duels/${duelId}/antwort`, { frageId: frage.frageId, antwortId });
			zustand = { art: 'feedback', frage, gewaehlt: antwortId, ergebnis };
			ergebnisse[frage.reihenfolge] = ergebnis.richtig;
		} catch (e) {
			if (e instanceof ApiError && e.status === 409) return zurAuswertung();
			zustand = { art: 'fehler', meldung: e instanceof ApiError ? e.message : 'Antwort konnte nicht gesendet werden' };
		}
	}

	function weiter() {
		if (zustand.art !== 'feedback') return;
		if (zustand.ergebnis.rundeFertig) void zurAuswertung();
		else void naechsteFrage();
	}

	function taste(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (zustand.art === 'frage') {
			const index = Number(event.key) - 1;
			const antwort = zustand.frage.antworten[index];
			if (antwort) antworten(antwort.id);
		} else if (zustand.art === 'feedback' && event.key === 'Enter') {
			event.preventDefault();
			weiter();
		}
	}

	async function bisherigeErgebnisse() {
		try {
			const duel = await api().get<DuellDetails>(`/duels/${duelId}`);
			for (const f of duel.fragen) if (f.ich) ergebnisse[f.reihenfolge] = f.ich.richtig;
		} catch {
			// nur Anzeige – ohne geht es auch
		}
	}

	onMount(() => {
		void bisherigeErgebnisse();
		void naechsteFrage();
		return () => cancelAnimationFrame(rahmen);
	});

	function kachelZustand(id: number): string {
		if (zustand.art === 'sendet') return zustand.gewaehlt === id ? 'gewaehlt' : '';
		if (zustand.art !== 'feedback') return '';
		if (id === zustand.ergebnis.richtigeAntwortId) return 'richtig';
		if (id === zustand.gewaehlt) return 'falsch';
		return 'aus';
	}

	function punktZustand(n: number, aktuell: number): string {
		if (n in ergebnisse) return ergebnisse[n] ? 'gut' : 'schlecht';
		return n === aktuell ? 'aktuell' : '';
	}
</script>

<svelte:head><title>Duell – Halmduell</title></svelte:head>
<svelte:window onkeydown={taste} />

{#if zustand.art === 'laedt'}
	<div class="laden" aria-live="polite">
		<Halmi pose="denken" groesse={110} halm={false} />
		<p>Frage wird geladen …</p>
	</div>
{:else if zustand.art === 'fehler'}
	<div class="karte fehler-karte">
		<Halmi pose="traurig" groesse={100} halm={false} />
		<p class="fehlermeldung" role="alert">{zustand.meldung}</p>
		<div class="aktionen">
			<button class="knopf" onclick={naechsteFrage}>Erneut versuchen</button>
			<a class="knopf zweitrangig" href="/duell/{duelId}">Zum Duell</a>
		</div>
	</div>
{:else}
	{@const frage = zustand.frage}
	<div class="spiel" class:mit-feedback={zustand.art === 'feedback'}>
		<div class="leiste">
			<a href="/duell/{duelId}" class="zurueck-knopf" aria-label="Runde unterbrechen">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
			</a>
			<div class="fortschritt">
				<span class="nummer">Frage {frage.reihenfolge} <span class="von">von {frage.anzahl}</span></span>
				<span class="punkte" aria-hidden="true">
					{#each Array.from({ length: frage.anzahl }, (_, i) => i + 1) as n (n)}
						<span class="punkt {punktZustand(n, frage.reihenfolge)}"></span>
					{/each}
				</span>
			</div>
			<div class="timer-platz">
				{#if zustand.art === 'frage' || zustand.art === 'sendet'}
					<Timer {restMs} gesamtMs={frage.zeitlimitMs} />
				{/if}
			</div>
		</div>

		<FrageAnsicht {frage} zustandVon={kachelZustand} deaktiviert={zustand.art !== 'frage'} onantwort={antworten} />
	</div>

	{#if zustand.art === 'feedback'}
		{@const e = zustand.ergebnis}
		<AntwortFeedback
			gut={e.richtig}
			titel={e.richtig ? 'Richtig!' : e.zeitAbgelaufen ? 'Zeit abgelaufen!' : 'Leider falsch'}
			erklaerung={e.erklaerung}
			knopf={e.rundeFertig ? 'Zur Auswertung' : 'Nächste Frage'}
			onweiter={weiter}
		/>
	{/if}
{/if}

<style>
	.laden {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		margin-top: 4rem;
		color: var(--text-2);
		font-weight: 800;
	}
	.fehler-karte {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		margin-top: 2rem;
	}
	.aktionen {
		display: flex;
		gap: 0.6rem;
	}
	.spiel {
		display: grid;
		gap: 1rem;
		padding-top: 0.9rem;
	}
	.spiel.mit-feedback {
		padding-bottom: 17rem;
	}
	.leiste {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
	}
	.fortschritt {
		display: grid;
		gap: 0.3rem;
	}
	.nummer {
		font-family: var(--schrift-titel);
		font-weight: 800;
		font-size: 1.1rem;
		line-height: 1;
	}
	.von {
		color: var(--text-2);
	}
	.punkte {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 4px;
	}
	.punkt {
		height: 12px;
		border-radius: 6px;
		border: 2px solid var(--kante);
		background: var(--flaeche);
	}
	.punkt.aktuell {
		background: var(--sonne);
	}
	.punkt.gut {
		background: #58b85f;
	}
	.punkt.schlecht {
		background: var(--falsch-akzent);
	}
	.timer-platz {
		width: 58px;
		height: 58px;
	}
</style>
