<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { DuellUebersicht } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import { kategorieName } from '$lib/format';

	let { data } = $props();

	let fehler = $state('');
	let laeuft = $state(false);
	const eigene = $derived(data.einladung?.von.id === data.user.id);

	async function annehmen() {
		laeuft = true;
		fehler = '';
		try {
			const duel = await api().post<DuellUebersicht>('/duels/beitreten', { code: page.params.code });
			await invalidate('app:duelle');
			await goto(`/duell/${duel.id}`, { replaceState: true });
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Einladung konnte nicht angenommen werden';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head><title>Einladung – Halmduell</title></svelte:head>

<div class="einladung">
	{#if data.einladung}
		{@const e = data.einladung}
		<div class="karte">
			<p class="ueber">Einladung zum Duell</p>
			<h1><span class="name">{e.von.username}</span> fordert dich heraus!</h1>
			<p class="kategorie"><KategorieSymbol kategorie={e.kategorie} groesse={22} /> {kategorieName(e.kategorie)}</p>
			<p class="hinweis">6 Fragen, je 15 Sekunden. Ihr beantwortet dieselben Fragen – wer mehr richtig hat, gewinnt.</p>
			{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
			{#if eigene}
				<p class="hinweis"><strong>Das ist deine eigene Einladung.</strong> Schick den Link an jemand anderen.</p>
				<a class="knopf zweitrangig breit" href="/duell/{e.duelId}">Zum Duell</a>
			{:else}
				<button class="knopf breit" onclick={annehmen} disabled={laeuft}>{laeuft ? 'Wird angenommen …' : 'Herausforderung annehmen'}</button>
			{/if}
		</div>
	{:else}
		<div class="karte">
			<h1>Einladung nicht verfügbar</h1>
			<p class="hinweis">{data.fehler} Vielleicht hat schon jemand anderes angenommen oder sie ist abgelaufen.</p>
			<a class="knopf breit" href="/duell/neu">Selbst ein Duell starten</a>
		</div>
	{/if}
</div>

<style>
	.einladung {
		max-width: 26rem;
		margin: 1.5rem auto 0;
		text-align: center;
	}
	.karte {
		display: grid;
		gap: 0.8rem;
		padding: 1.5rem 1.25rem;
	}
	.karte p,
	h1 {
		margin: 0;
	}
	.ueber {
		color: var(--text-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.name {
		color: var(--gruen);
	}
	.kategorie {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
	}
</style>
