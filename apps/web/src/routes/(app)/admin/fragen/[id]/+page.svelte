<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { MELDUNG_GRUND_NAMEN, type AdminFrage, type FrageBearbeiten, type MeldungenAbgeschlossen } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import FrageFormular from '$lib/components/admin/FrageFormular.svelte';
	import { wann } from '$lib/format';

	const js = hydriert();

	let { data } = $props();
	const f = $derived(data.frage);
	const quote = $derived(f.statistik.beantwortet ? Math.round((f.statistik.richtig / f.statistik.beantwortet) * 100) : null);

	async function speichern(daten: FrageBearbeiten) {
		await api().put<AdminFrage>(`/admin/fragen/${f.id}`, daten);
		await invalidate('app:admin');
		history.length > 1 ? history.back() : await goto('/admin');
	}

	let schliesst = $state(false);
	let meldungFehler = $state('');
	let antwort = $state('');
	let abgeschlossen = $state('');

	async function meldungenAbschliessen(status: 'erledigt' | 'verworfen') {
		schliesst = true;
		meldungFehler = '';
		try {
			const r = await api().post<MeldungenAbgeschlossen>(`/admin/fragen/${f.id}/meldungen`, { status, antwort });
			const was = `${r.abgeschlossen === 1 ? '1 Meldung' : `${r.abgeschlossen} Meldungen`} ${status === 'erledigt' ? 'erledigt' : 'verworfen'}`;
			abgeschlossen = `${was} – ${r.benachrichtigt === 1 ? '1 Spieler' : `${r.benachrichtigt} Spieler`} per Push benachrichtigt.`;
			antwort = '';
			await Promise.all([invalidate('app:admin-frage'), invalidate('app:admin')]);
		} catch (e) {
			meldungFehler = e instanceof ApiError ? e.message : 'Das hat nicht geklappt';
		} finally {
			schliesst = false;
		}
	}
</script>

<svelte:head><title>{f.code ?? 'Frage'} bearbeiten – Admin – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/admin" class="zurueck-knopf" aria-label="Zurück zur Liste">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>{f.code ?? `Frage ${f.id}`}</h1>
</div>

{#if f.eingereichtVon}<p class="hinweis">Eingereicht von <strong>{f.eingereichtVon}</strong>. Beim Freigeben oder Ablehnen bekommt {f.eingereichtVon} eine Nachricht.</p>{/if}

<p class="hinweis">
	{f.statistik.beantwortet ? `${f.statistik.beantwortet}× in Duellen beantwortet, ${quote} % richtig.` : 'Noch in keinem Duell gestellt.'}
	{#if f.statistik.beantwortet}Bei inhaltlich anderer Frage besser eine neue anlegen und diese ablehnen – sonst passen alte Duelle nicht mehr.{/if}
</p>

{#if data.meldungen.length}
	<section id="meldungen" class="karte meldungen" aria-labelledby="meldungen-titel">
		<h2 id="meldungen-titel">⚑ {data.meldungen.length === 1 ? '1 offene Meldung' : `${data.meldungen.length} offene Meldungen`}</h2>
		<ul>
			{#each data.meldungen as m (m.id)}
				<li data-testid="meldung">
					<strong>{MELDUNG_GRUND_NAMEN[m.grund]}</strong>
					{#if m.kommentar}<q>{m.kommentar}</q>{/if}
					<span class="wer">{m.username} · {wann(m.erstelltAt)} · hat {m.seineAntwort ? `„${m.seineAntwort}“ geantwortet` : 'nicht rechtzeitig geantwortet'}</span>
				</li>
			{/each}
		</ul>
		{#if meldungFehler}<p class="fehlermeldung" role="alert">{meldungFehler}</p>{/if}
		<p class="hinweis">Frage unten korrigieren (oder ablehnen), dann als erledigt markieren. Unbegründete Meldungen verwerfen. Die Melder bekommen eine Push-Nachricht.</p>
		<label class="antwort">
			<span>Antwort an die Melder <small>(optional, steht in der Nachricht)</small></span>
			<textarea bind:value={antwort} rows="2" maxlength="300" placeholder="z. B. Laut Sortenliste stimmt die Antwort."></textarea>
		</label>
		<div class="aktionen">
			<button class="knopf klein" disabled={!js.bereit || schliesst} onclick={() => meldungenAbschliessen('erledigt')}>Erledigt</button>
			<button class="knopf klein zweitrangig" disabled={!js.bereit || schliesst} onclick={() => meldungenAbschliessen('verworfen')}>Verwerfen</button>
		</div>
	</section>
{/if}

{#if abgeschlossen}<p class="erfolg abgeschlossen" role="status">{abgeschlossen}</p>{/if}

{#key f.id}
	<FrageFormular frage={f} {speichern} />
{/key}

<style>
	.meldungen {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1rem;
		border-color: var(--falsch);
		background: var(--falsch-hell);
	}
	.meldungen h2 {
		margin: 0;
		font-size: 1.15rem;
		color: var(--falsch);
	}
	.meldungen ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.meldungen li {
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius-klein);
		background: var(--flaeche);
	}
	.meldungen q {
		font-style: italic;
	}
	.wer {
		font-size: 0.82rem;
		color: var(--text-2);
	}
	.meldungen .hinweis {
		margin: 0;
	}
	.antwort {
		display: grid;
		gap: 0.3rem;
		font-weight: 800;
		font-size: 0.9rem;
	}
	.antwort small {
		font-weight: 600;
		color: var(--text-2);
	}
	.antwort textarea {
		font: inherit;
		font-weight: 400;
		padding: 0.5rem 0.6rem;
		border: 2px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
		color: var(--text);
		resize: vertical;
	}
	.abgeschlossen {
		margin-bottom: 1rem;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
