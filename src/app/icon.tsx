import { ImageResponse } from 'next/og';
import { HouseMark } from '@/lib/brand/HouseMark';

// 192×192 statt 64×64 (2026-09-01): Google zeigt SERP-Favicons auf
// Retina-Displays mit ~96px effektiver Größe — das 64er wurde hochskaliert
// und wirkte verpixelt (User-Befund). Die Marke ist vektorgezeichnet und
// bleibt bei 192 gestochen scharf; Google empfiehlt Vielfache von 48px.
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

/**
 * Browser / SERP favicon — Bildmarke „Haus mit Wegen" (seit 2026-09-24,
 * ersetzt den Pin). Roter Kreis auf transparentem Grund, damit er im
 * hellen wie im dunklen Browser-Tab und in der Google-Trefferliste ohne
 * Kasten steht.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HouseMark size={192} />
      </div>
    ),
    { ...size },
  );
}
