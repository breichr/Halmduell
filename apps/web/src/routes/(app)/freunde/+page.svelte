<script lang="ts">
	import { invalidate } from '$app/navigation';
	import type { FreundHinzugefuegt } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import Feld from '$lib/components/Feld.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { wann } from '$lib/format';

	const js = hydriert();

	let { data } = $props();

	const l = $derived(data.liste);
	const zahl = (n: number) => n.toLocaleString('de-DE');

	let name = $state('');
	let fehler = $state<string[]>([]);
	let meldung = $state('');
	let laeuft = $state(false);
	/** ID des Spielers, für den gerade eine Aktion läuft */
	let beschaeftigt = $state<number | null>(null);

	function bestaetigung(r: FreundHinzugefuegt) {
		return r.status === 'bestaetigt' ? `Du und ${r.username} seid jetzt Freunde.` : `Anfrage an ${r.username} verschickt.`;
	}

	async function hinzufuegen(event: SubmitEvent) {
		event.preventDefault();
		laeuft = true;
		fehler = [];
		meldung = '';
		try {
			const r = await api().post<FreundHinzugefuegt>('/freunde', { username: name.trim() });
			meldung = bestaetigung(r);
			name = '';
			await invalidate('app:freunde');
		} catch (e) {
			fehler = [e instanceof ApiError ? (e.felder.username?.[0] ?? e.message) : 'Anfrage konnte nicht verschickt werden'];
		} finally {
			laeuft = false;
		}
	}

	/** Führt eine Aktion für einen Spieler aus und lädt danach die Liste neu */
	async function aktion(id: number, ausfuehren: () => Promise<unknown>) {
		beschaeftigt = id;
		fehler = [];
		meldung = '';
		try {
			await ausfuehren();
		} catch (e) {
			fehler = [e instanceof ApiError ? e.message : 'Das hat nicht geklappt'];
		} finally {
			await invalidate('app:freunde');
			beschaeftigt = null;
		}
	}

	const annehmen = (id: number) => aktion(id, () => api().post(`/freunde/${id}/annehmen`));
	const entfernen = (id: number) => aktion(id, () => api().delete(`/freunde/${id}`));
	const vorschlagAnfragen = (id: number, username: string) =>
		aktion(id, async () => (meldung = bestaetigung(await api().post<FreundHinzugefuegt>('/freunde', { username }))));

	function beenden(id: number, username: string) {
		if (confirm(`Freundschaft mit ${username} beenden?`)) entfernen(id);
	}
</script>

<svelte:head><title>Freunde – Halmduell</title></svelte:head>

<header class="kopf">
	<h1>Freunde</h1>
	{#if l.freunde.length}
		<a class="chip" href="/rangliste?kreis=freunde">Rangliste unter Freunden</a>
	{/if}
</header>

<form class="karte hinzufuegen" onsubmit={hinzufuegen}>
	<Feld label="Freund per Benutzername hinzufügen" bind:wert={name} fehler={fehler} autocapitalize="none" autocomplete="off" required maxlength={50} />
	<button class="knopf" disabled={!js.bereit || laeuft}>{laeuft ? 'Wird geschickt …' : 'Anfragen'}</button>
	{#if meldung}<p class="erfolg" role="status">{meldung}</p>{/if}
</form>

{#if l.anfragen.length}
	<section aria-labelledby="anfragen-titel">
		<h2 id="anfragen-titel" class="abschnitt-titel">Anfragen an dich</h2>
		<ul class="liste karte">
			{#each l.anfragen as a (a.id)}
				<li>
					<span class="avatar" aria-hidden="true">{a.username.slice(0, 1).toUpperCase()}</span>
					<span class="text"><strong>{a.username}</strong><span class="unterzeile">{wann(a.seit)}</span></span>
					<span class="aktionen">
						<button class="knopf klein" disabled={!js.bereit || beschaeftigt === a.id} onclick={() => annehmen(a.id)} aria-label="Anfrage von {a.username} annehmen">Annehmen</button>
						<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === a.id} onclick={() => entfernen(a.id)} aria-label="Anfrage von {a.username} ablehnen">Ablehnen</button>
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section aria-labelledby="freunde-titel">
	<h2 id="freunde-titel" class="abschnitt-titel">Deine Freunde{l.freunde.length ? ` (${l.freunde.length})` : ''}</h2>
	{#if l.freunde.length}
		<ul class="liste karte">
			{#each l.freunde as f (f.id)}
				<li>
					<span class="avatar" aria-hidden="true">{f.username.slice(0, 1).toUpperCase()}</span>
					<span class="text">
						<strong>{f.username}</strong>
						<span class="unterzeile">{f.rating === null ? 'Diese Saison noch nicht gespielt' : `${zahl(f.rating)} · Liga ${f.liga}`}</span>
					</span>
					<span class="aktionen">
						{#if f.laufendesDuell}
							<a class="knopf klein" class:sonne={f.laufendesDuell.duBistDran} href="/duell/{f.laufendesDuell.id}">{f.laufendesDuell.duBistDran ? 'Du bist dran' : 'Zum Duell'}</a>
						{:else}
							<a class="knopf klein" href="/duell/neu?gegner={encodeURIComponent(f.username)}">Herausfordern</a>
						{/if}
						<button class="entfernen" disabled={!js.bereit || beschaeftigt === f.id} onclick={() => beenden(f.id, f.username)} aria-label="Freundschaft mit {f.username} beenden">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
						</button>
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="karte leer">
			<div class="halmi">
				<Halmi pose="winken" groesse={84} />
				<Sprechblase>Zu zweit macht's mehr Spaß!</Sprechblase>
			</div>
			<p class="hinweis">
				Gib oben einen Benutzernamen ein. Sobald die Anfrage angenommen ist, siehst du hier Rating und Liga eurer Freunde und könnt
				euch direkt herausfordern.
			</p>
		</div>
	{/if}
</section>

{#if l.vorschlaege.length}
	<section aria-labelledby="vorschlaege-titel">
		<h2 id="vorschlaege-titel" class="abschnitt-titel">Zuletzt gespielt gegen</h2>
		<ul class="liste karte">
			{#each l.vorschlaege as v (v.id)}
				<li>
					<span class="avatar" aria-hidden="true">{v.username.slice(0, 1).toUpperCase()}</span>
					<span class="text"><strong>{v.username}</strong></span>
					<span class="aktionen">
						<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === v.id} onclick={() => vorschlagAnfragen(v.id, v.username)} aria-label="{v.username} als Freund anfragen">Anfragen</button>
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if l.gesendet.length}
	<section aria-labelledby="gesendet-titel">
		<h2 id="gesendet-titel" class="abschnitt-titel">Warten auf Antwort</h2>
		<ul class="liste karte">
			{#each l.gesendet as a (a.id)}
				<li>
					<span class="avatar" aria-hidden="true">{a.username.slice(0, 1).toUpperCase()}</span>
					<span class="text"><strong>{a.username}</strong><span class="unterzeile">angefragt {wann(a.seit)}</span></span>
					<span class="aktionen">
						<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === a.id} onclick={() => entfernen(a.id)} aria-label="Anfrage an {a.username} zurückziehen">Zurückziehen</button>
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding-top: 1rem;
		margin-bottom: 0.9rem;
	}
	.kopf h1 {
		margin: 0;
	}
	.chip {
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		background: var(--himmel);
		border: 2px solid var(--kontur);
		color: var(--text);
		font-weight: 800;
		font-size: 0.85rem;
		text-decoration: none;
	}
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
	.aktionen {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.entfernen {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--text-2);
		cursor: pointer;
	}
	.entfernen:hover {
		background: var(--falsch-hell);
		color: var(--falsch);
	}
	.leer {
		display: grid;
		gap: 0.6rem;
	}
	.leer p {
		margin: 0;
	}
	.halmi {
		display: flex;
		align-items: flex-end;
		gap: 0.3rem;
	}
	.halmi :global(.blase) {
		margin-bottom: 1.4rem;
	}
	@media (max-width: 380px) {
		/* Knöpfe unter den Namen, damit der Name lesbar bleibt */
		.liste li {
			grid-template-columns: 40px minmax(0, 1fr);
		}
		.aktionen {
			grid-column: 2;
		}
	}
</style>
