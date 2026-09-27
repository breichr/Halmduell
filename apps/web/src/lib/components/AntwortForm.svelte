<script lang="ts">
	// Form je Antwortposition – Kacheln unterscheiden sich nicht nur über die Farbe
	let { index }: { index: number } = $props();
</script>

<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
	{#if index === 0}
		<circle cx="12" cy="12" r="9" fill="currentColor" />
	{:else if index === 1}
		<path d="M12 3 22 20H2z" fill="currentColor" />
	{:else if index === 2}
		<rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" />
	{:else}
		<path d="M12 2 22 12 12 22 2 12z" fill="currentColor" />
	{/if}
</svg>
