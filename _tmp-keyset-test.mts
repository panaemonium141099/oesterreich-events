import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const today = new Date().toISOString().split('T')[0];
const PAGE = 1000, MAX = 45000;
const t0 = Date.now();
let cursor: { qs: number; id: string } | null = null;
const seen = new Set<string>();
let total = 0, dupes = 0, pages = 0, slowest = 0;
while (total < MAX) {
  const tp = Date.now();
  let q = sb.from('events')
    .select('id, quality_score')
    .gte('start_date', today).eq('publish_status', 'published').gte('quality_score', 40)
    .order('quality_score', { ascending: false }).order('id', { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.or(`quality_score.lt.${cursor.qs},and(quality_score.eq.${cursor.qs},id.gt.${cursor.id})`);
  const { data, error } = await q;
  if (error) { console.log('ERR page', pages, error.message); break; }
  if (!data || data.length === 0) break;
  const ms = Date.now() - tp;
  slowest = Math.max(slowest, ms);
  pages++;
  for (const r of data) { if (seen.has(r.id)) dupes++; else seen.add(r.id); total++; }
  if (data.length < PAGE) break;
  const last = data[data.length - 1];
  cursor = { qs: last.quality_score ?? 0, id: last.id };
}
console.log(JSON.stringify({ pages, total, dupes, gesamtSek: ((Date.now()-t0)/1000).toFixed(1), langsamstePageMs: slowest }));
