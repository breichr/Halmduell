<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import type { AdminFrage, FrageBearbeiten } from '@halmduell/shared';
	import { api } from '$lib/api';
	import FrageFormular from '$lib/components/admin/FrageFormular.svelte';

	let { data } = $props();
	const f = $derived(data.frage);
	const quote = $derived(f.statistik.beantwortet ? Math.round((f.statistik.richtig / f.statistik.beantwortet) * 100) : null);

	async function speichern(daten: FrageBearbeiten) {
		await api().put<AdminFrage>(`/admin/fragen/${f.id}`, daten);
		await invalidate('app:admin');
		history.length > 1 ? history.back() : await goto('/admin');
	}
</script>

<svelte:head><title>{f.code ?? 'Frage'} bearbeiten – Admin – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/admin" class="zurueck-knopf" aria-label="Zurück zur Liste">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>{f.code ?? `Frage ${f.id}`}</h1>
</div>

<p class="hinweis">
	{f.statistik.beantwortet ? `${f.statistik.beantwortet}× in Duellen beantwortet, ${quote} % richtig.` : 'Noch in keinem Duell gestellt.'}
	{#if f.statistik.beantwortet}Bei inhaltlich anderer Frage besser eine neue anlegen und diese ablehnen – sonst passen alte Duelle nicht mehr.{/if}
</p>

{#key f.id}
	<FrageFormular frage={f} {speichern} />
{/key}
