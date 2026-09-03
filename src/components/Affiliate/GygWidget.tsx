'use client';

/**
 * GygWidget — echtes GetYourGuide-Widget (fn-22, Stufe 2).
 *
 * Drei Bauformen:
 *   activities — Touren EINES Ortes, festgenagelt ueber die GYG-Location-ID
 *                (die Zahl aus "wien-l7"). Das ist der Normalfall.
 *   auto       — sucht sich sein Angebot selbst anhand des Seitentexts
 *   city       — Teaser-Banner mit Such-CTA statt Tourenliste
 *
 * WARUM FESTGENAGELT STATT auto: das auto-Widget fuellt auf, wenn es vor
 * Ort nichts findet — auf der Pinkafeld-Seite standen unter "Touren in
 * Burgenland" ein Pinball-Museum und eine Pinguin-Parade aus Melbourne.
 * Mit location_id liefert dieselbe Seite Parndorf-Outlet und
 * Weinprobe, Klagenfurt die Tscheppaschlucht (live gegengeprueft).
 * Dazu der Loader (pa.umd.production.min.js), der die data-gyg-*-Divs
 * einsammelt und befuellt.
 *
 * WARUM SO VORSICHTIG (Lehre aus fn-15.4, wo AdSense wegen CLS wieder
 * ausgebaut wurde):
 *   1. Das Fremd-Script laedt ERST, wenn das Widget in Sichtnaehe kommt —
 *      oben blockiert nichts, und Seiten ohne Widget laden es nie.
 *   2. Die Hoehe ist vorher reserviert, damit nichts springt.
 *   3. Bleibt das Widget leer (kein Angebot, Adblocker, Script
 *      geblockt), verschwindet die Flaeche komplett statt einen leeren
 *      Rahmen stehen zu lassen.
 *   4. Killswitch per Env: NEXT_PUBLIC_GYG_WIDGET_ENABLED. Aus = die
 *      Seite ist wieder komplett fremd-script-frei.
 *
 * WARUM partnerId ALS PROP und nicht aus process.env: Next backt
 * NEXT_PUBLIC_*-Werte beim BUILD ins Client-Bundle. Liest diese
 * Komponente sie selbst, steht im Bundle der Wert vom Build-Zeitpunkt —
 * eine spaetere Env-Aenderung am Server bliebe wirkungslos (lokal
 * nachgestellt: die ID fehlte im Chunk, das Widget blieb still leer).
 * Die Server-Komponente liest die Env zur Laufzeit und reicht sie
 * durch; damit genuegt zum Aktivieren ein Container-Neustart.
 *
 * Bewusst NICHT auf Event-Detailseiten: das ist unsere groesste
 * SEO-Flaeche (21.735 Views/30 Tage), dort bleibt die scriptfreie
 * TourBox.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

const LOADER_SRC = 'https://widget.getyourguide.com/dist/pa.umd.production.min.js';

/** Loader nur einmal pro Seite anhaengen, egal wie viele Widgets. */
function ensureLoader(partnerId: string): void {
  if (document.querySelector(`script[src="${LOADER_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = LOADER_SRC;
  script.async = true;
  script.defer = true;
  script.setAttribute('data-gyg-partner-id', partnerId);
  document.head.appendChild(script);
}

export interface GygWidgetProps {
  /** Partner-ID, kommt zur Laufzeit von der Server-Komponente. */
  partnerId: string;
  kind: 'activities' | 'auto' | 'city';
  /** Fuer "activities"/"city" Pflicht: GYG-Location-ID, z. B. 7 fuer Wien. */
  locationId?: number | null;
  /** Wie viele Touren das Widget zeigt (GYG empfiehlt 3). */
  items?: number;
  /** GYG-Sprachcode, z. B. "de-DE". */
  localeCode?: string;
  /** Reservierte Mindesthoehe, verhindert Layout-Shift. */
  minHeight?: number;
  /**
   * Was gezeigt wird, wenn das Widget nichts liefert (Adblocker, Script
   * geblockt, kein Angebot). Ohne Fallback verschwindet die Flaeche —
   * mit Fallback bleibt wenigstens der scriptfreie Link stehen.
   */
  fallback?: ReactNode;
  className?: string;
}

export function GygWidget({
  partnerId,
  kind,
  locationId,
  items = 3,
  localeCode = 'de-DE',
  minHeight = 420,
  fallback = null,
  className = '',
}: GygWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [empty, setEmpty] = useState(false);

  const usable = !!partnerId && (kind === 'auto' || locationId != null);
  const frame =
    kind === 'city'
      ? 'https://widget.getyourguide.com/default/city.frame'
      : 'https://widget.getyourguide.com/default/activities.frame';

  useEffect(() => {
    if (!usable || !hostRef.current) return;
    const el = hostRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [usable]);

  useEffect(() => {
    if (!inView || !partnerId) return;
    ensureLoader(partnerId);
    // Der Loader ersetzt den Inhalt des data-gyg-Divs. Bleibt er nach
    // ein paar Sekunden leer, hat das Widget nichts geliefert.
    const timer = setTimeout(() => {
      const slot = hostRef.current?.querySelector('[data-gyg-widget]');
      if (!slot || slot.childElementCount === 0) setEmpty(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [inView, partnerId]);

  // Kein Reservat-Rahmen um den Fallback: sonst klafft die volle
  // Widget-Hoehe unter einem einzeiligen Link.
  if (!usable || empty) return <>{fallback}</>;

  return (
    <div ref={hostRef} className={className} style={{ minHeight }}>
      {kind === 'auto' ? (
        <div
          data-gyg-widget="auto"
          data-gyg-locale-code={localeCode}
          data-gyg-partner-id={partnerId}
        />
      ) : (
        <div
          data-gyg-href={frame}
          data-gyg-location-id={String(locationId)}
          data-gyg-locale-code={localeCode}
          data-gyg-widget={kind}
          {...(kind === 'activities' ? { 'data-gyg-number-of-items': String(items) } : {})}
          data-gyg-partner-id={partnerId}
        />
      )}
    </div>
  );
}
