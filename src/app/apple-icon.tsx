import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon (180×180). Same Fraunces L silhouette as the
 * 64px favicon, but room to breathe — slightly larger letter with a
 * tiny editorial caption below to hint at the brand name when the user
 * pulls up their home-screen grid.
 */
export default async function AppleIcon() {
  const fraunces = await loadGoogleFont({ family: 'Fraunces', weight: 600, text: 'L' });
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
          background: '#07060a',
          // iOS auto-rounds at ~22% — don't double-round. Slight inner
          // vignette for depth.
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(245,239,226,0.08), transparent 55%)',
          fontFamily: 'Fraunces',
          color: '#f5efe2',
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: 'Fraunces',
            fontSize: 120,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: -8,
          }}
        >
          L
        </div>
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
        { name: 'Fraunces', data: fraunces, style: 'normal', weight: 600 },
        { name: 'Geist', data: geist, style: 'normal', weight: 500 },
      ],
    },
  );
}
