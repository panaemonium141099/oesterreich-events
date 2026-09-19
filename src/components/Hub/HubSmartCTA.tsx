'use client';

import Link from 'next/link';
import { markSmartAutorun } from '@/lib/search/smart-autorun';

/**
 * "Frag die KI"-Bridge (fn-19 Phase A): Deep-Link in den Smart-Tab von
 * /entdecken mit vorbefüllter Beispiel-Query. Bis dahin war die
 * Smart-Suche AUSSCHLIESSLICH über den Tab auf /entdecken erreichbar —
 * null externe Einstiegspunkte für das teuerste Feature der Plattform.
 *
 * Der Link steht weiterhin im SSR-HTML (Client-Komponenten werden
 * serverseitig gerendert). Client-Komponente seit 2026-09-19, weil der
 * Klick die Query für den Auto-Start im Chat vormerkt — ohne diesen
 * Vermerk startet /entdecken die Gemini-Anfrage nicht mehr von selbst
 * (Crawler folgten dem Link tausendfach, siehe lib/search/smart-autorun).
 * Klicks laufen weiter über den globalen ClickTracker (`data-track` +
 * `data-track-id` = Einbau-Fläche).
 */
export function HubSmartCTA({
  query,
  surface,
  label,
}: {
  /** Vorbefüllte Beispiel-Query, z. B. "Was kann man in Eisenstadt unternehmen?" */
  query: string;
  /** Einbau-Fläche fürs Tracking, z. B. "gemeinde-hub". */
  surface: string;
  label?: string;
}) {
  return (
    <Link
      href={`/entdecken?mode=smart&q=${encodeURIComponent(query)}`}
      onClick={() => markSmartAutorun(query)}
      data-track="smart_cta_click"
      data-track-id={surface}
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,185,66,0.45)] bg-[rgba(245,185,66,0.10)] px-5 py-2.5 text-[14px] font-semibold text-[#f5b942] hover:bg-[rgba(245,185,66,0.18)] transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>
      </svg>
      {label ?? 'Frag die KI'}
    </Link>
  );
}
