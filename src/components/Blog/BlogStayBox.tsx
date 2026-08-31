/**
 * BlogStayBox — Booking.com-Unterkunfts-Box für Blog-Posts (fn-21).
 *
 * Rendert unter Event-/Festival-Posts eine "Übernachten in <Stadt>"-Box:
 * ein Klick führt per CJ-Affiliate-Deeplink (sid=blog-<slug>) auf die
 * fertig gefilterte Booking-Suche — Stadt vorausgefüllt, Check-in am
 * Eventdatum wenn es in der Zukunft liegt, sonst Evergreen-Suche ohne
 * Datum. Kein Fremd-Script, reine Links (DSGVO-neutral, SEO-neutral).
 *
 * Stadt kommt aus post.stayCity (explizites Override) oder wird aus
 * jsonLdEvent.location / keyFacts.location abgeleitet. Ohne brauchbare
 * Stadt → rendert nichts (kein leerer Rahmen).
 *
 * Kennzeichnung wie BlogTicketBox ("Anzeige" + Disclosure); Klicks laufen
 * über den globalen ClickTracker (data-track="stay_click").
 */

import {
  buildAffiliateStayLink,
  deriveCityFromLocation,
} from '@/lib/booking/affiliate';
import type { FestivalPost } from '@/content/blog/types';

function futureCheckin(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date > new Date().toISOString().slice(0, 10) ? date : null;
}

export function BlogStayBox({ post }: { post: FestivalPost }) {
  // "Übernachten"-Artikel haben ihre kuratierte BlogStayList — die
  // generische Box wäre dort redundant.
  if (post.stays && post.stays.length > 0) return null;
  // keyFacts.address zuerst: enthält meist "Straße, PLZ Stadt, Bundesland" —
  // das PLZ+Stadt-Muster ist die verlässlichste Quelle.
  const city =
    post.stayCity?.trim() ||
    deriveCityFromLocation(post.keyFacts?.address) ||
    deriveCityFromLocation(post.jsonLdEvent?.location) ||
    deriveCityFromLocation(post.keyFacts?.location);
  if (!city) return null;

  const checkin = futureCheckin(post.jsonLdEvent?.startDate);
  const href = buildAffiliateStayLink({ ss: city, checkin }, `blog-${post.slug}`);

  return (
    <section className="mb-14 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
          Übernachten in {city}
        </p>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
          Anzeige
        </span>
      </div>

      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm leading-snug">
            Von auswärts dabei? Unterkünfte in {city}
            {checkin ? ' rund um den Termin' : ''} findest du bei Booking.com.
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {checkin
              ? 'Stadt und Datum sind im Link schon vorausgefüllt.'
              : 'Die Stadt ist im Link schon vorausgefüllt.'}
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          data-track="stay_click"
          data-track-id={post.slug}
          data-track-provider="booking"
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap shrink-0"
        >
          Unterkünfte ansehen
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Affiliate-Link: Buchst du über diesen Link, erhält LassTreffen.at eine
          Provision von Booking.com — am Preis ändert sich für dich nichts.
          Buchung und Zahlung erfolgen direkt bei Booking.com.
        </p>
      </div>
    </section>
  );
}
