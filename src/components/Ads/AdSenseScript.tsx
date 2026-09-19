'use client';

/**
 * AdSenseScript — laedt adsbygoogle.js nur, wenn der Besucher Anzeigen
 * sehen darf (2026-09-19, werbefreie Accounts).
 *
 * Vorher stand das <Script> direkt im Server-Layout und lief fuer jeden.
 * Jetzt entscheidet useAdsAllowed(): anonyme Besucher sofort, eingeloggte
 * erst nach /api/me/ads, werbefreie Accounts nie. Ohne Script gibt es auch
 * keine Auto-Ads, falls die im Konto einmal aktiv sind.
 *
 * strategy="lazyOnload" wie bisher: die Kernmetriken der Seite bleiben
 * unberuehrt; mountet die Komponente erst nach dem load-Event, laedt
 * next/script das Skript in der naechsten Idle-Phase.
 */

import Script from 'next/script';
import { useAdsAllowed } from '@/lib/ads/ads-allowed';

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

export function AdSenseScript() {
  const allowed = useAdsAllowed();
  if (!ADS_ENABLED || !CLIENT_ID || allowed !== true) return null;

  return (
    <Script
      id="adsense"
      strategy="lazyOnload"
      async
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`}
    />
  );
}
