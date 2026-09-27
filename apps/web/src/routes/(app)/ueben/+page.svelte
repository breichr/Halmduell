<script lang="ts">
	import { UEBEN_ZIEL } from '@halmduell/shared';
	import Halmi from '$lib/components/Halmi.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { KATEGORIE_FARBE, kategorieName } from '$lib/format';

	let { data } = $props();
	const u = $derived(data.uebersicht);
	const fragen = (n: number) => (n === 1 ? '1 Frage' : `${n} Fragen`);
</script>

<svelte:head><title>Fehler üben – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/" class="zurueck-knopf" aria-label="Zurück zur Übersicht">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Fehler üben</h1>
</div>

{#if u.offen === 0}
	<div class="karte leer">
		<Halmi pose="jubeln" groesse={110} />
		<p>
			<strong>Keine offenen Fehler!</strong><br />
			<span class="hinweis">
				{u.gemeistert ? `${fragen(u.gemeistert)} schon gemeistert. ` : ''}Was du im Duell falsch beantwortest, landet hier zum Nachlernen.
			</span>
		</p>
		<a class="knopf klein" href="/duell/neu">Duell starten</a>
	</div>
{:else}
	<div class="halmi">
		<Halmi pose="lupe" groesse={84} halm={false} />
		<Sprechblase>{fragen(u.offen)} {u.offen === 1 ? 'wartet' : 'warten'} aufs Nachlernen.</Sprechblase>
	</div>

	<p class="hinweis erklaerung">
		Ohne Timer und ohne Wertung. Eine Frage ist gemeistert, wenn du sie {UEBEN_ZIEL}× hintereinander richtig beantwortest.
		{#if u.gemeistert}<strong>Schon gemeistert: {u.gemeistert}</strong>{/if}
	</p>

	<a class="knopf sonne breit" href="/ueben/spielen">Alle üben ({u.offen})</a>

	<h2 class="abschnitt-titel">Nach Kategorie</h2>
	<ul class="kategorien">
		{#each u.jeKategorie as k (k.kategorie)}
			<li>
				{#if k.offen}
					<a href="/ueben/spielen?kategorie={k.kategorie}" style="--farbe: {KATEGORIE_FARBE[k.kategorie]}">
						<KategorieSymbol kategorie={k.kategorie} groesse={26} />
						<span class="name">{kategorieName(k.kategorie)}</span>
						<span class="anzahl">{fragen(k.offen)}</span>
					</a>
				{:else}
					<span class="leer-kategorie" aria-label="{kategorieName(k.kategorie)}: nichts offen">
						<KategorieSymbol kategorie={k.kategorie} groesse={26} />
						<span class="name">{kategorieName(k.kategorie)}</span>
						<span class="anzahl">nichts offen</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.leer {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		text-align: center;
	}
	.leer p {
		margin: 0;
	}
	.halmi {
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
		margin: -0.3rem 0 0.6rem;
	}
	.halmi :global(.blase) {
		margin-bottom: 1.4rem;
	}
	.erklaerung {
		margin: 0 0 1rem;
	}
	.erklaerung strong {
		display: block;
		margin-top: 0.3rem;
		color: var(--gruen-dunkel);
	}
	h2 {
		margin-top: 1.4rem;
	}
	.kategorien {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.kategorien a,
	.leer-kategorie {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 60px;
		padding: 0 0.9rem;
		border: 3px solid var(--kontur);
		border-bottom-width: 5px;
		border-radius: 16px;
		font-weight: 800;
		text-decoration: none;
	}
	.kategorien a {
		background: var(--farbe);
		color: #2a1c14;
	}
	.leer-kategorie {
		background: var(--flaeche);
		color: var(--text-2);
		border-color: var(--linie-leise);
		border-bottom-width: 3px;
	}
	.name {
		flex: 1;
	}
	.anzahl {
		font-size: 0.9rem;
	}
</style>
