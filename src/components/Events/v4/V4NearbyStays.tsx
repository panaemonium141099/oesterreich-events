/**
 * V4NearbyStays — "Unterkünfte in der Nähe" unter dem Event-Detail (fn-21).
 *
 * Zeigt die 4 nächstgelegenen Beherbergungs-POIs aus stay_pois (OSM) mit
 * Entfernung; jeder Klick öffnet die Booking.com-Suche der Unterkunft über
 * unseren CJ-Affiliate-Deeplink (sid=event-<shortid>). Footer-CTA sucht
 * alle Unterkünfte der Stadt mit Check-in am Eventdatum. Reine Links,
 * kein Fremd-Script; Kennzeichnung "Anzeige" + ODbL-Attribution (die
 * Kartendaten stammen aus OpenStreetMap).
 *
 * Rendert null ohne Koordinaten oder ohne Treffer — angedockt in
 * V4RelatedEvents neben EventNearbyActivities (gleiches Muster).
 */

import { buildAffiliateStayLink, deriveCityFromLocation } from '@/lib/booking/affiliate';
import { loadNearbyStaysCached, roundCoord } from '@/lib/booking/nearby-stays-loader';
import type { Event } from '@/types/events';

const KIND_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  guest_house: 'Pension',
  apartment: 'Ferienwohnung',
  hostel: 'Hostel',
  alpine_hut: 'Almhütte',
  camp_site: 'Campingplatz',
  chalet: 'Chalet',
  motel: 'Motel',
};

/**
 * Icon-Header statt Foto: OSM liefert keine Bilder, und ohne die
 * (Direktpartner-)Demand-API gibt es keine legale Foto-Quelle für fremde
 * Unterkünfte (Google Places ist projektweit No-Go, fn-18-Recherche).
 * Deshalb je Unterkunftstyp ein Icon-Band im v4-Look — ehrlich statt
 * generischer Stock-Fotos, die wie das echte Haus aussehen würden.
 */
function KindIcon({ kind }: { kind: string }) {
  const common = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'w-10 h-10',
    'aria-hidden': true,
  };
  if (kind === 'camp_site') {
    return (
      <svg {...common}>
        <path d="M8 38L24 12l16 26H8z" />
        <path d="M24 12v26M17 38l7-11 7 11" />
      </svg>
    );
  }
  if (kind === 'alpine_hut' || kind === 'chalet') {
    return (
      <svg {...common}>
        <path d="M6 24L24 8l18 16" />
        <path d="M11 21v19h26V21" />
        <rect x="20" y="28" width="8" height="12" />
      </svg>
    );
  }
  // Bett — Hotel, Pension, Ferienwohnung, Hostel, Motel
  return (
    <svg {...common}>
      <path d="M6 14v22M6 30h36v6M6 26h36v-4a4 4 0 0 0-4-4H20v8" />
      <circle cx="13" cy="21" r="3" />
    </svg>
  );
}

function futureDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date > new Date().toISOString().slice(0, 10) ? date : null;
}

export async function V4NearbyStays({
  event,
}: {
  event: Pick<Event, 'id' | 'latitude' | 'longitude' | 'start_date' | 'location_name' | 'address' | 'bundesland'>;
}) {
  if (event.latitude == null || event.longitude == null) return null;

  const stays = await loadNearbyStaysCached(roundCoord(event.latitude), roundCoord(event.longitude));
  if (stays.length === 0) return null;

  const sid = `event-${String(event.id).slice(0, 8)}`;
  const checkin = futureDate(event.start_date);
  const city =
    deriveCityFromLocation(event.address) ||
    deriveCityFromLocation(event.location_name) ||
    stays.find((s) => s.city)?.city ||
    null;

  return (
    <section className="bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-10 md:pb-14">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
              Übernachten
            </p>
            <h2 className="text-[22px] md:text-[26px] font-bold leading-tight tracking-[-0.025em]">
              Unterkünfte in der Nähe
            </h2>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] border border-[var(--v4-hairline-3)] rounded px-1.5 py-0.5 mb-1">
            Anzeige
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stays.map((stay) => {
            const href = buildAffiliateStayLink(
              { ss: stay.city ? `${stay.name} ${stay.city}` : stay.name, checkin },
              sid,
            );
            return (
              <a
                key={stay.osm_id}
                href={href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                data-track="stay_click"
                data-track-id={`${sid}:${stay.osm_id}`}
                data-track-provider="booking"
                className="press-haptic flex flex-col rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors overflow-hidden"
              >
                <div className="flex items-center justify-center h-[76px] bg-gradient-to-br from-[var(--v4-surface)] to-[var(--v4-surface-elevated)] text-[var(--v4-ink-30)] border-b border-[var(--v4-hairline-1)]">
                  <KindIcon kind={stay.kind} />
                </div>
                <div className="flex flex-col gap-1.5 p-4 flex-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-[var(--v4-ink-50)]">
                  {KIND_LABELS[stay.kind] ?? 'Unterkunft'}
                </span>
                <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{stay.name}</h3>
                <p className="text-[12.5px] text-[var(--v4-ink-70)]">
                  {stay.distance_km < 0.95
                    ? `${Math.max(1, Math.round(stay.distance_km * 10)) * 100} m entfernt`
                    : `${stay.distance_km.toFixed(1).replace('.', ',')} km entfernt`}
                </p>
                <span className="mt-auto pt-1 text-[12px] font-semibold text-[var(--v4-ink)] inline-flex items-center gap-1">
                  Bei Booking.com prüfen
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                </div>
              </a>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5">
          {city && (
            <a
              href={buildAffiliateStayLink({ ss: city, checkin }, sid)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              data-track="stay_click"
              data-track-id={`${sid}:all`}
              data-track-provider="booking"
              className="press-haptic inline-flex items-center gap-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold px-4 py-2 w-fit"
            >
              Alle Unterkünfte in {city}
              {checkin ? ' zum Termin' : ''}
            </a>
          )}
          <p className="text-[10.5px] text-[var(--v4-ink-50)] leading-relaxed">
            Affiliate-Links (Booking.com) — am Preis ändert sich nichts.
            Unterkunftsdaten: © OpenStreetMap-Mitwirkende (ODbL).
          </p>
        </div>
      </div>
    </section>
  );
}
