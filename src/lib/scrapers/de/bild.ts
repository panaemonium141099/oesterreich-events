/**
 * Bilder der DE-Adapter (Entscheidung des Users 2026-10-29): das Bild der
 * Quelle wird übernommen, am Bild und am Event stehen die Website und der
 * Link auf die Detailseite des Termins (`image_credit` + `source_url`,
 * angezeigt im Hero der Detailseite). Was kein Eventbild ist, fällt weg wie
 * bei Eventfrog (`unusableImageUrls`): eine Quellenangabe ersetzt kein
 * Nutzungsrecht, ein Logo als Eventbild ist aber in jedem Fall falsch.
 * REIN, kein I/O.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * Absolute http(s)-URL des Bildes oder nichts. Vektorgrafiken sind Wappen
 * und Logos, keine Fotos (ionas Amt Sandesneben-Nusse: `poggensee.svg`,
 * `sandesneben.svg` an jeder Sitzung, 2026-10-29); ebenso Dateien, die sich
 * selbst Logo oder Wappen nennen (`zv-wasser-logo.jpg`, Borkheide
 * `logo-job-ev-klein.jpg`, Bergenhusen `logo_transparent-…@160w.jpg`) und
 * KI-Stockbilder (`…-ai-generated-…`, wie bei Eventfrog).
 */
export function imageUrl(raw: string | undefined, base?: string): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  let u: URL;
  try {
    u = new URL(t, base);
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
  const file = decodeURIComponent(u.pathname.split('/').pop() ?? '').toLowerCase();
  if (/\.svgz?$/.test(file)) return undefined;
  if (/(^|[^a-z])(logo|wappen)([^a-z]|$)/.test(file) || /ai-generated/.test(file)) return undefined;
  return u.href;
}

/** Bild-URL ohne Query (`?cid=…` bei ionas ist ein Cache-Schlüssel). */
const imageKey = (url: string) => url.split('?')[0];

/**
 * Bilder, die in einem Feed an mindestens drei verschiedenen Terminen hängen,
 * sind Platzhalter der Rubrik oder des Veranstalters, kein Bild des Termins
 * (Bergenhusen: ein Bild an 22 von 28 Terminen). Dieselbe Reihe mit gleichem
 * Titel an vielen Tagen darf ihr Bild behalten.
 */
export function placeholderImages(events: { title: string; image?: string }[]): Set<string> {
  const titles = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.image) continue;
    const k = imageKey(e.image);
    const set = titles.get(k) ?? new Set<string>();
    set.add(e.title.trim().toLowerCase());
    titles.set(k, set);
  }
  const out = new Set<string>();
  for (const [k, set] of titles) if (set.size >= 3) out.add(k);
  return out;
}

/** Die Termine eines Feeds, Platzhalterbilder entfernt. */
export function withoutPlaceholderImages<T extends { title: string; image?: string }>(events: T[]): T[] {
  const bad = placeholderImages(events);
  return events.map(e => (e.image && bad.has(imageKey(e.image)) ? { ...e, image: undefined } : e));
}

/** Bildnachweis: die Website der Quelle („amt-sn.de"). */
export function imageCredit(sourceUrl: string): string {
  return new URL(sourceUrl).host.replace(/^www\./, '');
}

/** Ist die URL eine Bilddatei (ATTACH ohne FMTTYPE)? */
export function looksLikeImageFile(url: string): boolean {
  try {
    return IMAGE_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
