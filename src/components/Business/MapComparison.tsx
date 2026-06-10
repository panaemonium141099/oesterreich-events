/**
 * Vergleich Clusterung vs. geboostetes Event.
 *
 * Zeigt zwei Karten-Ausschnitte nebeneinander: links die normale Clusterung,
 * rechts dasselbe mit einem hervorgehobenen Event, das NICHT geclustert wird.
 *
 * Die Marker sind dem echten Map-Stil nachgebildet (EventMap.tsx:
 * Cluster = heller Kreis mit Zähler + blauem Ring). Sobald echte Live-
 * Screenshots vorliegen, können die beiden <MapPanel>-Inhalte durch
 * <img src="/images/business/…"> ersetzt werden.
 */

/** Heller Cluster-Kreis mit Event-Anzahl — exakt der Stil aus EventMap. */
function Cluster({ count, className = '' }: { count: number; className?: string }) {
  const size = count >= 50 ? 56 : count >= 10 ? 48 : 40;
  return (
    <div
      className={`absolute flex items-center justify-center rounded-full bg-white/90 ring-2 ring-blue-600/25 text-[#1e3a5f] font-semibold tabular-nums shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: size >= 56 ? 15 : 13 }}
    >
      {count}
    </div>
  );
}

/** Karten-Hintergrund: gedämpfter Map-Look (kein echtes Mapbox nötig). */
function MapPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-56 sm:h-64 overflow-hidden rounded-xl bg-[#0e1626]">
      {/* faint "Straßen"-Raster, damit es nach Karte aussieht */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(#4b6280 1px, transparent 1px), linear-gradient(90deg, #4b6280 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 40%, rgba(56,89,138,0.5), transparent 45%), radial-gradient(circle at 75% 70%, rgba(56,89,138,0.4), transparent 40%)',
        }}
      />
      {children}
    </div>
  );
}

export function MapComparison() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Ohne Boost */}
      <figure className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <figcaption className="text-xs uppercase tracking-wider text-white/30 mb-3 px-1">
          Ohne Boost
        </figcaption>
        <MapPanel>
          <Cluster count={24} className="left-[18%] top-[30%]" />
          <Cluster count={8} className="left-[58%] top-[24%]" />
          <Cluster count={41} className="left-[64%] top-[60%]" />
          <Cluster count={6} className="left-[30%] top-[68%]" />
        </MapPanel>
        <p className="text-xs text-white/40 mt-3 px-1">
          Dein Event steckt in einem Cluster — erst nach mehrmaligem Reinzoomen sichtbar.
        </p>
      </figure>

      {/* Mit Boost */}
      <figure className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-4">
        <figcaption className="text-xs uppercase tracking-wider text-amber-400/80 mb-3 px-1">
          Mit Boost
        </figcaption>
        <MapPanel>
          <Cluster count={24} className="left-[18%] top-[30%]" />
          <Cluster count={41} className="left-[64%] top-[60%]" />

          {/* Hervorgehobenes Event — eigener Marker, nicht geclustert */}
          <div className="absolute left-[44%] top-[40%]">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-amber-400/25 blur-lg" aria-hidden="true" />
              <div className="relative flex items-center gap-1.5 rounded-full bg-amber-400 pl-2 pr-3 py-1.5 shadow-lg shadow-amber-500/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1205" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-[11px] font-bold text-[#1a1205] whitespace-nowrap">Dein Event</span>
              </div>
            </div>
          </div>
        </MapPanel>
        <p className="text-xs text-white/60 mt-3 px-1">
          Dein Event bleibt einzeln & hervorgehoben — sofort sichtbar, auch wenn alle
          anderen geclustert sind.
        </p>
      </figure>
    </div>
  );
}
