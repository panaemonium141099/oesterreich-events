/**
 * EventDetailV2 — cinematic + social event detail page.
 *
 * Implementation of the Claude Design mockup
 * (lasstreffen-at-design-system/project/mockups/detail-v2.jsx). Replaces
 * the legacy single-column EventDetail layout for `/events/[...slug]`.
 *
 * Sections (top to bottom):
 *   1. Hero            — 560px full-bleed photo, breadcrumb, share/save,
 *                        anchored title block, "Freunde dabei" floating chip.
 *   2. Sticky-RSVP-Bar — "Bist du dabei?" pill set; pinned below header.
 *   3. Stats strip     — 4 large numerals (going / maybe / km / eintritt).
 *   4. Friends         — 3-col grid of friend cards + invite tile.
 *   5. About           — 2-col: narrative + tags / lineup column.
 *   6. Map             — static Mapbox preview + directions card.
 *   7. Similar         — 3-col rail of nearby/same-day events.
 *   8. Footer          — source + last-update.
 *
 * Sections gracefully degrade when their data is absent: no friends → the
 * Friends section becomes a "Sei dabei" CTA. No lineup → only the
 * narrative column renders. No coords → the Map block is suppressed.
 *
 * Server-rendered. Interactivity (RSVP, save, share) is delegated to the
 * existing `EventDetailActions` client component placed inside the hero
 * top-right slot.
 */

import Link from 'next/link';
import type { Event } from '@/types/events';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { buildCitableIntro } from '@/lib/seo/event-intro';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { EventDetailActions } from './EventDetailActions';
import { RelatedEvents } from './RelatedEvents';

// ──────────────────────────────────────────────────────────────────────
// Category palette — maps our 11 primary_category values onto the 6
// chip styles defined in the design system. Falls back to the generic
// "kultur" tint so an unknown category still renders.
// ──────────────────────────────────────────────────────────────────────

type CatTone =
  | 'music'
  | 'kultur'
  | 'fest'
  | 'familie'
  | 'maerkte'
  | 'sport';

const CAT_TONE_STYLES: Record<CatTone, { fg: string; bg: string; bd: string }> = {
  music:   { fg: '#d8b4fe', bg: 'rgba(168,85,247,0.18)', bd: 'rgba(168,85,247,0.40)' },
  kultur:  { fg: '#93c5fd', bg: 'rgba(59,130,246,0.18)', bd: 'rgba(59,130,246,0.40)' },
  fest:    { fg: '#fcd34d', bg: 'rgba(245,158,11,0.18)', bd: 'rgba(245,158,11,0.40)' },
  familie: { fg: '#f9a8d4', bg: 'rgba(236,72,153,0.18)', bd: 'rgba(236,72,153,0.40)' },
  maerkte: { fg: '#6ee7b7', bg: 'rgba(16,185,129,0.18)', bd: 'rgba(16,185,129,0.40)' },
  sport:   { fg: '#fca5a5', bg: 'rgba(239,68,68,0.18)',  bd: 'rgba(239,68,68,0.40)' },
};

function categoryToTone(category: string | null): CatTone {
  if (!category) return 'kultur';
  const c = category.toLowerCase();
  if (/(konzert|musik|nightlife|club|techno|dj|festival)/.test(c)) return 'music';
  if (/(theater|kabarett|kultur|literatur|film|kino|ausstellung|museum|kunst)/.test(c)) return 'kultur';
  if (/(fest|brauchtum|kirtag|jahrmarkt)/.test(c)) return 'fest';
  if (/(familie|kinder)/.test(c)) return 'familie';
  if (/(markt|kulinarik|wein|essen|food)/.test(c)) return 'maerkte';
  if (/(sport|outdoor|wandern|lauf)/.test(c)) return 'sport';
  return 'kultur';
}

// ──────────────────────────────────────────────────────────────────────
// Lucide-style icons inlined as React elements. SVG is faster than a
// Lucide import at SSR time and matches the design exactly.
// ──────────────────────────────────────────────────────────────────────

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function IconCal({ size = 16, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconPin({ size = 16, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function IconNav({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="3,11 22,2 13,21 11,13"/>
    </svg>
  );
}
function IconUsers({ size = 13, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconChevR({ size = 11, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9,6 15,12 9,18"/>
    </svg>
  );
}
function IconArrowL({ size = 15, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12,19 5,12 12,5"/>
    </svg>
  );
}
function IconPlus({ size = 18, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function IconLayers({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12,2 2,7 12,12 22,7"/>
      <polyline points="2,17 12,22 22,17"/>
      <polyline points="2,12 12,17 22,12"/>
    </svg>
  );
}
function IconZap({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
    </svg>
  );
}
function IconTicket({ size = 14, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/>
      <line x1="13" y1="5" x2="13" y2="19"/>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// CatChip — small pill with category-tinted bg + border. Inline styles
// because the colors are computed at render time from a 6-tone palette.
// ──────────────────────────────────────────────────────────────────────

function CatChip({ category, label }: { category: string | null; label: string }) {
  const tone = categoryToTone(category);
  const c = CAT_TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 border"
      style={{ color: c.fg, background: c.bg, borderColor: c.bd }}
    >
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Eyebrow — uppercase tracked label, used as section headers.
// ──────────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/40">
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Free-text price detection. Used so the stats strip can show "frei" /
// "ab 12 €" / "—" without choking on whatever the scraper captured.
// ──────────────────────────────────────────────────────────────────────

function priceLabel(priceText: string | null | undefined, priceMin: number | null | undefined): string {
  if (priceText && /\b(frei|gratis|kostenlos|free|eintritt\s*frei)\b/i.test(priceText)) {
    return 'frei';
  }
  if (priceMin != null && priceMin > 0) {
    return `ab ${Math.round(priceMin)} €`;
  }
  if (priceText && priceText.length < 24) {
    return priceText;
  }
  if (priceMin === 0) return 'frei';
  return '—';
}

function priceSubLabel(priceText: string | null | undefined, priceMin: number | null | undefined): string {
  if (priceText && /\b(frei|gratis|kostenlos|free)\b/i.test(priceText)) return 'ohne Anmeldung';
  if (priceMin != null && priceMin > 0) return 'pro Person';
  return 'Preis n.b.';
}

// ──────────────────────────────────────────────────────────────────────
// Mapbox static URL — same pattern used by PlanCard. Falls back to null
// when no token or no coords; caller suppresses the section then.
// ──────────────────────────────────────────────────────────────────────

function buildStaticMapUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  width = 1280,
  height = 480,
): string | null {
  if (lat == null || lng == null) return null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  if (!token) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+ffffff(${lng},${lat})/${lng},${lat},14,0/${width}x${height}@2x?access_token=${token}`;
}

// ──────────────────────────────────────────────────────────────────────
// Friend / lineup data shapes. Both optional — the page passes whatever
// data it could load (group_members for friends, festival_artists for
// lineup) and the sections render or hide accordingly.
// ──────────────────────────────────────────────────────────────────────

export interface FriendAttendee {
  user_id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  rsvp: 'accepted' | 'maybe' | 'declined' | 'pending';
  city: string | null;
}

export interface LineupAct {
  artist_name: string;
  stage: string | null;
  start_time: string | null;
}

interface VenueLite {
  name: string;
  city: string | null;
}

interface EventDetailV2Props {
  event: Event;
  venue: VenueLite | null;
  derivedCity: string | null;
  /** Deep-link target for the city/region pill in the breadcrumb. */
  bundeslandHref?: string | null;
  /** Members of any group_event this event is linked to + their RSVP. */
  friends: FriendAttendee[];
  /** Festival lineup; empty array if not a festival or not yet ingested. */
  lineup: LineupAct[];
  /** Aggregate counts for the stats strip — accepted / maybe across all groups. */
  rsvpTotals: { going: number; maybe: number };
}

// ─────────────────────────────────────────────────────────────────────
// Avatar — gradient-filled circle keyed off the friend's name. Same
// algorithm the design's `Avatar` atom uses so colors match across
// surfaces (Planer, Hero, FriendsSection).
// ─────────────────────────────────────────────────────────────────────

function avatarGradient(name: string): { from: string; to: string } {
  const palette: [string, string][] = [
    ['#7bb794', '#3a5a4a'], ['#c67079', '#5a3036'],
    ['#a78bfa', '#3b2d6b'], ['#60a5fa', '#1e3a5f'],
    ['#fbbf24', '#5c3f0a'], ['#34d399', '#0e3d2c'],
    ['#f472b6', '#5b1d3e'], ['#c9a86a', '#4d3b1d'],
  ];
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [from, to] = palette[seed % palette.length];
  return { from, to };
}

function FriendAvatar({
  name, avatarUrl, size = 36, ringColor,
}: { name: string; avatarUrl: string | null; size?: number; ringColor?: string }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const grad = avatarGradient(name);
  return (
    <div
      className="inline-flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
        fontSize: Math.round(size * 0.4),
        boxShadow: ringColor ? `0 0 0 2px ${ringColor}` : undefined,
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main composition
// ─────────────────────────────────────────────────────────────────────

export function EventDetailV2({
  event, venue, derivedCity, bundeslandHref,
  friends, lineup, rsvpTotals,
}: EventDetailV2Props) {
  const heroImage = resolvePrimaryEventImage({
    imageUrl: event.image_url, category: event.category, title: event.title,
  });
  const startTime = formatTime(event.start_date);
  const endTime = event.end_date ? formatTime(event.end_date) : null;
  const dateLong = formatDateLong(event.start_date);
  const acceptedFriends = friends.filter(f => f.rsvp === 'accepted');
  const totalGoing = rsvpTotals.going > 0 ? rsvpTotals.going : acceptedFriends.length;
  const totalMaybe = rsvpTotals.maybe > 0 ? rsvpTotals.maybe : friends.filter(f => f.rsvp === 'maybe').length;
  const mapUrl = buildStaticMapUrl(event.latitude, event.longitude);
  const intro = buildCitableIntro({
    title: event.title, start_date: event.start_date, end_date: event.end_date,
    location_name: event.location_name, address: event.address,
    venue_name: venue?.name ?? null, city: derivedCity ?? null,
    category: event.category, price_text: event.price_text,
  });

  return (
    <main className="relative min-h-screen text-white" style={{ background: '#0a0a0c' }}>
      {/* ─────── HERO ────────────────────────────────────────────── */}
      <section
        className="relative w-full"
        style={{
          height: 'clamp(420px, 60vh, 600px)',
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }}
      >
        {/* breadcrumb top-left */}
        <div className="absolute top-5 left-5 sm:top-6 sm:left-7 flex items-center gap-2.5 text-xs text-white/85 z-10">
          <Link
            href="/map"
            aria-label="Zurück zur Karte"
            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors hover:bg-black/60"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <IconArrowL size={15}/>
          </Link>
          <Link href="/map" className="opacity-70 hover:opacity-100 hidden sm:inline">Karte</Link>
          {event.bundesland && (
            <>
              <IconChevR size={11} className="opacity-50 hidden sm:block"/>
              {bundeslandHref ? (
                <Link href={bundeslandHref} className="opacity-70 hover:opacity-100 hidden sm:inline">
                  {event.bundesland}
                </Link>
              ) : (
                <span className="opacity-70 hidden sm:inline">{event.bundesland}</span>
              )}
            </>
          )}
          <IconChevR size={11} className="opacity-50 hidden sm:block"/>
          <span className="font-medium truncate max-w-[40vw]">{event.title}</span>
        </div>

        {/* secondary actions top-right — share + bookmark live in
            EventDetailActions for the existing supabase-backed save state. */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-6 z-10">
          <EventDetailActions
            eventId={event.id}
            eventTitle={event.title}
            eventSlug={event.slug}
            city={derivedCity}
            bundesland={event.bundesland}
            venueId={event.venue_id}
            venueName={venue?.name}
            startDate={event.start_date}
            postalCode={event.postal_code}
            address={event.address}
            locationName={event.location_name}
          />
        </div>

        {/* multi-stop scrim — fades from 40% top dim, transparent in the
            middle so the photo breathes, then back to canvas at the bottom
            so the title sits on a clean dark anchor. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 50%, rgba(10,10,12,0.78) 85%, #0a0a0c 100%)',
          }}
        />

        {/* anchored title block */}
        <div className="absolute left-0 right-0 bottom-8 sm:bottom-12 px-5 sm:px-12 lg:px-16">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-end max-w-[1280px] mx-auto">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-3 sm:mb-4">
                {event.category && (
                  <CatChip category={event.category} label={event.category}/>
                )}
                {priceLabel(event.price_text, event.price_min) === 'frei' && (
                  <span
                    className="text-[11px] font-semibold rounded-full px-2.5 py-1 backdrop-blur-md uppercase tracking-[0.06em] text-white/85"
                    style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)' }}
                  >
                    kostenlos
                  </span>
                )}
                {event.organizer && (
                  <span className="text-xs text-white/70 hidden sm:inline">· {event.organizer}</span>
                )}
              </div>
              <h1
                className="m-0 text-white"
                style={{
                  fontSize: 'clamp(32px, 6vw, 72px)',
                  fontWeight: 700,
                  lineHeight: 0.96,
                  letterSpacing: '-0.035em',
                  textShadow: '0 2px 20px rgba(0,0,0,0.4)',
                  maxWidth: 760,
                  overflowWrap: 'break-word',
                }}
              >
                {event.title}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 sm:mt-5 text-sm text-white/85">
                <span className="inline-flex items-center gap-2">
                  <IconCal size={16}/>
                  <span>
                    {dateLong}
                    {startTime && ` · ${startTime}`}
                    {endTime && ` – ${endTime}`}
                  </span>
                </span>
                {(venue?.name || event.location_name || event.address) && (
                  <span className="inline-flex items-center gap-2">
                    <IconPin size={16}/>
                    <span>{venue?.name || event.location_name || event.address}</span>
                  </span>
                )}
              </div>
            </div>

            {/* friends-going floating chip — only when we know who's
                going. Otherwise we hide it; the empty state makes more
                sense in the dedicated Friends section below. */}
            {acceptedFriends.length > 0 && (
              <div
                className="rounded-2xl px-4 py-3.5 backdrop-blur-xl min-w-[220px]"
                style={{
                  background: 'rgba(20,20,22,0.7)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 mb-2">
                  Freunde dabei
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {acceptedFriends.slice(0, 4).map((f, i) => (
                      <div key={f.user_id} style={{ marginLeft: i ? -10 : 0 }}>
                        <FriendAvatar
                          name={`${f.first_name} ${f.last_name ?? ''}`.trim()}
                          avatarUrl={f.avatar_url}
                          size={36}
                          ringColor="rgba(20,20,22,0.7)"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-[13px] leading-tight">
                    <div>
                      <b>{acceptedFriends[0]?.first_name}</b>
                      {acceptedFriends[1] && (
                        <>, <b>{acceptedFriends[1].first_name}</b></>
                      )}
                    </div>
                    {acceptedFriends.length > 2 && (
                      <div className="text-white/60">+ {acceptedFriends.length - 2} weitere</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────── STATS STRIP ───────────────────────────────────────── */}
      <section
        className="grid grid-cols-2 sm:grid-cols-4 max-w-[1280px] mx-auto"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {[
          {
            n: totalGoing > 0 ? String(totalGoing) : '—',
            l: 'gehen',
            sub: acceptedFriends.length > 0 ? `${acceptedFriends.length} Freunde` : 'noch keine Zusagen',
          },
          {
            n: totalMaybe > 0 ? String(totalMaybe) : '—',
            l: 'vielleicht',
            sub: friends.filter(f => f.rsvp === 'maybe').length > 0
              ? `${friends.filter(f => f.rsvp === 'maybe').length} Freunde`
              : 'Plan flexibel',
          },
          {
            n: derivedCity ?? (event.bundesland ?? 'Österreich'),
            l: 'in',
            sub: event.address ?? event.location_name ?? '',
          },
          {
            n: priceLabel(event.price_text, event.price_min),
            l: 'eintritt',
            sub: priceSubLabel(event.price_text, event.price_min),
          },
        ].map((s, i) => (
          <div
            key={s.l}
            className="px-5 py-6 sm:px-7 sm:py-7"
            style={{
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : undefined,
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}
          >
            <div
              className="text-white"
              style={{
                fontSize: 'clamp(22px, 3vw, 38px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.n}
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">
              {s.l}
            </div>
            {s.sub && (
              <div className="text-xs text-white/40 mt-1 truncate">{s.sub}</div>
            )}
          </div>
        ))}
      </section>

      {/* ─────── FRIENDS SECTION ───────────────────────────────────── */}
      {friends.length > 0 ? (
        <section className="px-5 sm:px-12 lg:px-16 pt-12 pb-10 max-w-[1280px] mx-auto">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <Eyebrow>Wer geht · {friends.length} {friends.length === 1 ? 'Person' : 'Personen'}</Eyebrow>
              <h2
                style={{
                  fontSize: 'clamp(22px, 2.5vw, 32px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  margin: '6px 0 0',
                }}
              >
                Du wirst nicht alleine sein
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {friends.map(f => {
              const fullName = `${f.first_name} ${f.last_name ?? ''}`.trim();
              const tone = f.rsvp === 'accepted' ? '#7bb794'
                : f.rsvp === 'maybe' ? '#c9a86a'
                : f.rsvp === 'declined' ? '#c67079'
                : '#9ca3af';
              const label = f.rsvp === 'accepted' ? 'dabei'
                : f.rsvp === 'maybe' ? 'vielleicht'
                : f.rsvp === 'declined' ? 'absage'
                : 'offen';
              return (
                <div
                  key={f.user_id}
                  className="flex items-center gap-3.5 p-4 rounded-2xl"
                  style={{
                    background: '#141416',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <FriendAvatar name={fullName} avatarUrl={f.avatar_url} size={44}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-tight">{fullName}</div>
                    {f.city && <div className="text-xs text-white/60 mt-0.5">aus {f.city}</div>}
                  </div>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.06em] border"
                    style={{
                      background: `${tone}24`,
                      color: tone,
                      borderColor: `${tone}55`,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="px-5 sm:px-12 lg:px-16 pt-12 pb-2 max-w-[1280px] mx-auto">
          <div
            className="rounded-2xl p-5 sm:p-7 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center"
            style={{
              background: '#141416',
              border: '1px dashed rgba(255,255,255,0.15)',
            }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <IconUsers size={20}/>
            </div>
            <div className="flex-1 min-w-0">
              <Eyebrow>Sei dabei</Eyebrow>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-1">
                Plant gemeinsam — lade deine Freunde ein
              </h2>
              <p className="text-sm text-white/60 mt-1 leading-relaxed">
                Erstelle einen Plan rund um dieses Event und chattet euch warm.
                Aus vager Idee wird ein gemeinsamer Abend.
              </p>
            </div>
            <Link
              href={`/groups?from_event=${event.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors flex-shrink-0"
              style={{ background: '#fff', color: '#0a0a0c' }}
            >
              <IconPlus size={14} strokeWidth={2.5}/>
              Plan erstellen
            </Link>
          </div>
        </section>
      )}

      {/* ─────── ABOUT + LINEUP ───────────────────────────────────── */}
      <section className="px-5 sm:px-12 lg:px-16 pt-10 sm:pt-14 pb-12 sm:pb-16 max-w-[1280px] mx-auto">
        <div
          className="grid gap-10 lg:gap-16"
          style={{
            gridTemplateColumns: lineup.length > 0 ? 'minmax(0, 1fr) minmax(0, 380px)' : 'minmax(0, 1fr)',
          }}
        >
          <div className="min-w-0">
            <Eyebrow>Worum es geht</Eyebrow>
            {/* AI-citable intro paragraph — Google AI Overviews & Perplexity
                read this first sentence as the canonical fact. */}
            <p
              className="text-white/85 mt-3.5"
              style={{ fontSize: 'clamp(15px, 1.2vw, 18px)', lineHeight: 1.6, maxWidth: 640, textWrap: 'pretty' }}
            >
              {intro}
            </p>
            {event.description && event.description.trim() !== intro.trim() && (
              <p
                className="text-white/70 whitespace-pre-line mt-4"
                style={{ fontSize: 'clamp(14px, 1vw, 16px)', lineHeight: 1.65, maxWidth: 640, textWrap: 'pretty' }}
              >
                {event.description}
              </p>
            )}

            {/* tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-7">
                {event.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs font-medium rounded-full px-3 py-1.5 text-white/80"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* primary action buttons */}
            <div className="flex flex-wrap gap-3 mt-7">
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-colors"
                  style={{ background: '#fff', color: '#0a0a0c' }}
                >
                  <IconTicket size={14} strokeWidth={2}/>
                  Tickets sichern
                </a>
              )}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border transition-colors hover:bg-white/5"
                  style={{ borderColor: 'rgba(255,255,255,0.10)', color: '#fff' }}
                >
                  Zur Veranstaltung
                </a>
              )}
            </div>
          </div>

          {/* Lineup column — only renders when ingestion picked up an
              ordered act list (festivals via festival_artists). */}
          {lineup.length > 0 && (
            <div className="min-w-0">
              <Eyebrow>Lineup · {lineup.length} {lineup.length === 1 ? 'Act' : 'Acts'}</Eyebrow>
              <div className="mt-3.5">
                {lineup.map((l, i) => (
                  <div
                    key={`${l.artist_name}-${i}`}
                    className="grid gap-4 py-3.5 items-center"
                    style={{
                      gridTemplateColumns: '54px 1fr',
                      borderBottom: i < lineup.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                    }}
                  >
                    <div
                      className="text-sm font-semibold text-white"
                      style={{ fontFeatureSettings: "'tnum','lnum'" }}
                    >
                      {l.start_time ?? '—'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{l.artist_name}</div>
                      {l.stage && <div className="text-xs text-white/60 mt-0.5">{l.stage}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────── MAP SECTION ──────────────────────────────────────── */}
      {mapUrl && (
        <section className="px-5 sm:px-12 lg:px-16 pb-16 max-w-[1280px] mx-auto">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <Eyebrow>Treffpunkt</Eyebrow>
              <h2
                className="text-white"
                style={{
                  fontSize: 'clamp(20px, 2.2vw, 28px)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  margin: '6px 0 0',
                }}
              >
                {venue?.name ?? event.location_name ?? event.address ?? 'Veranstaltungsort'}
              </h2>
            </div>
            {event.latitude != null && event.longitude != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' }}
              >
                <IconNav size={14}/>
                Route öffnen
              </a>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                aspectRatio: '16/9',
                border: '1px solid rgba(255,255,255,0.06)',
                background: '#0d1014',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapUrl}
                alt={`Karte für ${event.title}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div
                className="absolute left-4 bottom-4 px-3 py-2 rounded-xl text-xs text-white/85 inline-flex items-center gap-1.5 backdrop-blur-md"
                style={{
                  background: 'rgba(20,20,22,0.85)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <IconPin size={12} className="text-emerald-400"/>
                {venue?.name ?? event.location_name ?? `${derivedCity ?? event.bundesland ?? ''}`}
              </div>
            </div>

            {/* directions card — links out to maps providers. The travel
                times are best-effort static estimates; we don't have a
                routing API yet. Marked with subtle copy so users get
                that they're approximations. */}
            <div
              className="rounded-3xl p-5"
              style={{
                background: '#141416',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Eyebrow>So kommst du hin</Eyebrow>
              <div className="mt-3.5 flex flex-col">
                {[
                  {
                    icon: <IconNav size={15}/>,
                    label: 'Auto / Taxi',
                    href: `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}&travelmode=driving`,
                    sub: derivedCity ? `Route via ${derivedCity}` : 'Auto-Route',
                  },
                  {
                    icon: <IconLayers size={15}/>,
                    label: 'Bahn + Bus',
                    href: `https://fahrplan.oebb.at/webapp/?Z=${encodeURIComponent(event.address ?? event.location_name ?? derivedCity ?? '')}`,
                    sub: 'ÖBB Fahrplan-Suche',
                  },
                  {
                    icon: <IconZap size={15}/>,
                    label: 'E-Bike / Rad',
                    href: `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}&travelmode=bicycling`,
                    sub: 'Radroute prüfen',
                  },
                ].map((r, i) => (
                  <a
                    key={r.label}
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-white/[0.03] -mx-1 px-1 rounded-lg"
                    style={{
                      borderTop: i ? '1px solid rgba(255,255,255,0.06)' : undefined,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-[11px] text-white/60 mt-0.5 truncate">{r.sub}</div>
                    </div>
                    <IconChevR size={14} className="text-white/40 flex-shrink-0"/>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────── SIMILAR EVENTS ────────────────────────────────────── */}
      <section className="px-5 sm:px-12 lg:px-16 pb-16 max-w-[1280px] mx-auto">
        <RelatedEvents eventId={event.id}/>
      </section>

      {/* ─────── FOOTER ───────────────────────────────────────────── */}
      <footer
        className="px-5 sm:px-12 lg:px-16 py-8 sm:py-10 max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/40"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          {event.source_url && (
            <>
              Quelle:{' '}
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 underline underline-offset-[3px] hover:text-white"
              >
                {(() => {
                  try { return new URL(event.source_url).hostname.replace(/^www\./, ''); }
                  catch { return event.source_url; }
                })()}
              </a>
              <span className="mx-2">·</span>
            </>
          )}
          {event.updated_at ? (
            <>aktualisiert {formatDateLong(event.updated_at)}</>
          ) : (
            <>von einem Veranstalter eingetragen</>
          )}
        </div>
        <div className="flex gap-4">
          <Link href={`/events/create?from=${event.id}`} className="hover:text-white">
            Ähnliches Event erstellen
          </Link>
        </div>
      </footer>

    </main>
  );
}
