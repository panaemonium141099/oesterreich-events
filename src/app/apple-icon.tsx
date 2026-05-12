import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon (180×180) — Pin-Dot brand glyph with brand-name caption.
 *
 * Same teardrop pin as the 64px favicon (icon.tsx) but at 180px we have
 * room for a small "LASS TREFFEN" caption below — matches the design-system
 * favicon spec where the larger size shows pin + wordmark caption.
 *
 * iOS auto-rounds at ~22% corner radius, so the container is a plain dark
 * square. The subtle radial-gradient vignette adds depth without competing
 * with the pin.
 */
export default async function AppleIcon() {
  const geist = await loadGoogleFont({
    family: 'Geist',
    weight: 500,
    text: 'LASS TREFFEN',
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0c',
          // Slight inner vignette for depth — matches existing apple-icon
          // styling so the home-screen icon visual weight stays consistent.
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(245,239,226,0.08), transparent 55%)',
          gap: 14,
          paddingBottom: 18,
        }}
      >
        {/* Pin glyph — sized to ~50% of the icon so the silhouette dominates,
            with the caption acting as supporting type. The shadow is omitted
            because the dark backdrop doesn't read shadows well at this scale. */}
        <svg width="84" height="105" viewBox="0 0 24 30" style={{ display: 'block' }}>
          <path
            d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
            fill="#c8553d"
          />
          <circle cx="12" cy="11.5" r="4" fill="#f3ecdb" />
        </svg>
        <div
          style={{
            fontFamily: 'Geist',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#9a938a',
          }}
        >
          Lass Treffen
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: geist, style: 'normal', weight: 500 },
      ],
    },
  );
}
