<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { FRAGEN_KATEGORIEN, UEBEN_ZIEL, type FragenKategorie, type UebungsErgebnis, type UebungsFrage, type UebungsRunde } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import AbzeichenPlakette from '$lib/components/AbzeichenPlakette.svelte';
	import AntwortFeedback from '$lib/components/AntwortFeedback.svelte';
	import FrageAnsicht from '$lib/components/FrageAnsicht.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import { kategorieName } from '$lib/format';

	const roh = page.url.searchParams.get('kategorie');
	const kategorie = (FRAGEN_KATEGORIEN as readonly string[]).includes(roh ?? '') ? (roh as FragenKategorie) : undefined;

	type Zustand =
		| { art: 'laedt' }
		| { art: 'frage'; frage: UebungsFrage }
		| { art: 'sendet'; frage: UebungsFrage; gewaehlt: number }
		| { art: 'feedback'; frage: UebungsFrage; gewaehlt: number; ergebnis: UebungsErgebnis }
		| { art: 'fertig' }
		| { art: 'fehler'; meldung: string };

	let zustand = $state<Zustand>({ art: 'laedt' });
	let offen = $state(0);
	let geschafft = $state(0);
	let letzteId: number | undefined;

	async function naechsteFrage() {
		zustand = { art: 'laedt' };
		const query = new URLSearchParams();
		if (kategorie) query.set('kategorie', kategorie);
		if (letzteId) query.set('ohne', String(letzteId));
		try {
			const runde = await api().get<UebungsRunde>(`/ueben/frage${query.size ? `?${query}` : ''}`);
			offen = runde.offen;
			zustand = runde.frage ? { art: 'frage', frage: runde.frage } : { art: 'fertig' };
		} catch (e) {
			zustand = { art: 'fehler', meldung: e instanceof ApiError ? e.message : 'Frage konnte nicht geladen werden' };
		}
	}

	async function antworten(antwortId: number) {
		if (zustand.art !== 'frage') return;
		const frage = zustand.frage;
		zustand = { art: 'sendet', frage, gewaehlt: antwortId };
		try {
			const ergebnis = await api().post<UebungsErgebnis>('/ueben/antwort', { frageId: frage.frageId, antwortId, kategorie });
			letzteId = frage.frageId;
			offen = ergebnis.offen;
			if (ergebnis.gemeistert) geschafft++;
			zustand = { art: 'feedback', frage, gewaehlt: antwortId, ergebnis };
		} catch (e) {
			// z. B. inzwischen gemeistert (anderes Gerät) → einfach die nächste
			if (e instanceof ApiError && e.status === 409) return naechsteFrage();
			zustand = { art: 'fehler', meldung: e instanceof ApiError ? e.message : 'Antwort konnte nicht gesendet werden' };
		}
	}

	function weiter() {
		if (zustand.art !== 'feedback') return;
		if (zustand.ergebnis.offen === 0) zustand = { art: 'fertig' };
		else void naechsteFrage();
	}

	function taste(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (zustand.art === 'frage') {
			const antwort = zustand.frage.antworten[Number(event.key) - 1];
			if (antwort) void antworten(antwort.id);
		} else if (zustand.art === 'feedback' && event.key === 'Enter') {
			event.preventDefault();
			weiter();
		}
	}

	function kachelZustand(id: number): string {
		if (zustand.art === 'sendet') return zustand.gewaehlt === id ? 'gewaehlt' : '';
		if (zustand.art !== 'feedback') return '';
		if (id === zustand.ergebnis.richtigeAntwortId) return 'richtig';
		if (id === zustand.gewaehlt) return 'falsch';
		return 'aus';
	}

	onMount(() => {
		void naechsteFrage();
		// Übersicht beim Zurückgehen neu laden
		return () => void invalidate('app:ueben');
	});
</script>

<svelte:head><title>Fehler üben – Halmduell</title></svelte:head>
<svelte:window onkeydown={taste} />

{#if zustand.art === 'laedt'}
	<div class="laden" aria-live="polite">
		<Halmi pose="denken" groesse={110} halm={false} />
		<p>Frage wird geladen …</p>
	</div>
{:else if zustand.art === 'fehler'}
	<div class="karte mittig">
		<Halmi pose="traurig" groesse={100} halm={false} />
		<p class="fehlermeldung" role="alert">{zustand.meldung}</p>
		<div class="aktionen">
			<button class="knopf" onclick={naechsteFrage}>Erneut versuchen</button>
			<a class="knopf zweitrangig" href="/ueben">Zur Übersicht</a>
		</div>
	</div>
{:else if zustand.art === 'fertig'}
	<div class="karte mittig" data-testid="fertig">
		<Halmi pose="jubeln" groesse={120} />
		<h1>Alles geübt!</h1>
		<p class="hinweis">
			{geschafft ? `${geschafft === 1 ? 'Eine Frage' : `${geschafft} Fragen`} gemeistert. ` : ''}{kategorie
				? `In „${kategorieName(kategorie)}“ ist nichts mehr offen.`
				: 'Es ist nichts mehr offen.'}
		</p>
		<div class="aktionen">
			<a class="knopf" href="/duell/neu">Duell starten</a>
			<a class="knopf zweitrangig" href="/ueben">Übersicht</a>
		</div>
	</div>
{:else}
	{@const frage = zustand.frage}
	<!-- nach der Antwort gleich den neuen Stand zeigen -->
	{@const inFolge = zustand.art === 'feedback' ? zustand.ergebnis.richtigInFolge : frage.richtigInFolge}
	<div class="spiel" class:mit-feedback={zustand.art === 'feedback'}>
		<div class="leiste">
			<a href="/ueben" class="zurueck-knopf" aria-label="Üben beenden">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
			</a>
			<div class="stand">
				<span class="titel">Fehler üben{kategorie ? ` · ${kategorieName(kategorie)}` : ''}</span>
				<span class="offen" data-testid="offen">noch {offen} offen</span>
			</div>
			<span class="folge" aria-label="{inFolge} von {UEBEN_ZIEL} richtig in Folge">
				{#each Array.from({ length: UEBEN_ZIEL }, (_, i) => i) as i (i)}
					<span class="stern" class:an={i < inFolge}></span>
				{/each}
			</span>
		</div>

		<FrageAnsicht {frage} zustandVon={kachelZustand} deaktiviert={zustand.art !== 'frage'} onantwort={antworten} />
	</div>

	{#if zustand.art === 'feedback'}
		{@const e = zustand.ergebnis}
		<AntwortFeedback
			gut={e.richtig}
			titel={e.gemeistert ? 'Gemeistert!' : e.richtig ? 'Richtig!' : 'Leider falsch'}
			erklaerung={e.erklaerung}
			knopf={e.offen === 0 ? 'Fertig' : 'Nächste Frage'}
			onweiter={weiter}
		>
			{#if e.richtig && !e.gemeistert}
				<p class="zusatz">Noch {UEBEN_ZIEL - e.richtigInFolge}× richtig, dann ist sie gemeistert.</p>
			{:else if !e.richtig}
				<p class="zusatz">Die Frage kommt später noch einmal.</p>
			{/if}
			{#each e.neueAbzeichen as a (a.key)}
				<p class="abzeichen"><AbzeichenPlakette icon={a.icon} groesse={36} /> Neues Abzeichen: <strong>{a.titel}</strong></p>
			{/each}
		</AntwortFeedback>
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
	.mittig {
		display: grid;
		justify-items: center;
		gap: 0.7rem;
		margin-top: 2rem;
		text-align: center;
	}
	.mittig h1,
	.mittig p {
		margin: 0;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}
	.spiel {
		display: grid;
		gap: 1rem;
		padding-top: 0.9rem;
	}
	.spiel.mit-feedback {
		padding-bottom: 19rem;
	}
	.leiste {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
	}
	.stand {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.titel {
		font-family: var(--schrift-titel);
		font-weight: 800;
		font-size: 1.1rem;
		line-height: 1.1;
	}
	.offen {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-2);
	}
	.folge {
		display: flex;
		gap: 4px;
	}
	.stern {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--kante);
		background: var(--flaeche);
	}
	.stern.an {
		background: var(--sonne);
		border-color: var(--kontur);
	}
	.zusatz {
		font-weight: 700;
	}
	.abzeichen {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
