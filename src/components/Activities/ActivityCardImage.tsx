'use client';

/**
 * Karten-Bild fuer Aktivitaets-Snippet-Cards (fn-18 Task 4, User-Feedback):
 * gleiche Regeln wie der Hero der Detailseite (ActivityHero) —
 *
 *   - Deskline-CDN-Hotlink mit onError-Fallback auf einen Gradient
 *     (Client-Komponente genau deswegen),
 *   - Copyright/Author aus dem images-jsonb SICHTBAR als kleines
 *     Overlay (Attribution auch auf Karten, solange das Bild zu sehen ist),
 *   - defensives Parsen: images kommt roh/ungeprueft aus dem jsonb.
 */

import { useState } from 'react';
import { pickActivityImage } from '@/lib/activities/card-image';

interface ActivityCardImageProps {
  /** Roh-jsonb der Aktivitaet (PublicActivityImage[] — nie validiert). */
  images: unknown;
  alt: string;
  /** Text im Gradient-Fallback (z. B. Tag-Label). */
  fallbackLabel: string;
  /** Prefix der Bild-Attribution (i18n 'imageCredit', z. B. "Bild:"). */
  creditPrefix: string;
  /** Tailwind-Aspect-Klasse; Hub 4/3, Event-Detail 16/9. */
  aspectClass?: string;
}

export function ActivityCardImage({
  images,
  alt,
  fallbackLabel,
  creditPrefix,
  aspectClass = 'aspect-[4/3]',
}: ActivityCardImageProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const image = pickActivityImage(images);
  const showImage = image != null && !imageFailed;

  return (
    <div
      className={`relative w-full ${aspectClass} overflow-hidden bg-gradient-to-br from-emerald-900/50 via-slate-900 to-black`}
    >
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Deskline-CDN-Hotlink mit onError-Fallback (wie ActivityHero) */}
          <img
            src={image.url}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
          {image.credit && (
            <span className="absolute bottom-1.5 right-2 text-[9px] text-white/60 bg-black/50 px-1.5 py-0.5 rounded">
              {creditPrefix} {image.credit}
            </span>
          )}
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 text-center px-3 leading-tight">
          {fallbackLabel}
        </span>
      )}
    </div>
  );
}
