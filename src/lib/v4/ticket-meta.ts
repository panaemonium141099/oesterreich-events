import type { Event } from '@/types/events';

/**
 * Ticket-Metadaten für die Seitenbox und die mobile Sticky-Bar.
 *
 * WARUM ALS EIGENE FUNKTION
 * ─────────────────────────
 * Diese Ableitung stand doppelt: einmal in der Voll-Seite
 * (`app/[locale]/events/[...slug]/page.tsx`) und einmal in der
 * abfangenden Modal-Route (`app/[locale]/@modal/(.)events/[...slug]`).
 * Jede In-App-Navigation landet im Modal, nur Hard-Loads treffen die
 * Voll-Seite — die beiden Pfade sehen also unterschiedlich aus, wenn
 * nur einer gepflegt wird. Genau das ist am 2026-09-07 passiert: die
 * Voll-Seite war korrigiert, das Modal zeigte weiter den kaputten Preis.
 *
 * Eine Quelle, beide Routen rufen sie.
 */
export interface V4TicketMeta {
  /** Anbietername für die Provider-Zeile ("Offizieller Ticketshop: …"). */
  provider?: string;
  /**
   * Kurzer Ab-Preis für die grosse Preiszeile, z. B. "€ 12".
   *
   * NUR gesetzt, wenn ein numerischer `price_min` vorliegt. Früher fiel
   * diese Ableitung ersatzweise auf `price_text` zurück — bei einem
   * Inserat war das ein 120 Zeichen langer Satz ("Abendkassa regulär:
   * EUR 12 - Early Bird / Ermässigungen / Vorverkauf: …"), gesetzt in
   * 28px fett. Fehlt die Zahl, schlüsselt die TicketBox den Preistext
   * stattdessen über V4PriceBlock auf.
   */
  priceFrom?: string;
  /** Roher Preistext für die Abendkassen-Box. */
  priceAtDoor?: string;
}

export function deriveTicketMeta(event: Event): V4TicketMeta {
  return {
    provider: event.source_name ?? undefined,
    priceFrom: event.price_min != null ? `€ ${event.price_min}` : undefined,
    priceAtDoor: event.price_text ?? undefined,
  };
}
