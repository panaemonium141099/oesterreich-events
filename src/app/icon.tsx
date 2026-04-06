import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

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
          background: '#111827',
          borderRadius: '6px',
          fontSize: '20px',
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
