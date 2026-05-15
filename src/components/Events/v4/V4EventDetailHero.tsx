/**
 * V4EventDetailHero — full-bleed image hero with title + date + location
 * as a single legible block bottom-left over a vertical gradient mask.
 *
 * RSC. Uses next/image with `priority` to become the LCP element on
 * /events/<slug>. Falls back to a text-only hero when imageUrl is null.
 */

import Image from 'next/image';
import { V4BackButton } from './V4BackButton';

interface V4EventDetailHeroProps {
  title: string;
  startDate: string;
  locationName: string | null;
  city: string | null;
  imageUrl?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function V4EventDetailHero({ title, startDate, locationName, city, imageUrl }: V4EventDetailHeroProps) {
  const dateLabel = formatDate(startDate);
  const placeLabel = [locationName, city].filter(Boolean).join(' · ');

  return (
    <section className="relative h-[320px] md:h-[480px] overflow-hidden">
      <V4BackButton className="top-4 left-4 md:top-5 md:left-5"/>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[var(--v4-surface-elevated)]"/>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,12,0.40) 0%, rgba(10,10,12,0.10) 35%, rgba(10,10,12,0.92) 100%)',
        }}
      />

      <div className="absolute left-0 right-0 bottom-0">
        <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-5 md:py-9 flex flex-col items-start gap-2.5">
          <h1
            className="m-0 text-[30px] md:text-[52px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.02] max-w-[760px]"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
          >
            {title}
          </h1>
          <div className="flex flex-wrap gap-3 items-center text-[13.5px] md:text-[16px] font-medium text-[var(--v4-ink-70)]">
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateLabel}
            </span>
            {placeLabel && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {placeLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
