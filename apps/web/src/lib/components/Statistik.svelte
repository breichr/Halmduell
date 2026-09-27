<script lang="ts">
	import { quote, saisonBezeichnung, type DuellAusgang, type Statistik } from '@halmduell/shared';
	import KategorieSymbol from '$lib/components/KategorieSymbol.svelte';
	import { KATEGORIE_FARBE, kategorieName } from '$lib/format';

	let { statistik: s }: { statistik: Statistik } = $props();

	/** Ab so vielen beantworteten Fragen gilt eine Kategorie für Stärke/Übungsbedarf */
	const MINDESTENS = 5;

	const zahl = (n: number) => n.toLocaleString('de-DE');
	const gesamtQuote = $derived(quote(s.fragen));
	const leer = $derived(s.duelle.gespielt === 0 && s.fragen.beantwortet === 0);

	const AUSGANG: Record<DuellAusgang, { kurz: string; name: string; mehrzahl: string }> = {
		sieg: { kurz: 'S', name: 'Sieg', mehrzahl: 'Siege' },
		unentschieden: { kurz: 'U', name: 'Unentschieden', mehrzahl: 'Unentschieden' },
		niederlage: { kurz: 'N', name: 'Niederlage', mehrzahl: 'Niederlagen' }
	};

	// Stärkste und schwächste Kategorie, sobald genug Fragen beantwortet sind
	const bewertet = $derived(
		s.kategorien
			.filter((k) => k.beantwortet >= MINDESTENS)
			.map((k) => ({ ...k, prozent: quote(k)! }))
			.sort((a, b) => b.prozent - a.prozent)
	);
	const staerke = $derived(bewertet.length >= 2 && bewertet[0]!.prozent > bewertet.at(-1)!.prozent ? bewertet[0] : null);
	const schwaeche = $derived(staerke ? bewertet.at(-1) : null);

	const sekunden = (ms: number) => (ms / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
</script>

{#if leer}
	<section class="karte leer" aria-labelledby="statistik-titel">
		<h2 id="statistik-titel">Deine Statistik</h2>
		<p class="hinweis">Nach deinem ersten Duell siehst du hier Bilanz, Trefferquote je Kategorie und deine Ratings.</p>
		<a class="knopf klein" href="/duell/neu">Duell starten</a>
	</section>
{:else}
	<section class="karte" aria-labelledby="bilanz-titel">
		<h2 id="bilanz-titel">Bilanz</h2>
		<dl class="bilanz">
			<div class="sieg"><dt>Siege</dt><dd>{zahl(s.duelle.siege)}</dd></div>
			<div class="unentschieden"><dt>Unentschieden</dt><dd>{zahl(s.duelle.unentschieden)}</dd></div>
			<div class="niederlage"><dt>Niederlagen</dt><dd>{zahl(s.duelle.niederlagen)}</dd></div>
		</dl>
		{#if s.form.length}
			<div class="form-zeile">
				<span class="form-titel" id="form-titel">Form <span class="hinweis">(neueste zuerst)</span></span>
				<ol class="form" aria-labelledby="form-titel">
					{#each s.form as ausgang, i (i)}
						<li class={ausgang} title={AUSGANG[ausgang].name}>
							<span aria-hidden="true">{AUSGANG[ausgang].kurz}</span><span class="nur-screenreader">{AUSGANG[ausgang].name}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
		{#if s.serie}
			<p class="serie {s.serie.ausgang}">
				{s.serie.laenge}
				{AUSGANG[s.serie.ausgang].mehrzahl} in Folge{s.serie.ausgang === 'sieg' ? ' – weiter so!' : ''}
			</p>
		{/if}
		{#if s.duelle.gespielt === 0}
			<p class="hinweis">Noch kein Duell abgeschlossen.</p>
		{/if}
	</section>

	<section class="karte" aria-labelledby="treffer-titel">
		<h2 id="treffer-titel">Trefferquote</h2>
		<div class="quote-kopf">
			<span class="quote-gross">{gesamtQuote ?? '–'}<small>%</small></span>
			<ul class="eckdaten">
				<li><strong>{zahl(s.fragen.richtig)}</strong> von {zahl(s.fragen.beantwortet)} Fragen richtig</li>
				{#if s.fragen.schnittRichtigMs !== null}
					<li>Ø <strong>{sekunden(s.fragen.schnittRichtigMs)} s</strong> bis zur richtigen Antwort</li>
				{/if}
				{#if s.fragen.abgelaufen}
					<li><strong>{zahl(s.fragen.abgelaufen)}×</strong> Zeit abgelaufen</li>
				{/if}
			</ul>
		</div>

		<ul class="kategorien">
			{#each s.kategorien as k (k.kategorie)}
				{@const prozent = quote(k)}
				<li style="--farbe: {KATEGORIE_FARBE[k.kategorie]}; --anteil: {prozent ?? 0}%">
					<span class="symbol" aria-hidden="true"><KategorieSymbol kategorie={k.kategorie} groesse={24} /></span>
					<span class="name">{kategorieName(k.kategorie)}</span>
					<span class="wert">{prozent === null ? '–' : `${prozent} %`}</span>
					<span class="balken" aria-hidden="true"><span></span></span>
					<span class="anzahl">{k.beantwortet ? `${zahl(k.richtig)} von ${zahl(k.beantwortet)} richtig` : 'noch keine Fragen'}</span>
				</li>
			{/each}
		</ul>

		{#if staerke && schwaeche}
			<p class="tipp">
				<strong>Stärke:</strong> {kategorieName(staerke.kategorie)} · <strong>Übungsbedarf:</strong>
				<a href="/ueben/spielen?kategorie={schwaeche.kategorie}">{kategorieName(schwaeche.kategorie)} üben</a>
			</p>
		{/if}
	</section>

	<section class="karte" aria-labelledby="ratings-titel">
		<h2 id="ratings-titel">Ratings {saisonBezeichnung(s.saison)}</h2>
		<ul class="ratings">
			{#each s.ratings as r (r.kategorie)}
				<li class:gesamt={r.kategorie === 'gesamt'}>
					<a href={r.kategorie === 'gesamt' ? '/rangliste' : `/rangliste?kategorie=${r.kategorie}`}>
						<span class="name">{kategorieName(r.kategorie)}</span>
						<span class="rating">{r.rating === null ? '–' : zahl(r.rating)}</span>
						<span class="liga">{r.liga ?? 'nicht gespielt'}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	section {
		margin-top: 1.1rem;
	}
	h2 {
		margin: 0 0 0.7rem;
	}
	.leer {
		display: grid;
		justify-items: start;
	}
	.leer h2 {
		margin-bottom: 0.3rem;
	}
	.leer p {
		margin: 0 0 0.7rem;
	}

	/* Bilanz */
	.bilanz {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0;
	}
	.bilanz div {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		padding: 0.6rem 0.2rem;
		border: 2px solid var(--kontur);
		border-radius: var(--radius-klein);
	}
	.bilanz dt {
		font-size: 0.8rem;
		font-weight: 800;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bilanz dd {
		margin: 0;
		font-family: var(--schrift-titel);
		font-size: 1.9rem;
		font-weight: 800;
		line-height: 1.1;
	}
	.sieg {
		background: var(--richtig-hell);
		color: var(--richtig);
	}
	.unentschieden {
		background: var(--grund);
		color: var(--text-2);
	}
	.niederlage {
		background: var(--falsch-hell);
		color: var(--falsch);
	}
	.form-zeile {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.8rem;
	}
	.form-titel {
		font-weight: 800;
		font-size: 0.9rem;
	}
	.form {
		display: flex;
		gap: 4px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.form li {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid currentColor;
		font-size: 0.72rem;
		font-weight: 800;
	}
	.form-titel .hinweis {
		font-size: 0.8rem;
		font-weight: 600;
	}
	.serie {
		display: inline-block;
		margin: 0.7rem 0 0;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		border: 2px solid currentColor;
		font-weight: 800;
		font-size: 0.9rem;
	}
	.serie.sieg {
		background: var(--sonne);
		color: var(--auf-farbe);
		border-color: var(--kontur);
	}

	/* Trefferquote */
	.quote-kopf {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.quote-gross {
		flex: none;
		font-family: var(--schrift-titel);
		font-size: 3rem;
		font-weight: 800;
		line-height: 1;
		color: var(--gruen-dunkel);
	}
	.quote-gross small {
		font-size: 1.4rem;
	}
	.eckdaten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.15rem;
		font-size: 0.9rem;
		color: var(--text-2);
	}
	.eckdaten strong {
		color: var(--text);
	}
	.kategorien {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.8rem;
	}
	.kategorien li {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) auto;
		column-gap: 0.6rem;
		row-gap: 0.2rem;
		align-items: center;
	}
	.symbol {
		grid-row: span 3;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--farbe);
		color: #2a1c14;
		border: 2px solid var(--kontur);
	}
	.kategorien .name {
		font-weight: 800;
	}
	.wert {
		font-weight: 800;
	}
	.balken {
		grid-column: 2 / -1;
		height: 12px;
		border-radius: 999px;
		border: 2px solid var(--kontur);
		background: var(--grund);
		overflow: hidden;
	}
	.balken span {
		display: block;
		width: var(--anteil);
		height: 100%;
		background: var(--farbe);
	}
	.anzahl {
		grid-column: 2 / -1;
		font-size: 0.8rem;
		color: var(--text-2);
	}
	.tipp {
		margin: 1rem 0 0;
		padding-top: 0.8rem;
		border-top: 2px dashed var(--linie-leise);
		font-size: 0.95rem;
	}
	.tipp a {
		font-weight: 800;
		color: var(--gruen-dunkel);
	}

	/* Ratings */
	.ratings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.ratings .gesamt {
		grid-column: 1 / -1;
	}
	.ratings a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: 0.4rem;
		padding: 0.5rem 0.7rem;
		border: 2px solid var(--kontur);
		border-radius: var(--radius-klein);
		color: var(--text);
		text-decoration: none;
	}
	.ratings .gesamt a {
		background: var(--himmel);
	}
	.ratings .name {
		font-weight: 800;
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ratings .rating {
		font-family: var(--schrift-titel);
		font-weight: 800;
		font-size: 1.2rem;
	}
	.ratings .liga {
		grid-column: 1 / -1;
		font-size: 0.8rem;
		font-weight: 600;
		opacity: 0.8;
	}
</style>
