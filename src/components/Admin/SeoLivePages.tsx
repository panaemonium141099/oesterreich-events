'use client';

/**
 * SeoLivePages — Live-Auswertung der Search-Console im Admin-SEO-Panel.
 *
 * Ergaenzt die snapshot-basierten Bloecke: der Tages-Snapshot haelt nur die
 * Top-50-Seiten eines 28-Tage-Fensters fest, in dem die abgelaufenen
 * Sommer-Feste alles ueberdecken. Diese Ansicht zieht bis zu 5.000 Zeilen
 * live (frei waehlbares Fenster) und zeigt:
 *
 *   - Verteilung nach Seitentyp inkl. Aktivitaeten (liefen vorher unter
 *     "Andere" und waren damit unsichtbar)
 *   - Event-Nachfrage getrennt nach kommenden und vergangenen Terminen
 *   - Chancen-Tabellen: Striking Distance (Pos. 4-20) und CTR-Luecke
 *     (gute Position, zu wenige Klicks)
 */

import { useCallback, useEffect, useState } from 'react';

interface Summary {
  impressions: number;
  clicks: number;
  pageCount: number;
  ctr: number;
  avgPosition: number;
}

interface PageRow {
  url: string;
  path: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  type: string;
  eventDate: string | null;
  isFuture: boolean | null;
  missedClicks?: number;
  expectedCtr?: number;
}

interface LiveResponse {
  window: { startDate: string; endDate: string; days: number };
  rowsReturned: number;
  rowLimitHit: boolean;
  totals: Summary;
  byType: Record<string, Summary>;
  events: { future: Summary; past: Summary };
  striking: PageRow[];
  ctrGap: PageRow[];
  topPages: PageRow[];
  error?: string;
  detail?: string;
}

const TYPE_LABELS: Record<string, string> = {
  event_detail: 'Events',
  aktivitaet: 'Aktivitäten',
  gemeinde: 'Gemeinden',
  thema: 'Themen',
  bundesland: 'Bundesländer',
  blog: 'Blog',
  other: 'Andere',
};

const num = (n: number) => n.toLocaleString('de-AT');
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

type TabKey = 'striking' | 'ctrGap' | 'top';

export function SeoLivePages() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('striking');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/seo/live-pages?days=${days}`)
      .then(async (r) => {
        const json = (await r.json()) as LiveResponse;
        if (!r.ok) throw new Error(json.detail ?? json.error ?? `HTTP ${r.status}`);
        return json;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const rows = data
    ? tab === 'striking' ? data.striking : tab === 'ctrGap' ? data.ctrGap : data.topPages
    : [];

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            Live aus der Search Console
          </h2>
          <p className="text-xs text-white/40 mt-1">
            {data
              ? `${data.window.startDate} bis ${data.window.endDate} · ${num(data.rowsReturned)} Seiten${data.rowLimitHit ? ' (Limit erreicht)' : ''}`
              : 'Direkt abgefragt — unabhängig vom Tages-Snapshot'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 28, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === d ? 'bg-white/[0.12] text-white/90' : 'bg-white/[0.04] text-white/50 hover:text-white/80'
              }`}
            >
              {d} Tage
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-40"
          >
            {loading ? 'lädt…' : 'Neu laden'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {data && !error && (
        <>
          {/* Event-Nachfrage: kommend vs. vergangen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['Kommende Termine', data.events.future, 'text-emerald-300'],
              ['Vergangene Termine', data.events.past, 'text-amber-300'],
            ] as const).map(([label, s, color]) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className={`text-[10px] uppercase tracking-wider ${color} mb-2`}>{label}</p>
                <p className="text-xl font-semibold text-white/90 tabular-nums">{num(s.impressions)}</p>
                <p className="text-xs text-white/40 mt-1">
                  Impressionen · {num(s.clicks)} Klicks · CTR {pct(s.ctr)} · Ø Pos. {s.avgPosition.toFixed(1)} · {num(s.pageCount)} Seiten
                </p>
              </div>
            ))}
          </div>

          {/* Verteilung nach Seitentyp */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Nach Seitentyp</p>
            <div className="space-y-1.5">
              {Object.entries(data.byType).map(([type, s]) => {
                const max = Math.max(...Object.values(data.byType).map((x) => x.impressions), 1);
                return (
                  <div key={type} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                    <span className="text-xs text-white/60">{TYPE_LABELS[type] ?? type}</span>
                    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500/70 to-indigo-400/80"
                        style={{ width: `${(s.impressions / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/50 tabular-nums whitespace-nowrap">
                      {num(s.impressions)} Impr · {num(s.clicks)} Kl · CTR {pct(s.ctr)} · Ø {s.avgPosition.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chancen-Tabellen */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                ['striking', `Striking Distance (${data.striking.length})`],
                ['ctrGap', `CTR-Lücke (${data.ctrGap.length})`],
                ['top', 'Top-Seiten'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === key ? 'bg-white/[0.12] text-white/90' : 'bg-white/[0.04] text-white/50 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-white/35 mb-2">
              {tab === 'striking'
                ? 'Position 4–20 mit mindestens 20 Impressionen — hier bringt jede Verbesserung am schnellsten Klicks.'
                : tab === 'ctrGap'
                  ? 'Gute Position, aber deutlich weniger Klicks als für diese Position üblich. „Verpasst" = geschätzte Klicks, die ein besserer Titel/Snippet holen würde.'
                  : 'Die sichtbarsten Seiten im gewählten Zeitraum.'}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="py-2 pr-3 font-medium">Seite</th>
                    <th className="py-2 px-2 font-medium text-right">Impr.</th>
                    <th className="py-2 px-2 font-medium text-right">Klicks</th>
                    <th className="py-2 px-2 font-medium text-right">CTR</th>
                    <th className="py-2 px-2 font-medium text-right">Pos.</th>
                    {tab === 'ctrGap' && <th className="py-2 pl-2 font-medium text-right">Verpasst</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 40).map((r) => (
                    <tr key={r.url} className="border-t border-white/[0.05]">
                      <td className="py-2 pr-3 max-w-[420px]">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/75 hover:text-white truncate block"
                          title={r.path}
                        >
                          {r.path}
                        </a>
                        <span className="text-[10px] uppercase tracking-wider text-white/30">
                          {TYPE_LABELS[r.type] ?? r.type}
                          {r.isFuture === true && <span className="text-emerald-400/70"> · kommt</span>}
                          {r.isFuture === false && <span className="text-amber-400/70"> · vorbei</span>}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/70">{num(r.impressions)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/70">{num(r.clicks)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/50">{pct(r.ctr)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/50">{r.position.toFixed(1)}</td>
                      {tab === 'ctrGap' && (
                        <td className="py-2 pl-2 text-right tabular-nums text-amber-300/80">+{r.missedClicks}</td>
                      )}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-white/30">
                        Keine Zeilen in dieser Auswahl.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
