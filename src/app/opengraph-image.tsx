import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LassTreffen.at — Entdecke was los ist in Österreich';

/**
 * Open Graph / social preview card. What people see when they share a
 * LassTreffen link on Discord, WhatsApp, Twitter, etc.
 *
 * Editorial composition: top caption (magazine masthead style), big
 * Fraunces wordmark "Lass Treffen" with the italic emphasis on the
 * action word, tagline + URL at the bottom. All on the same warm-
 * black that the Planer uses, so brand cohesion stays tight from
 * browser tab to social embed.
 */
export default async function Image() {
  const [frauncesRegular, frauncesItalic, geist, geistMedium] = await Promise.all([
    loadGoogleFont({ family: 'Fraunces', weight: 500 }),
    loadGoogleFont({ family: 'Fraunces', weight: 500, style: 'italic' }),
    loadGoogleFont({ family: 'Geist', weight: 400 }),
    loadGoogleFont({ family: 'Geist', weight: 500 }),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          background: '#07060a',
          // Warm-white spotlight from top, subtle edge vignette
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,239,226,0.07), transparent 65%)',
          color: '#ede6d8',
        }}
      >
        {/* Top row — masthead caption + URL badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'Geist',
            fontSize: 16,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#9a938a',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'Fraunces',
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: '#f5efe2',
                textTransform: 'none',
              }}
            >
              L
            </span>
            <span>Lass Treffen · Österreich</span>
          </div>
          <div>lasstreffen.at</div>
        </div>

        {/* Hero wordmark — Fraunces display */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces',
              fontSize: 148,
              fontWeight: 500,
              letterSpacing: '-0.035em',
              lineHeight: 0.95,
              color: '#f5efe2',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 20,
            }}
          >
            <span>Lass</span>
            <span style={{ fontStyle: 'italic' }}>Treffen</span>
            <span>.</span>
          </div>

          <div
            style={{
              fontFamily: 'Geist',
              fontSize: 26,
              color: '#9a938a',
              maxWidth: 720,
              lineHeight: 1.45,
            }}
          >
            Events in Wien, Graz, Salzburg und ganz Österreich —
            40&thinsp;000 Konzerte, Festivals, Märkte, Partys auf einer Karte.
          </div>
        </div>

        {/* Bottom row — thin rule + footer hint */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              height: 1,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(245,239,226,0.22) 20%, rgba(245,239,226,0.22) 80%, transparent 100%)',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'Geist',
              fontSize: 18,
              color: '#9a938a',
            }}
          >
            <div>
              Gemeinsam hingehen · gemeinsam planen
            </div>
            <div style={{ fontStyle: 'italic', fontFamily: 'Fraunces' }}>
              seit 2026
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: frauncesRegular, style: 'normal', weight: 500 },
        { name: 'Fraunces', data: frauncesItalic, style: 'italic', weight: 500 },
        { name: 'Geist', data: geist, style: 'normal', weight: 400 },
        { name: 'Geist', data: geistMedium, style: 'normal', weight: 500 },
      ],
    },
  );
}
