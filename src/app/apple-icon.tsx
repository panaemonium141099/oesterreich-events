import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon (180×180). Richer than the 32px favicon because iOS
 * can show gradients + type at this size. Keeps the brand palette
 * (rose → pink → violet) with a white pin mark.
 */
export default function AppleIcon() {
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
          background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 45%, #8b5cf6 100%)',
          borderRadius: '36px',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={100}
          height={100}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#ffffff"
          />
          <circle cx="12" cy="9" r="2.5" fill="#f43f5e" />
        </svg>
        <div
          style={{
            marginTop: 6,
            fontSize: 22,
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: 'sans-serif',
            letterSpacing: '0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          LassTreffen
        </div>
      </div>
    ),
    { ...size },
  );
}
