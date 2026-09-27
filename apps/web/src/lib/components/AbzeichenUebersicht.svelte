<script lang="ts">
	import { ABZEICHEN_GRUPPEN, ABZEICHEN_GRUPPEN_NAMEN, type AbzeichenListe } from '@halmduell/shared';
	import AbzeichenPlakette from '$lib/components/AbzeichenPlakette.svelte';

	let { liste }: { liste: AbzeichenListe } = $props();

	const gruppen = $derived(
		ABZEICHEN_GRUPPEN.map((g) => ({ gruppe: g, abzeichen: liste.abzeichen.filter((a) => a.gruppe === g) })).filter((g) => g.abzeichen.length)
	);
	const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<section class="karte" id="abzeichen" aria-labelledby="abzeichen-titel">
	<h2 id="abzeichen-titel">Abzeichen <span class="zaehler">{liste.erreicht} von {liste.abzeichen.length}</span></h2>
	{#each gruppen as g (g.gruppe)}
		<h3 class="abschnitt-titel">{ABZEICHEN_GRUPPEN_NAMEN[g.gruppe]}</h3>
		<ul>
			{#each g.abzeichen as a (a.key)}
				<li class:erreicht={a.erreichtAt}>
					<AbzeichenPlakette icon={a.icon} erreicht={!!a.erreichtAt} groesse={52} />
					<span class="text">
						<strong>{a.titel}</strong>
						<span class="beschreibung">{a.beschreibung}</span>
						{#if a.erreichtAt}
							<span class="am">erreicht am {datum(a.erreichtAt)}</span>
						{:else}
							<span class="nur-screenreader">noch nicht erreicht</span>
							{#if a.stand !== null && a.ziel}
								<span class="fortschritt">
									<span class="balken" aria-hidden="true"><span style="width: {(a.stand / a.ziel) * 100}%"></span></span>
									<span class="stand">{a.stand} / {a.ziel}</span>
								</span>
							{/if}
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/each}
</section>

<style>
	section {
		margin-top: 1.1rem;
		scroll-margin-top: 1rem;
	}
	h2 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0 0 0.4rem;
	}
	.zaehler {
		font-family: var(--schrift);
		font-size: 0.9rem;
		color: var(--text-2);
	}
	h3 {
		margin: 1rem 0 0.5rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.text {
		display: grid;
		min-width: 0;
		flex: 1;
	}
	li:not(.erreicht) strong {
		color: var(--text-2);
	}
	.beschreibung {
		font-size: 0.88rem;
		color: var(--text-2);
	}
	.am {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--gruen-dunkel);
	}
	.fortschritt {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}
	.balken {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: var(--grund);
		border: 1.5px solid var(--linie-leise);
		overflow: hidden;
	}
	.balken span {
		display: block;
		height: 100%;
		background: var(--gruen);
	}
	.stand {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-2);
	}
</style>
