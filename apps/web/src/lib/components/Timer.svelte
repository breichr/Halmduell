<script lang="ts">
	let { restMs, gesamtMs }: { restMs: number; gesamtMs: number } = $props();

	const RADIUS = 21;
	const UMFANG = 2 * Math.PI * RADIUS;
	const anteil = $derived(Math.max(0, Math.min(1, restMs / gesamtMs)));
	const sekunden = $derived(Math.ceil(restMs / 1000));
	const knapp = $derived(restMs <= 5000);
</script>

<div class="timer" class:knapp role="timer" aria-label="Noch {sekunden} Sekunden">
	<svg viewBox="0 0 54 54" aria-hidden="true">
		<circle cx="27" cy="27" r="25" class="rand" />
		<circle cx="27" cy="27" r={RADIUS} class="rest" stroke-dasharray={UMFANG} stroke-dashoffset={UMFANG * (1 - anteil)} />
	</svg>
	<span aria-hidden="true">{sekunden}</span>
</div>

<style>
	.timer {
		position: relative;
		width: 58px;
		height: 58px;
		display: grid;
		place-items: center;
		font-family: var(--schrift-titel);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		font-size: 1.45rem;
		color: #2a1c14;
	}
	svg {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
	}
	span {
		position: relative;
	}
	.rand {
		fill: #ffffff;
		stroke: var(--kontur);
		stroke-width: 3;
	}
	.rest {
		fill: none;
		stroke: var(--wiese);
		stroke-width: 5;
		stroke-linecap: round;
	}
	.knapp {
		animation: puls 1s ease-in-out infinite;
	}
	.knapp .rest {
		stroke: var(--falsch-akzent);
	}
	@keyframes puls {
		50% {
			transform: scale(1.08);
		}
	}
</style>
