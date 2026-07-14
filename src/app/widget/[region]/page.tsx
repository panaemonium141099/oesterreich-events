/**
 * /widget/[region] — embeddbares B2B-Event-Widget (MASTERPLAN P3 Syndication).
 *
 * Fremde Seiten (Gemeinden, Tourismusverbände, Venues, Medien) betten diese
 * Route als <iframe> ein — der Embed-Code wird auf /fuer-firmen#widget
 * generiert und enthält zusätzlich einen echten <a>-Backlink unter dem
 * iframe (SEO-Bedingung der kostenlosen Nutzung).
 *
 * Framing-Erlaubnis: next.config.ts setzt für /widget/:path* eine CSP mit
 * `frame-ancestors *` — die EINZIGE Fläche der Seite, die fremde Origins
 * einbetten dürfen (Rest bleibt X-Frame-Options=SAMEORIGIN).
 *
 * STATISCH-SICHER wie die Landing (§10.2): cookie-freier Anon-Client, kein
 * auth, keine searchParams — Optik ist fix (dunkle Brand-Karte), Varianten
 * leben im Pfad. ISR 30 min × 10 Regionen = vernachlässigbare DB-Last;
 * Query-Form per EXPLAIN belegt (Index-Walk idx_events_start_date, 9–52 ms).
 *
 * Chrome: V4TopNav/V4TabBar blenden sich auf /widget-Pfaden selbst aus.
 * PageviewTracker läuft mit → Widget-Reichweite landet als page_group
 * '/widget' in analytics_daily; Klicks tracken via data-track-Attribute.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { BUNDESLAND_NAMES, type BundeslandId } from '@/lib/districtsAT';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export const revalidate = 1800;
// Geschlossene Regions-Whitelist (generateStaticParams ist die SoT):
// unbekannte Slugs → hartes 404 ohne Render. Ohne dieses Flag streamt
// Next erst die Loading-Shell (Status 200) und rendert das 404 inline.
// Beim Ausbau auf Gemeinde-Slugs wieder auf dynamisch umstellen.
export const dynamicParams = false;

export const metadata: Metadata = {
  title: 'Event-Widget — LassTreffen.at',
  robots: { index: false, follow: false },
};

const REGION_LABELS: Record<string, string> = {
  oesterreich: 'ganz Österreich',
  ...BUNDESLAND_NAMES,
};

/** Hub-Seite, auf die der „Alle Events"-Footer-Link zeigt. */
function hubPath(region: string): string {
  return region === 'oesterreich' ? '/entdecken' : `/${region}`;
}

export function generateStaticParams() {
  return Object.keys(REGION_LABELS).map((region) => ({ region }));
}

interface WidgetEvent {
  id: string;
  slug: string | null;
  title: string | null;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  postal_code: string | null;
  address: string | null;
  category: string | null;
  image_url: string | null;
}

const ROW_LIMIT = 8;
const POOL = 16; // Reserve für den Recurring-Dedupe (Muster get-landing-data)

const dayFmt = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  timeZone: 'Europe/Vienna',
});
const dateFmt = new Intl.DateTimeFormat('de-AT', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Vienna',
});

function dedupeRecurring(rows: WidgetEvent[]): WidgetEvent[] {
  const seen = new Set<string>();
  const out: WidgetEvent[] = [];
  for (const e of rows) {
    const key = `${(e.title ?? '').trim().toLowerCase()}::${(e.image_url ?? '').trim()}`;
    if (e.title && seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  const label = REGION_LABELS[region];
  if (!label) notFound();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  let query = supabase
    .from('events')
    .select('id,slug,title,start_date,location_name,bundesland,postal_code,address,category,image_url')
    .gte('start_date', new Date().toISOString())
    .eq('publish_status', 'published')
    .gte('event_score', 40)
    .order('start_date', { ascending: true })
    .limit(POOL);
  if (region !== 'oesterreich') {
    query = query.eq('bundesland', region);
  }

  const { data } = await query;
  const events = dedupeRecurring((data ?? []) as WidgetEvent[]).slice(0, ROW_LIMIT);

  const utm = `utm_source=widget&utm_medium=embed&utm_campaign=${region}`;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col text-[14px]">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.07] flex items-baseline justify-between gap-3">
        <h1 className="font-bold text-[15px] tracking-tight truncate">
          Events in {label}
        </h1>
        <span className="text-[11px] text-white/35 whitespace-nowrap">Nächste Termine</span>
      </div>

      {/* Liste */}
      <div className="flex-1">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-white/40 text-center">
            Gerade keine Events — schau auf{' '}
            <a
              href={`https://lasstreffen.at${hubPath(region)}?${utm}`}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-2 text-white/70"
            >
              LassTreffen.at
            </a>{' '}
            vorbei.
          </p>
        ) : (
          <ul>
            {events.map((e) => {
              const d = new Date(e.start_date);
              const href = `https://lasstreffen.at${buildEventUrlV2(e)}?${utm}`;
              return (
                <li key={e.id} className="border-b border-white/[0.05] last:border-b-0">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    data-track="widget_event_click"
                    data-track-id={e.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-white/[0.06] border border-white/[0.07] shrink-0">
                      <span className="text-[10px] uppercase tracking-wide text-white/45 leading-none">
                        {dayFmt.format(d)}
                      </span>
                      <span className="text-[12.5px] font-bold tabular-nums leading-tight mt-0.5">
                        {dateFmt.format(d)}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-snug truncate">
                        {e.title}
                      </span>
                      <span className="block text-[12px] text-white/40 truncate">
                        {(() => {
                          const bl = e.bundesland && e.bundesland in BUNDESLAND_NAMES
                            ? BUNDESLAND_NAMES[e.bundesland as BundeslandId]
                            : null;
                          // "Wien · Wien" vermeiden, wenn location_name das
                          // Bundesland selbst ist.
                          const loc = e.location_name?.trim().toLowerCase() === bl?.toLowerCase()
                            ? null
                            : e.location_name;
                          return [loc, bl].filter(Boolean).join(' · ');
                        })()}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer — Branding + Hub-Link */}
      <div className="px-4 py-2.5 border-t border-white/[0.07] flex items-center justify-between gap-3 text-[12px]">
        <a
          href={`https://lasstreffen.at/?${utm}`}
          target="_blank"
          rel="noopener"
          data-track="widget_powered_click"
          className="text-white/40 hover:text-white/70 transition-colors whitespace-nowrap"
        >
          Powered by <span className="font-semibold text-white/60">LassTreffen.at</span>
        </a>
        <a
          href={`https://lasstreffen.at${hubPath(region)}?${utm}`}
          target="_blank"
          rel="noopener"
          data-track="widget_more_click"
          className="text-amber-300/80 hover:text-amber-200 font-semibold transition-colors whitespace-nowrap"
        >
          Alle Events →
        </a>
      </div>
    </div>
  );
}
