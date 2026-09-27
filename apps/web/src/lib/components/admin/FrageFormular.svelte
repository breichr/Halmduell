<script lang="ts">
	import { untrack } from 'svelte';
	import {
		FRAGE_STATUS,
		FRAGEN_KATEGORIEN,
		type AdminFrage,
		type FrageBearbeiten,
		type FragenKategorie,
		type FrageStatus,
		type FrageTyp
	} from '@halmduell/shared';
	import type { CommonsBild } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import { kategorieName } from '$lib/format';
	import FrageAnsicht from '$lib/components/FrageAnsicht.svelte';
	import { STATUS_NAMEN } from './status';

	/** Formular für neue und bestehende Fragen; `speichern` schickt es an die API */
	let {
		frage = null,
		speichern
	}: { frage?: AdminFrage | null; speichern: (daten: FrageBearbeiten) => Promise<void> } = $props();

	const js = hydriert();

	// Startwerte einmalig aus der geladenen Frage übernehmen (die Seite setzt das Formular per {#key} neu auf)
	const start = untrack(() => frage);
	let kategorie = $state<FragenKategorie>(start?.kategorie ?? 'pflanzenbau');
	let typ = $state<FrageTyp>(start?.typ ?? 'text');
	let text = $state(start?.frage ?? '');
	let richtig = $state(start?.richtig ?? '');
	let falsch = $state<[string, string, string]>(start ? [...start.falsch] : ['', '', '']);
	let erklaerung = $state(start?.erklaerung ?? '');
	let schwierigkeit = $state(start?.schwierigkeit ?? 1);
	let bildUrl = $state(start?.bildUrl ?? '');
	let bildQuelle = $state(start?.bildQuelle ?? '');
	let status = $state<FrageStatus>(start?.status ?? 'entwurf');

	let fehler = $state<Record<string, string[]>>({});
	let meldung = $state('');
	let laeuft = $state(false);

	// Vorschau wie im Spiel, die richtige Antwort markiert
	const vorschau = $derived({
		frageText: text || 'Fragetext …',
		bildUrl: bildUrl || null,
		bildQuelle: bildQuelle || null,
		antworten: [richtig, ...falsch].map((t, i) => ({ id: i + 1, text: t || '…' }))
	});

	async function absenden(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = {};
		meldung = '';
		try {
			await speichern({ kategorie, typ, frage: text, richtig, falsch, erklaerung, schwierigkeit, bildUrl, bildQuelle, status });
		} catch (e) {
			if (e instanceof ApiError) {
				fehler = e.felder;
				meldung = e.message;
			} else {
				meldung = 'Speichern fehlgeschlagen';
			}
		} finally {
			laeuft = false;
		}
	}

	const f = (name: string) => fehler[name]?.join(' · ');

	// Commons-Link → Bild-URL, Urheber und Lizenz
	let commonsLink = $state('');
	let commonsLaeuft = $state(false);
	let commonsMeldung = $state('');
	let commonsSeite = $state('');

	async function vonCommons() {
		commonsLaeuft = true;
		commonsMeldung = '';
		try {
			const bild = await api().post<CommonsBild>('/admin/commons', { link: commonsLink });
			bildUrl = bild.bildUrl;
			bildQuelle = bild.bildQuelle;
			commonsSeite = bild.seite;
			typ = 'bild';
			commonsLink = '';
		} catch (e) {
			commonsMeldung = e instanceof ApiError ? e.message : 'Übernehmen fehlgeschlagen';
		} finally {
			commonsLaeuft = false;
		}
	}
</script>

<form class="formular" onsubmit={absenden}>
	{#if meldung}<p class="fehlermeldung" role="alert">{meldung}</p>{/if}

	<div class="reihe">
		<label>
			<span>Kategorie</span>
			<select bind:value={kategorie}>
				{#each FRAGEN_KATEGORIEN as k (k)}<option value={k}>{kategorieName(k)}</option>{/each}
			</select>
		</label>
		<label>
			<span>Status</span>
			<select bind:value={status}>
				{#each FRAGE_STATUS as s (s)}<option value={s}>{STATUS_NAMEN[s]}</option>{/each}
			</select>
		</label>
		<label>
			<span>Schwierigkeit</span>
			<select bind:value={schwierigkeit}>
				{#each [1, 2, 3, 4, 5] as n (n)}<option value={n}>{n}</option>{/each}
			</select>
		</label>
	</div>

	<label>
		<span>Frage</span>
		<textarea bind:value={text} rows="3" required maxlength="1000" aria-invalid={!!f('frage') || undefined}></textarea>
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
		<span>Erklärung <small>(wird nach dem Antworten gezeigt)</small></span>
		<textarea bind:value={erklaerung} rows="3" maxlength="2000"></textarea>
	</label>

	<label class="haken">
		<input type="checkbox" checked={typ === 'bild'} onchange={(e) => (typ = e.currentTarget.checked ? 'bild' : 'text')} />
		Bildfrage
	</label>
	{#if typ === 'bild' || bildUrl}
		<div class="commons">
			<label>
				<span>Von Wikimedia Commons übernehmen <small>(Link zur Datei einfügen)</small></span>
				<span class="commons-zeile">
					<input
						type="url"
						bind:value={commonsLink}
						placeholder="https://commons.wikimedia.org/wiki/File:…"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								if (commonsLink.trim()) void vonCommons();
							}
						}}
					/>
					<button type="button" class="knopf klein zweitrangig" disabled={!js.bereit || commonsLaeuft || !commonsLink.trim()} onclick={vonCommons}>
						{commonsLaeuft ? 'Lädt …' : 'Übernehmen'}
					</button>
				</span>
			</label>
			{#if commonsMeldung}<small class="fehler" role="alert">{commonsMeldung}</small>{/if}
			{#if commonsSeite}
				<small class="gefunden" role="status">Übernommen – Lizenz prüfen: <a href={commonsSeite} target="_blank" rel="noopener noreferrer">Dateiseite auf Commons</a></small>
			{/if}
		</div>
		<label>
			<span>Bild-URL <small>(https, z. B. Wikimedia Commons)</small></span>
			<input type="url" bind:value={bildUrl} aria-invalid={!!f('bildUrl') || undefined} />
			{#if f('bildUrl')}<small class="fehler">{f('bildUrl')}</small>{/if}
		</label>
		<label>
			<span>Bildquelle <small>(Urheber + Lizenz)</small></span>
			<input bind:value={bildQuelle} maxlength="500" aria-invalid={!!f('bildQuelle') || undefined} />
			{#if f('bildQuelle')}<small class="fehler">{f('bildQuelle')}</small>{/if}
		</label>
	{/if}

	<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird gespeichert …' : frage ? 'Speichern' : 'Frage anlegen'}</button>
</form>

<section class="vorschau" aria-label="Vorschau">
	<h2 class="abschnitt-titel">Vorschau</h2>
	<div class="spiel">
		<FrageAnsicht frage={vorschau} zustandVon={(id) => (id === 1 ? 'richtig' : 'aus')} deaktiviert={true} onantwort={() => {}} />
	</div>
	{#if erklaerung}<p class="hinweis">{erklaerung}</p>{/if}
</section>

<style>
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
	.reihe {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 0.6rem;
	}
	input:not([type='checkbox']),
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
	.haken {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.haken input {
		width: 20px;
		height: 20px;
	}
	.commons {
		display: grid;
		gap: 0.3rem;
		padding: 0.7rem;
		border: 2px dashed var(--linie-leise);
		border-radius: var(--radius-klein);
	}
	.commons-zeile {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.4rem;
	}
	.gefunden {
		color: var(--richtig);
		font-weight: 800;
	}
	.gefunden a {
		color: inherit;
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
