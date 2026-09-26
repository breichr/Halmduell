<script lang="ts">
	import { aktuelleSaison, saisonBezeichnung } from '@halmduell/shared';
	import DuellKarte from '$lib/components/DuellKarte.svelte';

	let { data } = $props();

	const dran = $derived(data.duelle.filter((d) => d.duBistDran));
	const wartend = $derived(data.duelle.filter((d) => !d.duBistDran && (d.status === 'wartet_a' || d.status === 'wartet_b')));
	const beendet = $derived(data.duelle.filter((d) => d.status === 'abgeschlossen' || d.status === 'abgebrochen'));
</script>

<svelte:head><title>Übersicht – Halmduell</title></svelte:head>

<div class="kopf">
	<div>
		<h1>Hallo {data.user.username}</h1>
		<p class="hinweis">Saison {saisonBezeichnung(aktuelleSaison())}</p>
	</div>
</div>

<a href="/duell/neu" class="knopf breit neu">＋ Neues Duell starten</a>

{#if data.duelle.length === 0}
	<div class="karte leer">
		<p><strong>Noch keine Duelle.</strong></p>
		<p class="hinweis">Fordere jemanden per Benutzername heraus oder schick einen Einladungslink.</p>
	</div>
{/if}

{#each [{ titel: 'Du bist dran', liste: dran }, { titel: 'Warten auf den Gegner', liste: wartend }, { titel: 'Beendet', liste: beendet }] as abschnitt (abschnitt.titel)}
	{#if abschnitt.liste.length}
		<section>
			<h2>{abschnitt.titel} <span class="anzahl">{abschnitt.liste.length}</span></h2>
			<ul>
				{#each abschnitt.liste as duel (duel.id)}
					<li><DuellKarte {duel} /></li>
				{/each}
			</ul>
		</section>
	{/if}
{/each}

<style>
	.kopf p {
		margin: -0.3rem 0 0;
	}
	.neu {
		margin: 1rem 0 1.5rem;
	}
	.leer p {
		margin: 0 0 0.3rem;
	}
	section {
		margin-bottom: 1.5rem;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-2);
		font-size: 0.95rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.anzahl {
		background: var(--flaeche-2);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-size: 0.8rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
</style>
