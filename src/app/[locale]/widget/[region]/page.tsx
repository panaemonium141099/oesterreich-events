/**
 * /widget/[region] — embeddbares B2B-Event-Widget (MASTERPLAN P3 Syndication).
 *
 * Fremde Seiten (Gemeinden, Tourismusverbände, Venues, Medien) betten diese
 * Route als <iframe> ein — der Embed-Code wird auf /fuer-firmen#widget
 * generiert und enthält zusätzlich einen echten <a>-Backlink unter dem
 * iframe (SEO-Bedingung der kostenlosen Nutzung).
 *
 * Scopes (Auflösung in src/lib/widget/scopes.ts): ganz Österreich,
 * Bundesland, Bezirk ('bezirk-…', filtert events.district) und Gemeinde
 * ('{plz}-{ort}', 10-km-Umkreis wie die Gemeinde-Hub-Seiten). Unbekannte
 * Slugs → notFound.
 *
 * Framing-Erlaubnis: next.config.ts setzt für /widget/:path* eine CSP mit
 * `frame-ancestors *` — die EINZIGE Fläche der Seite, die fremde Origins
 * einbetten dürfen (Rest bleibt X-Frame-Options=SAMEORIGIN).
 *
 * STATISCH-SICHER wie die Landing (§10.2): cookie-freier Anon-Client, kein
 * auth, keine searchParams. ISR 30 min; nur tatsächlich angefragte Scopes
 * werden gerendert/gecacht. Query-Formen per EXPLAIN belegt (2026-07-14):
 * Bundesland/Bezirk laufen über idx_events_bundesland_start_date — dafür
 * MÜSSEN visibility='public' + lat/lng NOT NULL mitgefiltert werden
 * (partieller Index), und event_score bleibt BEWUSST aus dem SQL (der
 * Score-Index kippt den Plan in ein 500-ms-BitmapAnd; Gate läuft in JS).
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
import { bboxAround, haversineKm } from '@/lib/gemeinden/data';
import { resolveWidgetScope, REGION_LABELS, type WidgetScope } from '@/lib/widget/scopes';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Event-Widget — LassTreffen.at',
  robots: { index: false, follow: false },
};

/** Die 10 Regionen werden beim Build vorgerendert; Bezirke/Gemeinden on demand. */
/** Build-Resilienz (2026-08-26): on-demand ISR statt Build-Prerender —
 *  die 9 Regionen x 2 Locales hingen beim Build an der Micro-Instanz
 *  und rissen bei DB-Last den ganzen Vercel-Deploy mit (>60s-Kill). */
export function generateStaticParams(): Array<{ region: string }> {
  return [];
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
  event_score: number | null;
  latitude: number | null;
  longitude: number | null;
}

const ROW_LIMIT = 8;
const EVENT_COLS =
  'id,slug,title,start_date,location_name,bundesland,postal_code,address,category,image_url,event_score,latitude,longitude';

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

async function loadEvents(scope: WidgetScope): Promise<WidgetEvent[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  let query = supabase
    .from('events')
    .select(EVENT_COLS)
    .gte('start_date', new Date().toISOString())
    .eq('publish_status', 'published')
    .eq('visibility', 'public')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('start_date', { ascending: true });

  if (scope.kind === 'gemeinde') {
    const { minLat, maxLat, minLng, maxLng } = bboxAround(scope.lat, scope.lng, 10);
    query = query
      .gte('latitude', minLat).lte('latitude', maxLat)
      .gte('longitude', minLng).lte('longitude', maxLng)
      .limit(48);
  } else {
    if (scope.bundesland) query = query.eq('bundesland', scope.bundesland);
    if (scope.kind === 'bezirk') query = query.eq('district', scope.district);
    query = query.limit(36);
  }

  const { data } = await query;
  let rows = (data ?? []) as WidgetEvent[];

  if (scope.kind === 'gemeinde') {
    // bbox ist rechteckig — auf echten 10-km-Kreis nachfiltern (Muster
    // der Gemeinde-Hub-Seiten).
    rows = rows.filter(
      (e) => e.latitude != null && e.longitude != null
        && haversineKm(scope.lat, scope.lng, e.latitude, e.longitude) <= 10,
    );
  }

  // Qualitäts-Gate bewusst in JS statt SQL (s. Kopfkommentar).
  const scored = rows.filter((e) => (e.event_score ?? 0) >= 40);
  // Kleine Scopes nicht leerfiltern: lieber ungescorte Events als ein
  // leeres Widget auf einer Gemeinde-Website.
  const pool = scored.length >= ROW_LIMIT ? scored : rows;

  return dedupeRecurring(pool).slice(0, ROW_LIMIT);
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  const scope = resolveWidgetScope(region);
  if (!scope) notFound();

  const events = await loadEvents(scope);
  const utm = `utm_source=widget&utm_medium=embed&utm_campaign=${scope.slug}`;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col text-[14px]">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.07] flex items-baseline justify-between gap-3">
        <h1 className="font-bold text-[15px] tracking-tight truncate">
          Events in {scope.label}
        </h1>
        <span className="text-[11px] text-white/35 whitespace-nowrap">Nächste Termine</span>
      </div>

      {/* Liste */}
      <div className="flex-1">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-white/40 text-center">
            Gerade keine Events — schau auf{' '}
            <a
              href={`https://lasstreffen.at${scope.hubPath}?${utm}`}
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
          href={`https://lasstreffen.at${scope.hubPath}?${utm}`}
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
