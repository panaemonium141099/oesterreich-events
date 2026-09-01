import { ImageResponse } from 'next/og';

// 192×192 statt 64×64 (2026-09-01): Google zeigt SERP-Favicons auf
// Retina-Displays mit ~96px effektiver Größe — das 64er wurde hochskaliert
// und wirkte verpixelt (User-Befund). Der Pin ist vektorgezeichnet und
// bleibt bei 192 gestochen scharf; Google empfiehlt Vielfache von 48px.
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

/**
 * Browser / SERP favicon — Pin-Dot brand glyph.
 *
 * Design source: design-system logos/pindot-refinements.jsx (favicon spec in
 * each Pd* variant). The pin glyph alone is the brand mark — at 16×16 favicon
 * scale a wordmark would be illegible, but the pin silhouette (teardrop with
 * center dot) reads cleanly even at the smallest sizes.
 *
 * Colors: rust-red body (#c8553d) with cream center dot (#f3ecdb) on a
 * warm-black rounded-square (#0a0a0c). The cream-on-rust matches the
 * design-system favicon swatch in PdA / PdC / PdH etc.
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
          background: '#0a0a0c',
          borderRadius: '36px',
        }}
      >
        {/* The pin SVG is inlined to avoid runtime font/asset loading.
            ImageResponse renders this as the PNG, so it ships as a static
            image — no CSP issues with inline SVG at runtime. */}
        <svg
          width="126"
          height="157.5"
          viewBox="0 0 24 30"
          style={{ display: 'block' }}
        >
          <path
            d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
            fill="#c8553d"
          />
          <circle cx="12" cy="11.5" r="4" fill="#f3ecdb" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
