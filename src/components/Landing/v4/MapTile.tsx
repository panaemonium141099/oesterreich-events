/**
 * Karten-Kachel der Bühne (fn-30.5, Mockup D `.map`): Mapbox-Static-Bild
 * mit den Pins der heutigen Events als plain `<img>` (srcset 1x/2x, kein
 * mapbox-gl, kein next/image), darunter die Attributionszeile.
 *
 * Das Mapbox-Logo bleibt im Bild; weil die Bild-URL `attribution=false`
 * setzt, ist die Textzeile „© Mapbox © OpenStreetMap · Karte verbessern"
 * mit Links Pflicht (Mapbox Attribution Guide). Ohne Token liefert
 * `mapStaticImage` null: dann zeigt die Kachel nur den dunklen Verlauf
 * und denselben Knopf, ohne Attribution (keine Mapbox-Daten im Bild).
 * Bildfehler: das `<img>` hat `alt=""`, Browser zeichnen ein kaputtes Bild
 * mit leerem alt nicht, der Verlauf dahinter bleibt sichtbar.
 */

import { useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { MAPBOX_ATTRIBUTION_LINKS, mapStaticImage, type MapPin } from '@/lib/v4/map-static-url';

/** Logische Bildgröße der Kachel (eine Zeile) bzw. zwei Zeilen hoch (ohne Künstler-Kachel). */
export const MAP_TILE_SIZE = { width: 320, height: 256 } as const;
export const MAP_TILE_SIZE_TALL = { width: 320, height: 524 } as const;

const ATTRIBUTION_LINK = 'hover:underline underline-offset-2';

export function MapTile({
  pins,
  tall = false,
  token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  className,
}: {
  pins: MapPin[];
  /** Zwei Zeilen hoch, wenn die Künstler-Kachel entfällt. */
  tall?: boolean;
  token?: string | null;
  className?: string;
}) {
  const t = useTranslations('Landing.Map');
  const size = tall ? MAP_TILE_SIZE_TALL : MAP_TILE_SIZE;
  const image = mapStaticImage(pins, { token, width: size.width, height: size.height });

  return (
    <div className={`flex min-h-0 flex-col gap-1 ${className ?? ''}`} data-testid="map-tile">
      <LocaleLink
        href="/map"
        className="press-haptic relative block min-h-0 flex-1 overflow-hidden rounded-[18px] bg-[#101014] bg-[radial-gradient(ellipse_at_30%_20%,rgba(212,184,150,0.16),transparent_60%)]"
        data-track="landing_map_open"
      >
        {image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image.src}
            srcSet={image.srcSet}
            alt=""
            width={size.width}
            height={size.height}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            data-testid="map-tile-image"
          />
        )}
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.1),rgba(5,5,6,0.78))]"
          aria-hidden="true"
        />
        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="m-0 text-[17px] font-extrabold tracking-[-0.02em] text-[var(--v4-ink)]">{t('title')}</h2>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--v4-ink-70)]">{t('subtitle')}</p>
          </div>
          <b className="flex-none rounded-full bg-white px-3 py-2 text-[12.5px] font-bold text-[#0a0a0c]">
            {t('open')}
          </b>
        </div>
      </LocaleLink>

      {image && (
        <p className="m-0 px-1 text-[10.5px] leading-tight text-[var(--v4-ink-50)]" data-testid="map-attribution">
          ©{' '}
          <a href={MAPBOX_ATTRIBUTION_LINKS.mapbox} target="_blank" rel="noopener noreferrer" className={ATTRIBUTION_LINK}>
            Mapbox
          </a>
          {' '}©{' '}
          <a href={MAPBOX_ATTRIBUTION_LINKS.osm} target="_blank" rel="noopener noreferrer" className={ATTRIBUTION_LINK}>
            OpenStreetMap
          </a>
          <span aria-hidden="true"> · </span>
          <a href={MAPBOX_ATTRIBUTION_LINKS.improve} target="_blank" rel="noopener noreferrer" className={ATTRIBUTION_LINK}>
            {t('improve')}
          </a>
        </p>
      )}
    </div>
  );
}
