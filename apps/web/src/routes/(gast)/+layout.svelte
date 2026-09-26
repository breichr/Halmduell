<script lang="ts">
	let { children } = $props();
</script>

<div class="gast">
	{@render children()}
</div>

<style>
	.gast {
		max-width: 26rem;
		margin: 1rem auto 0;
		display: grid;
		gap: 1.25rem;
	}
	.gast :global(.unten) {
		text-align: center;
		margin: 0;
	}
</style>
