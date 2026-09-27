<script lang="ts">
	import { page } from '$app/state';

	let { offeneAnfragen = 0 }: { offeneAnfragen?: number } = $props();

	const aktiv = $derived(page.url.pathname);
</script>

<nav aria-label="Hauptnavigation">
	<a href="/" aria-current={aktiv === '/' ? 'page' : undefined}>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7v9H3z" /></svg>
		Start
	</a>
	<a href="/rangliste" aria-current={aktiv === '/rangliste' ? 'page' : undefined}>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>
		Rangliste
	</a>
	<a href="/duell/neu" class="neu" aria-label="Neues Duell">
		<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
	</a>
	<a
		href="/freunde"
		aria-current={aktiv === '/freunde' ? 'page' : undefined}
		aria-label={offeneAnfragen > 0 ? `Freunde, ${offeneAnfragen} ${offeneAnfragen === 1 ? 'neue Anfrage' : 'neue Anfragen'}` : undefined}
	>
		<span class="symbol">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.7 3.5 5.7" /></svg>
			{#if offeneAnfragen > 0}<span class="punkt" aria-hidden="true">{offeneAnfragen > 9 ? '9+' : offeneAnfragen}</span>{/if}
		</span>
		Freunde
	</a>
	<a href="/profil" aria-current={aktiv === '/profil' ? 'page' : undefined}>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
		Profil
	</a>
</nav>

<style>
	nav {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: max(0.75rem, env(safe-area-inset-bottom));
		width: min(26rem, calc(100% - 1.5rem));
		height: 68px;
		display: grid;
		/* Plus-Knopf mittig: links Start + Rangliste, rechts Freunde + Profil */
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 72px minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		background: var(--flaeche);
		border: 3px solid var(--kontur);
		border-radius: 22px;
		z-index: 10;
	}
	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 56px;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-2);
		text-decoration: none;
	}
	a[aria-current='page'] {
		color: var(--gruen-dunkel);
	}
	.symbol {
		position: relative;
		display: grid;
	}
	.punkt {
		position: absolute;
		top: -6px;
		right: -10px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--falsch);
		color: #ffffff;
		border: 2px solid var(--flaeche);
		font-size: 0.68rem;
		line-height: 14px;
		text-align: center;
	}
	.neu {
		justify-self: center;
		width: 60px;
		height: 60px;
		min-height: 0;
		margin-top: -28px;
		border-radius: 50%;
		background: var(--gruen);
		border: 3px solid var(--kontur);
		color: var(--gruen-text);
	}
</style>
