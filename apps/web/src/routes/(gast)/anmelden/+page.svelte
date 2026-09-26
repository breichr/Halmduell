<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import { sicheresZiel } from '$lib/navigation';

	const js = hydriert();

	let username = $state('');
	let password = $state('');
	let fehler = $state('');
	let laeuft = $state(false);

	const weiter = $derived(page.url.searchParams.get('weiter'));
	const mitWeiter = (pfad: string) => (weiter ? `${pfad}?weiter=${encodeURIComponent(weiter)}` : pfad);

	async function anmelden(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = '';
		try {
			await api().post('/auth/login', { username, password });
			await invalidate('app:user');
			await goto(sicheresZiel(weiter), { replaceState: true });
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Anmeldung fehlgeschlagen';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head><title>Anmelden – Halmduell</title></svelte:head>

<section class="intro">
	<h1>Willkommen zurück</h1>
	<p class="hinweis">Fordere Freunde zum Agrar-Quiz heraus – Kulturen, Schädlinge, Krankheiten und Fachwissen.</p>
</section>

<form method="post" class="karte formular" onsubmit={anmelden}>
	{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
	<Feld label="Benutzername" bind:wert={username} autocomplete="username" autocapitalize="none" required />
	<Feld label="Passwort" type="password" bind:wert={password} autocomplete="current-password" required />
	<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Anmelden …' : 'Anmelden'}</button>
	<a href={mitWeiter('/passwort-vergessen')} class="vergessen">Passwort vergessen?</a>
</form>

<p class="unten">Neu hier? <a href={mitWeiter('/registrieren')}>Konto erstellen</a></p>

<style>
	.intro p {
		margin: 0;
	}
	.vergessen {
		justify-self: center;
		font-size: 0.95rem;
	}
</style>
