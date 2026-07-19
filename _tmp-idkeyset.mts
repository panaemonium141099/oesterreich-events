import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const today = new Date().toISOString().split('T')[0];
const t0 = Date.now();
let lastId: string | null = null;
let total = 0, pages = 0, slowest = 0;
for (let page = 1; page <= 60; page++) {
  const tp = Date.now();
  let q = sb.from('events').select('id, quality_score')
    .gte('start_date', today).eq('publish_status', 'published').gte('quality_score', 40)
    .order('id', { ascending: true }).limit(1000);
  if (lastId) q = q.gt('id', lastId);
  const { data, error } = await q;
  const ms = Date.now() - tp;
  slowest = Math.max(slowest, ms);
  if (error) { console.log('ERR page', page, error.message); break; }
  if (!data || data.length === 0) break;
  total += data.length; pages++;
  lastId = data[data.length - 1].id;
  if (data.length < 1000) break;
}
console.log(JSON.stringify({ pages, total, gesamtSek: ((Date.now()-t0)/1000).toFixed(1), langsamstePageMs: slowest }));
