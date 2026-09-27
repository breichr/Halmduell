<script lang="ts">
	import AntwortForm from './AntwortForm.svelte';
	import Halmi from './Halmi.svelte';

	/** Frage mit Bild und vier Antwortkacheln – im Duell und beim Üben */
	let {
		frage,
		zustandVon,
		deaktiviert,
		onantwort
	}: {
		frage: { frageText: string; bildUrl: string | null; bildQuelle: string | null; antworten: { id: number; text: string }[] };
		/** Zustand je Kachel: '' | 'gewaehlt' | 'richtig' | 'falsch' | 'aus' */
		zustandVon: (id: number) => string;
		deaktiviert: boolean;
		onantwort: (id: number) => void;
	} = $props();
</script>

{#if frage.bildUrl}
	<figure>
		<img src={frage.bildUrl} alt="Bild zur Frage" />
		{#if frage.bildQuelle}<figcaption>Bild: {frage.bildQuelle}</figcaption>{/if}
		<span class="lupe"><Halmi pose="lupe" groesse={70} halm={false} /></span>
	</figure>
{/if}

<h1 class="frage" data-testid="frage">{frage.frageText}</h1>

<div class="antworten">
	{#each frage.antworten as antwort, i (antwort.id)}
		<button
			class="antwort farbe-{i} {zustandVon(antwort.id)}"
			disabled={deaktiviert}
			onclick={() => onantwort(antwort.id)}
			data-testid="antwort"
		>
			<span class="form">
				{#if zustandVon(antwort.id) === 'richtig'}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
				{:else if zustandVon(antwort.id) === 'falsch'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
				{:else}
					<AntwortForm index={i} />
				{/if}
			</span>
			<span class="text">{antwort.text}</span>
			<span class="nur-screenreader">(Taste {i + 1})</span>
		</button>
	{/each}
</div>

<style>
	figure {
		position: relative;
		margin: 0.6rem 0 0;
	}
	img {
		display: block;
		width: 100%;
		max-height: 40vh;
		object-fit: contain;
		background: var(--flaeche-2);
		border: 3px solid var(--kontur);
		border-radius: var(--radius);
	}
	figcaption {
		font-size: 0.78rem;
		color: var(--text-2);
		margin-top: 0.25rem;
	}
	.lupe {
		position: absolute;
		left: -0.6rem;
		top: -2.2rem;
	}
	.frage {
		font-size: 1.6rem;
		margin: 0.3rem 0 0;
		text-align: center;
		overflow-wrap: anywhere;
	}
	.antworten {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.antwort {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 104px;
		padding: 0.7rem 0.8rem;
		text-align: left;
		font: inherit;
		font-weight: 800;
		font-size: 1.05rem;
		line-height: 1.2;
		color: #2a1c14;
		border: 3px solid var(--kontur);
		border-bottom-width: 6px;
		border-radius: 18px;
		cursor: pointer;
		overflow-wrap: anywhere;
		transition: transform 0.06s, opacity 0.2s;
	}
	.antwort:active:enabled {
		transform: translateY(3px);
		border-bottom-width: 3px;
	}
	.antwort:disabled {
		cursor: default;
	}
	.farbe-0 {
		background: var(--sonne);
	}
	.farbe-1 {
		background: var(--blau);
	}
	.farbe-2 {
		background: var(--orange);
	}
	.farbe-3 {
		background: var(--hellgruen);
	}
	.form {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: rgb(255 255 255 / 55%);
	}
	.antwort.gewaehlt {
		outline: 4px solid var(--fokus);
		outline-offset: 2px;
	}
	.antwort.richtig {
		background: #2f7d3b;
		color: #ffffff;
		transform: rotate(-2deg);
	}
	.antwort.richtig .form {
		background: #ffffff;
		color: #2f7d3b;
	}
	.antwort.falsch {
		background: var(--falsch-hell);
		color: var(--falsch);
		border-color: var(--falsch);
	}
	.antwort.falsch .form {
		background: var(--falsch);
		color: #ffffff;
	}
	.antwort.aus {
		opacity: 0.45;
	}
</style>
