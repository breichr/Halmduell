<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { DUELL_KATEGORIEN, type DuellKategorie, type DuellUebersicht } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { KATEGORIE_FARBE, kategorieName } from '$lib/format';

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

<div class="kopfzeile">
	<a href="/" class="zurueck-knopf" aria-label="Zurück zur Übersicht">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Neues Duell</h1>
</div>

<div class="halmi">
	<Halmi pose="denken" groesse={80} halm={false} />
	<Sprechblase>Worauf hast du heute Lust?</Sprechblase>
</div>

<form method="post" class="formular" onsubmit={starten}>
	<fieldset>
		<legend class="nur-screenreader">Kategorie</legend>
		<div class="kategorien">
			{#each DUELL_KATEGORIEN as k (k)}
				<label class="kategorie" class:gewaehlt={kategorie === k} class:breit={k === 'gemischt'} style="--farbe: {KATEGORIE_FARBE[k]}">
					<input type="radio" name="kategorie" value={k} bind:group={kategorie} />
					<KategorieSymbol kategorie={k} groesse={30} />
					<span class="name">{k === 'gemischt' ? 'Gemischt – von allem etwas' : kategorieName(k)}</span>
					{#if kategorie === k}
						<span class="haken" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10" /></svg></span>
					{/if}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend class="frage">Gegen wen?</legend>
		<div class="arten">
			<label class="art" class:gewaehlt={art === 'einladung'}>
				<input type="radio" name="art" value="einladung" bind:group={art} />
				<span class="art-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg></span>
				<span class="art-text"><strong>Einladungslink</strong><span>Per WhatsApp & Co. teilen – wer ihn öffnet, spielt gegen dich.</span></span>
			</label>
			<label class="art" class:gewaehlt={art === 'name'}>
				<input type="radio" name="art" value="name" bind:group={art} />
				<span class="art-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg></span>
				<span class="art-text"><strong>Benutzername</strong><span>Jemanden herausfordern, der schon ein Konto hat.</span></span>
			</label>
		</div>
		{#if art === 'name'}
			<div class="name-feld">
				<Feld label="Benutzername des Gegners" bind:wert={gegner} autocapitalize="none" autocomplete="off" required />
			</div>
		{/if}
	</fieldset>

	{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
	<button class="knopf breit" disabled={!js.bereit || laeuft}>
		{laeuft ? 'Wird erstellt …' : art === 'einladung' ? 'Link erstellen & losspielen' : 'Herausfordern'}
	</button>
</form>

<style>
	.halmi {
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
		margin: -0.5rem 0 0.9rem;
	}
	.halmi :global(.blase) {
		margin-bottom: 1.4rem;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.frage {
		font-family: var(--schrift-titel);
		font-size: 1.35rem;
		font-weight: 800;
		margin-bottom: 0.5rem;
		padding: 0;
	}
	.kategorien {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.kategorie,
	.art {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		border: 3px solid var(--kontur);
		border-bottom-width: 6px;
		border-radius: 18px;
		cursor: pointer;
	}
	.kategorie {
		min-height: 74px;
		padding: 0 0.8rem;
		background: var(--farbe);
		color: #2a1c14;
		font-weight: 800;
		font-size: 1.05rem;
	}
	.kategorie.breit {
		grid-column: 1 / -1;
		min-height: 62px;
	}
	/* drei Fach-Kategorien nebeneinander: Symbol über dem Namen */
	.kategorie:not(.breit) {
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		min-height: 92px;
		padding: 0.5rem 0.3rem;
		font-size: 0.92rem;
		text-align: center;
	}
	.kategorie:not(.breit) .name {
		flex: none;
		overflow-wrap: anywhere;
	}
	.kategorie:not(.breit) .haken {
		position: absolute;
		top: -10px;
		right: -8px;
	}
	.kategorie .name {
		flex: 1;
	}
	.kategorie.gewaehlt {
		outline: 4px solid var(--gruen);
		outline-offset: 2px;
	}
	.haken {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #2f7d3b;
		color: #ffffff;
		border: 2px solid #2a1c14;
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
		outline-offset: 3px;
	}
	.arten {
		display: grid;
		gap: 0.6rem;
	}
	.art {
		padding: 0.75rem 0.9rem;
		background: var(--flaeche);
		color: var(--text);
		border-bottom-width: 3px;
	}
	.art.gewaehlt {
		background: var(--gruen-hell);
		border-bottom-width: 6px;
		outline: 4px solid var(--gruen);
		outline-offset: 2px;
	}
	.art-symbol {
		flex: none;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--sonne);
		color: #2a1c14;
		border: 2px solid var(--kontur);
	}
	.art-text {
		display: grid;
		gap: 0.1rem;
	}
	.art-text span {
		font-size: 0.9rem;
		color: var(--text-2);
	}
	.name-feld {
		margin-top: 0.8rem;
	}
</style>
