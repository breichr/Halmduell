<script lang="ts">
	let { groesse = 32, mitText = true }: { groesse?: number; mitText?: boolean } = $props();
</script>

<span class="logo">
	<!-- Getreidehalm: Platzhalter, bis das Maskottchen-Design steht -->
	<svg width={groesse} height={groesse} viewBox="0 0 32 32" aria-hidden="true">
		<path d="M16 30 C16 22 16 14 17 4" stroke="var(--gruen)" stroke-width="2" fill="none" stroke-linecap="round" />
		{#each [6, 11, 16, 21] as y (y)}
			<ellipse cx="13" cy={y + 1} rx="2.4" ry="4" transform="rotate(-30 13 {y + 1})" fill="var(--weizen)" />
			<ellipse cx="20" cy={y} rx="2.4" ry="4" transform="rotate(30 20 {y})" fill="var(--weizen)" />
		{/each}
	</svg>
	{#if mitText}<span class="wort">Halm<b>duell</b></span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.wort {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text);
	}
	.wort b {
		color: var(--gruen);
	}
</style>
