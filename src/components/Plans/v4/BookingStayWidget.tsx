'use client';

/**
 * BookingStayWidget — offizielles Booking.com-Suchwidget im Planer (fn-21).
 *
 * Click-to-Load: Standardmäßig nur eine Platzhalter-Karte im v4-Look —
 * erst nach Klick wird das prelanding_sdk-Script von booking.com geladen
 * und das Widget (iframe) gerendert. Gründe: DSGVO (Dritt-Cookies erst
 * nach aktiver User-Entscheidung) + Performance (kein Fremd-JS beim
 * Seitenload). CSP erlaubt script-src/frame-src booking.com (next.config).
 *
 * Alle Buchungen laufen über den CJ-Klick (destinationurloverride →
 * jdoqocy click-101870737-17319656, sid=plan-widget) und sind damit
 * provisioniert wie die Deeplinks.
 */

import { useEffect, useRef, useState } from 'react';

const WIDGET_CONTAINER_ID = 'bookingAffiliateWidget_lasstreffen_plan';
const CJ_WIDGET_CLICK = 'https://www.jdoqocy.com/click-101870737-17319656?sid=plan-widget';
const SDK_SRC = 'https://www.booking.com/affiliate/prelanding_sdk';

declare global {
  interface Window {
    Booking?: {
      AffiliateWidget: new (config: unknown) => unknown;
    };
  }
}

function mountWidget() {
  if (!window.Booking?.AffiliateWidget) return false;
  new window.Booking.AffiliateWidget({
    iframeSettings: {
      selector: WIDGET_CONTAINER_ID,
      responsive: true,
    },
    widgetSettings: {
      destinationurloverride: CJ_WIDGET_CLICK,
    },
  });
  return true;
}

export function BookingStayWidget() {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const startedRef = useRef(false);

  useEffect(() => {
    if (state !== 'loading' || startedRef.current) return;
    startedRef.current = true;

    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing && mountWidget()) {
      setState('ready');
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      setState(mountWidget() ? 'ready' : 'error');
    };
    script.onerror = () => setState('error');
    document.body.appendChild(script);
  }, [state]);

  return (
    <div className="rounded-2xl border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[13px] font-semibold text-[var(--v4-ink)]">
          Unterkunft direkt hier suchen
        </p>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] border border-[var(--v4-hairline-3)] rounded px-1.5 py-0.5">
          Anzeige
        </span>
      </div>

      {state === 'idle' && (
        <>
          <p className="text-[12px] text-[var(--v4-ink-50)] mb-3">
            Lädt die Booking.com-Suche in diese Seite (stellt erst nach Klick
            eine Verbindung zu Booking.com her).
          </p>
          <button
            type="button"
            onClick={() => setState('loading')}
            data-track="stay_widget_open"
            className="press-haptic inline-flex items-center gap-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold px-4 py-2"
          >
            Booking.com-Suche laden
          </button>
        </>
      )}

      {state === 'loading' && (
        <p className="text-[12px] text-[var(--v4-ink-50)] py-4">Widget lädt …</p>
      )}

      {state === 'error' && (
        <p className="text-[12px] text-[var(--v4-ink-50)] py-2">
          Das Widget konnte nicht geladen werden — nutze den
          „Bei booking.com ansehen"-Button oben.
        </p>
      )}

      {/* Container muss schon im DOM sein, wenn das SDK mounted */}
      <div id={WIDGET_CONTAINER_ID} className={state === 'ready' ? 'mt-2' : 'hidden'} />
    </div>
  );
}
