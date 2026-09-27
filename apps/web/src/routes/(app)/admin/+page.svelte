<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { FRAGEN_KATEGORIEN, FRAGEN_PRO_DUELL, type AdminFrage, type FrageStatus } from '@halmduell/shared';
	import { api, ApiError } from '$lib/api';
	import { hydriert } from '$lib/hydriert.svelte';
	import { KATEGORIE_FARBE, kategorieName } from '$lib/format';
	import { STATUS_NAMEN } from '$lib/components/admin/status';

	const js = hydriert();

	let { data } = $props();
	const l = $derived(data.liste);

	const FILTER: { wert: string; name: string }[] = [
		{ wert: 'entwurf', name: 'Entwürfe' },
		{ wert: 'freigegeben', name: 'Freigegeben' },
		{ wert: 'abgelehnt', name: 'Abgelehnt' },
		{ wert: 'alle', name: 'Alle' }
	];

	function link(status: string) {
		const q = new URLSearchParams();
		if (status !== 'entwurf') q.set('status', status);
		if (data.kategorie) q.set('kategorie', data.kategorie);
		if (data.suche) q.set('suche', data.suche);
		return q.size ? `/admin?${q}` : '/admin';
	}

	let beschaeftigt = $state<number | null>(null);
	let fehler = $state('');

	async function statusSetzen(f: AdminFrage, status: FrageStatus) {
		beschaeftigt = f.id;
		fehler = '';
		try {
			await api().post(`/admin/fragen/${f.id}/status`, { status });
			await invalidate('app:admin');
		} catch (e) {
			fehler = e instanceof ApiError ? e.message : 'Status konnte nicht gesetzt werden';
		} finally {
			beschaeftigt = null;
		}
	}

	const quote = (f: AdminFrage) => (f.statistik.beantwortet ? Math.round((f.statistik.richtig / f.statistik.beantwortet) * 100) : null);
	const offen = $derived(l.uebersicht.reduce((s, k) => s + k.entwurf + k.eingereicht, 0));
</script>

<svelte:head><title>Admin-Portal – Halmduell</title></svelte:head>

<header class="kopf">
	<h1>Admin-Portal</h1>
	<div class="knoepfe">
		<a class="knopf klein" href="/admin/fragen/neu">＋ Neue Frage</a>
		<a class="knopf klein zweitrangig" href="/api/admin/fragen.csv" download>CSV exportieren</a>
	</div>
</header>

<section aria-labelledby="stand-titel">
	<h2 id="stand-titel" class="abschnitt-titel">Fragen je Kategorie{offen ? ` · ${offen} zu prüfen` : ''}</h2>
	<ul class="stand">
		{#each l.uebersicht as k (k.kategorie)}
			<li style="--farbe: {KATEGORIE_FARBE[k.kategorie]}" class:zu-wenig={k.freigegeben < FRAGEN_PRO_DUELL}>
				<strong>{kategorieName(k.kategorie)}</strong>
				<span class="zahl">{k.freigegeben}</span>
				<span class="klein">freigegeben{k.entwurf ? ` · ${k.entwurf} Entwurf` : ''}{k.eingereicht ? ` · ${k.eingereicht} eingereicht` : ''}</span>
				{#if k.freigegeben < FRAGEN_PRO_DUELL}<span class="warnung">Duelle erst ab {FRAGEN_PRO_DUELL}</span>{/if}
			</li>
		{/each}
	</ul>
</section>

<nav class="filter" aria-label="Status">
	{#each FILTER as f (f.wert)}
		<a href={link(f.wert)} aria-current={data.status === f.wert ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate>{f.name}</a>
	{/each}
</nav>

<form method="get" action="/admin" class="suche" data-sveltekit-replacestate data-sveltekit-noscroll>
	{#if data.status !== 'entwurf'}<input type="hidden" name="status" value={data.status} />{/if}
	<select name="kategorie" value={data.kategorie} aria-label="Kategorie" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
		<option value="">Alle Kategorien</option>
		{#each FRAGEN_KATEGORIEN as k (k)}<option value={k}>{kategorieName(k)}</option>{/each}
	</select>
	<input type="search" name="suche" value={data.suche} placeholder="Suchen (Frage, Antwort, Code)" aria-label="Suchen" />
	<button class="knopf klein zweitrangig">Suchen</button>
</form>

{#if fehler}<p class="fehlermeldung" role="alert">{fehler}</p>{/if}

<p class="anzahl">{l.fragen.length === 1 ? '1 Frage' : `${l.fragen.length} Fragen`}</p>

{#if l.fragen.length === 0}
	<p class="karte leer">Keine Fragen für diesen Filter.</p>
{:else}
	<ul class="fragen">
		{#each l.fragen as f (f.id)}
			<li class="karte" data-testid="admin-frage">
				<div class="zeile-kopf">
					<span class="code">{f.code ?? `#${f.id}`}</span>
					<span class="kat" style="--farbe: {KATEGORIE_FARBE[f.kategorie]}">{kategorieName(f.kategorie)}</span>
					<span class="status {f.status}">{STATUS_NAMEN[f.status]}</span>
					<span class="schwierigkeit" title="Schwierigkeit">Stufe {f.schwierigkeit}</span>
				</div>
				<p class="frage">{f.typ === 'bild' ? '🖼 ' : ''}{f.frage}</p>
				<ul class="antworten">
					<li class="richtig"><span aria-hidden="true">✓</span> {f.richtig}<span class="nur-screenreader"> (richtig)</span></li>
					{#each f.falsch as a, i (i)}<li><span aria-hidden="true">✗</span> {a}</li>{/each}
				</ul>
				{#if f.erklaerung}<p class="erklaerung">{f.erklaerung}</p>{/if}
				<div class="zeile-fuss">
					<span class="statistik">
						{f.statistik.beantwortet ? `${f.statistik.beantwortet}× gespielt · ${quote(f)} % richtig` : 'noch nicht gespielt'}
					</span>
					<span class="aktionen">
						{#if f.status !== 'freigegeben'}
							<button class="knopf klein" disabled={!js.bereit || beschaeftigt === f.id} onclick={() => statusSetzen(f, 'freigegeben')}>Freigeben</button>
						{/if}
						{#if f.status !== 'abgelehnt'}
							<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === f.id} onclick={() => statusSetzen(f, 'abgelehnt')}>Ablehnen</button>
						{/if}
						{#if f.status === 'abgelehnt' || f.status === 'freigegeben'}
							<button class="knopf klein zweitrangig" disabled={!js.bereit || beschaeftigt === f.id} onclick={() => statusSetzen(f, 'entwurf')}>Zurück zu Entwurf</button>
						{/if}
						<a class="knopf klein zweitrangig" href="/admin/fragen/{f.id}" aria-label="{f.code ?? f.id} bearbeiten">Bearbeiten</a>
					</span>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		padding-top: 1rem;
		margin-bottom: 1rem;
	}
	.kopf h1 {
		margin: 0;
	}
	.knoepfe {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.stand {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.5rem;
	}
	.stand li {
		display: grid;
		padding: 0.6rem 0.7rem;
		border: 2px solid var(--kontur);
		border-left: 8px solid var(--farbe);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
	}
	.stand .zahl {
		font-family: var(--schrift-titel);
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1.1;
	}
	.stand .klein {
		font-size: 0.8rem;
		color: var(--text-2);
	}
	.stand .warnung {
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--falsch);
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.7rem;
	}
	.filter a {
		display: grid;
		place-items: center;
		min-height: 40px;
		padding: 0 0.9rem;
		border-radius: 999px;
		border: 2px solid var(--kontur);
		background: var(--flaeche);
		color: var(--text);
		font-weight: 800;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.filter a[aria-current='page'] {
		background: var(--gruen);
		color: var(--gruen-text);
	}
	.suche {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
		gap: 0.4rem;
		margin-bottom: 0.6rem;
	}
	.suche select,
	.suche input {
		font: inherit;
		min-height: 44px;
		min-width: 0;
		padding: 0 0.6rem;
		border: 2px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
		color: var(--text);
	}
	@media (max-width: 420px) {
		.suche {
			grid-template-columns: 1fr auto;
		}
		.suche select {
			grid-column: 1 / -1;
		}
	}
	.anzahl {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--text-2);
	}
	.leer {
		text-align: center;
		color: var(--text-2);
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.7rem;
	}
	.fragen > li {
		display: grid;
		gap: 0.5rem;
	}
	.zeile-kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 800;
	}
	.code {
		font-family: ui-monospace, monospace;
		color: var(--text-2);
	}
	.kat,
	.status,
	.schwierigkeit {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		border: 1.5px solid var(--kontur);
	}
	.kat {
		background: var(--farbe);
		color: #2a1c14;
	}
	.status.entwurf,
	.status.eingereicht {
		background: var(--sonne);
		color: var(--auf-farbe);
	}
	.status.freigegeben {
		background: var(--richtig-hell);
		color: var(--richtig);
		border-color: currentColor;
	}
	.status.abgelehnt {
		background: var(--falsch-hell);
		color: var(--falsch);
		border-color: currentColor;
	}
	.schwierigkeit {
		color: var(--text-2);
		border-color: var(--linie-leise);
	}
	.frage {
		margin: 0;
		font-weight: 800;
		font-size: 1.05rem;
	}
	.antworten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.2rem 0.8rem;
		font-size: 0.9rem;
		color: var(--text-2);
	}
	.antworten .richtig {
		color: var(--richtig);
		font-weight: 800;
	}
	.erklaerung {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2);
		border-left: 3px solid var(--linie-leise);
		padding-left: 0.6rem;
	}
	.zeile-fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.4rem;
		border-top: 2px dashed var(--linie-leise);
	}
	.statistik {
		font-size: 0.8rem;
		color: var(--text-2);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
</style>
