<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import type { AdminFrage, FrageBearbeiten } from '@halmduell/shared';
	import { api } from '$lib/api';
	import FrageFormular from '$lib/components/admin/FrageFormular.svelte';

	async function speichern(daten: FrageBearbeiten) {
		const neu = await api().post<AdminFrage>('/admin/fragen', daten);
		await invalidate('app:admin');
		await goto(`/admin?status=${neu.status}&suche=${encodeURIComponent(neu.code ?? '')}`, { replaceState: true });
	}
</script>

<svelte:head><title>Neue Frage – Admin – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/admin" class="zurueck-knopf" aria-label="Zurück zur Liste">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Neue Frage</h1>
</div>

<FrageFormular {speichern} />
