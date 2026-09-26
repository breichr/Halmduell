<script lang="ts">
	let { restMs, gesamtMs }: { restMs: number; gesamtMs: number } = $props();

	const RADIUS = 20;
	const UMFANG = 2 * Math.PI * RADIUS;
	const anteil = $derived(Math.max(0, Math.min(1, restMs / gesamtMs)));
	const sekunden = $derived(Math.ceil(restMs / 1000));
	const knapp = $derived(restMs <= 5000);
</script>

<div class="timer" class:knapp role="timer" aria-label="Noch {sekunden} Sekunden">
	<svg viewBox="0 0 48 48" aria-hidden="true">
		<circle cx="24" cy="24" r={RADIUS} class="spur" />
		<circle cx="24" cy="24" r={RADIUS} class="rest" stroke-dasharray={UMFANG} stroke-dashoffset={UMFANG * (1 - anteil)} />
	</svg>
	<span aria-hidden="true">{sekunden}</span>
</div>

<style>
	.timer {
		position: relative;
		width: 3.2rem;
		height: 3.2rem;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		font-size: 1.1rem;
	}
	svg {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
	}
	circle {
		fill: none;
		stroke-width: 4;
	}
	.spur {
		stroke: var(--flaeche-2);
	}
	.rest {
		stroke: var(--gruen);
		stroke-linecap: round;
	}
	.knapp {
		color: var(--falsch);
	}
	.knapp .rest {
		stroke: var(--falsch);
	}
</style>
