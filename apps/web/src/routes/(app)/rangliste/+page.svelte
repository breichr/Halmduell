<script lang="ts">
	import { RATING_KATEGORIEN, saisonBezeichnung, saisonEnde, type RanglistenEintrag, type RatingKategorie } from '@halmduell/shared';
	import Halmi from '$lib/components/Halmi.svelte';
	import { hydriert } from '$lib/hydriert.svelte';
	import { kategorieName, restzeit } from '$lib/format';

	const js = hydriert();

	let { data } = $props();

	const r = $derived(data.rangliste);
	const laufend = $derived(r.saison === r.aktuelleSaison);
	const podest = $derived(r.eintraege.slice(0, 3));
	const rest = $derived(r.eintraege.slice(3));
	// Eigener Platz liegt außerhalb der gezeigten Plätze → unten extra anhängen
	const ichExtra = $derived(r.ich && !r.eintraege.some((e) => e.id === r.ich!.id) ? r.ich : null);
	// Podest in der Reihenfolge 2 – 1 – 3
	const podestReihe = $derived([podest[1], podest[0], podest[2]].filter((e): e is RanglistenEintrag => !!e));

	const zahl = (n: number) => n.toLocaleString('de-DE');
	const istIch = (e: RanglistenEintrag) => e.id === r.ich?.id;

	function link(kategorie: RatingKategorie, saison = r.saison) {
		const query = new URLSearchParams();
		if (kategorie !== 'gesamt') query.set('kategorie', kategorie);
		if (saison !== r.aktuelleSaison) query.set('saison', String(saison));
		return query.size ? `/rangliste?${query}` : '/rangliste';
	}

	function saisonWaehlen(event: Event) {
		(event.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<svelte:head><title>Rangliste – Halmduell</title></svelte:head>

<header class="kopf">
	<h1>Rangliste</h1>
	<span class="chip saison">
		{saisonBezeichnung(r.saison)} · {laufend ? restzeit(saisonEnde(r.saison).toISOString()) : 'beendet'}
	</span>
</header>

<nav class="kategorien" aria-label="Kategorie">
	{#each RATING_KATEGORIEN as k (k)}
		<a href={link(k)} class="chip" aria-current={k === r.kategorie ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-replacestate>
			{kategorieName(k)}
		</a>
	{/each}
</nav>

{#if r.ich}
	<p class="ich-zeile" data-testid="eigener-platz">
		Du bist auf <strong>Platz {r.ich.platz}</strong> von {zahl(r.spielerAnzahl)} · {zahl(r.ich.rating)} · Liga {r.ich.liga}
	</p>
{/if}

{#if r.eintraege.length === 0}
	<div class="karte leer">
		<Halmi pose="schlafen" groesse={96} />
		<p>
			<strong>Noch niemand platziert.</strong><br />
			<span class="hinweis">
				{#if laufend}
					Wer in {r.kategorie === 'gesamt' ? 'dieser Saison' : `„${kategorieName(r.kategorie)}“`} ein Duell abschließt, landet hier.
				{:else}
					In dieser Saison wurde in dieser Kategorie nicht gespielt.
				{/if}
			</span>
		</p>
		{#if laufend}<a class="knopf klein" href="/duell/neu">Duell starten</a>{/if}
	</div>
{:else}
	<ol class="podest" class:mit-liste={rest.length > 0 || ichExtra} aria-label="Die ersten drei" style="--anzahl: {podestReihe.length}">
		{#each podestReihe as e (e.id)}
			{@const stufe = podest.indexOf(e)}
			<li class="stufe-{stufe + 1}" class:ich={istIch(e)}>
				{#if stufe === 0}
					<svg class="krone" width="30" height="22" viewBox="0 0 30 22" aria-hidden="true"><path d="M2 20 L4 6 L10 12 L15 2 L20 12 L26 6 L28 20 Z" fill="var(--sonne)" stroke="var(--kontur)" stroke-width="2" stroke-linejoin="round" /></svg>
				{/if}
				<span class="avatar" aria-hidden="true">{e.username.slice(0, 1).toUpperCase()}</span>
				<span class="name">{istIch(e) ? 'Du' : e.username}</span>
				<span class="sockel">
					<span class="platz"><span class="nur-screenreader">Platz </span>{e.platz}</span>
					<span class="rating">{zahl(e.rating)}</span>
				</span>
			</li>
		{/each}
	</ol>

	{#if rest.length || ichExtra}
		<ol class="liste karte" aria-label="Weitere Plätze">
			{#each rest as e (e.id)}
				{@render zeile(e)}
			{/each}
			{#if ichExtra}
				<li class="luecke" aria-hidden="true">…</li>
				{@render zeile(ichExtra)}
			{/if}
		</ol>
	{/if}
{/if}

{#if !r.ich && laufend && r.eintraege.length > 0}
	<div class="karte mitmachen">
		<Halmi pose="denken" groesse={72} halm={false} />
		<p>
			<strong>Du bist noch nicht platziert.</strong><br />
			<span class="hinweis">
				Schließ ein Duell {r.kategorie === 'gesamt' ? '' : `in „${kategorieName(r.kategorie)}“ `}ab, dann stehst du hier.
			</span>
		</p>
	</div>
{/if}

{#if r.saisons.length > 1}
	<form method="get" action="/rangliste" class="saisonwahl">
		{#if r.kategorie !== 'gesamt'}<input type="hidden" name="kategorie" value={r.kategorie} />{/if}
		<label for="saison">Saison</label>
		<select id="saison" name="saison" value={String(r.saison)} onchange={saisonWaehlen}>
			{#each r.saisons as s (s)}
				<option value={String(s)}>{saisonBezeichnung(s)}{s === r.aktuelleSaison ? ' (läuft)' : ''}</option>
			{/each}
		</select>
		{#if !js.bereit}<button class="knopf zweitrangig klein">Anzeigen</button>{/if}
	</form>
{/if}

{#snippet zeile(e: RanglistenEintrag)}
	<li class:ich={istIch(e)}>
		<span class="platz"><span class="nur-screenreader">Platz </span>{e.platz}</span>
		<span class="avatar klein" aria-hidden="true">{e.username.slice(0, 1).toUpperCase()}</span>
		<span class="name">{istIch(e) ? 'Du' : e.username}<span class="liga">{' · '}{e.liga}</span></span>
		<span class="rating">{zahl(e.rating)}</span>
	</li>
{/snippet}

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
		background: var(--flaeche);
		border: 2px solid var(--kontur);
		color: var(--text);
		font-weight: 800;
		font-size: 0.9rem;
		white-space: nowrap;
		text-decoration: none;
	}
	.chip.saison {
		background: var(--himmel);
		font-size: 0.8rem;
	}
	.kategorien {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}
	.kategorien .chip {
		display: grid;
		place-items: center;
		min-height: 40px;
	}
	.kategorien .chip[aria-current='page'] {
		background: var(--gruen);
		color: var(--gruen-text);
	}
	.ich-zeile {
		margin: 0 0 0.8rem;
		color: var(--text-2);
		font-size: 0.95rem;
	}
	.ich-zeile strong {
		color: var(--text);
	}

	/* Podest */
	.podest {
		list-style: none;
		margin: 0.4rem 0 0;
		padding: 0 0.4rem;
		display: grid;
		/* bei weniger als drei Platzierten bleibt das Podest mittig */
		grid-template-columns: repeat(var(--anzahl), minmax(0, calc((100% - 1rem) / 3)));
		justify-content: center;
		gap: 0.5rem;
		align-items: end;
	}
	.podest li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}
	.podest .name {
		font-weight: 800;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: var(--flaeche);
		border: 3px solid var(--kontur);
		font-family: var(--schrift-titel);
		font-size: 1.4rem;
		font-weight: 800;
	}
	.stufe-1 .avatar {
		width: 62px;
		height: 62px;
		font-size: 1.6rem;
		background: var(--himmel);
	}
	.ich .avatar {
		background: var(--sonne);
		color: var(--auf-farbe);
	}
	.sockel {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 3px solid var(--kontur);
		border-bottom: 0;
		border-radius: 14px 14px 0 0;
		color: var(--auf-farbe);
		font-weight: 800;
	}
	.sockel .platz {
		font-family: var(--schrift-titel);
		font-size: 1.9rem;
		line-height: 1;
	}
	.stufe-1 .sockel {
		height: 118px;
		background: var(--sonne);
	}
	.stufe-1 .sockel .platz {
		font-size: 2.3rem;
	}
	.stufe-2 .sockel {
		height: 86px;
		background: #d7dee4;
	}
	.stufe-3 .sockel {
		height: 66px;
		background: #e6b98e;
	}
	/* Ohne Liste darunter bekommen die Sockel eine eigene Unterkante */
	.podest:not(.mit-liste) .sockel {
		border-bottom: 3px solid var(--kontur);
		border-radius: 14px;
	}

	/* Liste ab Platz 4 */
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		border-width: 3px;
		border-color: var(--kontur);
		border-radius: 0 0 var(--radius) var(--radius);
		overflow: hidden;
	}
	.liste li {
		display: grid;
		grid-template-columns: 2rem 40px minmax(0, 1fr) auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.6rem 0.8rem;
		border-bottom: 2px dashed var(--linie-leise);
		font-weight: 800;
	}
	.liste li:last-child {
		border-bottom: 0;
	}
	.liste .platz {
		font-family: var(--schrift-titel);
		font-size: 1.15rem;
		color: var(--text-2);
		text-align: center;
	}
	.avatar.klein {
		width: 36px;
		height: 36px;
		border-width: 2px;
		font-family: var(--schrift);
		font-size: 1rem;
	}
	.liste .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.liga {
		font-weight: 600;
		color: var(--text-2);
		font-size: 0.85rem;
	}
	.liste li.ich {
		background: var(--gruen-hell);
	}
	.liste li.ich .platz {
		color: var(--gruen-dunkel);
	}
	.liste li.luecke {
		display: block;
		padding: 0.2rem;
		text-align: center;
		color: var(--text-2);
	}

	.leer,
	.mitmachen {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		text-align: center;
	}
	.mitmachen {
		grid-template-columns: auto 1fr;
		justify-items: start;
		text-align: left;
		margin-top: 0.9rem;
	}
	.leer p,
	.mitmachen p {
		margin: 0;
	}

	.saisonwahl {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1.2rem;
		font-weight: 800;
	}
	.saisonwahl select {
		min-height: 44px;
		padding: 0 0.7rem;
		border: 2px solid var(--kante);
		border-radius: var(--radius-klein);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
	}
</style>
