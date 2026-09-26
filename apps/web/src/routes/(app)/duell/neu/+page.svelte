<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { DUELL_KATEGORIEN, type DuellKategorie, type DuellUebersicht } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import { kategorieName } from '$lib/format';

	const js = hydriert();

	const vorgabeKategorie = page.url.searchParams.get('kategorie');
	const vorgabeGegner = page.url.searchParams.get('gegner') ?? '';

	let kategorie = $state<DuellKategorie>(
		(DUELL_KATEGORIEN as readonly string[]).includes(vorgabeKategorie ?? '') ? (vorgabeKategorie as DuellKategorie) : 'gemischt'
	);
	let art = $state<'name' | 'einladung'>(vorgabeGegner ? 'name' : 'einladung');
	let gegner = $state(vorgabeGegner);
	let fehler = $state('');
	let laeuft = $state(false);

	async function starten(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = '';
		try {
			const duel = await api().post<DuellUebersicht>('/duels', {
				kategorie,
				...(art === 'name' ? { gegner: gegner.trim() } : {})
			});
			await invalidate('app:duelle');
			await goto(`/duell/${duel.id}`, { replaceState: true });
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Duell konnte nicht erstellt werden';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head><title>Neues Duell – Halmduell</title></svelte:head>

<a href="/" class="zurueck">← Übersicht</a>
<h1>Neues Duell</h1>

<form method="post" class="formular" onsubmit={starten}>
	<fieldset>
		<legend>Kategorie</legend>
		<div class="kategorien">
			{#each DUELL_KATEGORIEN as k (k)}
				<label class="kategorie" class:gewaehlt={kategorie === k}>
					<input type="radio" name="kategorie" value={k} bind:group={kategorie} />
					<KategorieSymbol kategorie={k} />
					<span>{kategorieName(k)}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend>Gegner</legend>
		<div class="arten">
			<label class="art" class:gewaehlt={art === 'einladung'}>
				<input type="radio" name="art" value="einladung" bind:group={art} />
				<strong>Einladungslink</strong>
				<span class="hinweis">Link per WhatsApp & Co. teilen – wer ihn öffnet, spielt gegen dich.</span>
			</label>
			<label class="art" class:gewaehlt={art === 'name'}>
				<input type="radio" name="art" value="name" bind:group={art} />
				<strong>Benutzername</strong>
				<span class="hinweis">Jemanden herausfordern, der schon ein Konto hat.</span>
			</label>
		</div>
		{#if art === 'name'}
			<div class="name">
				<Feld label="Benutzername des Gegners" bind:wert={gegner} autocapitalize="none" autocomplete="off" required />
			</div>
		{/if}
	</fieldset>

	{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
	<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird erstellt …' : 'Duell starten'}</button>
</form>

<style>
	.zurueck {
		display: inline-block;
		margin-bottom: 0.5rem;
		text-decoration: none;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		font-weight: 650;
		margin-bottom: 0.6rem;
	}
	.kategorien {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: 0.6rem;
	}
	.kategorie,
	.art {
		position: relative;
		background: var(--flaeche);
		border: 2px solid var(--linie);
		border-radius: var(--radius);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.kategorie {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 0.9rem 0.4rem;
		color: var(--text-2);
		font-weight: 600;
		font-size: 0.95rem;
	}
	.gewaehlt {
		border-color: var(--gruen);
		background: var(--gruen-hell);
		color: var(--text);
	}
	.kategorie.gewaehlt {
		color: var(--gruen);
	}
	/* Radio unsichtbar, aber per Tastatur bedienbar */
	input[type='radio'] {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	label:has(input:focus-visible) {
		outline: 3px solid var(--fokus);
		outline-offset: 2px;
	}
	.arten {
		display: grid;
		gap: 0.6rem;
	}
	.art {
		display: grid;
		gap: 0.15rem;
		padding: 0.8rem 1rem;
	}
	.name {
		margin-top: 0.8rem;
	}
</style>
