<script lang="ts">
	import { page } from '$app/state';
	import Halmi from '$lib/components/Halmi.svelte';
	import Landschaft from '$lib/components/Landschaft.svelte';

	let { children } = $props();

	const pose = $derived(page.url.pathname.startsWith('/passwort-vergessen') ? 'denken' : 'winken');
</script>

<Landschaft hoehe={250}>
	<div class="marke">
		<Halmi {pose} groesse={128} />
		<p class="name" aria-hidden="true">Halmduell</p>
		<p class="slogan">Das Agrar-Quiz für dich und deine Freunde</p>
	</div>
</Landschaft>

<div class="gast">
	{@render children()}
</div>

<style>
	.marke {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 0 2.5rem;
	}
	.name {
		margin: 0;
		font-family: var(--schrift-titel);
		font-size: 2.6rem;
		font-weight: 800;
		line-height: 1;
		color: var(--gruen-dunkel);
	}
	.slogan {
		margin: 0.2rem 0 0;
		font-weight: 800;
	}
	.gast {
		max-width: 26rem;
		margin: 1.25rem auto 0;
		display: grid;
		gap: 1rem;
	}
	.gast :global(.unten) {
		text-align: center;
		margin: 0;
	}
	.gast :global(.formular.karte) {
		border-bottom-width: 6px;
	}
</style>
