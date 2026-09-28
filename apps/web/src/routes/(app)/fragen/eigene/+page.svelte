<script lang="ts">
	import { invalidate } from '$app/navigation';
	import type { EigeneFrage, FrageStatus } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { KATEGORIE_FARBE, kategorieName, wann } from '$lib/format';

	const js = hydriert();

	let { data } = $props();

	// Status aus Sicht des Einreichers
	const STATUS: Record<FrageStatus, string> = {
		eingereicht: 'Wird geprüft',
		entwurf: 'Wird überarbeitet',
		freigegeben: 'Im Spiel',
		abgelehnt: 'Nicht übernommen'
	};

	let fehler = $state('');
	let beschaeftigt = $state<number | null>(null);

	async function zurueckziehen(f: EigeneFrage) {
		if (!confirm('Diese Frage zurückziehen?')) return;
		beschaeftigt = f.id;
		fehler = '';
		try {
			await api().delete(`/fragen/eigene/${f.id}`);
			await invalidate('app:eigene-fragen');
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Das hat nicht geklappt';
		} finally {
			beschaeftigt = null;
		}
	}

	const imSpiel = $derived(data.fragen.filter((f) => f.status === 'freigegeben').length);
</script>

<svelte:head><title>Meine Fragen – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/profil" class="zurueck-knopf" aria-label="Zurück zum Profil">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Meine Fragen</h1>
</div>

{#if data.geradeEingereicht}
	<p class="erfolg" role="status">Danke! Deine Frage wird geprüft – du bekommst Bescheid, sobald sie im Spiel ist.</p>
{/if}

<a class="knopf breit neu" href="/fragen/einreichen">＋ Frage einreichen</a>

{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}

{#if data.fragen.length === 0}
	<div class="karte leer">
		<div class="halmi">
			<Halmi pose="lupe" groesse={84} />
			<Sprechblase>Du kennst dich aus? Dann stell die Fragen!</Sprechblase>
		</div>
		<p class="hinweis">Reich eigene Fragen ein. Nach einer kurzen Prüfung werden sie in Duellen gestellt.</p>
	</div>
{:else}
	<p class="anzahl">{data.fragen.length === 1 ? '1 Frage' : `${data.fragen.length} Fragen`} eingereicht{imSpiel ? ` · ${imSpiel} im Spiel` : ''}</p>
	<ul class="fragen">
		{#each data.fragen as f (f.id)}
			<li class="karte" data-testid="eigene-frage">
				<div class="kopf">
					<span class="kat" style="--farbe: {KATEGORIE_FARBE[f.kategorie]}">{kategorieName(f.kategorie)}</span>
					<span class="status {f.status}">{STATUS[f.status]}</span>
					<span class="datum">{wann(f.eingereichtAt)}</span>
				</div>
				<p class="frage">{f.frage}</p>
				<p class="antwort"><span aria-hidden="true">✓</span> {f.richtig}</p>
				{#if f.rueckmeldung}<p class="rueckmeldung"><strong>Rückmeldung:</strong> {f.rueckmeldung}</p>{/if}
				{#if f.status === 'eingereicht'}
					<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === f.id} onclick={() => zurueckziehen(f)}>Zurückziehen</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.neu {
		margin: 0.4rem 0 1rem;
	}
	.erfolg {
		margin-bottom: 0.8rem;
	}
	.leer {
		display: grid;
		gap: 0.6rem;
	}
	.leer p {
		margin: 0;
	}
	.halmi {
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
	}
	.halmi :global(.blase) {
		margin-bottom: 1.4rem;
	}
	.anzahl {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--text-2);
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
	}
	.fragen > li {
		display: grid;
		gap: 0.4rem;
		justify-items: start;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 800;
	}
	.kat,
	.status {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		border: 1.5px solid var(--kontur);
	}
	.kat {
		background: var(--farbe);
		color: #2a1c14;
	}
	/* gestrichelt: wartet noch (nicht mit gelben Kategorien verwechseln) */
	.status.eingereicht,
	.status.entwurf {
		background: var(--flaeche);
		color: var(--text-2);
		border-style: dashed;
	}
	.status.freigegeben {
		background: var(--richtig-hell);
		color: var(--richtig);
		border-color: currentColor;
	}
	.status.abgelehnt {
		background: var(--falsch-hell);
		color: var(--falsch);
		border-color: currentColor;
	}
	.datum {
		color: var(--text-2);
	}
	.frage {
		margin: 0;
		font-weight: 800;
		font-size: 1.05rem;
	}
	.antwort {
		margin: 0;
		color: var(--richtig);
		font-weight: 800;
		font-size: 0.9rem;
	}
	.rueckmeldung {
		margin: 0;
		font-size: 0.9rem;
		border-left: 3px solid var(--linie-leise);
		padding-left: 0.6rem;
	}
</style>
