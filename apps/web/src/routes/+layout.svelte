<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Logo from '$lib/components/Logo.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Halmduell</title>
</svelte:head>

<header>
	<a href="/" class="start" aria-label="Halmduell – zur Übersicht"><Logo /></a>
	{#if data.user}
		<a href="/profil" class="profil">
			<span class="avatar" aria-hidden="true">{data.user.username.slice(0, 1).toUpperCase()}</span>
			<span class="nur-screenreader">Profil von</span>
			<span class="name">{data.user.username}</span>
		</a>
	{/if}
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 40rem;
		margin: 0 auto;
		padding: max(0.75rem, env(safe-area-inset-top)) 1rem 0.75rem;
	}
	.start {
		text-decoration: none;
	}
	.profil {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		min-height: 44px;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--gruen-hell);
		color: var(--gruen);
		font-weight: 700;
	}
	@media (max-width: 380px) {
		.name {
			display: none;
		}
	}
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 0.5rem 1rem max(2rem, env(safe-area-inset-bottom));
	}
</style>
