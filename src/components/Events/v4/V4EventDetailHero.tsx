/**
 * V4EventDetailHero — image hero with Spotify/Apple-Music-style blurred
 * backdrop derived from the image itself, and a sharp centered inset that
 * shows the image in its native aspect ratio without upscaling.
 *
 * Why: many TVB-source images (Feratel) cap at 640×427. Rendering them as
 * full-bleed `object-cover` on a 1920×480 hero produces 2-3× browser
 * upscaling → pixelated. Using the same image as a heavily-blurred,
 * scaled, saturated backdrop fills the hero with color from the image
 * itself; the sharp inset (object-contain) stays unblown-up.
 *
 * Big images (≥ container size) look the same as before, just with a
 * tiny slice of blurred ambient padding — acceptable trade-off for
 * a consistent visual language across the catalogue.
 *
 * RSC. Uses next/image with `priority` so the inset is the LCP element.
 * Falls back to a text-only hero when imageUrl is null.
 */

import Image from 'next/image';
import { useLocale } from 'next-intl';
import { V4BackButton } from './V4BackButton';
import { V4HeroSlideshow } from './V4HeroSlideshow';

interface V4EventDetailHeroProps {
  title: string;
  startDate: string;
  locationName: string | null;
  city: string | null;
  imageUrl?: string | null;
  /** Mehrere Bilder → Hero wird zur Diashow. */
  images?: string[] | null;
}

function formatDate(iso: string, fmt: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(fmt, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString(fmt, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function V4EventDetailHero({ title, startDate, locationName, city, imageUrl, images }: V4EventDetailHeroProps) {
  const locale = useLocale();
  const dateLabel = formatDate(startDate, locale === 'de' ? 'de-AT' : 'en-GB');
  const placeLabel = [locationName, city].filter(Boolean).join(' · ');
  const slides = (images ?? []).filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );

  return (
    <section className="relative h-[320px] md:h-[480px] overflow-hidden">
      <V4BackButton className="top-4 left-4 md:top-5 md:left-5"/>
      {slides.length > 1 ? (
        <V4HeroSlideshow images={slides} title={title} />
      ) : imageUrl ? (
        <>
          {/* Layer 1: blurred backdrop sampled from the image itself.
              `scale(1.2)` hides the soft edges that `blur()` produces
              outside the original image rect. `saturate(1.4)` keeps the
              ambient color punchy after the heavy blur. */}
          <Image
            src={imageUrl}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            style={{
              objectFit: 'cover',
              filter: 'blur(40px) saturate(1.4) brightness(0.85)',
              transform: 'scale(1.2)',
            }}
          />
          {/* Layer 2: sharp inset — object-contain keeps the native
              aspect ratio and never upscales beyond what fits. */}
          <div className="absolute inset-0 flex items-center justify-center px-4 py-4 md:px-10 md:py-8">
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={title}
                fill
                priority
                sizes="(max-width: 768px) 92vw, 1100px"
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
        </>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[var(--v4-surface-elevated)]"/>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,12,0.40) 0%, rgba(10,10,12,0.00) 35%, rgba(10,10,12,0.92) 100%)',
        }}
      />

      <div className="absolute left-0 right-0 bottom-0">
        <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-5 md:py-9 flex flex-col items-start gap-2.5">
          <h1
            className="m-0 text-[30px] md:text-[52px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.02] max-w-[760px]"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
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
