/**
 * RelatedEvents — "Ähnliche Events"-Sektion für Blog-Posts (fn-19).
 *
 * Zieht live passende kommende Events aus Supabase und verlinkt sie intern
 * auf die Event-Detailseiten — die Brücke Blog → Website, die bisher nur
 * die (Eventim-exklusive) BlogTicketBox schlug. Dazu feste CTAs auf
 * /entdecken und /map.
 *
 * Matching zweistufig:
 *   1. Titel-Terme des Posts (deriveSearchTerms aus der BlogTicketBox,
 *      gleiche Heuristik) als ilike-AND über kommende publizierte Events.
 *   2. Auffüllen auf MAX_EVENTS mit den besten kommenden Events
 *      österreichweit (quality_score DESC) — so ist die Sektion auch bei
 *      Posts ohne DB-Treffer (z. B. historische Themen) nie leer.
 *
 * Statisch-sicher wie die BlogTicketBox: cookie-freier Anon-Client, damit
 * die Blog-Seite eine prerenderte ISR-Route bleibt; die Events refreshen
 * über das revalidate-Fenster der Seite (6 h).
 */

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { deriveSearchTerms } from '@/components/Blog/BlogTicketBox';

const MAX_EVENTS = 6;

interface RelatedEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
}

const SELECT_COLS =
  'id, slug, title, start_date, location_name, postal_code, address, bundesland';

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

async function fetchRelatedEvents(postTitle: string): Promise<RelatedEvent[]> {
  const supabase = anonClient();
  const nowIso = new Date().toISOString();
  const results: RelatedEvent[] = [];

  try {
    const terms = deriveSearchTerms(postTitle);
    if (terms.length > 0) {
      let q = supabase
        .from('events')
        .select(SELECT_COLS)
        .eq('visibility', 'public')
        .in('publish_status', ['published', 'published_low_confidence'])
        .gte('start_date', nowIso);
      for (const term of terms) {
        q = q.ilike('title', `%${term}%`);
      }
      const { data, error } = await q
        .order('start_date', { ascending: true })
        .limit(MAX_EVENTS)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) {
        console.error('[RelatedEvents] title query failed:', error.message);
      } else if (data) {
        results.push(...(data as RelatedEvent[]));
      }
    }

    if (results.length < MAX_EVENTS) {
      const seen = new Set(results.map(e => e.id));
      const { data, error } = await supabase
        .from('events')
        .select(SELECT_COLS)
        .eq('visibility', 'public')
        .eq('publish_status', 'published')
        .gte('start_date', nowIso)
        .gte('quality_score', 80)
        .order('quality_score', { ascending: false })
        .order('start_date', { ascending: true })
        .limit(MAX_EVENTS + results.length)
        .abortSignal(AbortSignal.timeout(8000));
      if (error) {
        console.error('[RelatedEvents] fill query failed:', error.message);
      } else if (data) {
        for (const e of data as RelatedEvent[]) {
          if (results.length >= MAX_EVENTS) break;
          if (!seen.has(e.id)) {
            seen.add(e.id);
            results.push(e);
          }
        }
      }
    }
  } catch (err) {
    // Sektion ist Zusatznutzen — ein DB-Schluckauf darf den Blog-Render
    // nicht mitreißen.
    console.error('[RelatedEvents] failed:', err);
  }

  return results;
}

export async function RelatedEvents({ postTitle }: { postTitle: string }) {
  const events = await fetchRelatedEvents(postTitle);

  return (
    <section className="mb-14" data-testid="related-events">
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
        Ähnliche Events &amp; Termine
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Live aus unserem Kalender — täglich aktualisiert aus über 140 Quellen.
      </p>

      {events.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 mb-6">
          {events.map(e => (
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
              </Link>
            </li>
          ))}
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
