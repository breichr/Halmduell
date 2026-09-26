<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { aktuelleSaison, saisonBezeichnung } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import Wiederherstellungscode from '$lib/components/Wiederherstellungscode.svelte';

	const js = hydriert();

	let { data } = $props();

	// Passwort ändern
	let altesPasswort = $state('');
	let neuesPasswort = $state('');
	let pwFehler = $state<Record<string, string[]>>({});
	let pwMeldung = $state('');
	let pwOk = $state(false);

	async function passwortAendern(event: SubmitEvent) {
		event.preventDefault();
		pwFehler = {};
		pwMeldung = '';
		pwOk = false;
		try {
			await api().post('/auth/passwort', { altesPasswort, neuesPasswort });
			altesPasswort = neuesPasswort = '';
			pwOk = true;
		} catch (e) {
			if (e instanceof ApiError) {
				pwFehler = e.felder;
				pwMeldung = Object.keys(e.felder).length ? '' : e.message;
			}
		}
	}

	// Neuer Wiederherstellungscode
	let codePasswort = $state('');
	let codeFehler = $state('');
	let neuerCode = $state<string | null>(null);

	async function codeErzeugen(event: SubmitEvent) {
		event.preventDefault();
		codeFehler = '';
		try {
			const res = await api().post<{ wiederherstellungsCode: string }>('/auth/wiederherstellungscode', { passwort: codePasswort });
			neuerCode = res.wiederherstellungsCode;
			codePasswort = '';
		} catch (e) {
			codeFehler = e instanceof ApiError ? e.message : 'Fehlgeschlagen';
		}
	}

	async function abmelden(ueberall: boolean) {
		await api().post(ueberall ? '/auth/logout-alle' : '/auth/logout');
		await invalidateAll();
		await goto('/anmelden', { replaceState: true });
	}
</script>

<svelte:head><title>Profil – Halmduell</title></svelte:head>

<a href="/" class="zurueck">← Übersicht</a>
<h1>{data.user.username}</h1>
<p class="hinweis">Saison {saisonBezeichnung(aktuelleSaison())}</p>

<section class="karte">
	<h2>Passwort ändern</h2>
	<form method="post" class="formular" onsubmit={passwortAendern}>
		{#if pwMeldung}<p class="fehlermeldung" role="alert">{pwMeldung}</p>{/if}
		{#if pwOk}<p class="erfolg" role="status">Passwort geändert. Andere Geräte wurden abgemeldet.</p>{/if}
		<Feld label="Aktuelles Passwort" type="password" bind:wert={altesPasswort} autocomplete="current-password" required />
		<Feld label="Neues Passwort" type="password" bind:wert={neuesPasswort} fehler={pwFehler.neuesPasswort} hinweis="Mindestens 8 Zeichen" autocomplete="new-password" minlength={8} required />
		<button disabled={!js.bereit} class="knopf">Passwort ändern</button>
	</form>
</section>

<section class="karte">
	<h2>Wiederherstellungscode</h2>
	{#if neuerCode}
		<Wiederherstellungscode code={neuerCode} username={data.user.username} weiter={() => (neuerCode = null)} />
	{:else}
		<p class="hinweis">Code verloren? Erzeuge einen neuen – der alte wird dabei ungültig.</p>
		<form method="post" class="formular" onsubmit={codeErzeugen}>
			{#if codeFehler}<p class="fehlermeldung" role="alert">{codeFehler}</p>{/if}
			<Feld label="Passwort zur Bestätigung" type="password" bind:wert={codePasswort} autocomplete="current-password" required />
			<button disabled={!js.bereit} class="knopf zweitrangig">Neuen Code erzeugen</button>
		</form>
	{/if}
</section>

<section class="abmelden">
	<button class="knopf zweitrangig breit" onclick={() => abmelden(false)}>Abmelden</button>
	<button class="knopf gefahr breit" onclick={() => abmelden(true)}>Auf allen Geräten abmelden</button>
</section>

<style>
	.zurueck {
		display: inline-block;
		margin-bottom: 0.5rem;
		text-decoration: none;
	}
	h1 + .hinweis {
		margin-top: -0.3rem;
	}
	section {
		margin-top: 1.25rem;
	}
	.karte h2 {
		margin-bottom: 0.8rem;
	}
	.karte > .hinweis {
		margin-top: 0;
	}
	.erfolg {
		background: var(--richtig-hell);
		color: var(--richtig);
		border-radius: var(--radius-klein);
		padding: 0.7em 0.9em;
		margin: 0;
		font-weight: 500;
	}
	.abmelden {
		display: grid;
		gap: 0.6rem;
	}
</style>
