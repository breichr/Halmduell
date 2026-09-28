<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { FRAGEN_KATEGORIEN, type EigeneFrage, type FragenKategorie } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import FrageAnsicht from '$lib/components/FrageAnsicht.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { kategorieName } from '$lib/format';

	const js = hydriert();

	let kategorie = $state<FragenKategorie>('pflanzenbau');
	let text = $state('');
	let richtig = $state('');
	let falsch = $state<[string, string, string]>(['', '', '']);
	let erklaerung = $state('');

	let fehler = $state<Record<string, string[]>>({});
	let meldung = $state('');
	let laeuft = $state(false);

	// Vorschau wie im Spiel, die richtige Antwort markiert
	const vorschau = $derived({
		frageText: text || 'Deine Frage …',
		bildUrl: null,
		bildQuelle: null,
		antworten: [richtig, ...falsch].map((t, i) => ({ id: i + 1, text: t || '…' }))
	});

	async function absenden(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = {};
		meldung = '';
		try {
			await api().post<EigeneFrage>('/fragen', { kategorie, frage: text, richtig, falsch, erklaerung });
			await invalidate('app:eigene-fragen');
			await goto('/fragen/eigene?eingereicht=1');
		} catch (e) {
			if (e instanceof ApiError) {
				fehler = e.felder;
				meldung = e.message;
			} else {
				meldung = 'Einreichen fehlgeschlagen';
			}
		} finally {
			laeuft = false;
		}
	}

	const f = (name: string) => fehler[name]?.join(' · ');
</script>

<svelte:head><title>Frage einreichen – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/fragen/eigene" class="zurueck-knopf" aria-label="Zurück zu meinen Fragen">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Frage einreichen</h1>
</div>

<div class="halmi">
	<Halmi pose="denken" groesse={76} halm={false} />
	<Sprechblase>Was weißt du, was andere nicht wissen?</Sprechblase>
</div>

<p class="hinweis regeln">
	Eine Frage, eine richtige und drei falsche Antworten. Die falschen sollten plausibel klingen, die richtige eindeutig stimmen.
	Wir prüfen jede Frage, bevor sie ins Spiel kommt – du bekommst Bescheid.
</p>

<form class="formular" onsubmit={absenden}>
	{#if meldung}<p class="fehlermeldung" role="alert">{meldung}</p>{/if}

	<label>
		<span>Kategorie</span>
		<select bind:value={kategorie}>
			{#each FRAGEN_KATEGORIEN as k (k)}<option value={k}>{kategorieName(k)}</option>{/each}
		</select>
	</label>

	<label>
		<span>Frage</span>
		<textarea bind:value={text} rows="3" required maxlength="500" aria-invalid={!!f('frage') || undefined}></textarea>
		{#if f('frage')}<small class="fehler">{f('frage')}</small>{/if}
	</label>

	<label>
		<span>Richtige Antwort</span>
		<input class="richtig" bind:value={richtig} required maxlength="100" aria-invalid={!!f('richtig') || undefined} />
		{#if f('richtig')}<small class="fehler">{f('richtig')}</small>{/if}
	</label>
	<fieldset>
		<legend>Falsche Antworten</legend>
		{#each [0, 1, 2] as i (i)}
			<input bind:value={falsch[i]} required maxlength="100" aria-label="Falsche Antwort {i + 1}" aria-invalid={!!f('falsch') || undefined} />
		{/each}
		{#if f('falsch')}<small class="fehler">{f('falsch')}</small>{/if}
	</fieldset>

	<label>
		<span>Erklärung <small>(optional – warum stimmt die Antwort? Gern mit Quelle)</small></span>
		<textarea bind:value={erklaerung} rows="3" maxlength="1000"></textarea>
		{#if f('erklaerung')}<small class="fehler">{f('erklaerung')}</small>{/if}
	</label>

	<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird eingereicht …' : 'Frage einreichen'}</button>
</form>

<section class="vorschau" aria-label="Vorschau">
	<h2 class="abschnitt-titel">So sieht sie im Spiel aus</h2>
	<div class="spiel">
		<FrageAnsicht frage={vorschau} zustandVon={(id) => (id === 1 ? 'richtig' : 'aus')} deaktiviert={true} onantwort={() => {}} />
	</div>
	<p class="hinweis">Im Spiel werden die Antworten gemischt.</p>
</section>

<style>
	.halmi {
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
		margin: -0.5rem 0 0.4rem;
	}
	.halmi :global(.blase) {
		margin-bottom: 1.4rem;
	}
	.regeln {
		margin: 0 0 1rem;
	}
	label,
	fieldset {
		display: grid;
		gap: 0.3rem;
		font-weight: 800;
		font-size: 0.95rem;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 0.3rem;
	}
	label small {
		font-weight: 600;
		color: var(--text-2);
	}
	input,
	select,
	textarea {
		font: inherit;
		font-weight: 600;
		min-height: 46px;
		padding: 0.45em 0.7em;
		border: 2px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--grund);
		color: var(--text);
	}
	textarea {
		resize: vertical;
	}
	input.richtig {
		border-color: var(--richtig);
		background: var(--richtig-hell);
	}
	[aria-invalid] {
		border-color: var(--falsch) !important;
	}
	.fehler {
		color: var(--falsch);
		font-weight: 800;
	}
	.vorschau {
		margin-top: 1.6rem;
	}
	.spiel {
		display: grid;
		gap: 1rem;
		pointer-events: none;
	}
</style>
