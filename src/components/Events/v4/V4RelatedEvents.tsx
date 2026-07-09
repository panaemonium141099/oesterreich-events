/**
 * V4RelatedEvents — „Das könnte dich auch interessieren" + Hub-Links
 * unter dem Event-Detail (MASTERPLAN §8.1: Session-Tiefe 1,4 → 3+,
 * interne Verlinkung zu den SEO-Hubs).
 *
 * RSC, ISR-sicher: cookie-freier Anon-Client (die Detailseite läuft mit
 * revalidate=3600 — jeder cookies()-Touch würde sie mit einem Runtime-500
 * aus dem statischen Pfad kippen, siehe Kommentar in page.tsx).
 *
 * Query-Disziplin (Micro-DB!): bundesland + start_date nutzen den
 * Composite-Index mit Early-Exit; category ist Residualfilter. Events
 * ohne bundesland (z. B. DE/CH aus dem Eventim-Feed) bekommen keine
 * Sektion — ein unpräfixter Datums-Scan wäre auf der Instanz zu teuer.
 */

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { BUNDESLAND_NAMES, type BundeslandId } from '@/lib/districtsAT';
import type { Event } from '@/types/events';

const LIMIT_SHOWN = 6;
const POOL = 12; // Reserve für Titel-Dedupe (Recurring-Events)

interface RelatedRow {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  category: string | null;
  image_url: string | null;
}

/** Kategorie → Gradient für bildlose Karten. Bewusst lokale Kopie des
 *  EventListView/SmartMode-Palettenmusters (gleiches Vorgehen dort). */
const CAT_GRADIENT: Record<string, [string, string]> = {
  Musik: ['#a855f7', '#7e22ce'],
  'Kultur & Bühne': ['#3b82f6', '#1d4ed8'],
  'Nightlife & Party': ['#ec4899', '#9d174d'],
  'Essen & Trinken': ['#f59e0b', '#b45309'],
  'Märkte & Feste': ['#10b981', '#047857'],
  'Sport & Bewegung': ['#ef4444', '#b91c1c'],
  'Natur & Abenteuer': ['#22c55e', '#15803d'],
  'Wissen & Karriere': ['#0ea5e9', '#0369a1'],
  'Familie & Kinder': ['#f472b6', '#be185d'],
  'Community & Freizeit': ['#8b5cf6', '#5b21b6'],
  'Wellness & Spiritualität': ['#06b6d4', '#0e7490'],
};
function gradientFor(cat?: string | null): [string, string] {
  return (cat && CAT_GRADIENT[cat]) || ['#475569', '#1e293b'];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return time === '00:00' ? date : `${date} · ${time}`;
}

/** Titel-Dedupe wie auf der Landing: Recurring-Events (gleicher Titel +
 *  gleiches Bild an N Tagen) belegen sonst mehrere Slots. */
function dedupe(rows: RelatedRow[]): RelatedRow[] {
  const seen = new Set<string>();
  const out: RelatedRow[] = [];
  for (const r of rows) {
    const key = `${(r.title ?? '').trim().toLowerCase()}::${(r.image_url ?? '').trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

const RELATED_COLS =
  'id, slug, title, start_date, location_name, postal_code, address, bundesland, category, image_url';

async function fetchRelated(event: Event): Promise<RelatedRow[]> {
  if (!event.bundesland) return [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const base = () =>
    supabase
      .from('events')
      .select(RELATED_COLS)
      .eq('visibility', 'public')
      .in('publish_status', ['published', 'published_low_confidence'])
      .eq('bundesland', event.bundesland!)
      .gte('start_date', new Date().toISOString())
      .neq('id', event.id)
      .order('start_date', { ascending: true })
      .limit(POOL);

  // 1. Gleiche Kategorie im gleichen Bundesland
  let rows: RelatedRow[] = [];
  if (event.category) {
    const { data, error } = await base().eq('category', event.category);
    if (error) console.error('[related] category query failed:', error);
    rows = dedupe((data ?? []) as RelatedRow[]);
  }

  // 2. Fallback: Kategorie offen lassen, wenn zu dünn
  if (rows.length < 3) {
    const { data, error } = await base();
    if (error) console.error('[related] fallback query failed:', error);
    const merged = [...rows, ...((data ?? []) as RelatedRow[]).filter(r => !rows.some(x => x.id === r.id))];
    rows = dedupe(merged);
  }

  return rows.slice(0, LIMIT_SHOWN);
}

/** Hub-Links: Gemeinde via PLZ-Registry-Lookup (nur wenn der Hub wirklich
 *  existiert — kein toter Link), Bundesland via ID-Whitelist. */
export function hubLinksFor(event: Pick<Event, 'postal_code' | 'bundesland'>): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [];
  if (event.postal_code) {
    const g = ALL_GEMEINDEN.find(x => x.plz === event.postal_code);
    if (g) links.push({ href: `/gemeinde/${g.slug}`, label: `Events in ${g.name}` });
  }
  if (event.bundesland && event.bundesland in BUNDESLAND_NAMES) {
    links.push({
      href: `/${event.bundesland}`,
      label: `Events in ${BUNDESLAND_NAMES[event.bundesland as BundeslandId]}`,
    });
  }
  return links;
}

export async function V4RelatedEvents({ event }: { event: Event }) {
  const related = await fetchRelated(event);
  const hubs = hubLinksFor(event);
  if (related.length === 0 && hubs.length === 0) return null;

  return (
    <section className="bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-10 md:py-14">
        {related.length > 0 && (
          <>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
              Das könnte dich auch interessieren
            </p>
            <h2 className="text-[22px] md:text-[26px] font-bold leading-tight tracking-[-0.025em] mb-6">
              Ähnliche Events{event.bundesland && event.bundesland in BUNDESLAND_NAMES
                ? ` in ${BUNDESLAND_NAMES[event.bundesland as BundeslandId]}`
                : ''}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {related.map(ev => {
                const [g1, g2] = gradientFor(ev.category);
                return (
                  <Link
                    key={ev.id}
                    href={buildEventUrlV2(ev)}
                    className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
                  >
                    <div
                      className="w-full aspect-[16/9] relative overflow-hidden"
                      style={ev.image_url ? undefined : { background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                    >
                      {ev.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={ev.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy"/>
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/90 text-center px-3 leading-tight">
                          {ev.category || 'Event'}
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-1.5">
                      <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">
                        {formatDate(ev.start_date)}
                      </p>
                      <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{ev.title}</h3>
                      {ev.location_name && (
                        <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">{ev.location_name}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {hubs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[var(--v4-hairline-1)] mt-2">
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mr-1 pt-4">
              Mehr entdecken:
            </span>
            {hubs.map(h => (
              <Link
                key={h.href}
                href={h.href}
                className="press-haptic mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)] hover:bg-[var(--v4-surface-elevated)] transition-colors"
              >
                {h.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            ))}
            <Link
              href="/entdecken"
              className="press-haptic mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)] hover:bg-[var(--v4-surface-elevated)] transition-colors"
            >
              Alle Events
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
