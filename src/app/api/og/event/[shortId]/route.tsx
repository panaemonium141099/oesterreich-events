/**
 * Dynamic Open-Graph image for an event.
 *
 * Moved from the route-file convention (`opengraph-image.tsx` next to the
 * page) to an API route because Next.js forbids metadata files inside
 * catch-all routes:
 *
 *   Error: Catch-all must be the last part of the URL in route
 *          "/events/[...slug]/opengraph-image"
 *
 * Now reachable at `/api/og/event/<8-char-shortId>` and referenced from the
 * event page's `metadata.openGraph.images[0].url`. Cached by Next.js so
 * each unique event image is regenerated at most once per revalidate
 * window.
 */

import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { extractShortId } from '@/lib/utils/slugify';

export const runtime = 'nodejs';
export const revalidate = 86400; // re-render OG image once per day per event

const size = { width: 1200, height: 630 };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getEvent(token: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, bundesland, category, slug')
      .eq('id', token)
      .single();
    if (data) return data;
  }
  const shortId = extractShortId(token);
  const rangeStart = `${shortId}-0000-0000-0000-000000000000`;
  const rangeEnd = `${shortId}-ffff-ffff-ffff-ffffffffffff`;
  const { data } = await supabase
    .from('events')
    .select('id, title, start_date, location_name, bundesland, category, slug')
    .gte('id', rangeStart)
    .lte('id', rangeEnd)
    .limit(1)
    .single();
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await params;
  const event = await getEvent(shortId);

  const title = event?.title ?? 'Event in Österreich';
  const subtitle = [
    event?.start_date
      ? new Date(event.start_date).toLocaleDateString('de-AT', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null,
    event?.location_name || event?.bundesland || 'Österreich',
  ]
    .filter(Boolean)
    .join(' · ');

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
            alignSelf: 'flex-start',
            padding: '10px 18px',
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.12)',
            fontSize: 24,
          }}
        >
          {event?.category ?? 'Event'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: title.length > 60 ? 48 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
              maxWidth: 1000,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title.length > 90 ? title.slice(0, 87) + '...' : title}
          </div>

          <div
            style={{
              fontSize: 30,
              opacity: 0.85,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            opacity: 0.75,
          }}
        >
          <div>LassTreffen.at</div>
          <div>lasstreffen.at</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, must-revalidate',
        'Content-Type': 'image/png',
      },
    },
  );
}
