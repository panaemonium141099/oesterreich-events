/**
 * BlogTicketBox — Affiliate-Ticket-Box für Blog-Posts (MASTERPLAN §7.1.3).
 *
 * Zieht live die passenden buchbaren Eventim-Events (ticket_url trägt die
 * Affiliate-ID J70) zum Festival des Posts und rendert bis zu 4 Termine:
 * Titel verlinkt intern auf die Event-Detailseite (interne Verlinkung
 * Blog→Events), der CTA geht mit rel="sponsored" zum Eventim-Shop.
 *
 * Statisch-sicher: cookie-freier Anon-Client (kein cookies()!), damit die
 * Blog-Seite eine prerenderte ISR-Route bleibt — die Termine refreshen
 * über das revalidate-Fenster der Seite.
 *
 * Kennzeichnung: "Anzeige"-Label + Provisions-Disclosure gemäß der
 * Transparenz-Zusage auf /ueber-uns. Klicks laufen über den globalen
 * ClickTracker (data-track="ticket_click"), Seiten-Attribution kommt über
 * das page-Feld der Analytics automatisch mit.
 *
 * Kein Treffer (z. B. Gratis-Festivals, nicht bei Eventim gelistet) →
 * rendert nichts.
 */

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

interface TicketEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  price_min: number | null;
  price_text: string | null;
  ticket_url: string;
}

/** Suchbegriffe aus dem Post-Titel: Jahreszahlen + Füllwörter raus,
 *  maximal 2 distinctive Tokens (AND-verknüpft als ilike). */
const TITLE_STOPWORDS = new Set([
  'festival', 'festspiele', 'open', 'air', 'openair', 'fest',
  'das', 'der', 'die', 'und', 'the', 'von', 'bei', 'mit',
]);

export function deriveSearchTerms(postTitle: string): string[] {
  return postTitle
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, ' ') // Jahreszahlen
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 4 && !TITLE_STOPWORDS.has(w))
    .slice(0, 2);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return time === '00:00' ? date : `${date}, ${time}`;
}

function formatPrice(e: TicketEvent): string | null {
  if (e.price_min != null && e.price_min > 0) {
    return `ab ${e.price_min.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
  return e.price_text ?? null;
}

async function fetchTicketEvents(postTitle: string): Promise<TicketEvent[]> {
  const terms = deriveSearchTerms(postTitle);
  if (terms.length === 0) return [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  let q = supabase
    .from('events')
    .select('id, slug, title, start_date, location_name, postal_code, address, bundesland, price_min, price_text, ticket_url')
    .eq('source_name', 'Eventim')
    .eq('visibility', 'public')
    .in('publish_status', ['published', 'published_low_confidence'])
    .not('ticket_url', 'is', null)
    .gte('start_date', new Date().toISOString());
  for (const term of terms) {
    q = q.ilike('title', `%${term}%`);
  }
  const { data, error } = await q.order('start_date', { ascending: true }).limit(4);
  if (error) {
    console.error('[BlogTicketBox] query failed:', error);
    return [];
  }
  return (data ?? []) as TicketEvent[];
}

export async function BlogTicketBox({ postTitle }: { postTitle: string }) {
  const events = await fetchTicketEvents(postTitle);
  if (events.length === 0) return null;

  return (
    <section className="mb-14 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
          Tickets sichern
        </p>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
          Anzeige
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {events.map(e => {
          const price = formatPrice(e);
          return (
            <div key={e.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">
                  {formatDate(e.start_date)}
                </p>
                <Link
                  href={buildEventUrlV2(e)}
                  className="font-semibold text-gray-900 text-sm leading-snug hover:text-gray-600 transition-colors line-clamp-2"
                >
                  {e.title}
                </Link>
                <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
                  {[e.location_name, e.bundesland].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {price && (
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{price}</span>
                )}
                <a
                  href={e.ticket_url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  data-track="ticket_click"
                  data-track-id={e.id}
                  data-track-provider="eventim"
                  className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap"
                >
                  Tickets
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Affiliate-Links: Kaufst du über diese Links, erhält LassTreffen.at eine
          Provision vom Ticketanbieter — am Preis ändert sich für dich nichts.
          Kauf und Zahlung erfolgen direkt beim offiziellen Anbieter.
        </p>
      </div>
    </section>
  );
}
