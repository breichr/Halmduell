<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import type { AnstupsenErgebnis } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import EinladungTeilen from '$lib/components/EinladungTeilen.svelte';
	import AbzeichenPlakette from '$lib/components/AbzeichenPlakette.svelte';
	import Ergebnissymbol from '$lib/components/Ergebnissymbol.svelte';
	import FrageMelden from '$lib/components/FrageMelden.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
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

	const pose = $derived(
		ergebnis?.art === 'sieg' ? 'jubeln'
		: ergebnis?.art === 'niederlage' ? 'traurig'
		: ergebnis ? 'denken'
		: duel.duBistDran ? 'winken'
		: 'schlafen'
	);
	const titel = $derived(
		ergebnis ? ergebnis.titel
		: duel.duBistDran ? 'Du bist dran!'
		: duel.gegner ? `${gegnerName} ist am Zug`
		: duel.zufall ? 'Gegner wird gesucht' : 'Warte auf einen Gegner'
	);

	// B spielt nach A: solange das Duell läuft, hat der Gegner nur dann schon gespielt,
	// wenn ich als B dran bin
	const gegnerHatNichtGespielt = $derived(laufend && !(duel.status === 'wartet_b' && duel.duBistDran));

	let fehler = $state('');
	let aufgebenOffen = $state(false);

	// Anstupsen: Gegner ist am Zug; nach dem Stupsen 12 Stunden Pause
	let angestupst = $state<AnstupsenErgebnis | null>(null);
	let stupstGerade = $state(false);
	const jetzt = Date.now();
	const stupsenGesperrt = $derived(
		angestupst !== null || (duel.anstupsenAb !== null && new Date(duel.anstupsenAb).getTime() > jetzt)
	);

	async function anstupsen() {
		fehler = '';
		stupstGerade = true;
		try {
			angestupst = await api().post<AnstupsenErgebnis>(`/duels/${duel.id}/anstupsen`);
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Anstupsen fehlgeschlagen';
		} finally {
			stupstGerade = false;
		}
	}

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

<div class="kopfzeile">
	<a href="/" class="zurueck-knopf" aria-label="Zurück zur Übersicht">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<span class="kategorie"><KategorieSymbol kategorie={duel.kategorie} groesse={22} /> {kategorieName(duel.kategorie)}{duel.gegner ? ` · gegen ${duel.gegner.username}` : ''}</span>
</div>

<header class="buehne {ergebnis?.art ?? (duel.duBistDran ? 'dran' : 'warten')}" data-testid={ergebnis ? 'ergebnis' : undefined}>
	<Halmi {pose} groesse={120} />
	<h1>{titel}</h1>
	{#if ergebnis}
		<p class="untertitel">
			{ergebnis.text}
			{#if duel.ratingAenderung !== null}<span class="rating">Rating {vorzeichen(duel.ratingAenderung)}</span>{/if}
		</p>
	{:else if laufend && duel.zugBis}
		<p class="untertitel">
			{duel.duBistDran ? 'Du bist dran' : duel.gegner ? `${gegnerName} ist dran` : duel.zufall ? 'Gegner wird gesucht' : 'Wartet auf einen Gegner'} · {restzeit(duel.zugBis)}
		</p>
	{/if}
</header>

<div class="spielstand" aria-label="Du {duel.meinePunkte}, {gegnerName} {duel.gegnerPunkte}">
	<div class="spieler">
		<span class="name">Du</span>
		<span class="zahl" data-testid="meine-punkte">{duel.meinePunkte}</span>
	</div>
	<span class="trenner" aria-hidden="true">:</span>
	<div class="spieler">
		<span class="name">{duel.gegner?.username ?? 'Offen'}</span>
		<span class="zahl gegner">{gegnerHatNichtGespielt ? '?' : duel.gegnerPunkte}</span>
	</div>
</div>

{#if duel.neueAbzeichen.length}
	<a class="karte neue-abzeichen" href="/profil#abzeichen" data-testid="neue-abzeichen">
		<span class="plaketten">
			{#each duel.neueAbzeichen as a (a.key)}<AbzeichenPlakette icon={a.icon} groesse={44} />{/each}
		</span>
		<span>
			<strong>{duel.neueAbzeichen.length === 1 ? 'Neues Abzeichen!' : `${duel.neueAbzeichen.length} neue Abzeichen!`}</strong>
			<span class="abzeichen-namen">{duel.neueAbzeichen.map((a) => a.titel).join(' · ')}</span>
		</span>
	</a>
{/if}

{#if duel.duBistDran}
	<a href="/duell/{duel.id}/spielen" class="knopf breit spielen" data-sveltekit-preload-data="off">{angefangen ? 'Weiterspielen' : 'Runde spielen'}</a>
{/if}

{#if duel.einladungsCode}
	<EinladungTeilen code={duel.einladungsCode} />
{/if}

<section>
	<h2 class="abschnitt-titel">Fragen</h2>
	<ol class="fragen">
		{#each duel.fragen as f (f.reihenfolge)}
			<li class="frage">
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
							<FrageMelden frageId={f.frage.id} gemeldet={f.frage.gemeldet} />
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
		<a class="knopf breit" href="/duell/neu?gegner={encodeURIComponent(duel.gegner.username)}&kategorie={duel.kategorie}">Revanche!</a>
	{/if}
	{#if duel.anstupsenAb !== null}
		<button type="button" class="knopf zweitrangig breit" disabled={stupsenGesperrt || stupstGerade} onclick={anstupsen}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
			{stupsenGesperrt ? 'Angestupst' : `${gegnerName} anstupsen`}
		</button>
		{#if angestupst}
			<p class="stups-info" role="status">
				{angestupst.zugestellt
					? `${gegnerName} bekommt eine Benachrichtigung.`
					: `${gegnerName} hat keine Benachrichtigungen an – vielleicht kurz per Nachricht erinnern?`}
			</p>
		{:else if stupsenGesperrt}
			<p class="stups-info">Wieder möglich in {restzeit(duel.anstupsenAb!).replace('noch ', '')}.</p>
		{/if}
	{/if}
	{#if laufend && !duel.duBistDran}
		<a class="knopf sonne breit" href="/duell/neu">Währenddessen: neues Duell</a>
	{/if}
	{#if laufend}
		{#if aufgebenOffen}
			<div class="karte bestaetigen" role="alertdialog" aria-labelledby="aufgeben-titel">
				<p id="aufgeben-titel"><strong>Wirklich aufgeben?</strong> {duel.gegner ? `${gegnerName} gewinnt dann das Duell.` : duel.zufall ? 'Die Suche nach einem Gegner wird beendet.' : 'Die Einladung wird zurückgezogen.'}</p>
				<div class="aktionen">
					<button class="knopf zweitrangig klein" onclick={() => (aufgebenOffen = false)}>Abbrechen</button>
					<button class="knopf gefahr klein" onclick={aufgeben}>Aufgeben</button>
				</div>
			</div>
		{:else}
			<button class="knopf gefahr breit" onclick={() => (aufgebenOffen = true)}>{duel.gegner ? 'Aufgeben' : duel.zufall ? 'Suche abbrechen' : 'Einladung zurückziehen'}</button>
		{/if}
	{/if}
	<button class="knopf zweitrangig breit" onclick={() => goto('/')}>Zur Übersicht</button>
</div>

<style>
	.kategorie {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 800;
		min-width: 0;
	}
	.buehne {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.2rem;
		padding: 0.8rem 1rem 1rem;
		border: 3px solid var(--kontur);
		border-radius: var(--radius);
		background: var(--himmel);
	}
	.buehne.sieg {
		background: var(--richtig-hell);
	}
	.buehne.niederlage {
		background: var(--falsch-hell);
	}
	.buehne.warten {
		background: var(--nacht);
	}
	.buehne.dran {
		background: var(--sonne-hell);
	}
	.buehne h1 {
		margin: 0.2rem 0 0;
		font-size: 2.2rem;
	}
	.untertitel {
		margin: 0;
		display: grid;
		gap: 0.2rem;
		font-weight: 800;
	}
	.rating {
		justify-self: center;
		padding: 0.15rem 0.7rem;
		border-radius: 999px;
		background: var(--sonne);
		color: #2a1c14;
		border: 2px solid var(--kontur);
	}
	.spielstand {
		display: flex;
		justify-content: space-around;
		align-items: center;
		margin: 0.9rem 0;
		padding: 0.6rem 1rem;
		background: var(--flaeche);
		border: 3px solid var(--kontur);
		border-bottom-width: 6px;
		border-radius: var(--radius);
	}
	.spieler {
		display: grid;
		justify-items: center;
		min-width: 5rem;
	}
	.spieler .name {
		font-weight: 800;
		max-width: 9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.zahl {
		font-family: var(--schrift-titel);
		font-size: 3.2rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.zahl.gegner {
		color: var(--text-2);
	}
	.trenner {
		font-family: var(--schrift-titel);
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-2);
	}
	.spielen {
		margin-bottom: 1rem;
		min-height: 60px;
		font-size: 1.35rem;
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.frage {
		background: var(--flaeche);
		border: 2px solid var(--kante);
		border-radius: 16px;
	}
	summary,
	.zeile {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0.8rem;
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
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		background: var(--flaeche-2);
		font-family: var(--schrift-titel);
		font-weight: 800;
		color: var(--text-2);
	}
	.text {
		font-size: 0.95rem;
		font-weight: 800;
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
		font-weight: 600;
		font-style: italic;
	}
	.symbole {
		display: flex;
		gap: 0.3rem;
	}
	.details {
		padding: 0 0.8rem 0.8rem 3.2rem;
		display: grid;
		gap: 0.4rem;
	}
	.details p {
		margin: 0;
	}
	.details img {
		max-width: 100%;
		border-radius: var(--radius-klein);
		border: 2px solid var(--kante);
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
		gap: 0.7rem;
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
	.neue-abzeichen {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-bottom: 1rem;
		background: var(--sonne);
		color: var(--auf-farbe);
		border-color: var(--kontur);
		text-decoration: none;
	}
	.neue-abzeichen > span:last-child {
		display: grid;
		min-width: 0;
	}
	.plaketten {
		display: flex;
		flex: none;
	}
	.plaketten :global(.plakette + .plakette) {
		margin-left: -14px;
	}
	.abzeichen-namen {
		font-size: 0.9rem;
		font-weight: 700;
	}
	.stups-info {
		margin: -0.3rem 0 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--text-2);
	}
</style>
