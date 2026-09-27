import { onMount } from 'svelte';

/**
 * true, sobald die Seite interaktiv ist. Absende-Knöpfe bleiben bis dahin
 * deaktiviert – sonst schickt der Browser das Formular selbst ab (als GET,
 * mit Passwort in der URL), bevor unser Submit-Handler existiert.
 */
export function hydriert() {
	let bereit = $state(false);
	onMount(() => {
		bereit = true;
	});
	return {
		get bereit() {
			return bereit;
		}
	};
}
