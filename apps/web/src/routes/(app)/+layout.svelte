<script lang="ts">
	import { page } from '$app/state';
	import Navigation from '$lib/components/Navigation.svelte';

	let { children } = $props();

	// Beim Spielen nichts, was vom Timer ablenkt
	const mitNavigation = $derived(!page.url.pathname.endsWith('/spielen'));
</script>

<div class:platz-fuer-navigation={mitNavigation}>
	{@render children()}
</div>

{#if mitNavigation}
	<Navigation />
{/if}

<style>
	.platz-fuer-navigation {
		padding-bottom: 6rem;
	}
</style>
