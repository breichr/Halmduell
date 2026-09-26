<script lang="ts">
	import type { DuellUebersicht } from '@halmduell/shared';
	import { kategorieName, restzeit, vorzeichen, wann } from '$lib/format';

	let { duel }: { duel: DuellUebersicht } = $props();

	const beendet = $derived(duel.status === 'abgeschlossen' || duel.status === 'abgebrochen');
	const gegnerName = $derived(duel.gegner?.username ?? 'Offene Einladung');

	const statusText = $derived.by(() => {
		if (duel.status === 'abgebrochen') return 'Abgebrochen';
		if (duel.status === 'abgeschlossen') {
			if (duel.aufgegeben === 'ich') return 'Aufgegeben';
			if (duel.aufgegeben === 'gegner') return 'Gewonnen – Gegner hat aufgegeben';
			if (duel.meinePunkte > duel.gegnerPunkte) return 'Gewonnen';
			if (duel.meinePunkte < duel.gegnerPunkte) return 'Verloren';
			return 'Unentschieden';
		}
		if (duel.duBistDran) return 'Du bist dran';
		if (!duel.gegner) return 'Wartet, bis jemand die Einladung annimmt';
		return `Wartet auf ${duel.gegner.username}`;
	});

	const ergebnis = $derived.by(() => {
		if (duel.status !== 'abgeschlossen') return null;
		if (duel.aufgegeben === 'gegner' || (!duel.aufgegeben && duel.meinePunkte > duel.gegnerPunkte)) return 'sieg';
		if (duel.aufgegeben === 'ich' || duel.meinePunkte < duel.gegnerPunkte) return 'niederlage';
		return 'remis';
	});
</script>

<a href="/duell/{duel.id}" class="karte duell" class:dran={duel.duBistDran} data-testid="duell-karte">
	<span class="avatar" class:offen={!duel.gegner} aria-hidden="true">
		{#if duel.gegner}
			{duel.gegner.username.slice(0, 1).toUpperCase()}
		{:else}
			<!-- Link-Symbol für offene Einladungen -->
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
		{/if}
	</span>
	<span class="mitte">
		<span class="gegner">{gegnerName}</span>
		<span class="info">
			<span class="kategorie">{kategorieName(duel.kategorie)}</span>
			·
			<span class="status {ergebnis ?? ''}">{statusText}</span>
		</span>
		{#if duel.zugBis && !beendet}
			<span class="frist">{restzeit(duel.zugBis)}</span>
		{:else if duel.abgeschlossenAt}
			<span class="frist">{wann(duel.abgeschlossenAt)}</span>
		{/if}
	</span>
	<span class="rechts">
		{#if duel.status !== 'abgebrochen'}
			<span class="punkte" aria-label="{duel.meinePunkte} zu {duel.gegnerPunkte}">{duel.meinePunkte}:{duel.gegnerPunkte}</span>
		{/if}
		{#if duel.ratingAenderung !== null}
			<span class="rating" class:plus={duel.ratingAenderung > 0} class:minus={duel.ratingAenderung < 0}>
				{vorzeichen(duel.ratingAenderung)}
			</span>
		{/if}
	</span>
</a>

<style>
	.duell {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.85rem;
		color: var(--text);
		text-decoration: none;
		padding: 0.9rem 1rem;
		border: 2px solid transparent;
		transition: border-color 0.15s;
	}
	@media (hover: hover) {
		.duell:hover {
			border-color: var(--linie);
		}
	}
	.dran {
		border-color: var(--gruen);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		background: var(--gruen-hell);
		color: var(--gruen);
		font-weight: 700;
		font-size: 1.1rem;
	}
	.avatar.offen {
		background: var(--weizen-hell);
		color: var(--weizen);
	}
	.mitte {
		display: grid;
		min-width: 0;
	}
	.gegner {
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.info,
	.frist {
		font-size: 0.87rem;
		color: var(--text-2);
	}
	.dran .status {
		color: var(--gruen);
		font-weight: 600;
	}
	.status.sieg {
		color: var(--richtig);
		font-weight: 600;
	}
	.status.niederlage {
		color: var(--falsch);
	}
	.rechts {
		display: grid;
		justify-items: end;
	}
	.punkte {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.rating {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-2);
	}
	.rating.plus {
		color: var(--richtig);
	}
	.rating.minus {
		color: var(--falsch);
	}
</style>
