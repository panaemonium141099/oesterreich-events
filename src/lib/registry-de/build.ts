/**
 * DE-Gemeinde-Registry (fn-29.4): je Gemeinde genau ein Eintrag mit der
 * Integration, über die ihre Termine gelesen werden, aus der Vollerhebung
 * (`docs/research/de-gemeinden/data/vollerhebung-*.csv`). REIN.
 */
import { INTEGRATIONS, stufeOf, type Stufe } from './integrations';
import { heimatInfoFeedUrl } from './feed-url';

/** Zeile der Vollerhebung (Spalten siehe 01-vollerhebung.md Abschnitt 7). */
export interface ErhebungRow {
  ags: string;
  name: string;
  host: string;
  stufe: string;
  integration: string;
  vb_host: string;
  vb_integration: string;
  event_url: string;
  vb_event_url: string;
  heimatinfo_id: string;
  meinort_ort: string;
}

export interface RegistryEntryDe {
  ags: string;
  name: string;
  /** Land-ID aus den Stammdaten. */
  land: string;
  /** Eigene Website der Gemeinde (Host). */
  host: string | null;
  /** Stufe der Vollerhebung: A–E eigene Website, V Amt/VG, M meinOrt, R Rest. */
  stufe: 'A' | 'B' | 'C' | 'D' | 'E' | 'V' | 'M' | 'R';
  /** Integration der eigenen Website (F/G heißt: kein lesbarer Kalender). */
  integration: string;
  /** Kalenderseite der eigenen Website. */
  url: string | null;
  /** Feed bzw. API, nur Stufe A und nur wenn die Seite sie belegt. */
  feed_url?: string;
  /** Ausweichweg, wenn die eigene Website keinen Kalender hat. */
  fallback?: { kind: 'verband'; host: string; integration: string; url: string | null; feed_url?: string } | { kind: 'meinort'; ort: string };
  /** Heimat-Info-Kommune (Lizenzquelle, fn-29.19). */
  heimatinfo_id?: string;
  checked_at: string;
}

export interface BuildInput {
  rows: ErhebungRow[];
  /** AGS → Land-ID aus `data/gemeinden-de.json`. */
  landByAgs: ReadonlyMap<string, string>;
  /** Kalenderseite (URL) → belegter Feed, aus dem Feed-Lauf des Builders. */
  feeds: ReadonlyMap<string, string>;
  checkedAt: string;
}

export interface BuildResult {
  entries: RegistryEntryDe[];
  problems: string[];
}

const nn = (s: string | undefined | null) => (s && s.trim() ? s.trim() : null);

/**
 * Seiten, die der Linkfinder der Vollerhebung als „Termine" erkannt hat, die
 * aber keine Veranstaltungen führen (Seitentitel geprüft 2026-10-28):
 * Online-Terminbuchung des Bürgerbüros und Abfallkalender.
 */
export const NON_EVENT_HOSTS: ReadonlyMap<string, string> = new Map([
  ['terminland.de', 'terminbuchung'], // „Terminland | Einfach Termine online buchen"
  ['terminplaner-online.de', 'terminbuchung'], // „Terminplaner Online - Terminverwaltung"
  ['termine-reservieren.de', 'terminbuchung'], // Pfad /termine/<amt>/, Startseite 403
  ['art-trier.de', 'abfall'], // „Zweckverband Abfallwirtschaft Region Trier (A.R.T.)"
  ['awr.de', 'abfall'], // „Abfallwirtschaft Rendsburg-Eckernförde"
]);

/** Kalender-URL, sofern sie nicht auf einen Nicht-Veranstaltungsdienst zeigt. */
export function eventPageUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./, '');
    for (const host of NON_EVENT_HOSTS.keys()) if (h === host || h.endsWith(`.${host}`)) return null;
    // Eine Datei des Plugins ist keine Kalenderseite (MEC: `…/assets/css/frontend.min.css`
    // als Kalender-URL von Drage, Echternacherbrück, Theilheim, Bad Frankenhausen; fn-29.7).
    if (/\.(css|js|json|png|jpe?g|gif|svg|webp|woff2?|ttf|ico)$/i.test(u.pathname)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function buildRegistry(input: BuildInput): BuildResult {
  const problems: string[] = [];
  const seen = new Set<string>();
  const entries: RegistryEntryDe[] = [];
  for (const r of input.rows) {
    if (seen.has(r.ags)) { problems.push(`${r.ags}: doppelt`); continue; }
    seen.add(r.ags);
    const land = input.landByAgs.get(r.ags);
    if (!land) { problems.push(`${r.ags} ${r.name}: nicht in den Stammdaten`); continue; }
    if (!(r.integration in INTEGRATIONS)) { problems.push(`${r.ags} ${r.name}: unbekannte Integration ${r.integration}`); continue; }
    const stufe = r.stufe as RegistryEntryDe['stufe'];
    if (!['A', 'B', 'C', 'D', 'E', 'V', 'M', 'R'].includes(stufe)) { problems.push(`${r.ags}: unbekannte Stufe ${r.stufe}`); continue; }
    const own = stufeOf(r.integration) as Stufe;
    if ('ABCDE'.includes(own) && stufe !== own) problems.push(`${r.ags}: Stufe ${stufe} passt nicht zu ${r.integration}`);
    const url = eventPageUrl(nn(r.event_url));
    const e: RegistryEntryDe = { ags: r.ags, name: r.name, land, host: nn(r.host), stufe, integration: r.integration, url, checked_at: input.checkedAt };
    if (r.integration === 'heimatinfo' && nn(r.heimatinfo_id)) e.feed_url = heimatInfoFeedUrl(r.heimatinfo_id.trim());
    else if (own === 'A' && url && input.feeds.has(url)) e.feed_url = input.feeds.get(url)!;
    if (stufe === 'V') {
      if (!nn(r.vb_host) || !(r.vb_integration in INTEGRATIONS)) problems.push(`${r.ags}: Stufe V ohne Verband`);
      else {
        const vbUrl = eventPageUrl(nn(r.vb_event_url));
        e.fallback = { kind: 'verband', host: r.vb_host, integration: r.vb_integration, url: vbUrl };
        if (stufeOf(r.vb_integration) === 'A' && vbUrl && input.feeds.has(vbUrl)) e.fallback.feed_url = input.feeds.get(vbUrl)!;
      }
    } else if (stufe === 'M') {
      if (!nn(r.meinort_ort)) problems.push(`${r.ags}: Stufe M ohne meinOrt-Ort`);
      else e.fallback = { kind: 'meinort', ort: r.meinort_ort.trim() };
    }
    if (nn(r.heimatinfo_id)) e.heimatinfo_id = r.heimatinfo_id.trim();
    entries.push(e);
  }
  entries.sort((a, b) => a.ags.localeCompare(b.ags));
  return { entries, problems };
}

export interface RegistryDiff {
  added: string[];
  removed: string[];
  changed: { ags: string; fields: string[] }[];
}

/** Unterschiede zwischen zwei Registry-Ständen (ohne `checked_at`). */
export function diffRegistry(before: RegistryEntryDe[], after: RegistryEntryDe[]): RegistryDiff {
  const b = new Map(before.map(e => [e.ags, e]));
  const a = new Map(after.map(e => [e.ags, e]));
  const changed: RegistryDiff['changed'] = [];
  for (const [ags, e] of a) {
    const old = b.get(ags);
    if (!old) continue;
    const fields = (['stufe', 'integration', 'url', 'feed_url', 'fallback', 'host', 'heimatinfo_id'] as const)
      .filter(k => JSON.stringify(old[k] ?? null) !== JSON.stringify(e[k] ?? null));
    if (fields.length) changed.push({ ags, fields });
  }
  return {
    added: [...a.keys()].filter(k => !b.has(k)),
    removed: [...b.keys()].filter(k => !a.has(k)),
    changed,
  };
}
