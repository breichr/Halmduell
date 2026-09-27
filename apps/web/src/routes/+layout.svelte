<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import UpdateHinweis from '$lib/components/UpdateHinweis.svelte';
	// fängt das Installationsangebot des Browsers früh ab
	import '$lib/installation.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Halmduell</title>
</svelte:head>

<main>
	<UpdateHinweis />
	{@render children()}
</main>

<style>
	main {
		max-width: 30rem;
		margin: 0 auto;
		padding: env(safe-area-inset-top) 1rem max(2rem, env(safe-area-inset-bottom));
		min-height: 100dvh;
	}
</style>
