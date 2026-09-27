<script lang="ts">
	import type { AntwortStand } from '@halmduell/shared';

	let { stand, wer }: { stand: AntwortStand | null; wer: string } = $props();

	const art = $derived(!stand ? 'offen' : stand.richtig ? 'richtig' : 'falsch');
	const text = $derived(
		!stand ? `${wer}: noch offen` : stand.richtig ? `${wer}: richtig` : stand.antwortId === null ? `${wer}: Zeit abgelaufen` : `${wer}: falsch`
	);
</script>

<span class="symbol {art}" title={text}>
	<span aria-hidden="true">{art === 'richtig' ? '✓' : art === 'falsch' ? '✗' : '?'}</span>
	<span class="nur-screenreader">{text}</span>
</span>

<style>
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid var(--kante);
		font-weight: 800;
		font-size: 1rem;
	}
	.richtig {
		background: #2f7d3b;
		border-color: #2a1c14;
		color: #ffffff;
	}
	.falsch {
		background: var(--falsch-akzent);
		border-color: #2a1c14;
		color: #ffffff;
	}
	.offen {
		background: var(--flaeche);
		border-style: dashed;
		color: var(--text-2);
	}
</style>
