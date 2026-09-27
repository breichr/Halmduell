<script lang="ts">
	import type { DuellUebersicht } from '@halmduell/shared';
	import { kategorieName, restzeit, vorzeichen, wann } from '$lib/format';

	let { duel }: { duel: DuellUebersicht } = $props();

	const beendet = $derived(duel.status === 'abgeschlossen' || duel.status === 'abgebrochen');
	const gegnerName = $derived(duel.gegner?.username ?? (duel.zufall ? 'Zufälliger Gegner' : 'Offene Einladung'));

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
		if (!duel.gegner) return duel.zufall ? 'Gegner wird gesucht' : 'Wartet, bis jemand die Einladung annimmt';
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
		{:else if duel.zufall}
			<!-- Würfel: Zufallsgegner wird noch gesucht -->
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
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
		gap: 0.8rem;
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
		padding: 0.7rem 0.9rem;
		border-width: 2px;
		border-radius: 16px;
	}
	.dran {
		border-color: var(--gruen);
		border-width: 3px;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		background: var(--himmel);
		border: 2px solid var(--kante);
		font-family: var(--schrift-titel);
		font-weight: 800;
		font-size: 1.15rem;
	}
	.avatar.offen {
		background: var(--sonne-hell);
	}
	.mitte {
		display: grid;
		min-width: 0;
	}
	.gegner {
		font-weight: 800;
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
		color: var(--gruen-dunkel);
		font-weight: 800;
	}
	.status.sieg {
		color: var(--richtig);
		font-weight: 800;
	}
	.status.niederlage {
		color: var(--falsch);
		font-weight: 800;
	}
	.rechts {
		display: grid;
		justify-items: end;
	}
	.punkte {
		font-family: var(--schrift-titel);
		font-size: 1.4rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}
	.rating {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-2);
	}
	.rating.plus {
		color: var(--richtig);
	}
	.rating.minus {
		color: var(--falsch);
	}
</style>
