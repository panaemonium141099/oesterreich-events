import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

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
          background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)',
          borderRadius: '36px',
          fontSize: '100px',
          fontWeight: 800,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        L
      </div>
    ),
    { ...size },
  );
}
