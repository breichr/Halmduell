<script lang="ts">
	import { updated } from '$app/state';

	let laedt = $state(false);

	// Wartenden Service Worker aktivieren und danach neu laden
	async function neuLaden() {
		laedt = true;
		const registrierung = await navigator.serviceWorker?.getRegistration();
		await registrierung?.update().catch(() => {});
		const wartend = registrierung?.waiting;
		if (wartend) {
			navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
			wartend.postMessage('neueVersionAktivieren');
			setTimeout(() => location.reload(), 3000); // falls controllerchange ausbleibt
		} else {
			location.reload();
		}
	}
</script>

{#if updated.current}
	<div class="update" role="status">
		<span>Neue Version verfügbar</span>
		<button type="button" class="knopf sonne klein" onclick={neuLaden} disabled={laedt}>Neu laden</button>
	</div>
{/if}

<style>
	.update {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		margin: 0 -1rem;
		padding: 0.5rem 1rem;
		background: var(--kontur);
		color: #ffffff;
		font-weight: 800;
	}
</style>
