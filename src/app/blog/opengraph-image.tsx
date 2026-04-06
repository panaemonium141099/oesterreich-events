import { ImageResponse } from 'next/og';

export const alt = 'Österreich Events Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #111827 0%, #1e293b 50%, #0f172a 100%)',
          fontFamily: 'sans-serif',
          gap: '24px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, color: '#111' }}>
            L
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px', fontWeight: 600, letterSpacing: '0.05em' }}>
            LassTreffen.at
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '72px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em', textAlign: 'center' }}>
          Events Blog
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: '26px', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center', maxWidth: '700px', lineHeight: 1.4 }}>
          Event-Guides, Tipps und Insiderwissen zu den besten Veranstaltungen in ganz Österreich
        </p>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          {['Musik', 'Kultur', 'Sport', 'Märkte', 'Klassik'].map((cat) => (
            <span key={cat} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', border: '1.5px solid rgba(255,255,255,0.2)', padding: '6px 18px', borderRadius: '20px' }}>
              {cat}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
