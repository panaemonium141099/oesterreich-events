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
  /** Featured style = bigger, with prominent map hero and amber glow */
  featured?: boolean;
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

function getMapThumbnail(lat: number | null, lng: number | null, width = 480, height = 320): string | null {
  if (!lat || !lng) return null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  // Dark style + amber-tinted marker (our accent)
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+e8a94e(${lng},${lat})/${lng},${lat},12.5,0/${width}x${height}@2x?access_token=${token}`;
}

export function PlanCard({ plan, featured = false, index = 0 }: PlanCardProps) {
  const date = formatDateLine(plan.event_date);
  const bgImg = plan.image_url || plan.linked_event_image_url;
  const mapImg = getMapThumbnail(
    plan.location_lat,
    plan.location_lng,
    featured ? 900 : 480,
    featured ? 500 : 320,
  );

  const totalConfirmed = plan.rsvp_counts.accepted;
  const totalMaybe = plan.rsvp_counts.maybe;

  return (
    <motion.div
      variants={riseItem}
      custom={index}
      layoutId={`plan-card-${plan.id}`}
      className={featured ? '' : ''}
    >
      <Link
        href={`/groups/${plan.id}`}
        className={[
          'group relative block overflow-hidden rounded-[22px] isolate',
          'border transition-all duration-500',
          featured
            ? 'border-[color:var(--color-planer-amber)]/20 hover:border-[color:var(--color-planer-amber)]/45'
            : 'border-white/[0.06] hover:border-white/20',
          'bg-[color:var(--color-planer-surface)]',
        ].join(' ')}
        style={{
          boxShadow: featured
            ? '0 30px 60px -30px rgba(232, 169, 78, 0.25), 0 10px 30px -10px rgba(0,0,0,0.5)'
            : '0 12px 40px -20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Inner grid: map left, content right. Featured: full-width hero image. */}
        <div className={featured ? 'grid grid-cols-1 md:grid-cols-[1.1fr_1fr]' : 'grid grid-cols-[140px_1fr] sm:grid-cols-[170px_1fr]'}>

          {/* Visual side */}
          <div className="relative overflow-hidden">
            {mapImg ? (
              <div className="w-full h-full min-h-[140px] relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapImg}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
                  loading="lazy"
                />
                {/* warm overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-planer-void)]/90 via-[color:var(--color-planer-void)]/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[color:var(--color-planer-surface)]/50" />
              </div>
            ) : bgImg ? (
              <div className="w-full h-full min-h-[140px] relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bgImg}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-planer-void)]/90 via-[color:var(--color-planer-void)]/30 to-transparent" />
              </div>
            ) : (
              // Pattern-only fallback — radial amber echo
              <div className="w-full h-full min-h-[140px] bg-[color:var(--color-planer-raised)] relative">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `radial-gradient(circle at 30% 40%, rgba(232,169,78,0.22), transparent 55%)`,
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

            {/* Date badge — floats over the map */}
            {date && (
              <div className="absolute top-3 left-3 flex flex-col items-center justify-center rounded-xl bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 px-2.5 py-2 min-w-[54px]">
                <span className="serif-display text-[22px] leading-none font-light text-[color:var(--color-planer-ink)] tabular">
                  {date.day}
                </span>
                <span className="text-[9px] tracking-[0.18em] text-[color:var(--color-planer-amber)] mt-0.5">
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
            <div className="absolute bottom-3 left-3">
              <span
                className={[
                  'inline-block text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded-full backdrop-blur-sm border',
                  plan.event_type === 'existing_event'
                    ? 'bg-[color:var(--color-planer-plum)]/15 border-[color:var(--color-planer-plum)]/30 text-[color:var(--color-planer-plum)]'
                    : 'bg-[color:var(--color-planer-amber)]/10 border-[color:var(--color-planer-amber)]/30 text-[color:var(--color-planer-amber)]',
                ].join(' ')}
              >
                {plan.event_type === 'existing_event' ? 'Öffentliches Event' : 'Privater Plan'}
              </span>
            </div>
          </div>

          {/* Content side */}
          <div className={featured ? 'p-6 sm:p-8 flex flex-col justify-between gap-5' : 'p-4 sm:p-5 flex flex-col justify-between gap-3'}>
            <div>
              <h3
                className={[
                  'serif-display font-light text-[color:var(--color-planer-ink)] tracking-tight leading-tight',
                  featured ? 'text-[28px] sm:text-[34px]' : 'text-[18px] sm:text-[20px]',
                ].join(' ')}
              >
                {plan.name}
              </h3>
              {plan.location_name && (
                <p className={`mt-1.5 text-[color:var(--color-planer-dim)] flex items-center gap-1.5 ${featured ? 'text-sm' : 'text-xs'}`}>
                  <svg className="w-3 h-3 shrink-0 text-[color:var(--color-planer-amber)]/70" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a8 8 0 00-8 8c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  <span className="truncate">{plan.location_name}</span>
                </p>
              )}
            </div>

            {/* Bottom row: participants + message preview */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                {plan.participant_avatars && plan.participant_avatars.length > 0 && (
                  <AvatarStack avatars={plan.participant_avatars} size={featured ? 32 : 26} max={featured ? 5 : 3} />
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] text-[color:var(--color-planer-ink)]">
                    <span className="tabular text-[color:var(--color-planer-sage)]">{totalConfirmed}</span>
                    {totalMaybe > 0 && (
                      <>
                        <span className="text-[color:var(--color-planer-whisper)] mx-1">·</span>
                        <span className="tabular text-[color:var(--color-planer-plum)]">{totalMaybe}</span>
                        <span className="text-[color:var(--color-planer-whisper)] ml-1">vielleicht</span>
                      </>
                    )}
                    {totalMaybe === 0 && <span className="text-[color:var(--color-planer-dim)] ml-1">dabei</span>}
                  </span>
                  <span className="text-[10px] text-[color:var(--color-planer-whisper)]">
                    {plan.member_count} eingeladen
                  </span>
                </div>
              </div>

              {/* Subtle arrow that magnetically shifts on hover */}
              <motion.span
                className="shrink-0 text-[color:var(--color-planer-amber)]/40 group-hover:text-[color:var(--color-planer-amber)] transition-colors"
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

        {/* Amber sheen on hover — very subtle */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 20% 0%, rgba(232,169,78,0.06), transparent 50%)',
            }}
          />
        </div>
      </Link>
    </motion.div>
  );
}
