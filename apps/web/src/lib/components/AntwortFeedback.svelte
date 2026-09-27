<script lang="ts">
	import type { Snippet } from 'svelte';
	import Halmi from './Halmi.svelte';

	/** Rückmeldung nach einer Antwort, unten eingeblendet – im Duell und beim Üben */
	let {
		gut,
		titel,
		erklaerung,
		knopf,
		onweiter,
		children
	}: { gut: boolean; titel: string; erklaerung: string | null; knopf: string; onweiter: () => void; children?: Snippet } = $props();
</script>

<div class="feedback {gut ? 'gut' : 'schlecht'}" role="status" data-testid="feedback">
	<span class="feedback-halmi"><Halmi pose={gut ? 'jubeln' : 'traurig'} groesse={96} halm={false} /></span>
	<strong>{titel}</strong>
	{#if erklaerung}<p>{erklaerung}</p>{/if}
	{@render children?.()}
	<!-- svelte-ignore a11y_autofocus -->
	<button class="knopf breit" onclick={onweiter} autofocus>{knopf}</button>
</div>

<style>
	.feedback {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: 0;
		width: min(30rem, 100%);
		display: grid;
		gap: 0.6rem;
		padding: 1.1rem 1rem max(1rem, env(safe-area-inset-bottom));
		border: 3px solid var(--kontur);
		border-bottom: 0;
		border-radius: 26px 26px 0 0;
		animation: hoch 0.25s ease-out;
		z-index: 5;
	}
	@keyframes hoch {
		from {
			transform: translate(-50%, 40%);
			opacity: 0;
		}
	}
	.feedback.gut {
		background: var(--richtig-hell);
	}
	.feedback.schlecht {
		background: var(--falsch-hell);
	}
	.feedback strong {
		font-family: var(--schrift-titel);
		font-size: 2rem;
		line-height: 1;
	}
	.feedback.gut strong {
		color: var(--gruen-dunkel);
	}
	.feedback.schlecht strong {
		color: var(--falsch);
	}
	.feedback p {
		margin: 0;
		padding-right: 4.5rem;
	}
	.feedback-halmi {
		position: absolute;
		right: 0.5rem;
		top: -5.2rem;
	}
</style>
