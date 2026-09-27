/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service Worker: App-Shell für schnellen Start, Offline-Seite ohne Netz.
// API-Antworten (/api/*) werden NIE gecacht – Spielstand und Anmeldung kommen
// immer frisch vom Server.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `halmduell-${version}`;
const OFFLINE_SEITE = '/offline.html';

// gebaute JS/CSS/Schriften + Dateien aus static/ (Icons, Manifest, Offline-Seite)
const APP_SHELL = [...build, ...files.filter((f) => !f.endsWith('robots.txt'))];
const IN_APP_SHELL = new Set(APP_SHELL);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const name of await caches.keys()) {
				if (name !== CACHE) await caches.delete(name);
			}
			await sw.clients.claim();
		})()
	);
});

// Neue Version erst übernehmen, wenn der Nutzer „Neu laden“ tippt – nie mitten im Spiel
sw.addEventListener('message', (event) => {
	if (event.data === 'neueVersionAktivieren') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	// App-Shell: aus dem Cache (Dateinamen enthalten einen Hash bzw. wechseln mit der Version)
	if (IN_APP_SHELL.has(url.pathname)) {
		event.respondWith(
			caches.match(request).then((treffer) => treffer ?? fetch(request))
		);
		return;
	}

	// Seiten: immer vom Server (Inhalte sind persönlich und aktuell); ohne Netz die Offline-Seite
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => (await caches.match(OFFLINE_SEITE)) ?? Response.error())
		);
	}
});

// Web Push: Benachrichtigung anzeigen (Inhalt kommt fertig vom Server)
interface PushNachricht {
	titel: string;
	text: string;
	url: string;
	tag?: string;
}

sw.addEventListener('push', (event) => {
	let n: PushNachricht;
	try {
		n = event.data?.json() as PushNachricht;
	} catch {
		n = { titel: 'Halmduell', text: event.data?.text() ?? 'Es gibt Neuigkeiten.', url: '/' };
	}
	event.waitUntil(
		sw.registration.showNotification(n.titel, {
			body: n.text,
			tag: n.tag,
			icon: '/icons/icon-192.png',
			badge: '/icons/badge-96.png',
			data: { url: n.url },
			lang: 'de'
		})
	);
});

// Antippen: offenes Halmduell-Fenster auf die Seite lenken, sonst neues öffnen
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const ziel = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', sw.location.origin).href;
	event.waitUntil(
		(async () => {
			const fenster = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const offen = fenster.find((f) => new URL(f.url).origin === sw.location.origin) as WindowClient | undefined;
			if (offen) {
				await offen.focus();
				await offen.navigate(ziel).catch(() => offen.postMessage({ typ: 'navigieren', url: ziel }));
				return;
			}
			await sw.clients.openWindow(ziel);
		})()
	);
});
