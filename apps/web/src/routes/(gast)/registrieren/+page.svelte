<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { UserMitWiederherstellungscode } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import Wiederherstellungscode from '$lib/components/Wiederherstellungscode.svelte';
	import { sicheresZiel } from '$lib/navigation';

	const js = hydriert();

	let username = $state('');
	let password = $state('');
	let fehler = $state('');
	let feldFehler = $state<Record<string, string[]>>({});
	let laeuft = $state(false);
	let neu = $state<UserMitWiederherstellungscode | null>(null);

	const weiter = $derived(page.url.searchParams.get('weiter'));

	async function registrieren(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = '';
		feldFehler = {};
		try {
			neu = await api().post<UserMitWiederherstellungscode>('/auth/register', { username, password });
		} catch (e) {
			if (e instanceof ApiError) {
				feldFehler = e.felder;
				fehler = Object.keys(e.felder).length ? '' : e.message;
			} else {
				fehler = 'Registrierung fehlgeschlagen';
			}
		} finally {
			laeuft = false;
		}
	}

	async function fertig() {
		await invalidate('app:user');
		await goto(sicheresZiel(weiter), { replaceState: true });
	}
</script>

<svelte:head><title>Konto erstellen – Halmduell</title></svelte:head>

{#if neu}
	<h1>Willkommen, {neu.username}!</h1>
	<Wiederherstellungscode code={neu.wiederherstellungsCode} username={neu.username} weiter={fertig} />
{:else}
	<section>
		<h1>Konto erstellen</h1>
		<p class="hinweis">Kein E-Mail nötig – nur ein Benutzername, unter dem dich deine Freunde finden.</p>
	</section>

	<form method="post" class="karte formular" onsubmit={registrieren}>
		{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
		<Feld
			label="Benutzername"
			bind:wert={username}
			fehler={feldFehler.username}
			hinweis="3–20 Zeichen: Buchstaben, Ziffern, _ und -"
			autocomplete="username"
			autocapitalize="none"
			minlength={3}
			maxlength={20}
			required
		/>
		<Feld
			label="Passwort"
			type="password"
			bind:wert={password}
			fehler={feldFehler.password}
			hinweis="Mindestens 8 Zeichen"
			autocomplete="new-password"
			minlength={8}
			required
		/>
		<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird erstellt …' : 'Konto erstellen'}</button>
	</form>

	<p class="unten">Schon ein Konto? <a href={weiter ? `/anmelden?weiter=${encodeURIComponent(weiter)}` : '/anmelden'}>Anmelden</a></p>
{/if}

<style>
	section p {
		margin: 0;
	}
</style>
