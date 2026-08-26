import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { WeekHeatmap } from '@/components/Heatmap/WeekHeatmap';
import { Footer } from '@/components/Legal/Footer';
import { Link } from '@/i18n/navigation';

/**
 * /wo-ist-was-los — öffentliche Event-Dichte-Heatmap Österreichs (fn-19).
 *
 * Linkbait/PR-Fläche: animierbare Heatmap (Client, aus dem existierenden
 * CDN-Points-Snapshot — null zusätzliche DB-Last) + serverseitig
 * gerendertes Bezirks-Ranking der nächsten 7 Tage als teilbarer,
 * indexierbarer Inhalt. Datenbasis, die sonst niemand hat: ~90k kommende
 * Events aus ~144 Quellen.
 *
 * Ranking-Aggregation läuft 1x/h (ISR) über die RPC get_event_map_points
 * (liest die schmale MV, anon-Key wie /api/events/map-points).
 * Seite ist bewusst DE-only (Canonical ohne /en-Alternate).
 */

export const revalidate = 3600;

const EPOCH_MS = Date.UTC(2026, 0, 1);

export const metadata: Metadata = {
  title: 'Wo ist was los in Österreich? Die Event-Heatmap',
  description:
    'Live-Heatmap der Event-Dichte in ganz Österreich: Welche Bezirke haben diese Woche das meiste Programm? Basierend auf zehntausenden Terminen aus über 140 Quellen.',
  alternates: { canonical: 'https://lasstreffen.at/wo-ist-was-los' },
  openGraph: {
    title: 'Wo ist was los in Österreich? Die Event-Heatmap',
    description:
      'Welche Bezirke haben diese Woche das meiste Programm? Live-Heatmap aus zehntausenden Terminen.',
    type: 'website',
  },
};

/** DB-Werte sind lowercase-Slugs ("linz (stadt)", "kaernten") — fuers
 *  Ranking menschenlesbar kapitalisieren. */
function prettify(name: string): string {
  const SMALL = new Set(['an', 'am', 'im', 'in', 'der', 'die', 'das', 'und', 'auf']);
  return name.replace(/\p{L}+/gu, w =>
    SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
  );
}

interface DistrictRank {
  district: string;
  bundesland: string;
  count: number;
}

interface WeekStats {
  total: number;
  top: DistrictRank[];
  byBundesland: Array<{ bundesland: string; count: number }>;
}

async function loadWeekStats(): Promise<WeekStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const supabase = createClient(url, key);
    // Harter Timeout: haengt die DB (I/O-Sturm), darf der Prerender nie in
    // den 60s-Static-Kill laufen — Seite rendert dann ohne Ranking und das
    // naechste Revalidate traegt es nach.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_event_map_points')
      .abortSignal(AbortSignal.timeout(15_000));
    if (error || !data) return null;

    const p = data as {
      n: number; start: number[]; end: number[];
      district: number[]; districts: string[];
      bl: number[]; bls: string[];
    };

    const today = Math.floor((Date.now() - EPOCH_MS) / 86_400_000);
    const to = today + 6;

    const districtCounts = new Map<number, number>();
    const districtBl = new Map<number, number>();
    const blCounts = new Map<number, number>();
    let total = 0;

    for (let i = 0; i < p.n; i++) {
      const s = p.start[i];
      const e = p.end[i] || s;
      if (s > to || e < today) continue;
      total++;
      const d = p.district[i];
      // Leerer District = Quelle ohne Bezirks-Mapping (z. B. ein Kaernten-
      // Feed mit 4,6k Events) — gehoert in total/Bundesland, aber nicht
      // ins Bezirks-Ranking.
      if (d != null && d >= 0 && (p.districts[d] ?? '') !== '') {
        districtCounts.set(d, (districtCounts.get(d) ?? 0) + 1);
        districtBl.set(d, p.bl[i]);
      }
      const b = p.bl[i];
      if (b != null && b >= 0) blCounts.set(b, (blCounts.get(b) ?? 0) + 1);
    }

    const top: DistrictRank[] = [...districtCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([d, count]) => ({
        district: prettify(p.districts[d] ?? '?'),
        bundesland: prettify(p.bls[districtBl.get(d) ?? -1] ?? ''),
        count,
      }));

    const byBundesland = [...blCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([b, count]) => ({ bundesland: prettify(p.bls[b] ?? '?'), count }));

    return { total, top, byBundesland };
  } catch (err) {
    console.error('[wo-ist-was-los] stats failed:', err);
    return null;
  }
}

export default async function HeatmapPage() {
  const stats = await loadWeekStats();

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)] flex flex-col">
      <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 md:px-14 py-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          Live aus {stats ? stats.total.toLocaleString('de-AT') : 'zehntausenden'} Terminen · über 140 Quellen
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          Wo ist was los in Österreich?
        </h1>
        <p className="text-[var(--v4-ink-70)] max-w-2xl mb-8">
          Die Heatmap zeigt die Event-Dichte der nächsten Tage in ganz Österreich — von
          Bregenz bis Neusiedl. Je heller, desto mehr Programm. Zoom rein und finde heraus,
          was in deiner Gegend geht.
        </p>

        <WeekHeatmap />

        {stats && stats.top.length > 0 && (
          <section className="mt-12 grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xl font-bold mb-4">
                Die 10 lebendigsten Bezirke dieser Woche
              </h2>
              <ol className="space-y-2">
                {stats.top.map((d, i) => (
                  <li key={d.district} className="flex items-baseline gap-3 border-b border-white/5 pb-2">
                    <span className="text-[var(--v4-ink-50)] text-sm w-6 shrink-0">{i + 1}.</span>
                    <span className="font-semibold flex-1">
                      {d.district}
                      {d.bundesland && (
                        <span className="font-normal text-[var(--v4-ink-50)] text-sm"> · {d.bundesland}</span>
                      )}
                    </span>
                    <span className="text-sm text-[var(--v4-ink-70)] tabular-nums">
                      {d.count.toLocaleString('de-AT')} Events
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-4">Events nach Bundesland</h2>
              <ul className="space-y-2">
                {stats.byBundesland.map(b => {
                  const max = stats.byBundesland[0]?.count || 1;
                  return (
                    <li key={b.bundesland} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-sm">{b.bundesland}</span>
                      <span className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-[#f5b942]/70"
                          style={{ width: `${Math.max(4, Math.round((b.count / max) * 100))}%` }}
                        />
                      </span>
                      <span className="text-sm text-[var(--v4-ink-70)] tabular-nums w-16 text-right">
                        {b.count.toLocaleString('de-AT')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-12 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-lg font-bold mb-2">Woher kommen die Daten?</h2>
          <p className="text-sm text-[var(--v4-ink-70)] max-w-3xl leading-relaxed">
            LassTreffen aggregiert täglich Veranstaltungen aus über 140 Quellen — von
            Gemeinde-Kalendern über Venue-Programme bis zu Ticket-Anbietern — und
            verortet sie auf der Karte. Die Heatmap und das Ranking aktualisieren sich
            laufend aus diesem Bestand.{' '}
            <Link href="/entdecken" className="underline underline-offset-2 hover:text-[var(--v4-ink)]">
              Alle Events entdecken
            </Link>{' '}
            oder{' '}
            <Link href="/map" className="underline underline-offset-2 hover:text-[var(--v4-ink)]">
              auf der interaktiven Karte
            </Link>{' '}
            stöbern.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
