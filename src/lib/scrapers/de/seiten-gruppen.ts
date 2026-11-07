/**
 * Kalender eingebetteter Widgets (Deskline, destination.one): die Registry
 * kennt nur die Kalenderseite der Gemeinde, nicht den Schlüssel des Widgets.
 * Der Adapter liest die Seite und findet den Schlüssel selbst; Gruppen wie
 * bei iKISS: die Registry-Seite, sonst die Startseite der Website, dazu
 * Ausweichwege über Amt/VG. REIN, kein I/O.
 */
import { loadRegistryDe, singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';

export function seitenGruppen(integration: string, entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (raw: string) => {
    const url = raw.replace(/&amp;/g, '&');
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === integration) group(e.url ?? `https://www.${e.host}/`).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === integration) {
      group(e.fallback.url ?? `https://www.${e.fallback.host}/`).viaVerband.push(e);
    }
  }
  return [...groups.values()].sort((a, b) => Number(!singleGemeinde(a)) - Number(!singleGemeinde(b)) || a.feedUrl.localeCompare(b.feedUrl));
}
