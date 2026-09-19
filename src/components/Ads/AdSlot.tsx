'use client';

/**
 * AdSlot — dezente AdSense-Flaeche (2026-09-02).
 *
 * Rahmenbedingungen aus der Projekthistorie:
 *
 *   1. **Kein Layout-Shift.** fn-15.4 hat AdSense u. a. wegen CLS wieder
 *      ausgebaut. Dieser Slot reserviert seine Hoehe VOR dem Laden.
 *   2. **Einwilligung zuerst.** Werbe-Cookies brauchen im EWR eine
 *      Zustimmung (TKG/DSGVO) und Google verlangt dafuer eine
 *      zertifizierte CMP. Das Script laedt deshalb nur, wenn
 *      NEXT_PUBLIC_ADS_ENABLED=true gesetzt ist — dieser Schalter wird
 *      erst umgelegt, wenn im AdSense-Konto die DSGVO-Meldung
 *      veroeffentlicht ist. Die CMP blockt Anzeigen und Cookies dann
 *      selbst bis zur Zustimmung.
 *   3. **Kennzeichnung.** Werbung muss als solche erkennbar sein, daher
 *      das "Anzeige"-Label ueber der Flaeche.
 *   4. **Lazy.** Die Anzeige wird erst angefordert, wenn der Slot in die
 *      Naehe des Sichtbereichs kommt — oben blockiert nichts.
 *   5. **Werbefreie Accounts (2026-09-19).** AdSense hat die Einnahmen
 *      wegen ungueltiger Klicks eingeschraenkt. Accounts mit
 *      profiles.ads_disabled (Admin-Schalter unter /admin/users) bekommen
 *      keine Flaeche; bis useAdsAllowed() entschieden hat, rendert der
 *      Slot nichts, damit es keinen Moment mit sichtbarer Anzeige gibt.
 *
 * Bleibt eine Flaeche unbefuellt, verschwindet sie ganz statt einen
 * leeren Rahmen stehen zu lassen.
 */

import { useEffect, useRef, useState } from 'react';
import { useAdsAllowed } from '@/lib/ads/ads-allowed';

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export interface AdSlotProps {
  /** Slot-ID aus dem AdSense-Konto (Anzeigen -> Nach Anzeigenblock). */
  slot: string;
  /** Reservierte Mindesthoehe in px — verhindert Layout-Shift. */
  minHeight?: number;
  /** Rahmenfarbe: dunkle v4-Seiten vs. heller Blog. */
  tone?: 'dark' | 'light';
  className?: string;
}

export function AdSlot({ slot, minHeight = 280, tone = 'dark', className = '' }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [unfilled, setUnfilled] = useState(false);
  const adsAllowed = useAdsAllowed();

  useEffect(() => {
    // Der Container existiert erst, wenn Anzeigen erlaubt sind; der Effekt
    // laeuft deshalb erneut, sobald adsAllowed kippt.
    if (!ADS_ENABLED || !CLIENT_ID || adsAllowed !== true || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      // Grosszuegiger Vorlauf: die Flaechen sitzen am Seitenende, ein
      // knapper Rand liess sie in der Praxis nie ausloesen.
      { rootMargin: '1500px' },
    );
    obs.observe(el);

    // Sicherheitsnetz: Wenn der Beobachter aus irgendeinem Grund nicht
    // ausloest (verschachtelte Scroll-Container, blockiertes Scrollen
    // durch den Einwilligungsdialog, exotische Browser), wird die
    // Anzeige nach ein paar Sekunden trotzdem angefordert. Ohne das
    // bleibt die Flaeche dauerhaft leer — beobachtet am 02.09.2026.
    const fallback = setTimeout(() => {
      setInView(true);
      obs.disconnect();
    }, 4000);

    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, [adsAllowed]);

  useEffect(() => {
    if (!inView) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      /* Adblocker o. ae. — Flaeche bleibt leer und wird ausgeblendet */
    }
    const t = setTimeout(() => {
      const ins = ref.current?.querySelector('ins');
      if (ins?.getAttribute('data-ad-status') === 'unfilled') setUnfilled(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [inView]);

  // Ohne Schalter, ohne Konto-ID, ohne konfigurierte Slot-ID oder ohne
  // Freigabe fuer diesen Besucher rendert der Slot gar nichts — so bleibt
  // die Seite unveraendert, solange die Anzeigenbloecke im AdSense-Konto
  // nicht angelegt sind bzw. der Account werbefrei ist.
  if (!ADS_ENABLED || !CLIENT_ID || !slot || unfilled || adsAllowed !== true) return null;

  const labelColor = tone === 'dark' ? 'text-white/30' : 'text-gray-400';
  const borderColor = tone === 'dark' ? 'border-white/[0.06]' : 'border-gray-200';

  return (
    <div ref={ref} className={`my-8 ${className}`} aria-label="Werbung">
      <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${labelColor} mb-1.5`}>
        Anzeige
      </p>
      <div className={`rounded-xl border ${borderColor} overflow-hidden`} style={{ minHeight }}>
        {inView && (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', minHeight }}
            data-ad-client={CLIENT_ID}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    </div>
  );
}
