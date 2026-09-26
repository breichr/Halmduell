import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Eine Domain für alles: /api/* reicht der Web-Server intern an den API-Container
// weiter (Coolify: nur der Web-Service braucht eine öffentliche Domain).

// hop-by-hop-Header gelten nur für eine Verbindung und werden nicht weitergereicht
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];

function istApiPfad(pfad: string): boolean {
	return pfad === '/api' || pfad.startsWith('/api/');
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!istApiPfad(event.url.pathname)) return resolve(event);

	const ziel = new URL(event.url.pathname + event.url.search, env.API_URL ?? 'http://localhost:3000');
	const headers = new Headers(event.request.headers);
	for (const name of [...HOP_BY_HOP, 'host']) headers.delete(name);
	// Die API liest die Client-IP aus X-Forwarded-For (Rate-Limits). Hinter Coolify
	// setzt Traefik den Header; ohne Proxy (lokal) setzen wir ihn selbst.
	if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', event.getClientAddress());

	const mitBody = !['GET', 'HEAD'].includes(event.request.method);
	let antwort: Response;
	try {
		antwort = await fetch(ziel, {
			method: event.request.method,
			headers,
			body: mitBody ? event.request.body : undefined,
			redirect: 'manual',
			// nötig, um einen Request-Stream weiterzureichen
			...(mitBody ? { duplex: 'half' } : {})
		} as RequestInit);
	} catch {
		return Response.json({ error: 'Server gerade nicht erreichbar' }, { status: 502 });
	}

	const antwortHeaders = new Headers(antwort.headers);
	// fetch hat den Body bereits entpackt – Länge/Kodierung stimmen nicht mehr
	for (const name of [...HOP_BY_HOP, 'content-encoding', 'content-length']) antwortHeaders.delete(name);
	return new Response(antwort.body, { status: antwort.status, statusText: antwort.statusText, headers: antwortHeaders });
};
