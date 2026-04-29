import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function LandingStats() {
  let total = 42000; // fallback
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Count unique events (deduplicated by title + date)
    // Supabase can't do DISTINCT count, so we use a raw count and apply
    // the known dedup ratio (~70% of raw events are unique)
    // count='estimated' — landing-page total ist eh "circa", exact count
    // braucht zweite Vollscan-Query auf 175k events.
    // visibility ist NOT NULL DEFAULT 'public' seit 2026-04-29.
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'estimated', head: true })
      .eq('visibility', 'public')
      .gte('start_date', today);
    if (count) {
      // Apply dedup ratio: ~30% of events are title+date duplicates from multiple scrapers
      total = Math.round(count * 0.70);
    }
  } catch {}

  const formatted = total.toLocaleString('de-AT');

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
      <p className="text-white/40 text-lg md:text-xl">
        <span className="text-white font-semibold">{formatted}+</span> Events in ganz Österreich
      </p>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/25">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        Täglich aktualisiert
      </span>
    </div>
  );
}
