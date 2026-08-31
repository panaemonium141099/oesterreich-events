/**
 * Plan-Deep-Links — Phase 6 Designer-aligned.
 *
 * Reine Pure-Functions. Bauen Outbound-URLs für offizielle Anbieter
 * (ÖBB-Scotty Routenplaner, booking.com). KEINE API-Integration —
 * der User schließt die Buchung beim Anbieter selbst ab.
 */

import type { Event } from '@/types/events';
import { buildAffiliateStayLink } from '@/lib/booking/affiliate';

/**
 * Baut ÖBB-Scotty Routenplaner-URL.
 *
 * `fahrplan.oebb.at/webapp/` akzeptiert:
 *   - S = Startort (optional, sonst leer)
 *   - Z = Zielort (frei-Text)
 *   - date = DD.MM.YYYY
 *   - time = HH:MM
 *
 * @param event Ziel-Event (location_name / address / bundesland werden
 *              zur Zieladresse kombiniert)
 * @param from  Startort als Free-Text (z.B. "Wien Hbf"). null = leer
 *              (ÖBB-Scotty fragt dann den User)
 * @param planDate Plan-Datum als YYYY-MM-DD
 */
export function buildOebbScottyUrl(
  event: Pick<Event, 'location_name' | 'address' | 'bundesland' | 'start_date'>,
  from: string | null,
  planDate: string,
): string {
  const dest = [event.location_name, event.address, event.bundesland]
    .filter(Boolean)
    .join(', ') || 'Wien';

  // Date: YYYY-MM-DD → DD.MM.YYYY
  const [yyyy, mm, dd] = planDate.split('-');
  const dateParam = yyyy && mm && dd ? `${dd}.${mm}.${yyyy}` : '';

  // Zeit aus Event-Start oder 18:00 als Fallback
  let timeParam = '18:00';
  if (event.start_date) {
    try {
      const d = new Date(event.start_date);
      if (!isNaN(d.getTime())) {
        timeParam = d.toLocaleTimeString('de-AT', {
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
      }
    } catch { /* keep fallback */ }
  }

  const params = new URLSearchParams();
  if (from && from.trim()) params.set('S', from.trim());
  params.set('Z', dest);
  if (dateParam) params.set('date', dateParam);
  params.set('time', timeParam);

  return `https://fahrplan.oebb.at/webapp/?${params.toString()}`;
}

/**
 * Baut booking.com Hotel-Such-URL.
 *
 * `booking.com/searchresults.html` akzeptiert:
 *   - ss = Search String (Stadt / Region)
 *   - checkin / checkout = YYYY-MM-DD
 *   - group_adults = Anzahl Erwachsene
 *   - no_rooms = Anzahl Zimmer
 *
 * @param city Stadt/Region als Free-Text (z.B. "Eisenstadt").
 *             Wenn null/leer: kein Search-String → booking.com Homepage.
 * @param planDate Plan-Datum als YYYY-MM-DD (= checkin)
 * @param nights Anzahl Übernachtungen (default 1)
 */
export function buildBookingUrl(
  city: string | null,
  planDate: string,
  nights = 1,
): string {
  // fn-21: läuft jetzt über unseren CJ-Affiliate-Deeplink (sid=plan) statt
  // des früheren generischen aid=304142 — gleiche Ziel-Suche, aber mit
  // Provisions-Tracking. Ohne Stadt bleibt ss leer → Booking-Suchmaske.
  const checkin = planDate && /^\d{4}-\d{2}-\d{2}$/.test(planDate) ? planDate : null;
  return buildAffiliateStayLink({ ss: (city ?? '').trim(), checkin, nights }, 'plan');
}

/**
 * Default-Stadt aus Event ableiten. Wird in der Unterkunft-Card
 * voraus-gefüllt wenn der User accommodation_city nicht überschrieben hat.
 */
export function deriveAccommodationCity(events: Pick<Event, 'location_name' | 'bundesland'>[]): string {
  const first = events[0];
  if (!first) return '';
  // location_name ist oft "Schloss Esterhazy, Eisenstadt" — wir nehmen
  // den letzten Comma-Teil als Stadt; falls keiner: bundesland.
  const loc = (first.location_name || '').trim();
  if (loc) {
    const parts = loc.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
    return parts[0];
  }
  return (first.bundesland || '').trim();
}
