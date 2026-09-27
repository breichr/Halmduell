<script lang="ts">
	import { installation } from '$lib/installation.svelte';
	import Halmi from './Halmi.svelte';

	let { schliessbar = false, onschliessen }: { schliessbar?: boolean; onschliessen?: () => void } = $props();
</script>

{#if installation.moeglich || installation.nurManuellIos}
	<section class="karte installieren" aria-labelledby="installieren-titel">
		<Halmi pose="winken" groesse={64} halm={false} />
		<div class="text">
			<h2 id="installieren-titel">Halmduell als App</h2>
			{#if installation.moeglich}
				<p>Aufs Handy holen – startet schneller und ohne Browserleiste.</p>
				<button type="button" class="knopf klein" onclick={() => installation.installieren()}>Installieren</button>
			{:else}
				<p>
					In Safari unten auf <strong>Teilen</strong>
					<svg class="teilen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-label="(Teilen-Symbol)"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v8h14v-8" /></svg>
					tippen, dann <strong>„Zum Home-Bildschirm“</strong>.
				</p>
			{/if}
		</div>
		{#if schliessbar}
			<button type="button" class="schliessen" aria-label="Hinweis ausblenden" onclick={onschliessen}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
			</button>
		{/if}
	</section>
{/if}

<style>
	.installieren {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: var(--himmel);
		margin-bottom: 0.9rem;
	}
	.text {
		flex: 1;
		display: grid;
		gap: 0.4rem;
		justify-items: start;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	p {
		margin: 0;
		font-size: 0.95rem;
	}
	.teilen {
		vertical-align: -3px;
	}
	.schliessen {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
		color: var(--text);
		cursor: pointer;
	}
</style>
