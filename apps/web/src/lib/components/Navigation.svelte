<script lang="ts">
	import { page } from '$app/state';

	const aktiv = $derived(page.url.pathname);
</script>

<nav aria-label="Hauptnavigation">
	<a href="/" aria-current={aktiv === '/' ? 'page' : undefined}>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7v9H3z" /></svg>
		Start
	</a>
	<a href="/duell/neu" class="neu" aria-label="Neues Duell">
		<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
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
