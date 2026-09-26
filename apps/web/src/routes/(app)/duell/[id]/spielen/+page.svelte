<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { AntwortErgebnis, GestellteFrage } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import Timer from '$lib/components/Timer.svelte';

	const duelId = page.params.id;

	type Zustand =
		| { art: 'laedt' }
		| { art: 'frage'; frage: GestellteFrage }
		| { art: 'sendet'; frage: GestellteFrage; gewaehlt: number | null }
		| { art: 'feedback'; frage: GestellteFrage; gewaehlt: number | null; ergebnis: AntwortErgebnis }
		| { art: 'fehler'; meldung: string };

	let zustand = $state<Zustand>({ art: 'laedt' });
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

	onMount(() => {
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
</script>

<svelte:head><title>Duell – Halmduell</title></svelte:head>
<svelte:window onkeydown={taste} />

{#if zustand.art === 'laedt'}
	<p class="laden" aria-live="polite">Frage wird geladen …</p>
{:else if zustand.art === 'fehler'}
	<div class="karte">
		<p class="fehlermeldung" role="alert">{zustand.meldung}</p>
		<div class="aktionen">
			<button class="knopf" onclick={naechsteFrage}>Erneut versuchen</button>
			<a class="knopf zweitrangig" href="/duell/{duelId}">Zum Duell</a>
		</div>
	</div>
{:else}
	{@const frage = zustand.frage}
	<div class="spiel">
		<div class="leiste">
			<div class="fortschritt" aria-label="Frage {frage.reihenfolge} von {frage.anzahl}">
				<span class="nummer">Frage {frage.reihenfolge} <span class="von">von {frage.anzahl}</span></span>
				<span class="punkte" aria-hidden="true">
					{#each Array.from({ length: frage.anzahl }, (_, i) => i + 1) as n (n)}
						<span class="punkt" class:erledigt={n < frage.reihenfolge} class:aktuell={n === frage.reihenfolge}></span>
					{/each}
				</span>
			</div>
			{#if zustand.art === 'frage' || zustand.art === 'sendet'}
				<Timer {restMs} gesamtMs={frage.zeitlimitMs} />
			{/if}
		</div>

		{#if frage.bildUrl}
			<figure>
				<img src={frage.bildUrl} alt="Bild zur Frage" />
				{#if frage.bildQuelle}<figcaption>Bild: {frage.bildQuelle}</figcaption>{/if}
			</figure>
		{/if}

		<h1 class="frage" data-testid="frage">{frage.frageText}</h1>

		<div class="antworten">
			{#each frage.antworten as antwort, i (antwort.id)}
				<button
					class="antwort {kachelZustand(antwort.id)}"
					disabled={zustand.art !== 'frage'}
					onclick={() => antworten(antwort.id)}
					data-testid="antwort"
				>
					<span class="taste" aria-hidden="true">{i + 1}</span>
					<span>{antwort.text}</span>
				</button>
			{/each}
		</div>

		{#if zustand.art === 'feedback'}
			{@const e = zustand.ergebnis}
			<div class="feedback {e.richtig ? 'gut' : 'schlecht'}" role="status" data-testid="feedback">
				<strong>{e.richtig ? 'Richtig!' : e.zeitAbgelaufen ? 'Zeit abgelaufen' : 'Leider falsch'}</strong>
				{#if e.erklaerung}<p>{e.erklaerung}</p>{/if}
			</div>
			<!-- svelte-ignore a11y_autofocus -->
			<button class="knopf breit weiter" onclick={weiter} autofocus>
				{e.rundeFertig ? 'Zur Auswertung' : 'Nächste Frage'}
			</button>
		{/if}
	</div>
{/if}

<style>
	.laden {
		text-align: center;
		color: var(--text-2);
		margin-top: 3rem;
	}
	.aktionen {
		display: flex;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	.spiel {
		display: grid;
		gap: 1rem;
	}
	.leiste {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3.2rem;
	}
	.fortschritt {
		display: grid;
		gap: 0.35rem;
	}
	.nummer {
		font-weight: 700;
	}
	.von {
		color: var(--text-2);
		font-weight: 500;
	}
	.punkte {
		display: flex;
		gap: 0.3rem;
	}
	.punkt {
		width: 1.6rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--flaeche-2);
	}
	.punkt.erledigt {
		background: var(--gruen);
		opacity: 0.55;
	}
	.punkt.aktuell {
		background: var(--gruen);
	}
	figure {
		margin: 0;
	}
	img {
		width: 100%;
		max-height: 45vh;
		object-fit: contain;
		background: var(--flaeche-2);
		border-radius: var(--radius);
	}
	figcaption {
		font-size: 0.78rem;
		color: var(--text-2);
		margin-top: 0.25rem;
	}
	.frage {
		font-size: 1.3rem;
		font-weight: 650;
		margin: 0.25rem 0;
	}
	.antworten {
		display: grid;
		gap: 0.6rem;
	}
	@media (min-width: 480px) {
		.antworten {
			grid-template-columns: 1fr 1fr;
		}
	}
	.antwort {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 64px;
		padding: 0.8rem 1rem;
		text-align: left;
		font: inherit;
		font-weight: 550;
		color: var(--text);
		background: var(--flaeche);
		border: 2px solid var(--linie);
		border-radius: var(--radius);
		box-shadow: var(--schatten);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, opacity 0.2s;
	}
	/* nur mit Maus: auf Touch-Geräten bliebe der Hover-Rahmen nach dem Tippen stehen */
	@media (hover: hover) {
		.antwort:hover:enabled {
			border-color: var(--gruen);
		}
	}
	.antwort:disabled {
		cursor: default;
	}
	.taste {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 6px;
		background: var(--flaeche-2);
		color: var(--text-2);
		font-size: 0.8rem;
		font-weight: 700;
	}
	.antwort.gewaehlt {
		border-color: var(--gruen);
		background: var(--gruen-hell);
	}
	.antwort.richtig {
		border-color: var(--richtig);
		background: var(--richtig-hell);
	}
	.antwort.falsch {
		border-color: var(--falsch);
		background: var(--falsch-hell);
	}
	.antwort.aus {
		opacity: 0.5;
	}
	.feedback {
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
	}
	.feedback strong {
		font-size: 1.15rem;
	}
	.feedback p {
		margin: 0.3rem 0 0;
		color: var(--text);
	}
	.feedback.gut {
		background: var(--richtig-hell);
		color: var(--richtig);
	}
	.feedback.schlecht {
		background: var(--falsch-hell);
		color: var(--falsch);
	}
	.weiter {
		min-height: 56px;
		font-size: 1.05rem;
	}
</style>
