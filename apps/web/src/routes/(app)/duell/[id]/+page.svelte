<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { api, ApiError } from '$lib/api';
	import EinladungTeilen from '$lib/components/EinladungTeilen.svelte';
	import Ergebnissymbol from '$lib/components/Ergebnissymbol.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import { kategorieName, restzeit, vorzeichen } from '$lib/format';

	let { data } = $props();
	const duel = $derived(data.duel);

	const laufend = $derived(duel.status === 'wartet_a' || duel.status === 'wartet_b');
	const gegnerName = $derived(duel.gegner?.username ?? 'Gegner');
	const angefangen = $derived(duel.fragen.some((f) => f.beantwortet));

	const ergebnis = $derived.by(() => {
		if (duel.status === 'abgebrochen') return { art: 'neutral', titel: 'Abgebrochen', text: 'Niemand hat die Einladung angenommen – keine Wertung.' };
		if (duel.status !== 'abgeschlossen') return null;
		if (duel.aufgegeben === 'ich') return { art: 'niederlage', titel: 'Aufgegeben', text: `${gegnerName} gewinnt das Duell.` };
		if (duel.aufgegeben === 'gegner') return { art: 'sieg', titel: 'Gewonnen!', text: `${gegnerName} hat aufgegeben.` };
		if (duel.meinePunkte > duel.gegnerPunkte) return { art: 'sieg', titel: 'Gewonnen!', text: 'Stark gespielt.' };
		if (duel.meinePunkte < duel.gegnerPunkte) return { art: 'niederlage', titel: 'Verloren', text: `${gegnerName} war diesmal besser.` };
		return { art: 'neutral', titel: 'Unentschieden', text: 'Gleichstand – Revanche?' };
	});

	let fehler = $state('');
	let aufgebenOffen = $state(false);

	async function aufgeben() {
		fehler = '';
		try {
			await api().post(`/duels/${duel.id}/aufgeben`);
			aufgebenOffen = false;
			await Promise.all([invalidate('app:duell'), invalidate('app:duelle')]);
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Aufgeben fehlgeschlagen';
		}
	}
</script>

<svelte:head><title>Duell gegen {gegnerName} – Halmduell</title></svelte:head>

<a href="/" class="zurueck">← Übersicht</a>

<header class="kopf">
	<div class="kategorie"><KategorieSymbol kategorie={duel.kategorie} groesse={22} /> {kategorieName(duel.kategorie)}</div>
	<div class="spielstand" aria-label="Du {duel.meinePunkte}, {gegnerName} {duel.gegnerPunkte}">
		<div class="spieler">
			<span class="name">Du</span>
			<span class="zahl" data-testid="meine-punkte">{duel.meinePunkte}</span>
		</div>
		<span class="trenner" aria-hidden="true">:</span>
		<div class="spieler">
			<span class="name">{duel.gegner?.username ?? 'Offen'}</span>
			<span class="zahl">{duel.gegnerPunkte}</span>
		</div>
	</div>
	{#if laufend && duel.zugBis}
		<p class="hinweis frist">
			{duel.duBistDran ? 'Du bist dran' : duel.gegner ? `${gegnerName} ist dran` : 'Wartet auf einen Gegner'} ·
			{restzeit(duel.zugBis)}
		</p>
	{/if}
</header>

{#if ergebnis}
	<div class="ergebnis {ergebnis.art}" data-testid="ergebnis">
		<strong>{ergebnis.titel}</strong>
		<span>{ergebnis.text}</span>
		{#if duel.ratingAenderung !== null}
			<span class="rating">Rating {vorzeichen(duel.ratingAenderung)}</span>
		{/if}
	</div>
{/if}

{#if duel.duBistDran}
	<a href="/duell/{duel.id}/spielen" class="knopf breit spielen">{angefangen ? 'Weiterspielen' : 'Runde spielen'}</a>
{/if}

{#if duel.einladungsCode}
	<EinladungTeilen code={duel.einladungsCode} />
{/if}

<section>
	<h2>Fragen</h2>
	<ol class="fragen">
		{#each duel.fragen as f (f.reihenfolge)}
			<li class="karte frage">
				{#if f.frage}
					<details>
						<summary>
							<span class="nr">{f.reihenfolge}</span>
							<span class="text">{f.frage.frageText}</span>
							<span class="symbole"><Ergebnissymbol stand={f.ich} wer="Du" /><Ergebnissymbol stand={f.gegner} wer={gegnerName} /></span>
						</summary>
						<div class="details">
							{#if f.frage.bildUrl}
								<img src={f.frage.bildUrl} alt="" loading="lazy" />
								{#if f.frage.bildQuelle}<p class="quelle">Bild: {f.frage.bildQuelle}</p>{/if}
							{/if}
							{#if f.frage.richtigeAntwort}<p><strong>Richtig:</strong> {f.frage.richtigeAntwort.text}</p>{/if}
							{#if f.frage.erklaerung}<p class="hinweis">{f.frage.erklaerung}</p>{/if}
						</div>
					</details>
				{:else}
					<div class="zeile">
						<span class="nr">{f.reihenfolge}</span>
						<span class="text verdeckt">Noch nicht beantwortet</span>
						<span class="symbole"><Ergebnissymbol stand={f.ich} wer="Du" /><Ergebnissymbol stand={null} wer={gegnerName} /></span>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
	<p class="hinweis legende">Links du, rechts {gegnerName}. Antworten des Gegners siehst du erst, wenn du die Frage selbst beantwortet hast.</p>
</section>

{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}

<div class="unten">
	{#if !laufend && duel.gegner}
		<a class="knopf breit" href="/duell/neu?gegner={encodeURIComponent(duel.gegner.username)}&kategorie={duel.kategorie}">Revanche</a>
	{/if}
	{#if laufend}
		{#if aufgebenOffen}
			<div class="karte bestaetigen" role="alertdialog" aria-labelledby="aufgeben-titel">
				<p id="aufgeben-titel"><strong>Wirklich aufgeben?</strong> {duel.gegner ? `${gegnerName} gewinnt dann das Duell.` : 'Die Einladung wird zurückgezogen.'}</p>
				<div class="aktionen">
					<button class="knopf zweitrangig" onclick={() => (aufgebenOffen = false)}>Abbrechen</button>
					<button class="knopf gefahr" onclick={aufgeben}>Aufgeben</button>
				</div>
			</div>
		{:else}
			<button class="knopf gefahr breit" onclick={() => (aufgebenOffen = true)}>{duel.gegner ? 'Aufgeben' : 'Einladung zurückziehen'}</button>
		{/if}
	{/if}
	<button class="knopf zweitrangig breit" onclick={() => goto('/')}>Zur Übersicht</button>
</div>

<style>
	.zurueck {
		display: inline-block;
		margin-bottom: 0.5rem;
		text-decoration: none;
	}
	.kopf {
		text-align: center;
		margin-bottom: 1rem;
	}
	.kategorie {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--gruen);
		font-weight: 600;
	}
	.spielstand {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 1.25rem;
		margin: 0.5rem 0;
	}
	.spieler {
		display: grid;
		justify-items: center;
		min-width: 5rem;
	}
	.spieler .name {
		color: var(--text-2);
		font-weight: 500;
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.zahl {
		font-size: 3rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.trenner {
		font-size: 2.2rem;
		font-weight: 700;
		color: var(--text-2);
		padding-bottom: 0.2rem;
	}
	.frist {
		margin: 0;
	}
	.ergebnis {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		text-align: center;
		padding: 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		background: var(--flaeche-2);
	}
	.ergebnis strong {
		font-size: 1.4rem;
	}
	.ergebnis.sieg {
		background: var(--richtig-hell);
		color: var(--richtig);
	}
	.ergebnis.niederlage {
		background: var(--falsch-hell);
		color: var(--falsch);
	}
	.ergebnis span {
		color: var(--text);
	}
	.ergebnis .rating {
		font-weight: 700;
	}
	.spielen {
		margin-bottom: 1rem;
		font-size: 1.1rem;
		min-height: 56px;
	}
	section {
		margin-top: 1.5rem;
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.frage {
		padding: 0;
	}
	summary,
	.zeile {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.9rem;
		min-height: 56px;
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.nr {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: var(--flaeche-2);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-2);
	}
	.text {
		font-size: 0.95rem;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	details[open] .text {
		display: block;
	}
	.verdeckt {
		color: var(--text-2);
		font-style: italic;
	}
	.symbole {
		display: flex;
		gap: 0.3rem;
	}
	.details {
		padding: 0 0.9rem 0.9rem 3.25rem;
		display: grid;
		gap: 0.4rem;
	}
	.details p {
		margin: 0;
	}
	.details img {
		max-width: 100%;
		border-radius: var(--radius-klein);
	}
	.quelle {
		font-size: 0.8rem;
		color: var(--text-2);
	}
	.legende {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
	}
	.unten {
		display: grid;
		gap: 0.6rem;
		margin-top: 1.5rem;
	}
	.bestaetigen {
		display: grid;
		gap: 0.8rem;
	}
	.bestaetigen p {
		margin: 0;
	}
	.aktionen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
</style>
