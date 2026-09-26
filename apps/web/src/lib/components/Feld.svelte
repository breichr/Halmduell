<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		wert = $bindable(''),
		fehler = [],
		hinweis,
		...rest
	}: { label: string; wert?: string; fehler?: string[]; hinweis?: string } & Omit<HTMLInputAttributes, 'value'> = $props();

	const id = $props.id();
</script>

<div class="feld">
	<label for={id}>{label}</label>
	<input
		{id}
		bind:value={wert}
		aria-invalid={fehler.length > 0 || undefined}
		aria-describedby={fehler.length || hinweis ? `${id}-info` : undefined}
		{...rest}
	/>
	{#if fehler.length}
		<p id="{id}-info" class="fehler">{fehler.join(' · ')}</p>
	{:else if hinweis}
		<p id="{id}-info" class="hinweis">{hinweis}</p>
	{/if}
</div>

<style>
	.feld {
		display: grid;
		gap: 0.3rem;
	}
	label {
		font-weight: 600;
		font-size: 0.95rem;
	}
	input {
		font: inherit;
		min-height: 48px;
		padding: 0.6em 0.8em;
		border: 1.5px solid var(--linie);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
		color: var(--text);
	}
	input:focus {
		border-color: var(--gruen);
		outline: none;
		box-shadow: 0 0 0 3px var(--gruen-hell);
	}
	input[aria-invalid] {
		border-color: var(--falsch);
	}
	p {
		margin: 0;
		font-size: 0.88rem;
	}
	.fehler {
		color: var(--falsch);
	}
</style>
