<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} – Halmduell</title></svelte:head>

<div class="karte fehler">
	<h1>{page.status === 404 ? 'Nicht gefunden' : 'Etwas ist schiefgelaufen'}</h1>
	<p class="hinweis">{page.error?.message}</p>
	<a class="knopf" href="/">Zur Übersicht</a>
</div>

<style>
	.fehler {
		max-width: 26rem;
		margin: 2rem auto 0;
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
