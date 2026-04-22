import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/**
 * Browser / SERP favicon. One Fraunces serif "L" on a warm-black rounded
 * square — matches the Planer hero's editorial direction.
 *
 * Downscales cleanly to 16/32 px because the L is the whole silhouette:
 * a bold stem + serif terminals read as a distinct shape even at tiny
 * sizes, unlike a complex illustration that would muddy.
 */
export default async function Icon() {
  const fraunces = await loadGoogleFont({ family: 'Fraunces', weight: 600 });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07060a',
          borderRadius: '12px',
          color: '#f5efe2',
          fontFamily: 'Fraunces',
          fontSize: 52,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          // Pull the L slightly up-left so it sits optically centered
          // inside a square (typography renders with ascender room).
          paddingBottom: 6,
        }}
      >
        L
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Fraunces', data: fraunces, style: 'normal', weight: 600 }],
    },
  );
}
