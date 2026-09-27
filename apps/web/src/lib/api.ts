import type { ApiFehler } from '@halmduell/shared';

/** Fehlerantwort der API mit Status, Meldung und ggf. Feldfehlern */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly felder: Record<string, string[]> = {}
	) {
		super(message);
	}
}

type Fetch = typeof fetch;

async function anfrage<T>(f: Fetch, method: string, pfad: string, body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await f(`/api${pfad}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError(0, 'Keine Verbindung – bitte Internetverbindung prüfen.');
	}
	if (res.status === 204) return undefined as T;
	const daten = await res.json().catch(() => null);
	if (!res.ok) {
		const fehler = daten as Partial<ApiFehler> | null;
		throw new ApiError(res.status, fehler?.error ?? `Fehler ${res.status}`, fehler?.felder ?? {});
	}
	return daten as T;
}

/**
 * API-Zugriff. In load-Funktionen das `fetch` aus dem Event übergeben, damit
 * beim Server-Rendering das Session-Cookie mitgeschickt wird.
 */
export function api(f: Fetch = fetch) {
	return {
		get: <T>(pfad: string) => anfrage<T>(f, 'GET', pfad),
		post: <T = void>(pfad: string, body?: unknown) => anfrage<T>(f, 'POST', pfad, body),
		put: <T = void>(pfad: string, body?: unknown) => anfrage<T>(f, 'PUT', pfad, body),
		delete: (pfad: string) => anfrage<void>(f, 'DELETE', pfad)
	};
}
