import { browser } from '$app/environment';
import type { PushSchluessel } from '@halmduell/shared';
import { api } from '$lib/api';

/**
 * Zustand der Benachrichtigungen auf diesem Gerät:
 * - laden: wird noch geprüft
 * - ios-installieren: iPhone/iPad im Browser – Push gibt es dort nur für die installierte App
 * - nicht-unterstuetzt: Browser kann kein Web Push
 * - server-aus: auf dem Server nicht eingerichtet (keine VAPID-Schlüssel)
 * - blockiert: in den Browser-Einstellungen verboten
 */
export type PushZustand = 'laden' | 'ios-installieren' | 'nicht-unterstuetzt' | 'server-aus' | 'blockiert' | 'aus' | 'an';

let zustand = $state<PushZustand>('laden');
let publicKey: string | null = null;
let geprueft: Promise<void> | null = null;

const istIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const istInstalliert = () =>
	matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const unterstuetzt = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function schluesselBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	const roh = atob(base64);
	const bytes = new Uint8Array(new ArrayBuffer(roh.length));
	for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
	return bytes;
}

function gleicherSchluessel(abo: PushSubscription, schluessel: string): boolean {
	const vorhanden = abo.options.applicationServerKey;
	if (!vorhanden) return false;
	const a = new Uint8Array(vorhanden);
	const b = schluesselBytes(schluessel);
	return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Service Worker, sobald aktiv (ohne SW, z. B. im Dev-Server, nach kurzer Zeit null) */
async function registrierung(): Promise<ServiceWorkerRegistration | null> {
	return Promise.race([
		navigator.serviceWorker.ready,
		new Promise<null>((fertig) => setTimeout(() => fertig(null), 4000))
	]);
}

async function pruefen(): Promise<void> {
	if (!unterstuetzt()) {
		zustand = istIos() && !istInstalliert() ? 'ios-installieren' : 'nicht-unterstuetzt';
		return;
	}
	try {
		publicKey = (await api().get<PushSchluessel>('/push/schluessel')).publicKey;
	} catch {
		publicKey = null;
	}
	if (!publicKey) {
		zustand = 'server-aus';
		return;
	}
	if (Notification.permission === 'denied') {
		zustand = 'blockiert';
		return;
	}
	const reg = await registrierung();
	const abo = await reg?.pushManager.getSubscription();
	if (!reg || !abo || Notification.permission !== 'granted') {
		zustand = 'aus';
		return;
	}
	if (!gleicherSchluessel(abo, publicKey)) {
		// Server hat neue Schlüssel – altes Abo ist wertlos, neu anmelden
		await abo.unsubscribe().catch(() => {});
		zustand = await anmelden(reg) ? 'an' : 'aus';
		return;
	}
	// Abo dem Server (erneut) mitteilen – z. B. nach Kontowechsel auf diesem Gerät
	await api().post('/push/abo', abo.toJSON()).catch(() => {});
	zustand = 'an';
}

async function anmelden(reg: ServiceWorkerRegistration): Promise<boolean> {
	if (!publicKey) return false;
	const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(publicKey) });
	try {
		await api().post('/push/abo', abo.toJSON());
		return true;
	} catch {
		await abo.unsubscribe().catch(() => {});
		return false;
	}
}

export const push = {
	get zustand() {
		return zustand;
	},
	/** Einmal pro Seitenaufruf prüfen (mehrere Komponenten teilen sich das Ergebnis) */
	pruefen(): Promise<void> {
		if (!browser) return Promise.resolve();
		geprueft ??= pruefen().catch(() => {
			zustand = 'nicht-unterstuetzt';
		});
		return geprueft;
	},
	/** Fragt nach der Erlaubnis und meldet das Gerät an. Liefert, ob es geklappt hat. */
	async aktivieren(): Promise<boolean> {
		const erlaubnis = await Notification.requestPermission();
		if (erlaubnis !== 'granted') {
			zustand = erlaubnis === 'denied' ? 'blockiert' : 'aus';
			return false;
		}
		const reg = await registrierung();
		const ok = !!reg && (await anmelden(reg).catch(() => false));
		zustand = ok ? 'an' : 'aus';
		return ok;
	},
	/** Meldet dieses Gerät ab (auch vor dem Abmelden vom Konto) */
	async deaktivieren(): Promise<void> {
		if (!browser || !unterstuetzt()) return;
		const reg = await registrierung();
		const abo = await reg?.pushManager.getSubscription();
		if (abo) {
			await fetch('/api/push/abo', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ endpoint: abo.endpoint })
			}).catch(() => {});
			await abo.unsubscribe().catch(() => {});
		}
		if (zustand === 'an') zustand = 'aus';
	}
};
