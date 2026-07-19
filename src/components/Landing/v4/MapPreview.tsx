import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * MapPreview — server-rendered preview of the real /map experience.
 *
 * Uses Mapbox Static Images API (HTTP-only, no mapbox-gl client bundle) so
 * the visual fidelity matches /map without adding ~480 KB of JS to the
 * landing — fn-15 bundle discipline stays intact. The PNG is a fixed-URL
 * GET which lets the browser + CDN cache it aggressively.
 *
 * Pin colors map to v4 card states:
 *   sand   (#d4b896) — Tickets verfügbar
 *   gold   (#f5b942) — Künstler im Line-up
 *   green  (#7bb794) — In deinem Plan
 *
 * NEXT_PUBLIC_MAPBOX_TOKEN is the same token the real /map uses; the URL
 * is constructed at render time. Marker coords are real Austrian cities
 * — same 5 dots the SVG had before, just placed on an actual map image.
 */

// Lon, Lat (Mapbox order)
const MARKERS = [
  // Wien — sand (Tickets verfügbar)
  { lon: 16.37, lat: 48.21, color: 'd4b896' },
  // Eisenstadt — gold (Künstler im Line-up)
  { lon: 16.51, lat: 47.85, color: 'f5b942' },
  // Salzburg — sand
  { lon: 13.04, lat: 47.81, color: 'd4b896' },
  // Linz — sand
  { lon: 14.30, lat: 48.30, color: 'd4b896' },
  // Graz — green (In deinem Plan)
  { lon: 15.43, lat: 47.07, color: '7bb794' },
  // Innsbruck — sand
  { lon: 11.40, lat: 47.27, color: 'd4b896' },
];

function buildMapboxUrl(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // Without a token the API returns 401. Return an empty string and let the
  // <img> tag handle the broken-image case gracefully (fallback shows the
  // dark backdrop + legend, still readable).
  if (!token) return '';
  const pins = MARKERS.map(m => `pin-s+${m.color}(${m.lon},${m.lat})`).join(',');
  // Austria roughly: center 13.55,47.6, zoom 5.4 covers Bregenz→Wien.
  const camera = '13.55,47.55,5.4,0';
  const size = '1280x320@2x';
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/${camera}/${size}?access_token=${token}&logo=false&attribution=false`;
}

export function MapPreview() {
  const t = useTranslations('Landing.MapPreview');
  const mapUrl = buildMapboxUrl();

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            {t('eyebrow')}
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            {t('title')}
          </h2>
        </div>
        <Link
          href="/map"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          {t('open')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      <Link
        href="/map"
        className="press-haptic relative block h-[220px] md:h-[320px] rounded-[18px] overflow-hidden border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)]"
        aria-label={t('open')}
      >
        {mapUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mapUrl}
            alt={t('alt')}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-50)] text-sm">
            {t('loading')}
          </div>
        )}

        {/* Soft top-fade so the legend + CTA stay legible regardless of map content */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[rgba(10,10,12,0.45)]" aria-hidden="true"/>

        <div className="absolute bottom-4 left-4 flex gap-3.5 flex-wrap px-3.5 py-2.5 rounded-xl bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] text-[11px] text-[var(--v4-ink-70)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-ticket)' }} aria-hidden="true"/>
            {t('legendTickets')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-match)' }} aria-hidden="true"/>
            {t('legendLineup')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-go)' }} aria-hidden="true"/>
            {t('legendPlan')}
          </span>
        </div>

        <span
          className="press-haptic absolute top-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          {t('open')}
        </span>
      </Link>
    </section>
  );
}
