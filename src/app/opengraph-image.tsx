import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LassTreffen.at — Entdecke was los ist in Österreich';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 48,
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #111827 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {['Konzerte', 'Kultur', 'Nightlife', 'Sport', 'Familie', 'Natur'].map(
            (cat) => (
              <div
                key={cat}
                style={{
                  display: 'flex',
                  padding: '8px 16px',
                  borderRadius: 9999,
                  background: 'rgba(255,255,255,0.1)',
                  fontSize: 20,
                }}
              >
                {cat}
              </div>
            ),
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            LassTreffen.at
          </div>

          <div
            style={{
              fontSize: 32,
              opacity: 0.85,
              maxWidth: 800,
            }}
          >
            Entdecke was los ist in Österreich
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            opacity: 0.6,
          }}
        >
          <div>40.000+ Veranstaltungen auf einer Karte</div>
          <div>lasstreffen.at</div>
        </div>
      </div>
    ),
    size,
  );
}
