import { browser } from '$app/environment';

// Chrome/Edge/Android feuern „beforeinstallprompt“ genau einmal, früh nach dem Laden –
// deshalb global abfangen, nicht erst in der Komponente, die den Knopf zeigt.
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let angebot = $state<InstallPromptEvent | null>(null);
let installiert = $state(false);

if (browser) {
	installiert =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault(); // eigener Knopf statt Browser-Leiste
		angebot = e as InstallPromptEvent;
	});
	addEventListener('appinstalled', () => {
		installiert = true;
		angebot = null;
	});
}

const istIos = browser && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const installation = {
	/** Browser bietet Installation per Knopf an (Chrome, Edge, Android) */
	get moeglich() {
		return angebot !== null && !installiert;
	},
	/** iPhone/iPad: Installation nur über „Teilen → Zum Home-Bildschirm“ */
	get nurManuellIos() {
		return istIos && !installiert;
	},
	get installiert() {
		return installiert;
	},
	async installieren(): Promise<boolean> {
		if (!angebot) return false;
		await angebot.prompt();
		const { outcome } = await angebot.userChoice;
		angebot = null;
		return outcome === 'accepted';
	}
};
