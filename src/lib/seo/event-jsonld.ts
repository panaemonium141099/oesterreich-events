/**
 * Event-JSON-LD fuer die Event-Detailseite.
 *
 * Aus page.tsx extrahiert, damit die Schema-Logik unit-testbar ist (die
 * Page selbst zieht next-intl/RSC-Imports, die vitest nicht laden kann).
 *
 * Google-Rich-Result-Regeln, die die Feld-Emission hier bestimmen:
 *  - `offers` NUR mit bekanntem `price` — ein Offer ohne price ist ein
 *    GSC-FEHLER (schlimmer als gar kein Offer).
 *  - endDate/description/address sind Recommended Fields — fehlen sie,
 *    warnt GSC pro Seite ("Darstellung von Elementen verbessern").
 *  - `image` muss eine absolute URL sein.
 * Alle Fallbacks speisen sich aus echten Row-Feldern — nie erfundene Werte.
 */

import type { Event } from '@/types/events';
import { extractCity } from '@/lib/utils/city';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import {
  hasKnownStartTime,
  parseEventDate,
  toViennaDate,
  toViennaIso,
  viennaEndDate,
} from '@/lib/utils/event-time';

/**
 * Extracts a numeric price from free-text like "ab 15 €", "€12,50", "Tickets 25 EUR".
 * Returns '0' for free events (frei/gratis/kostenlos), null when no price is detectable.
 */
export function parsePriceText(priceText: string | null | undefined): string | null {
  if (!priceText) return null;
  const lower = priceText.toLowerCase();
  if (/\b(frei|gratis|kostenlos|free|eintritt\s*frei)\b/.test(lower)) return '0';
  const match = priceText.match(/(\d+(?:[.,]\d+)?)/);
  return match ? match[1].replace(',', '.') : null;
}

export type EventStatus =
  | 'scheduled'
  | 'cancelled'
  | 'postponed'
  | 'rescheduled'
  | 'moved_online';

const STATUS_URL: Record<EventStatus, string> = {
  scheduled: 'https://schema.org/EventScheduled',
  cancelled: 'https://schema.org/EventCancelled',
  postponed: 'https://schema.org/EventPostponed',
  rescheduled: 'https://schema.org/EventRescheduled',
  moved_online: 'https://schema.org/EventMovedOnline',
};

export function normalizeEventStatus(raw: unknown): EventStatus {
  return typeof raw === 'string' && raw in STATUS_URL ? (raw as EventStatus) : 'scheduled';
}

export interface BuildJsonLdOptions {
  /** 'de' | 'en' — steuert `inLanguage`. Default 'de'. */
  locale?: string;
  /**
   * Absolute Canonical-URL der Seite. Wird durchgereicht statt neu gebaut,
   * damit JSON-LD und `<link rel="canonical">` nie auseinanderlaufen (auf /en
   * kanonisiert die Seite bewusst auf DE, solange keine Uebersetzung existiert).
   */
  canonicalUrl?: string;
}

export function buildJsonLd(event: Event, opts: BuildJsonLdOptions = {}): string {
  const isEn = opts.locale === 'en';
  const canonicalUrl = opts.canonicalUrl ?? `https://lasstreffen.at${buildEventUrlV2(event)}`;

  // ─── Zeitpunkt (fn-23) ──────────────────────────────────────────────────
  // Vorher stand hier der rohe DB-String (`2026-10-01T17:00:00+00:00`).
  // Zwei Probleme, beide klassische Rich-Result-Killer:
  //  1. Wien ist UTC+1/+2 — der Event startet real 19:00, nicht 17:00.
  //  2. 32,5 % der zukuenftigen Events haben gar keine bekannte Uhrzeit und
  //     bekamen trotzdem eine erfundene (meist 00:00Z = Wien 02:00); bei der
  //     viennaToUtc-Form (22:00Z) war sogar der ausgelieferte TAG falsch.
  // Jetzt: Ortszeit mit Offset wenn die Uhrzeit echt ist, sonst reines Datum.
  const start = parseEventDate(event.start_date);
  const timed = start != null && hasKnownStartTime(event);
  const startValue = start ? (timed ? toViennaIso(start) : toViennaDate(start)) : event.start_date;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: startValue,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: isEn ? 'en' : 'de',
    url: canonicalUrl,
  };

  // endDate ist ein Google-Recommended-Field; Eintages-Events (der Normalfall
  // ohne end_date-Row) sind mit endDate == startDate schema-korrekt abgebildet.
  // Das Ende folgt derselben Praezision wie der Start — ein date-only Start
  // mit timestamp-Ende waere inkonsistent.
  const end = parseEventDate(event.end_date);
  if (!end || !start) {
    jsonLd.endDate = startValue;
  } else if (timed) {
    jsonLd.endDate = end.getTime() > start.getTime() ? toViennaIso(end) : startValue;
  } else {
    const endDay = viennaEndDate(end);
    jsonLd.endDate = endDay > toViennaDate(start) ? endDay : startValue;
  }

  // ─── eventStatus (fn-23) ────────────────────────────────────────────────
  // War hart auf EventScheduled verdrahtet, weil es keine DB-Spalte gab.
  // Google verlangt bei Absagen/Verschiebungen, dass die Seite ONLINE BLEIBT
  // und der Status im Markup gepflegt wird.
  const status = normalizeEventStatus(event.event_status);
  jsonLd.eventStatus = STATUS_URL[status];
  if (status === 'moved_online') {
    jsonLd.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';
  }
  // Bei einer Verschiebung ist der alte Termin ein Google-Pflichtfeld.
  const previous = parseEventDate(event.previous_start_date);
  if (status === 'rescheduled' && previous) {
    jsonLd.previousStartDate = timed ? toViennaIso(previous) : toViennaDate(previous);
  }

  if (event.description) {
    jsonLd.description = event.description.slice(0, 500);
  } else {
    // Fallback aus echten Row-Feldern (gleiche Quelle wie die Meta-Description) —
    // GSC warnt sonst "Feld 'description' fehlt" auf jeder Seite ohne Text.
    const datePart = (event.start_date ?? '').slice(0, 10).split('-').reverse().join('.');
    const where = event.location_name ?? extractCity(event) ?? 'Österreich';
    jsonLd.description = [event.title, datePart, where].filter(Boolean).join(' — ');
  }

  // Use resolver so JSON-LD always has an image (category fallback if needed).
  // Schema.org verlangt absolute URLs — die Kategorie-Fallbacks sind relative
  // Pfade ("/images/categories/…") und damit "Ungültige URL in Feld 'image'".
  const rawImage = resolvePrimaryEventImage({
    imageUrl: event.image_url,
    category: event.category,
    title: event.title,
    bundesland: event.bundesland,
    imageWidth: event.image_width,
  });
  jsonLd.image =
    rawImage.startsWith('//') ? `https:${rawImage}` :
    rawImage.startsWith('/') ? `https://lasstreffen.at${rawImage}` :
    rawImage;

  const locationName = event.location_name ?? event.address ?? (isEn ? 'Austria' : 'Österreich');
  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: locationName,
  };

  // PostalAddress schon ab PLZ oder Ort emittieren — Google akzeptiert
  // Adressen ohne streetAddress, und ~31k Events haben eine PLZ aber keine
  // Strasse (GSC: "Feld 'address' fehlt"). Nur echte Row-Daten: addressLocality
  // kommt aus Venue-/Adress-Parsing, NICHT aus dem Bundesland-Hauptstadt-
  // Fallback der URL-Slugs (der waere fuer eine Adresse schlicht falsch).
  const plz = (event.postal_code ?? '').trim();
  const plzValid = /^\d{4}$/.test(plz);
  const city = extractCity(event);
  if (event.address || plzValid || city) {
    location.address = {
      '@type': 'PostalAddress',
      ...(event.address ? { streetAddress: event.address } : {}),
      ...(plzValid ? { postalCode: plz } : {}),
      ...(city ? { addressLocality: city } : {}),
      addressCountry: 'AT',
    };
  }

  if (event.latitude != null && event.longitude != null) {
    location.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }

  // Online verlegte Events brauchen eine VirtualLocation — ein Place neben
  // OnlineEventAttendanceMode ist fuer Google widerspruechlich.
  jsonLd.location =
    status === 'moved_online'
      ? { '@type': 'VirtualLocation', url: event.ticket_url || canonicalUrl }
      : location;

  // Organizer — ALWAYS present. Falls back to the site when the scraper
  // didn't capture an explicit organizer. Satisfies Google's Event rich-result
  // field requirement ("fehlende Felder: organizer") even on scraped rows
  // where the source page didn't expose one.
  jsonLd.organizer = {
    '@type': 'Organization',
    name: event.organizer || 'LassTreffen.at',
    url: 'https://lasstreffen.at',
  };

  // Performer — ALWAYS present. Google's Event schema treats `performer` as a
  // recommended field; omitting it triggers the "Ereignisse für strukturierte
  // Daten" warning in Search Console. We use the organizer when known,
  // otherwise fall back to the event title itself as the performing entity.
  jsonLd.performer = {
    '@type': 'PerformingGroup',
    name: event.organizer || event.title,
  };

  // Offers — nur emitten wenn ein Preis bekannt ist. Google's Event-Schema
  // verlangt bei `offers` zwingend ein `price` (oder lowPrice/highPrice).
  // Vorher hatten wir den Offer-Block immer ausgegeben und `price` nur
  // bedingt — das produzierte ~2.280 GSC-Fehler "Feld 'price' fehlt".
  // Lieber kein Offer-Block (Google ignoriert ihn dann) als ein invalider.
  const parsed = parsePriceText(event.price_text);
  const price =
    event.price_min != null ? String(event.price_min) :
    parsed != null ? parsed :
    null;

  if (price != null) {
    const offers: Record<string, unknown> = {
      '@type': 'Offer',
      url: event.ticket_url || canonicalUrl,
      priceCurrency: 'EUR',
      price,
      // Ein abgesagtes Event darf nicht weiter als buchbar ausgezeichnet werden.
      availability:
        status === 'cancelled'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      validFrom: event.created_at || event.start_date,
    };
    if (event.price_text) {
      offers.name = event.price_text;
    }
    jsonLd.offers = offers;
  }

  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}
