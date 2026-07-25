'use client';

/**
 * Hero der Aktivitaets-Detailseite (fn-18 Task 3).
 *
 * Client-Komponente wegen des onError-Fallbacks: Bilder werden direkt
 * vom Deskline-CDN gehotlinkt — bricht der Link, faellt der Hero still
 * auf einen Gradient zurueck. Copyright/Author aus dem images-jsonb
 * werden SICHTBAR gerendert (Attribution-Pflicht).
 */

import { useState } from 'react';
import type { PublicActivityImage } from '@/lib/activities/public-types';

interface ActivityHeroProps {
  name: string;
  town: string | null;
  bundeslandLabel: string | null;
  tags: string[];
  images: PublicActivityImage[] | null;
  /** Sichtbarer Hinweis fuer dauerhaft geschlossene POIs (is_closed). */
  closedLabel: string | null;
  imageCreditPrefix: string;
  children?: React.ReactNode;
}

function firstImage(images: PublicActivityImage[] | null): PublicActivityImage | null {
  if (!images) return null;
  for (const img of images) {
    if (Array.isArray(img.urls) && img.urls.some((u) => typeof u === 'string' && u.trim() !== '')) {
      return img;
    }
  }
  return null;
}

export function ActivityHero({
  name,
  town,
  bundeslandLabel,
  tags,
  images,
  closedLabel,
  imageCreditPrefix,
  children,
}: ActivityHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const image = firstImage(images);
  const imageUrl = image?.urls.find((u) => typeof u === 'string' && u.trim() !== '') ?? null;
  const credit = image ? (image.copyright || image.author) : null;
  const showImage = imageUrl != null && !imageFailed;

  const locationLine = [town, bundeslandLabel].filter(Boolean).join(', ');

  return (
    <header className="relative">
      <div className="relative w-full h-64 md:h-96 overflow-hidden rounded-b-3xl bg-gradient-to-br from-emerald-900/60 via-slate-900 to-black">
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element -- Deskline-CDN-Hotlink mit onError-Fallback; next/image würde die fremde Domain proxien
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        {/* Bild-Attribution (Pflicht) — nur wenn das Bild wirklich zu sehen ist */}
        {showImage && credit && (
          <span className="absolute bottom-2 right-3 text-[10px] text-white/50 bg-black/50 px-2 py-0.5 rounded">
            {imageCreditPrefix} {credit}
          </span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative">
        {closedLabel && (
          <span className="inline-block mb-3 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
            {closedLabel}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">{name}</h1>
        {locationLine && <p className="text-white/50 mt-2">{locationLine}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {children}
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-xs bg-white/[0.06] text-white/60 border border-white/[0.08]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
