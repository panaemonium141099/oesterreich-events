'use client';

/**
 * Vergleich Clusterung vs. geboostetes Event.
 *
 * Wenn ein echter Karten-Screenshot unter
 *   public/images/business/boost-map.png
 * liegt, wird dieser angezeigt (das ist das eigentliche Beweisbild). Fehlt die
 * Datei, fällt die Komponente automatisch auf die schematische Zwei-Panel-
 * Nachbildung zurück (heller Cluster-Kreis mit Zähler + violetter Boost-Pin,
 * dem echten Map-Stil aus EventMap.tsx nachempfunden).
 */

import { useState } from 'react';

const REAL_SCREENSHOT = '/images/business/boost-map.png';

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
  const [hasReal, setHasReal] = useState(true);

  // Echtes Beweisbild — wird gezeigt, sobald die Datei existiert. Schlägt das
  // Laden fehl (Datei fehlt noch), wird auf die schematische Nachbildung
  // umgeschaltet.
  if (hasReal) {
    return (
      <figure className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0e1626]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REAL_SCREENSHOT}
          alt="Geboostetes Event mit violettem Marker bleibt einzeln sichtbar, während alle anderen Events geclustert sind"
          className="w-full h-auto block"
          onError={() => setHasReal(false)}
        />
        <figcaption className="text-xs text-white/40 px-4 py-3">
          Echte Karte: das geboostete Event (violetter Marker) bleibt einzeln &
          hervorgehoben, während alle anderen Events zu Clustern zusammengefasst sind.
        </figcaption>
      </figure>
    );
  }

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
      <figure className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[0.08] to-transparent p-4">
        <figcaption className="text-xs uppercase tracking-wider text-violet-300/90 mb-3 px-1">
          Mit Boost
        </figcaption>
        <MapPanel>
          <Cluster count={24} className="left-[18%] top-[30%]" />
          <Cluster count={41} className="left-[64%] top-[60%]" />

          {/* Hervorgehobenes Event — eigener Marker, nicht geclustert.
              Violett = identisch zur echten .marker-boosted-Optik auf der Karte. */}
          <div className="absolute left-[44%] top-[40%]">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-violet-500/30 blur-lg" aria-hidden="true" />
              <div className="relative flex items-center gap-1.5 rounded-full bg-violet-500 pl-2 pr-3 py-1.5 shadow-lg shadow-violet-500/40">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.5 5.8 21.2l1.6-7L2 9.5l7.1-.6z" />
                </svg>
                <span className="text-[11px] font-bold text-white whitespace-nowrap">Dein Event</span>
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
