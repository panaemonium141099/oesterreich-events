/**
 * Belege für harte Fakten in Blogposts (`FestivalPost.factSources`).
 *
 * Ein Termin, eine Öffnungszeit oder ein Ort steht nur im Post, wenn er an
 * einer Primärquelle geprüft wurde: Veranstalter, Tourismusverband oder die
 * Quelle des Events in unserer Datenbank. Der handgeschriebene April-Batch
 * 2026 hatte geschätzte Termine und erfundene Events (PR #338), weil die
 * Spec nur Format prüfte. Der Wächter `fact-sources.test.ts` macht das CI rot,
 * wenn ein Post mit Termin keine Belege trägt.
 */
import type { FestivalPost } from '@/content/blog/types';

const URL_RE = /^https?:\/\/[^\s/]+\.[^\s/]+/i;

/** Gültige http(s)-URLs aus beliebigen Kandidaten, dedupliziert, Reihenfolge bleibt. */
type Candidate = string | null | undefined;

export function factSourceUrls(...candidates: Array<Candidate | readonly Candidate[]>): string[] {
  const out: string[] = [];
  for (const c of candidates.flat()) {
    const url = typeof c === 'string' ? c.trim() : '';
    if (URL_RE.test(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

/** Nennt der Post einen konkreten Termin? Event-Schema oder eine Ziffer in keyFacts.dates. */
export function hasConcreteDate(post: Pick<FestivalPost, 'jsonLdEvent' | 'keyFacts'>): boolean {
  return Boolean(post.jsonLdEvent) || /\d/.test(post.keyFacts?.dates ?? '');
}

/** Fehlerliste für `factSources`; leer = in Ordnung. `today` als ISO-Tag (YYYY-MM-DD). */
export function factSourceErrors(post: FestivalPost, today: string): string[] {
  const sources = post.factSources;
  if (!sources) return ['factSources fehlt'];
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sources.checkedAt) || Number.isNaN(Date.parse(sources.checkedAt))) {
    errors.push(`checkedAt "${sources.checkedAt}" ist kein ISO-Tag`);
  } else if (sources.checkedAt > today) {
    errors.push(`checkedAt ${sources.checkedAt} liegt in der Zukunft`);
  }
  if (!Array.isArray(sources.urls) || sources.urls.length === 0) {
    errors.push('keine Quell-URL');
  } else {
    for (const u of sources.urls) if (!URL_RE.test(u)) errors.push(`keine URL: "${u}"`);
  }
  return errors;
}
