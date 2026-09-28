<script lang="ts">
	import { invalidate } from '$app/navigation';
	import type { AdminEintrag } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';

	const js = hydriert();

	let { data } = $props();

	let name = $state('');
	let fehler = $state<string[]>([]);
	let meldung = $state('');
	let laeuft = $state(false);
	let beschaeftigt = $state<number | null>(null);

	async function ernennen(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = [];
		meldung = '';
		try {
			const neu = await api().post<AdminEintrag>('/admin/admins', { username: name.trim() });
			meldung = `${neu.username} ist jetzt Admin.`;
			name = '';
			await invalidate('app:admins');
		} catch (e) {
			fehler = [e instanceof ApiError ? (e.felder.username?.[0] ?? e.message) : 'Das hat nicht geklappt'];
		} finally {
			laeuft = false;
		}
	}

	async function entfernen(a: AdminEintrag) {
		if (!confirm(`${a.username} die Admin-Rechte entziehen?`)) return;
		beschaeftigt = a.id;
		fehler = [];
		meldung = '';
		try {
			await api().delete(`/admin/admins/${a.id}`);
			meldung = `${a.username} ist kein Admin mehr.`;
			await invalidate('app:admins');
		} catch (e) {
			fehler = [e instanceof ApiError ? e.message : 'Das hat nicht geklappt'];
		} finally {
			beschaeftigt = null;
		}
	}
</script>

<svelte:head><title>Admins – Admin-Portal – Halmduell</title></svelte:head>

<div class="kopfzeile">
	<a href="/admin" class="zurueck-knopf" aria-label="Zurück zum Admin-Portal">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
	</a>
	<h1>Admins</h1>
</div>

<form class="karte hinzufuegen" onsubmit={ernennen}>
	<Feld label="Spieler zum Admin machen (Benutzername)" bind:wert={name} {fehler} autocapitalize="none" autocomplete="off" required maxlength={50} />
	<button class="knopf" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird gespeichert …' : 'Zum Admin machen'}</button>
	{#if meldung}<p class="erfolg" role="status">{meldung}</p>{/if}
</form>

<section aria-labelledby="admins-titel">
	<h2 id="admins-titel" class="abschnitt-titel">Aktuelle Admins ({data.admins.length})</h2>
	<ul class="liste karte">
		{#each data.admins as a (a.id)}
			<li data-testid="admin-eintrag">
				<span class="avatar" aria-hidden="true">{a.username.slice(0, 1).toUpperCase()}</span>
				<span class="text">
					<strong>{a.username}{a.ich ? ' (du)' : ''}</strong>
					<span class="unterzeile">{a.fest ? 'fest über ADMIN_USERNAMES' : 'im Portal ernannt'}</span>
				</span>
				{#if !a.fest && !a.ich}
					<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === a.id} onclick={() => entfernen(a)} aria-label="{a.username} die Admin-Rechte entziehen">Entfernen</button>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="hinweis">
		Admins prüfen und bearbeiten Fragen, bearbeiten Meldungen und verwalten Admins. Feste Admins aus <code>ADMIN_USERNAMES</code> lassen sich
		nur dort entfernen – so kann sich niemand aussperren.
	</p>
</section>

<style>
	.hinzufuegen {
		display: grid;
		gap: 0.7rem;
	}
	section {
		margin-top: 1.3rem;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
	.liste li {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) auto;
		gap: 0.7rem;
		align-items: center;
		padding: 0.7rem 0.8rem;
		border-bottom: 2px dashed var(--linie-leise);
	}
	.liste li:last-child {
		border-bottom: 0;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--flaeche);
		border: 2px solid var(--kontur);
		font-weight: 800;
	}
	.text {
		display: grid;
		min-width: 0;
	}
	.text strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unterzeile {
		color: var(--text-2);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.hinweis {
		margin-top: 0.8rem;
	}
</style>
