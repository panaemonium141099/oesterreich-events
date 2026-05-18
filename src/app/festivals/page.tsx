import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Festival } from '@/types/festivals';
import { V4FestivalCard } from '@/components/Events/v4';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export const metadata: Metadata = {
  title: 'Festivals in Österreich — lasstreffen.at',
  description: 'Alle Festivals mit Termin und Line-up — Konzerte, Kultur, Sommer.',
};

const FESTIVAL_FALLBACK_COUNT = 30;
function festivalCategoryFallback(festivalId: string): string {
  let h = 0;
  for (let i = 0; i < festivalId.length; i++) {
    h = (h * 31 + festivalId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(h) % FESTIVAL_FALLBACK_COUNT) + 1;
  return `/images/categories/musik-${idx}.jpg`;
}

type ParentEventRow = {
  id: string;
  slug: string | null;
  start_date: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  location_name: string | null;
  image_url: string | null;
};
type FestivalRow = Festival & { parent_event: ParentEventRow | ParentEventRow[] | null };

export default async function FestivalsPage() {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('festivals')
    .select('*, parent_event:events!parent_event_id(id, slug, start_date, postal_code, address, bundesland, location_name, image_url)')
    .gte('ends_at', today)
    .order('starts_at', { ascending: true });

  const festivals = ((data ?? []) as unknown as FestivalRow[]).map(f => {
    const parentEvent = Array.isArray(f.parent_event) ? f.parent_event[0] : f.parent_event;
    const { parent_event: _omit, ...rest } = f;
    void _omit;
    const href = parentEvent && parentEvent.slug && parentEvent.start_date
      ? buildEventUrlV2({
          id: parentEvent.id,
          slug: parentEvent.slug,
          start_date: parentEvent.start_date,
          postal_code: parentEvent.postal_code,
          address: parentEvent.address,
          bundesland: parentEvent.bundesland,
          location_name: parentEvent.location_name,
        })
      : `/festivals/${f.slug}`;
    return {
      ...(rest as Festival),
      image_url: parentEvent?.image_url ?? festivalCategoryFallback(f.id),
      href,
    };
  });

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-10 md:py-14">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          Saison · Termine bekannt
        </p>
        <h1 className="text-[32px] md:text-[44px] font-bold leading-tight tracking-[-0.03em] text-[var(--v4-ink)]">
          Festivals
        </h1>
        <p className="mt-3 text-[14px] md:text-[15.5px] text-[var(--v4-ink-70)] max-w-[640px]">
          {festivals.length === 0
            ? 'Aktuell sind keine kommenden Festivals in unserer Datenbank.'
            : `${festivals.length} kommende Festivals in Österreich.`}
        </p>
      </section>

      {festivals.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {festivals.map(f => (
              <V4FestivalCard key={f.id} festival={f}/>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
