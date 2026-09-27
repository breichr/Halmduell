<script lang="ts">
	/** Kleiner Pfeil mit Plätzen seit gestern; nichts bei null oder 0 */
	let { wert, lang = false }: { wert: number | null; lang?: boolean } = $props();

	const plaetze = (n: number) => (n === 1 ? '1 Platz' : `${n} Plätze`);
</script>

{#if wert}
	<span class="veraenderung" class:hoch={wert > 0} class:runter={wert < 0}>
		<span aria-hidden="true">{wert > 0 ? '▲' : '▼'} {lang ? plaetze(Math.abs(wert)) : Math.abs(wert)}</span>
		<span class="nur-screenreader">{wert > 0 ? `${plaetze(wert)} gewonnen` : `${plaetze(-wert)} verloren`} seit gestern</span>
		{#if lang}<span aria-hidden="true" class="seit">seit gestern</span>{/if}
	</span>
{/if}

<style>
	.veraenderung {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25em;
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
	}
	.hoch {
		color: var(--richtig);
	}
	.runter {
		color: var(--falsch);
	}
	.seit {
		font-weight: 600;
		color: var(--text-2);
	}
</style>
