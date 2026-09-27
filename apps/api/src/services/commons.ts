// Bilddaten von Wikimedia Commons holen (Admin-Portal: Link einfügen → URL, Urheber, Lizenz).

/** Breite des verwendeten Vorschaubilds – reicht fürs Handy, spart Datenvolumen */
const BREITE = 1024;
const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia verlangt einen aussagekräftigen User-Agent
const USER_AGENT = 'Halmduell/1.0 (Agrar-Quiz; Admin-Portal Bildimport)';

type Holen = (url: string, init: RequestInit) => Promise<Response>;
let holen: Holen = (url, init) => fetch(url, init);

/** Nur für Tests: Netzwerkzugriff ersetzen */
export function setzeCommonsFetch(neu: Holen | null): void {
  holen = neu ?? ((url, init) => fetch(url, init));
}

export class CommonsFehler extends Error {
  constructor(readonly status: 400 | 404 | 422 | 502, message: string) {
    super(message);
  }
}

/**
 * Dateiname aus allem, was man typischerweise kopiert: Link zur Dateiseite
 * (auch mobil, mit #/media/…), direkter Bildlink auf upload.wikimedia.org
 * oder nur „Datei:Name.jpg“.
 */
export function commonsDateiname(link: string): string | null {
  const text = link.trim();
  const titel = (t: string) => {
    const name = decodeURIComponent(t).replace(/^(File|Datei|Image|Bild):/i, '').replace(/_/g, ' ').trim();
    return /\.(jpe?g|png|gif|webp|svg|tiff?)$/i.test(name) ? name : null;
  };
  // „Datei:X.jpg“ wäre für new URL() eine gültige URL mit Schema „datei:“
  if (!/^https?:\/\//i.test(text)) return /^(File|Datei):/i.test(text) ? titel(text) : null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const medien = url.hash.match(/#\/media\/((?:File|Datei):[^?#]+)/i);
  if (medien) return titel(medien[1]!);
  if (/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(url.hostname)) {
    const seite = url.pathname.match(/\/wiki\/((?:File|Datei|Image|Bild):[^/]+)$/i);
    if (seite) return titel(seite[1]!);
    const titelParam = url.searchParams.get('title');
    if (titelParam) return titel(titelParam);
  }
  if (url.hostname === 'upload.wikimedia.org') {
    // …/commons/a/ab/Name.jpg bzw. …/commons/thumb/a/ab/Name.jpg/800px-Name.jpg
    const teile = url.pathname.split('/').filter(Boolean);
    const i = teile.indexOf('thumb');
    return titel(i >= 0 ? teile[i + 3] ?? '' : teile.at(-1) ?? '');
  }
  return null;
}

/** HTML aus den Commons-Metadaten zu schlichtem Text */
function ohneHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

/** Holt URL, Urheber und Lizenz einer Commons-Datei */
export async function commonsBild(link: string) {
  const datei = commonsDateiname(link);
  if (!datei) throw new CommonsFehler(400, 'Kein Link zu einer Bilddatei auf Wikimedia Commons');

  const query = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', titles: `File:${datei}`,
    prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: String(BREITE),
  });
  let antwort: { query?: { pages?: { missing?: boolean; imageinfo?: ImageInfo[] }[] } };
  try {
    const res = await holen(`${API}?${query}`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    antwort = await res.json();
  } catch {
    throw new CommonsFehler(502, 'Wikimedia Commons ist gerade nicht erreichbar');
  }

  const seite = antwort.query?.pages?.[0];
  const info = seite?.imageinfo?.[0];
  if (!seite || seite.missing || !info) throw new CommonsFehler(404, `„${datei}“ gibt es auf Wikimedia Commons nicht`);

  const meta = (name: string) => ohneHtml(info.extmetadata?.[name]?.value ?? '');
  const lizenz = meta('LicenseShortName');
  const urheber = meta('Artist') || meta('Credit') || 'Unbekannt';
  const bildUrl = info.thumburl ?? info.url;
  if (!bildUrl || !info.descriptionurl) throw new CommonsFehler(404, 'Commons liefert zu dieser Datei kein Bild');
  if (!lizenz) throw new CommonsFehler(422, 'Zu dieser Datei ist keine Lizenz angegeben – bitte ein anderes Bild wählen');

  return {
    bildUrl,
    bildQuelle: `${urheber}, ${lizenz}, Wikimedia Commons`.slice(0, 500),
    urheber,
    lizenz,
    seite: info.descriptionurl,
  };
}
