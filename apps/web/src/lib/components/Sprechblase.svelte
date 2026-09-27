<script lang="ts">
	import type { Snippet } from 'svelte';

	let { richtung = 'links', children }: { richtung?: 'links' | 'rechts'; children: Snippet } = $props();
</script>

<p class="blase {richtung}">{@render children()}</p>

<style>
	.blase {
		margin: 0;
		padding: 0.55rem 0.8rem;
		background: var(--flaeche);
		border: 2px solid var(--kante);
		font-weight: 800;
		line-height: 1.3;
	}
	.links {
		border-radius: 14px 14px 14px 4px;
	}
	.rechts {
		border-radius: 14px 14px 4px 14px;
	}
</style>
