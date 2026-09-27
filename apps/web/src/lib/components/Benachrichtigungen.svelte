<script lang="ts">
	import { onMount } from 'svelte';
	import { push } from '$lib/push.svelte';
	import Halmi from './Halmi.svelte';

	/**
	 * profil: Karte mit Schalter und Erklärung je Zustand.
	 * hinweis: nur wenn noch aus – kurzer, ausblendbarer Hinweis auf der Übersicht.
	 */
	let { art = 'profil', onschliessen }: { art?: 'profil' | 'hinweis'; onschliessen?: () => void } = $props();

	let laeuft = $state(false);
	let fehler = $state('');

	onMount(() => void push.pruefen());

	async function umschalten() {
		laeuft = true;
		fehler = '';
		try {
			if (push.zustand === 'an') await push.deaktivieren();
			else if (!(await push.aktivieren()) && push.zustand !== 'blockiert') fehler = 'Das hat nicht geklappt – bitte später noch einmal versuchen.';
		} finally {
			laeuft = false;
		}
	}
</script>

{#if art === 'hinweis'}
	{#if push.zustand === 'aus'}
		<section class="karte hinweis-karte" aria-labelledby="push-hinweis-titel">
			<Halmi pose="winken" groesse={64} halm={false} />
			<div class="text">
				<h2 id="push-hinweis-titel">Nichts verpassen</h2>
				<p>Bescheid bekommen, wenn du dran bist oder ein Duell endet.</p>
				<button type="button" class="knopf klein" disabled={laeuft} onclick={umschalten}>Benachrichtigungen an</button>
				{#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
			</div>
			<button type="button" class="schliessen" aria-label="Hinweis zu Benachrichtigungen ausblenden" onclick={onschliessen}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
			</button>
		</section>
	{/if}
{:else if push.zustand !== 'server-aus' && push.zustand !== 'laden'}
	<section class="karte" aria-labelledby="push-titel">
		<div class="kopf">
			<h2 id="push-titel">Benachrichtigungen</h2>
			{#if push.zustand === 'an' || push.zustand === 'aus'}
				<button
					type="button"
					class="schalter"
					role="switch"
					aria-checked={push.zustand === 'an'}
					aria-labelledby="push-titel"
					disabled={laeuft}
					onclick={umschalten}
				>
					<span class="griff"></span>
				</button>
			{/if}
		</div>
		{#if push.zustand === 'an'}
			<p class="hinweis">An auf diesem Gerät: wenn du dran bist, ein Duell endet, die Frist bald abläuft oder jemand dich als Freund anfragt.</p>
		{:else if push.zustand === 'aus'}
			<p class="hinweis">Bescheid bekommen, wenn du dran bist, ein Duell endet oder die Frist bald abläuft. Gilt nur für dieses Gerät.</p>
		{:else if push.zustand === 'blockiert'}
			<p class="hinweis">Benachrichtigungen sind für Halmduell in den Browser- bzw. Systemeinstellungen blockiert. Dort erlauben, dann hier einschalten.</p>
		{:else if push.zustand === 'ios-installieren'}
			<p class="hinweis">Auf dem iPhone gibt es Benachrichtigungen nur für die installierte App: in Safari <strong>Teilen → „Zum Home-Bildschirm“</strong>, dann die App öffnen und hier einschalten.</p>
		{:else}
			<p class="hinweis">Dieser Browser unterstützt keine Benachrichtigungen.</p>
		{/if}
		{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
	</section>
{/if}

<style>
	section {
		margin-top: 1.1rem;
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	h2 {
		margin: 0;
	}
	.kopf + .hinweis {
		margin-bottom: 0;
	}
	.schalter {
		flex: none;
		position: relative;
		width: 58px;
		height: 34px;
		padding: 0;
		border-radius: 999px;
		border: 3px solid var(--kante);
		background: var(--grund);
		cursor: pointer;
	}
	.schalter[aria-checked='true'] {
		background: var(--gruen);
		border-color: var(--kontur);
	}
	.griff {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--text-2);
		transition: transform 0.15s;
	}
	.schalter[aria-checked='true'] .griff {
		transform: translateX(24px);
		background: var(--flaeche);
		border: 2px solid var(--kontur);
	}
	.schalter:focus-visible {
		outline: 3px solid var(--fokus);
		outline-offset: 3px;
	}
	.schalter:disabled {
		opacity: 0.6;
	}

	.hinweis-karte {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		margin: 0 0 0.9rem;
		background: var(--himmel);
	}
	.text {
		flex: 1;
		display: grid;
		gap: 0.4rem;
		justify-items: start;
	}
	.text h2 {
		font-size: 1.2rem;
	}
	.text p {
		margin: 0;
	}
	.fehler {
		color: var(--falsch);
		font-weight: 800;
		font-size: 0.9rem;
	}
	.schliessen {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--text);
		cursor: pointer;
	}
</style>
