<script lang="ts">
	import type { AntwortStand } from '@halmduell/shared';

	let { stand, wer }: { stand: AntwortStand | null; wer: string } = $props();

	const art = $derived(!stand ? 'offen' : stand.richtig ? 'richtig' : 'falsch');
	const text = $derived(
		!stand ? `${wer}: noch offen` : stand.richtig ? `${wer}: richtig` : stand.antwortId === null ? `${wer}: Zeit abgelaufen` : `${wer}: falsch`
	);
</script>

<span class="symbol {art}" title={text}>
	<span aria-hidden="true">{art === 'richtig' ? '✓' : art === 'falsch' ? '✗' : '·'}</span>
	<span class="nur-screenreader">{text}</span>
</span>

<style>
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		font-weight: 800;
		font-size: 1rem;
	}
	.richtig {
		background: var(--richtig-hell);
		color: var(--richtig);
	}
	.falsch {
		background: var(--falsch-hell);
		color: var(--falsch);
	}
	.offen {
		background: var(--flaeche-2);
		color: var(--text-2);
	}
</style>
