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
	let code = $state('');
	let neuesPasswort = $state('');
	let fehler = $state('');
	let feldFehler = $state<Record<string, string[]>>({});
	let laeuft = $state(false);
	let ergebnis = $state<UserMitWiederherstellungscode | null>(null);

	async function zuruecksetzen(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = '';
		feldFehler = {};
		try {
			ergebnis = await api().post<UserMitWiederherstellungscode>('/auth/zuruecksetzen', { username, code, neuesPasswort });
		} catch (e) {
			if (e instanceof ApiError) {
				feldFehler = e.felder;
				fehler = Object.keys(e.felder).length ? '' : e.message;
			} else {
				fehler = 'Zurücksetzen fehlgeschlagen';
			}
		} finally {
			laeuft = false;
		}
	}

	async function fertig() {
		await invalidate('app:user');
		await goto(sicheresZiel(page.url.searchParams.get('weiter')), { replaceState: true });
	}
</script>

<svelte:head><title>Passwort vergessen – Halmduell</title></svelte:head>

{#if ergebnis}
	<h1>Neues Passwort gesetzt</h1>
	<p class="hinweis">Dein alter Code ist damit verbraucht. Hier ist dein neuer:</p>
	<Wiederherstellungscode code={ergebnis.wiederherstellungsCode} username={ergebnis.username} weiter={fertig} />
{:else}
	<section>
		<h1>Passwort vergessen</h1>
		<p class="hinweis">Gib den Wiederherstellungscode ein, den du bei der Registrierung bekommen hast.</p>
	</section>

	<form method="post" class="karte formular" onsubmit={zuruecksetzen}>
		{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}
		<Feld label="Benutzername" bind:wert={username} autocomplete="username" autocapitalize="none" required />
		<Feld
			label="Wiederherstellungscode"
			bind:wert={code}
			fehler={feldFehler.code}
			placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			required
		/>
		<Feld
			label="Neues Passwort"
			type="password"
			bind:wert={neuesPasswort}
			fehler={feldFehler.neuesPasswort}
			hinweis="Mindestens 8 Zeichen"
			autocomplete="new-password"
			minlength={8}
			required
		/>
		<button class="knopf breit" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird gesetzt …' : 'Passwort zurücksetzen'}</button>
	</form>

	<p class="unten"><a href="/anmelden">Zurück zur Anmeldung</a></p>
{/if}

<style>
	section {
		text-align: center;
	}
	section h1 {
		font-size: 1.6rem;
		margin: 0 0 0.2rem;
	}
	section p {
		margin: 0;
	}
</style>
