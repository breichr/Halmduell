<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { DuellUebersicht } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import Halmi from '$lib/components/Halmi.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import { kategorieName } from '$lib/format';

	let { data } = $props();

	let fehler = $state('');
	let laeuft = $state(false);
	const eigene = $derived(data.einladung?.von.id === data.user.id);

	async function annehmen() {
		laeuft = true;
		fehler = '';
		try {
			const duel = await api().post<DuellUebersicht>('/duels/beitreten', { code: page.params.code });
			await invalidate('app:duelle');
			await goto(`/duell/${duel.id}`, { replaceState: true });
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Einladung konnte nicht angenommen werden';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head><title>Einladung – Halmduell</title></svelte:head>

{#if data.einladung}
	{@const e = data.einladung}
	<div class="poster">
		<svg class="strahlen" viewBox="0 0 390 600" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
			<g stroke="rgb(0 0 0 / 6%)" stroke-width="30">
				<path d="M195 230 L-60 0" /><path d="M195 230 L60 -60" /><path d="M195 230 L330 -60" /><path d="M195 230 L450 0" /><path d="M195 230 L480 260" /><path d="M195 230 L-90 260" />
			</g>
		</svg>
		<span class="band">Herausforderung!</span>
		<div class="gegner">
			<div class="person"><span class="avatar">{e.von.username.slice(0, 1).toUpperCase()}</span><span>{e.von.username}</span></div>
			<span class="vs" aria-hidden="true">VS</span>
			<div class="person"><span class="avatar du">{data.user.username.slice(0, 1).toUpperCase()}</span><span>Du</span></div>
		</div>
		<h1>{e.von.username} fordert dich heraus!</h1>
		<div class="info">
			<p class="kategorie"><KategorieSymbol kategorie={e.kategorie} groesse={24} /> {kategorieName(e.kategorie)}</p>
			<div class="regeln">
				<div><strong>6</strong><span>Fragen</span></div>
				<div><strong>15 s</strong><span>pro Frage</span></div>
				<div><strong>3</strong><span>Tage Zeit</span></div>
			</div>
		</div>
		<span class="halmi"><Halmi pose="winken" groesse={64} halm={false} /></span>
	</div>

	{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
	<div class="aktionen">
		{#if eigene}
			<p class="hinweis"><strong>Das ist deine eigene Einladung.</strong> Schick den Link an jemand anderen.</p>
			<a class="knopf zweitrangig breit" href="/duell/{e.duelId}">Zum Duell</a>
		{:else}
			<button class="knopf breit gross" onclick={annehmen} disabled={laeuft}>{laeuft ? 'Wird angenommen …' : 'Herausforderung annehmen'}</button>
			<a class="knopf zweitrangig breit" href="/">Später</a>
		{/if}
	</div>
{:else}
	<div class="karte nicht-da">
		<Halmi pose="traurig" groesse={110} halm={false} />
		<h1>Einladung nicht verfügbar</h1>
		<p class="hinweis">{data.fehler} Vielleicht hat schon jemand anderes angenommen oder sie ist abgelaufen.</p>
		<a class="knopf breit" href="/duell/neu">Selbst ein Duell starten</a>
	</div>
{/if}

<style>
	.poster {
		position: relative;
		overflow: hidden;
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		margin-top: 1rem;
		padding: 1.2rem 1rem 1.3rem;
		background: var(--sonne);
		color: #2a1c14;
		border: 3px solid var(--kontur);
		border-bottom-width: 6px;
		border-radius: 24px;
		text-align: center;
	}
	.strahlen {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.poster > :not(.strahlen) {
		position: relative;
	}
	.band {
		padding: 0.3rem 0.9rem;
		border-radius: 999px;
		background: #ffffff;
		border: 3px solid #2a1c14;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		font-size: 0.85rem;
	}
	.gegner {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.person {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		font-weight: 800;
		max-width: 7rem;
		overflow-wrap: anywhere;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: var(--blau);
		border: 4px solid #2a1c14;
		font-family: var(--schrift-titel);
		font-size: 2.2rem;
		font-weight: 800;
	}
	.avatar.du {
		background: #ffffff;
	}
	.vs {
		font-family: var(--schrift-titel);
		font-size: 1.9rem;
		font-weight: 800;
		padding: 0 0.5rem;
		background: #2a1c14;
		color: var(--sonne);
		border-radius: 12px;
		transform: rotate(-6deg);
	}
	h1 {
		margin: 0;
		font-size: 1.9rem;
		overflow-wrap: anywhere;
	}
	.info {
		width: 100%;
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem;
		background: #ffffff;
		border: 3px solid #2a1c14;
		border-radius: 18px;
	}
	.kategorie {
		margin: 0;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 0.4rem;
		font-weight: 800;
		font-size: 1.1rem;
	}
	.regeln {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.regeln div {
		display: grid;
		padding: 0.4rem;
		background: #fff8ea;
		border-radius: 12px;
		font-size: 0.85rem;
	}
	.regeln strong {
		font-family: var(--schrift-titel);
		font-size: 1.4rem;
		line-height: 1.1;
	}
	.halmi {
		position: absolute !important;
		right: 0.3rem;
		top: 0.2rem;
	}
	.aktionen {
		display: grid;
		gap: 0.7rem;
		margin-top: 1rem;
	}
	.gross {
		min-height: 62px;
		font-size: 1.35rem;
	}
	.nicht-da {
		display: grid;
		justify-items: center;
		gap: 0.7rem;
		text-align: center;
		margin-top: 1.5rem;
	}
	.nicht-da h1,
	.nicht-da p {
		margin: 0;
	}
</style>
