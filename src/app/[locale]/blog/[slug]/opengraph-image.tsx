import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/content/blog';

export const alt = 'Blog Post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORY_COLORS: Record<string, string> = {
  'Musik & Festival': '#7c3aed',
  'Musik & Konzerte': '#6d28d9',
  'Kultur & Tradition': '#b45309',
  'Kultur & Bühne': '#92400e',
  'Kulinarik & Tradition': '#15803d',
  'Essen & Trinken': '#166534',
  'Sport & Outdoor': '#0369a1',
  'Sport & Fitness': '#0c4a6e',
  'Festivals & Feste': '#be123c',
  'Open-Air & Feste': '#9f1239',
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return new ImageResponse(
      (
        <div style={{ fontSize: 48, background: '#111', color: '#fff', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          LassTreffen.at
        </div>
      ),
      { ...size },
    );
  }

  const accentColor = CATEGORY_COLORS[post.category] || '#111827';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px',
          background: `linear-gradient(135deg, ${accentColor} 0%, #111827 60%, #0f172a 100%)`,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top bar: branding + category */}
        <div style={{ position: 'absolute', top: '48px', left: '60px', right: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: '#111' }}>
              L
            </div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px', fontWeight: 600, letterSpacing: '0.05em' }}>
              LassTreffen.at
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', border: '1.5px solid rgba(255,255,255,0.3)', padding: '6px 16px', borderRadius: '4px' }}>
            {post.category}
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 style={{ fontSize: post.title.length > 35 ? '52px' : '64px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em' }}>
            {post.title}
          </h1>
          <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.55)', margin: 0, fontWeight: 400, lineHeight: 1.4, maxWidth: '800px' }}>
            {post.keyFacts.dates} — {post.keyFacts.location}
          </p>
        </div>

        {/* Bottom accent line */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
      </div>
    ),
    { ...size },
  );
}
