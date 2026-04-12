import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Event-Vorschau';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getEventByShortId(slugParam: string) {
  // Full UUID exact match
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam)) {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, bundesland, category, slug')
      .eq('id', slugParam)
      .single();
    if (data) return data;
  }

  // Short ID range query
  const shortId = slugParam.slice(0, 8);
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

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventByShortId(slug);

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
    size,
  );
}
