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
		font-weight: 800;
		font-size: 0.95rem;
	}
	input {
		font: inherit;
		font-weight: 800;
		font-size: 1.05rem;
		min-height: 52px;
		padding: 0.5em 0.9em;
		border: 3px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--grund);
		color: var(--text);
	}
	input::placeholder {
		color: var(--text-2);
		font-weight: 600;
	}
	input:focus {
		outline: none;
		border-color: var(--gruen);
		box-shadow: 0 0 0 4px var(--gruen-hell);
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
		font-weight: 800;
	}
</style>
