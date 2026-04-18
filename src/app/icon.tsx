import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Browser / search-result favicon. Displayed at 16-32px so the design has to
 * read at tiny sizes. A filled pin silhouette with a bright centre dot works
 * well enough to not look like a placeholder in Google's SERP while keeping
 * the Next.js metadata-file convention (no static asset needed).
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
          background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%)',
          borderRadius: '7px',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={22}
          height={22}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#ffffff"
          />
          <circle cx="12" cy="9" r="2.5" fill="#f43f5e" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
