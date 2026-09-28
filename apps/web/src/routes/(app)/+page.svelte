<script lang="ts">
	import { onMount } from 'svelte';
	import { aktuelleSaison, saisonBezeichnung } from '@halmduell/shared';
	import AppInstallieren from '$lib/components/AppInstallieren.svelte';
	import Benachrichtigungen from '$lib/components/Benachrichtigungen.svelte';
	import { installation } from '$lib/installation.svelte';
	import DuellKarte from '$lib/components/DuellKarte.svelte';
	import Halmi from '$lib/components/Halmi.svelte';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import Landschaft from '$lib/components/Landschaft.svelte';
	import Sprechblase from '$lib/components/Sprechblase.svelte';
	import { kategorieName, restzeit } from '$lib/format';

	let { data } = $props();

	// Installationshinweis auf der Übersicht ist ausblendbar (bleibt im Profil verfügbar)
	const HINWEIS_AUS = 'halmduell:installhinweis-aus';
	let installHinweis = $state(false);
	// ebenso der Hinweis auf Benachrichtigungen (Schalter bleibt im Profil)
	const PUSH_HINWEIS_AUS = 'halmduell:pushhinweis-aus';
	let pushHinweis = $state(false);
	onMount(() => {
		try {
			installHinweis = localStorage.getItem(HINWEIS_AUS) !== '1';
			pushHinweis = localStorage.getItem(PUSH_HINWEIS_AUS) !== '1';
		} catch {
			installHinweis = true;
			pushHinweis = true;
		}
	});
	function ausblenden(schluessel: string) {
		try {
			localStorage.setItem(schluessel, '1');
		} catch {
			// privater Modus o. Ä. – dann eben nur für diese Sitzung
		}
	}
	function hinweisAusblenden() {
		installHinweis = false;
		ausblenden(HINWEIS_AUS);
	}
	function pushHinweisAusblenden() {
		pushHinweis = false;
		ausblenden(PUSH_HINWEIS_AUS);
	}
	// Nie zwei Hinweise übereinander – erst installieren, dann Benachrichtigungen
	const installSichtbar = $derived(installHinweis && (installation.moeglich || installation.nurManuellIos));

	const dran = $derived(data.duelle.filter((d) => d.duBistDran));
	const wartend = $derived(data.duelle.filter((d) => !d.duBistDran && (d.status === 'wartet_a' || d.status === 'wartet_b')));
	const beendet = $derived(data.duelle.filter((d) => d.status === 'abgeschlossen' || d.status === 'abgebrochen'));

	const pose = $derived(dran.length ? 'winken' : wartend.length ? 'schlafen' : 'denken');
	const blase = $derived.by(() => {
		const erster = dran.find((d) => d.gegner);
		if (erster) return `${erster.gegner!.username} wartet auf dich!`;
		if (dran.length) return 'Du kannst schon loslegen!';
		if (wartend.length) return 'Die anderen sind dran. Zeit für ein neues Duell?';
		return 'Fordere jemanden heraus!';
	});
</script>

<svelte:head><title>Übersicht – Halmduell</title></svelte:head>

<Landschaft hoehe={236}>
	<div class="kopf">
		<span class="marke" aria-hidden="true">Halmduell</span>
		<a href="/profil" class="avatar" aria-label="Profil von {data.user.username}">{data.user.username.slice(0, 1).toUpperCase()}</a>
	</div>
	<div class="gruss">
		<div class="text">
			<h1>Hallo {data.user.username}!</h1>
			<Sprechblase>{blase}</Sprechblase>
		</div>
		<Halmi {pose} groesse={116} />
	</div>
</Landschaft>

<div class="chips">
	<span class="chip">Saison {saisonBezeichnung(aktuelleSaison())}</span>
	{#if dran.length}<span class="chip sonne">{dran.length} × du bist dran</span>{/if}
</div>

{#each dran as duel (duel.id)}
	<section class="hero" aria-label="Du bist dran gegen {duel.gegner?.username ?? 'offene Einladung'}">
		<div class="hero-kopf">
			<span class="hero-avatar" aria-hidden="true">
				{#if duel.gegner}{duel.gegner.username.slice(0, 1).toUpperCase()}{:else}<KategorieSymbol kategorie={duel.kategorie} groesse={24} />{/if}
			</span>
			<span class="hero-text">
				<strong>Du bist dran!</strong>
				<span>{duel.gegner ? `gegen ${duel.gegner.username}` : 'Einladung offen'} · {kategorieName(duel.kategorie)}</span>
				{#if duel.zugBis}<span class="frist">{restzeit(duel.zugBis)}</span>{/if}
			</span>
		</div>
		<div class="hero-knoepfe">
			<a class="knopf breit" href="/duell/{duel.id}/spielen" data-sveltekit-preload-data="off">Los geht's!</a>
			<a class="knopf zweitrangig klein" href="/duell/{duel.id}" aria-label="Details zum Duell">Details</a>
		</div>
	</section>
{/each}

<a href="/duell/neu" class="knopf sonne breit neu">＋ Neues Duell starten</a>

{#if installHinweis}
	<AppInstallieren schliessbar onschliessen={hinweisAusblenden} />
{/if}
{#if pushHinweis && !installSichtbar}
	<Benachrichtigungen art="hinweis" onschliessen={pushHinweisAusblenden} />
{/if}

{#if data.ueben && data.ueben.offen > 0}
	<a class="karte ueben" href="/ueben">
		<span class="ueben-symbol" aria-hidden="true">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
		</span>
		<span class="ueben-text">
			<strong>Fehler üben</strong>
			<span>{data.ueben.offen === 1 ? '1 Frage wartet' : `${data.ueben.offen} Fragen warten`} aufs Nachlernen</span>
		</span>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
	</a>
{/if}

{#if data.duelle.length === 0}
	<div class="karte leer">
		<p><strong>Noch keine Duelle.</strong></p>
		<p class="hinweis">Spiel gegen einen zufälligen Gegner, schick einen Einladungslink per WhatsApp & Co. – oder fordere jemanden per Benutzername heraus.</p>
	</div>
{/if}

{#each [{ titel: 'Warten auf den Gegner', liste: wartend }, { titel: 'Beendet', liste: beendet }] as abschnitt (abschnitt.titel)}
	{#if abschnitt.liste.length}
		<section>
			<h2 class="abschnitt-titel">{abschnitt.titel}</h2>
			<ul>
				{#each abschnitt.liste as duel (duel.id)}
					<li><DuellKarte {duel} /></li>
				{/each}
			</ul>
		</section>
	{/if}
{/each}

<style>
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.9rem;
	}
	.marke {
		font-family: var(--schrift-titel);
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--gruen-dunkel);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--flaeche);
		border: 3px solid var(--kontur);
		color: var(--text);
		text-decoration: none;
	}
	.gruss {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0 2.2rem;
	}
	.text {
		display: grid;
		gap: 0.45rem;
		max-width: 15rem;
	}
	.text h1 {
		margin: 0;
		font-size: 2rem;
		overflow-wrap: anywhere;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.9rem 0;
	}
	.chip {
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		background: var(--flaeche);
		border: 2px solid var(--kante);
		font-weight: 800;
		font-size: 0.9rem;
	}
	.chip.sonne {
		background: var(--sonne);
		color: var(--auf-farbe);
		border-color: var(--kontur);
	}
	.hero {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		margin-bottom: 0.9rem;
		background: var(--sonne);
		color: var(--auf-farbe);
		border: 3px solid var(--kontur);
		border-bottom-width: 6px;
		border-radius: var(--radius);
	}
	.hero-kopf {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.hero-avatar {
		flex: none;
		display: grid;
		place-items: center;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		background: #ffffff;
		border: 3px solid var(--kontur);
		font-family: var(--schrift-titel);
		font-size: 1.4rem;
		font-weight: 800;
		color: #2a1c14;
	}
	.hero-text {
		flex: 1;
		display: grid;
		min-width: 0;
	}
	.hero-text strong {
		font-family: var(--schrift-titel);
		font-size: 1.4rem;
		line-height: 1.1;
	}
	.hero-text span {
		font-weight: 800;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hero-text .frist {
		font-size: 0.85rem;
		color: #4a3a30;
	}
	.hero-knoepfe {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.6rem;
		align-items: stretch;
	}
	.hero-knoepfe .klein {
		min-height: 54px;
	}
	.neu {
		margin-bottom: 0.5rem;
	}
	.leer {
		margin-top: 1rem;
	}
	.leer p {
		margin: 0 0 0.3rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.ueben {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-bottom: 0.9rem;
		color: var(--text);
		text-decoration: none;
	}
	.ueben-symbol {
		flex: none;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--orange);
		color: #2a1c14;
		border: 2px solid var(--kontur);
	}
	.ueben-text {
		flex: 1;
		display: grid;
	}
	.ueben-text span {
		font-size: 0.9rem;
		color: var(--text-2);
	}
</style>
