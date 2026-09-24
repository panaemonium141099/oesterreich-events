import { ImageResponse } from 'next/og';
import { HouseMark } from '@/lib/brand/HouseMark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon (180×180) — Bildmarke „Haus mit Wegen".
 *
 * iOS rundet selbst ab und verlangt einen deckenden Hintergrund, deshalb
 * sitzt der rote Kreis auf Weiß. Dient zugleich als Organization-Logo im
 * JSON-LD (layout.tsx), das Google für das Markenlogo heranzieht.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <HouseMark size={148} />
      </div>
    ),
    { ...size },
  );
}
