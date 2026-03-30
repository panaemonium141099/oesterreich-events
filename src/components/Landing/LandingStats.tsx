import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function LandingStats() {
  let total = 42000; // fallback
  try {
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .or('visibility.eq.public,source_type.eq.scraped');
    if (count) total = count;
  } catch {}

  const formatted = total.toLocaleString('de-AT');

  return (
    <p className="text-white/40 text-lg md:text-xl animate-fade-in opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
      <span className="text-white font-semibold">{formatted}+</span> Events in ganz Österreich
    </p>
  );
}
