<script lang="ts">
	import { MELDUNG_GRUENDE, MELDUNG_GRUND_NAMEN, type MeldungGrund } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';

	let { frageId, gemeldet = false }: { frageId: number; gemeldet?: boolean } = $props();

	const js = hydriert();
	const id = $props.id();

	let offen = $state(false);
	// nach dem Absenden ohne Neuladen als gemeldet anzeigen
	let gesendet = $state(false);
	let grund = $state<MeldungGrund>('antwort_falsch');
	let kommentar = $state('');
	let laeuft = $state(false);
	let fehler = $state('');

	async function senden(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = '';
		try {
			await api().post(`/fragen/${frageId}/melden`, { grund, kommentar });
			gesendet = true;
			offen = false;
		} catch (e) {
			fehler = e instanceof ApiError ? (e.felder.kommentar?.[0] ?? e.message) : 'Meldung konnte nicht gesendet werden';
		} finally {
			laeuft = false;
		}
	}
</script>

{#if offen}
	<form class="melden" onsubmit={senden} aria-labelledby="{id}-titel">
		<p id="{id}-titel" class="titel">Was stimmt mit dieser Frage nicht?</p>
		<fieldset>
			<legend class="nur-screenreader">Grund</legend>
			{#each MELDUNG_GRUENDE as g (g)}
				<label class="grund"><input type="radio" name="{id}-grund" value={g} bind:group={grund} /> {MELDUNG_GRUND_NAMEN[g]}</label>
			{/each}
		</fieldset>
		<label class="kommentar">
			<span>Anmerkung <small>(optional, z. B. was richtig wäre und woher du das weißt)</small></span>
			<textarea bind:value={kommentar} rows="3" maxlength="500"></textarea>
		</label>
		{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
		<div class="aktionen">
			<button type="button" class="knopf klein zweitrangig" onclick={() => (offen = false)}>Abbrechen</button>
			<button class="knopf klein" disabled={laeuft}>{laeuft ? 'Wird gesendet …' : 'Melden'}</button>
		</div>
	</form>
{:else if gesendet || gemeldet}
	<p class="gemeldet" role={gesendet ? 'status' : undefined}>
		<span>{gesendet ? 'Danke! Wir schauen uns die Frage an.' : 'Du hast diese Frage gemeldet.'}</span>
		<button type="button" class="link" disabled={!js.bereit} onclick={() => (offen = true)}>Meldung ändern</button>
	</p>
{:else}
	<button type="button" class="melden-knopf" disabled={!js.bereit} onclick={() => (offen = true)}>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
		Frage melden
	</button>
{/if}

<style>
	.melden-knopf,
	.link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 44px;
		padding: 0 0.2rem;
		border: 0;
		background: none;
		color: var(--text-2);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.melden {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem;
		border: 2px dashed var(--kante);
		border-radius: var(--radius-klein);
	}
	.titel {
		margin: 0;
		font-weight: 800;
	}
	fieldset {
		display: grid;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.grund {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 40px;
		font-weight: 600;
	}
	.grund input {
		width: 1.2rem;
		height: 1.2rem;
		accent-color: var(--gruen);
	}
	.kommentar {
		display: grid;
		gap: 0.3rem;
		font-weight: 800;
		font-size: 0.9rem;
	}
	.kommentar small {
		font-weight: 600;
		color: var(--text-2);
	}
	textarea {
		font: inherit;
		font-weight: 400;
		padding: 0.5rem 0.6rem;
		border: 2px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
		color: var(--text);
		resize: vertical;
	}
	.aktionen {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.gemeldet {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 0.6rem;
		margin: 0;
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--richtig);
	}
</style>
