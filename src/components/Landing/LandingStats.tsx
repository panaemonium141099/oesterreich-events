import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function LandingStats() {
  let total = 42000; // fallback
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .or('visibility.eq.public,source_type.eq.scraped')
      .gte('start_date', today);
    if (count) total = count;
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
