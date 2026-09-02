'use client';

/**
 * GygWidget — echtes GetYourGuide-Widget (fn-22, Stufe 2).
 *
 * Zwei Bauformen, beide aus dem Partner-Portal uebernommen:
 *   city — Top-Touren eines Ortes, braucht die GYG-Location-ID
 *          (die Zahl aus "wien-l7"), Ziel-Frame default/city.frame
 *   auto — liest den umgebenden Artikeltext und waehlt selbst passende
 *          Aktivitaeten; ohne weitere Parameter
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
  kind: 'city' | 'auto';
  /** Nur fuer kind="city": GYG-Location-ID, z. B. 7 fuer Wien. */
  locationId?: number | null;
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
  localeCode = 'de-DE',
  minHeight = 420,
  fallback = null,
  className = '',
}: GygWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [empty, setEmpty] = useState(false);

  const usable = !!partnerId && (kind === 'auto' || locationId != null);

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
      {kind === 'city' ? (
        <div
          data-gyg-href="https://widget.getyourguide.com/default/city.frame"
          data-gyg-location-id={String(locationId)}
          data-gyg-locale-code={localeCode}
          data-gyg-widget="city"
          data-gyg-partner-id={partnerId}
        />
      ) : (
        <div
          data-gyg-widget="auto"
          data-gyg-locale-code={localeCode}
          data-gyg-partner-id={partnerId}
        />
      )}
    </div>
  );
}
