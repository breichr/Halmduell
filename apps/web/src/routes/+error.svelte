<script lang="ts">
	import { page } from '$app/state';
	import Halmi from '$lib/components/Halmi.svelte';
</script>

<svelte:head><title>{page.status} – Halmduell</title></svelte:head>

<div class="karte fehler">
	<Halmi pose="traurig" groesse={120} />
	<h1>{page.status === 404 ? 'Nicht gefunden' : 'Etwas ist schiefgelaufen'}</h1>
	<p class="hinweis">{page.error?.message}</p>
	<a class="knopf" href="/">Zur Übersicht</a>
</div>

<style>
	.fehler {
		max-width: 26rem;
		margin: 3rem auto 0;
		text-align: center;
		display: grid;
		gap: 0.8rem;
		justify-items: center;
	}
	.fehler h1,
	.fehler p {
		margin: 0;
	}
</style>
