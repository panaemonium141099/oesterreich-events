'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { riseItem, EASE_OUT_EXPO } from './motion';
import { AvatarStack } from './primitives';

export interface PlanCardData {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  image_url: string | null;
  linked_event_image_url?: string | null;
  rsvp_counts: { accepted: number; maybe: number; pending: number; declined: number };
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
  participant_avatars?: { url: string | null; name: string }[];
}

interface PlanCardProps {
  plan: PlanCardData;
  /**
   * Dezenter „↓ als nächstes"-Indikator auf dem obersten kommenden Treffen.
   * Das Card-Layout bleibt identisch — Hierarchie entsteht nur über den
   * Caption-Marker, nicht über Größe (sonst wirken alle anderen als
   * Runner-ups).
   */
  isNext?: boolean;
  index?: number;
}

function formatDateLine(dateStr: string | null): { day: string; month: string; time: string | null } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('de-AT', { day: '2-digit' });
  const month = d.toLocaleDateString('de-AT', { month: 'short' }).replace('.', '').toUpperCase();
  const h = d.getHours();
  const m = d.getMinutes();
  const time = (h === 0 && m === 0) ? null : d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return { day, month, time };
}

function getMapThumbnail(lat: number | null, lng: number | null, width = 540, height = 360): string | null {
  if (!lat || !lng) return null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  // Dark style + warm off-white marker (matches the accent token)
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+d0c9bd(${lng},${lat})/${lng},${lat},12.5,0/${width}x${height}@2x?access_token=${token}`;
}

export function PlanCard({ plan, isNext = false, index = 0 }: PlanCardProps) {
  const date = formatDateLine(plan.event_date);
  const bgImg = plan.image_url || plan.linked_event_image_url;
  const mapImg = getMapThumbnail(plan.location_lat, plan.location_lng);

  const totalConfirmed = plan.rsvp_counts.accepted;
  const totalMaybe = plan.rsvp_counts.maybe;

  return (
    <motion.div
      variants={riseItem}
      custom={index}
      layoutId={`plan-card-${plan.id}`}
    >
      <Link
        href={`/groups/${plan.id}`}
        className={[
          'group relative block overflow-hidden rounded-[22px] isolate',
          'border transition-all duration-500',
          isNext
            ? 'border-[color:var(--color-planer-accent)]/30 hover:border-[color:var(--color-planer-accent)]/55'
            : 'border-white/[0.06] hover:border-white/18',
          'bg-[color:var(--color-planer-surface)]',
        ].join(' ')}
        style={{
          boxShadow: isNext
            ? '0 14px 36px -24px rgba(245, 239, 226, 0.14), 0 6px 20px -10px rgba(0,0,0,0.5)'
            : '0 10px 32px -18px rgba(0,0,0,0.5)',
        }}
      >
        {/* Uniform inner grid: map on the left, content on the right */}
        <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr] min-h-[180px]">

          {/* Visual side — layered:
                BASE layer: map preview (or pattern fallback)
                COVER layer: title image, if any — fades out on hover to
                reveal the map/info underneath. This makes the card feel
                like an event poster at rest and a data card on inspection. */}
          <div className="relative overflow-hidden">
            {/* ─── BASE: map or pattern fallback ─── */}
            {mapImg ? (
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapImg}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-planer-void)]/85 via-[color:var(--color-planer-void)]/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[color:var(--color-planer-surface)]/50" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-[color:var(--color-planer-raised)]">
                <div
                  className="absolute inset-0 opacity-50"
                  style={{
                    backgroundImage: `radial-gradient(circle at 30% 40%, rgba(245,239,226,0.14), transparent 55%)`,
                  }}
                />
                <svg
                  className="absolute inset-0 m-auto w-10 h-10 text-[color:var(--color-planer-whisper)]"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            )}

            {/* ─── COVER: title image (fades out on hover) ─── */}
            {bgImg && (
              <div className="absolute inset-0 transition-opacity duration-500 ease-out group-hover:opacity-0 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bgImg}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* subtle vignette for badge legibility when image is showing */}
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-planer-void)]/70 via-transparent to-[color:var(--color-planer-void)]/25" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[color:var(--color-planer-surface)]/40" />
              </div>
            )}

            {/* Date badge — always visible, floats over whichever layer is showing */}
            {date && (
              <div className="absolute top-3 left-3 flex flex-col items-center justify-center rounded-xl bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 px-2.5 py-2 min-w-[54px] z-10">
                <span className="serif-display text-[22px] leading-none font-light text-[color:var(--color-planer-ink)] tabular">
                  {date.day}
                </span>
                <span className="text-[9px] tracking-[0.18em] text-[color:var(--color-planer-accent)] mt-0.5">
                  {date.month}
                </span>
                {date.time && (
                  <span className="text-[10px] text-[color:var(--color-planer-dim)] mt-1 tabular">
                    {date.time}
                  </span>
                )}
              </div>
            )}

            {/* Type badge bottom-left */}
            <div className="absolute bottom-3 left-3 z-10">
              <span
                className={[
                  'inline-block text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded-full backdrop-blur-sm border',
                  plan.event_type === 'existing_event'
                    ? 'bg-[color:var(--color-planer-maybe)]/15 border-[color:var(--color-planer-maybe)]/30 text-[color:var(--color-planer-maybe)]'
                    : 'bg-[color:var(--color-planer-accent)]/15 border-[color:var(--color-planer-accent)]/30 text-[color:var(--color-planer-accent)]',
                ].join(' ')}
              >
                {plan.event_type === 'existing_event' ? 'Öffentlich' : 'Privat'}
              </span>
            </div>

            {/* "Hover"-hint — only when there's a cover to reveal */}
            {bgImg && (
              <span className="absolute bottom-3 right-3 text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-planer-ink)]/60 opacity-80 group-hover:opacity-0 transition-opacity duration-300 z-10">
                Hover
              </span>
            )}
          </div>

          {/* Content side */}
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
            <div>
              <h3 className="serif-display font-light text-[color:var(--color-planer-ink)] tracking-tight leading-tight text-[20px] sm:text-[22px]">
                {plan.name}
              </h3>
              {plan.location_name && (
                <p className="mt-1.5 text-[color:var(--color-planer-dim)] flex items-center gap-1.5 text-xs sm:text-sm">
                  <svg className="w-3 h-3 shrink-0 text-[color:var(--color-planer-accent)]/70" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a8 8 0 00-8 8c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  <span className="truncate">{plan.location_name}</span>
                </p>
              )}
            </div>

            {/* Bottom row: participants + message preview + arrow */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                {plan.participant_avatars && plan.participant_avatars.length > 0 && (
                  <AvatarStack avatars={plan.participant_avatars} size={28} max={3} />
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] text-[color:var(--color-planer-ink)]">
                    <span className="tabular text-[color:var(--color-planer-sage)]">{totalConfirmed}</span>
                    {totalMaybe > 0 ? (
                      <>
                        <span className="text-[color:var(--color-planer-whisper)] mx-1">·</span>
                        <span className="tabular text-[color:var(--color-planer-maybe)]">{totalMaybe}</span>
                        <span className="text-[color:var(--color-planer-whisper)] ml-1">vielleicht</span>
                      </>
                    ) : (
                      <span className="text-[color:var(--color-planer-dim)] ml-1">dabei</span>
                    )}
                  </span>
                  <span className="text-[10px] text-[color:var(--color-planer-whisper)]">
                    {plan.member_count} eingeladen
                  </span>
                </div>
              </div>

              {/* Subtle arrow that magnetically shifts on hover */}
              <motion.span
                className="shrink-0 text-[color:var(--color-planer-accent)]/40 group-hover:text-[color:var(--color-planer-accent)] transition-colors"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </motion.span>
            </div>

            {/* Last message whisper */}
            {plan.last_message && (
              <div className="pt-3 border-t border-white/[0.04]">
                <p className="text-[11px] text-[color:var(--color-planer-dim)] italic line-clamp-1">
                  „{plan.last_message}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hover sheen — whisper of warmth, no drama */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 20% 0%, rgba(245,239,226,0.03), transparent 50%)',
            }}
          />
        </div>
      </Link>
    </motion.div>
  );
}
