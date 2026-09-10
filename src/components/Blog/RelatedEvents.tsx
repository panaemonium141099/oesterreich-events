/**
 * RelatedEvents — "Ähnliche Events"-Sektion für Blog-Posts (fn-19).
 *
 * Zieht live passende kommende Events aus Supabase und verlinkt sie intern
 * auf die Event-Detailseiten — die Brücke Blog → Website. Dazu feste CTAs
 * auf /entdecken und /map.
 *
 * ── Warum das hier neu geschrieben wurde (User-Befund 2026-09-10) ────────
 * Vorher lief das Matching über `deriveSearchTerms(postTitle)`: zwei Wörter
 * aus dem Titel, mit UND verknüpft. Auf der Halloween-Seite hieß das
 * `title ILIKE '%halloween%' AND title ILIKE '%österreich%'` — kein einziges
 * Event trägt beides im Titel. Ergebnis null, danach griff der Auffüller mit
 * "beste kommende Events österreichweit". Unter einem Halloween-Artikel
 * standen deshalb House of Strauss, Peterskirche und eine Freddie-Mercury-
 * Show. Formal "Events", inhaltlich Zufall.
 *
 * Jetzt:
 *   1. Die Suchbegriffe kommen aus `post.relatedEvents.terms` (kuratiert)
 *      bzw. aus den SEO-Keywords des Posts, und sie werden mit ODER
 *      verknüpft. Ein Treffer reicht.
 *   2. Saison-Seiten geben ein Zeitfenster mit (`from`/`to`). Für "Halloween"
 *      ist die Woche selbst das stärkste Relevanzsignal, nicht der Titel.
 *   3. Sortiert wird nach Ticket-Verfügbarkeit: Eventim-Events mit
 *      Ticket-Link zuerst (Affiliate-Erlös, und für Leser der konkretere
 *      Tipp), danach nach quality_score.
 *   4. Höchstens zwei Karten pro Bundesland, damit die Auswahl nicht
 *      komplett nach Wien kippt.
 *
 * Statisch-sicher wie die BlogTicketBox: cookie-freier Anon-Client, damit
 * die Blog-Seite eine prerenderte ISR-Route bleibt; die Events refreshen
 * über das revalidate-Fenster der Seite (6 h).
 */

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { RelatedEventsSpec } from '@/content/blog/types';

const MAX_EVENTS = 6;
/** Sonst zeigt die Sektion sechsmal Wien. */
const MAX_PER_BUNDESLAND = 2;
/** Sonst sind alle sechs Karten vom selben Tag. */
const MAX_PER_DAY = 2;
/** Wie weit nach vorn geschaut wird, wenn der Post kein Fenster vorgibt. */
const DEFAULT_WINDOW_DAYS = 120;

interface RelatedEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  category: string | null;
  source_name: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_text: string | null;
  quality_score: number | null;
}

const SELECT_COLS =
  'id, slug, title, start_date, location_name, postal_code, address, bundesland,'
  + ' category, source_name, ticket_url, price_min, price_text, quality_score';

/** Wörter, die als Suchbegriff jedes beliebige Event treffen würden. */
const TERM_STOPWORDS = new Set([
  'oesterreich', 'österreich', 'austria', 'event', 'events', 'termin', 'termine',
  'guide', 'ueberblick', 'überblick', 'alle', 'beste', 'besten', 'tipps',
  'wien', 'programm', 'kalender', 'jahr', 'saison',
]);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-AT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPrice(e: RelatedEvent): string | null {
  if (e.price_min != null && e.price_min > 0) {
    return `ab ${e.price_min.toLocaleString('de-AT', { maximumFractionDigits: 0 })} €`;
  }
  const t = e.price_text?.trim();
  if (!t) return null;
  return t.length > 24 ? null : t;
}

/**
 * Suchbegriffe für die ODER-Suche. Kuratierte Terme aus dem Post schlagen
 * alles andere; sonst werden die SEO-Keywords zerlegt, weil die schon das
 * Thema treffen ("halloween mit kindern" → halloween, kindern).
 */
function buildTerms(spec: RelatedEventsSpec | undefined, keywords: string[], title: string): string[] {
  if (spec?.terms?.length) return spec.terms.slice(0, 8);
  const words = [...keywords, title]
    .join(' ')
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 5 && !TERM_STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 6);
}

/** Eventim mit Ticket zuerst, dann irgendein Ticket, dann Qualität. */
function rank(a: RelatedEvent, b: RelatedEvent): number {
  const tier = (e: RelatedEvent) => {
    if (e.ticket_url && e.source_name === 'Eventim') return 0;
    if (e.ticket_url) return 1;
    return 2;
  };
  const t = tier(a) - tier(b);
  if (t !== 0) return t;
  const q = (b.quality_score ?? 0) - (a.quality_score ?? 0);
  if (q !== 0) return q;
  return a.start_date.localeCompare(b.start_date);
}

/**
 * Nach Rang auswählen, aber über Bundesländer UND Tage streuen.
 *
 * Ohne die Tages-Deckelung stehen sechs Karten vom selben Datum da: sehr
 * viele Events teilen sich denselben quality_score, und dann entscheidet
 * das Datum den Gleichstand immer zugunsten des frühesten Tages.
 */
function pickSpread(pool: RelatedEvent[], take: number, seen: Set<string>): RelatedEvent[] {
  const perBl = new Map<string, number>();
  const perDay = new Map<string, number>();
  const out: RelatedEvent[] = [];
  const titles = new Set<string>();
  // Zwei Durchläufe: erst streng gedeckelt, dann die Reste auffüllen, damit
  // die Sektion bei dünner Datenlage trotzdem voll wird.
  for (const dayCap of [MAX_PER_DAY, Number.MAX_SAFE_INTEGER]) {
    for (const e of [...pool].sort(rank)) {
      if (out.length >= take) break;
      if (seen.has(e.id)) continue;
      // Serien wie "Ladies Night" an vier Abenden sollen die Liste nicht füllen.
      const key = e.title.toLowerCase().slice(0, 40);
      if (titles.has(key)) continue;
      const bl = e.bundesland ?? 'unbekannt';
      if ((perBl.get(bl) ?? 0) >= MAX_PER_BUNDESLAND) continue;
      const day = e.start_date.slice(0, 10);
      if ((perDay.get(day) ?? 0) >= dayCap) continue;
      perBl.set(bl, (perBl.get(bl) ?? 0) + 1);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      titles.add(key);
      seen.add(e.id);
      out.push(e);
    }
    if (out.length >= take) break;
  }
  return out;
}

async function fetchRelatedEvents(
  postTitle: string,
  keywords: string[],
  category: string,
  spec: RelatedEventsSpec | undefined,
): Promise<RelatedEvent[]> {
  const supabase = anonClient();
  const now = new Date();
  const from = spec?.from ?? now.toISOString();
  const to = spec?.to
    ?? new Date(now.getTime() + DEFAULT_WINDOW_DAYS * 86_400_000).toISOString();

  const base = () => supabase
    .from('events')
    .select(SELECT_COLS)
    .eq('visibility', 'public')
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', from)
    .lte('start_date', to);

  const results: RelatedEvent[] = [];
  const seen = new Set<string>();

  try {
    // 1) Thematische Treffer: ODER über die Suchbegriffe.
    const terms = buildTerms(spec, keywords, postTitle);
    if (terms.length > 0) {
      const orFilter = terms.map(t => `title.ilike.%${t.replace(/[,()]/g, '')}%`).join(',');
      const { data, error } = await base()
        .or(orFilter)
        .order('quality_score', { ascending: false })
        .limit(80)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) console.error('[RelatedEvents] term query failed:', error.message);
      else if (data) results.push(...pickSpread(data as unknown as RelatedEvent[], MAX_EVENTS, seen));
    }

    // 2) Auffüllen aus derselben Rubrik statt aus "irgendwas Gutes".
    if (results.length < MAX_EVENTS) {
      const cats = spec?.categories?.length ? spec.categories : [category];
      const { data, error } = await base()
        .in('category', cats)
        .order('quality_score', { ascending: false })
        .limit(80)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) console.error('[RelatedEvents] category query failed:', error.message);
      else if (data) {
        results.push(...pickSpread(data as unknown as RelatedEvent[], MAX_EVENTS - results.length, seen));
      }
    }

    // 3) Letzter Ausweg: buchbare Events im Fenster. Immer noch besser als
    //    eine leere Sektion, und durch den Ticket-Filter wenigstens konkret.
    if (results.length < MAX_EVENTS) {
      const { data, error } = await base()
        .not('ticket_url', 'is', null)
        .order('quality_score', { ascending: false })
        .limit(80)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) console.error('[RelatedEvents] fill query failed:', error.message);
      else if (data) {
        results.push(...pickSpread(data as unknown as RelatedEvent[], MAX_EVENTS - results.length, seen));
      }
    }
  } catch (err) {
    // Sektion ist Zusatznutzen — ein DB-Schluckauf darf den Blog-Render
    // nicht mitreißen.
    console.error('[RelatedEvents] failed:', err);
  }

  return results.sort(rank);
}

export async function RelatedEvents({
  postTitle,
  keywords = [],
  category = '',
  spec,
}: {
  postTitle: string;
  keywords?: string[];
  category?: string;
  spec?: RelatedEventsSpec;
}) {
  const events = await fetchRelatedEvents(postTitle, keywords, category, spec);

  return (
    <section className="mb-14" data-testid="related-events">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
        Passende Events &amp; Termine
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Live aus unserem Kalender, täglich aktualisiert.
      </p>

      {events.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 mb-6">
          {events.map(e => {
            const price = formatPrice(e);
            return (
              <li key={e.id}>
                <Link
                  href={buildEventUrlV2(e)}
                  className="block border border-gray-200 rounded-xl bg-white p-4 hover:border-gray-400 transition-colors h-full"
                  data-track="blog_related_event"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    {formatDate(e.start_date)}
                    {e.bundesland ? ` · ${e.bundesland}` : ''}
                  </p>
                  <p className="font-semibold text-gray-900 leading-snug line-clamp-2">{e.title}</p>
                  {e.location_name && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{e.location_name}</p>
                  )}
                  {(e.ticket_url || price) && (
                    <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                      {e.ticket_url && <span className="text-emerald-700">Tickets</span>}
                      {price && <span className="text-gray-500">{price}</span>}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/entdecken"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors text-sm"
          data-track="blog_cta_entdecken"
        >
          Alle Events entdecken
        </Link>
        <Link
          href="/map"
          className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-900 font-semibold px-6 py-3 rounded-lg hover:border-gray-500 transition-colors text-sm"
          data-track="blog_cta_karte"
        >
          Events auf der Karte
        </Link>
      </div>
    </section>
  );
}
