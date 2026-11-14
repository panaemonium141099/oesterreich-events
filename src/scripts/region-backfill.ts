/**
 * Backfill der Regionsschlüssel im Bestand (fn-31.7).
 *
 * Der Schreibweg füllt `region_id`, `kreis_key`, `gemeinde_key` seit fn-31.6.
 * Zeilen, die seither kein Scraper geliefert hat, bekommen sie hier, mit
 * DERSELBEN Funktion (`regionKeys`), ohne Resolver-Lauf und ohne Netz.
 *
 * Der Bestand hat je Land nur einige tausend verschiedene Gemeinden in der
 * Ortsentscheidung. Statt jede Zeile einzeln über die REST-API zu schreiben
 * (228.000 Anfragen für Deutschland), rechnet das Skript die Schlüssel je
 * Gemeinde-Gruppe und erzeugt SQL, das die Datenbank in Scheiben ausführt:
 *
 *   1. Gruppen aus Prod holen (nur lesend):
 *        psql … -c "\copy (<GROUPS_SQL>) to stdout csv header" > gruppen.csv
 *   2. Schlüssel rechnen und SQL schreiben:
 *        npx tsx src/scripts/region-backfill.ts --country DE --groups gruppen.csv --out backfill.sql
 *   3. backfill.sql per psql ausführen (16 Scheiben nach erster Stelle der id,
 *      je eine Transaktion; ein zweiter Lauf schreibt nichts mehr).
 *
 * Nie während eines Deploys oder eines Nachtlaufs ausführen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { regionKeys, type RegionKeys } from '@/lib/location/region-keys';

/** Die Abfrage für Schritt 1; `:country` durch das Land ersetzen. */
export const GROUPS_SQL = `select location_resolution->'gemeinde'->>'name' as name,
       location_resolution->'gemeinde'->>'plz' as plz,
       location_resolution->'gemeinde'->>'bundesland' as land,
       location_resolution->'gemeinde'->>'bezirk' as kreis,
       count(*) as n
from events
where country = ':country' and jsonb_typeof(location_resolution->'gemeinde') = 'object'
group by 1,2,3,4`;

export interface Group { name: string; plz: string; land: string; kreis: string; n: number }

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

const lit = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);

export interface BackfillPlan {
  sql: string;
  /** Zeilen je Ergebnis, für den Bericht. */
  tally: Record<'gemeinde' | 'nur_kreis' | 'nur_land' | 'nichts', { gruppen: number; events: number }>;
}

/** Aus den Gruppen eines Landes das SQL und die Zählung. Pur. */
export function planBackfill(country: 'AT' | 'DE', groups: Group[]): BackfillPlan {
  const tally: BackfillPlan['tally'] = {
    gemeinde: { gruppen: 0, events: 0 },
    nur_kreis: { gruppen: 0, events: 0 },
    nur_land: { gruppen: 0, events: 0 },
    nichts: { gruppen: 0, events: 0 },
  };
  const values: string[] = [];
  for (const g of groups) {
    const k: RegionKeys = regionKeys(country, { name: g.name, plz: g.plz, bundesland: g.land, bezirk: g.kreis || null });
    const kind = k.gemeinde_key ? 'gemeinde' : k.kreis_key ? 'nur_kreis' : k.region_id ? 'nur_land' : 'nichts';
    tally[kind].gruppen++;
    tally[kind].events += g.n;
    if (kind === 'nichts') continue;
    values.push(`(${lit(g.name)}, ${lit(g.plz)}, ${lit(g.land)}, ${lit(g.kreis)}, ${lit(k.region_id)}, ${lit(k.kreis_key)}, ${lit(k.gemeinde_key)})`);
  }

  const out: string[] = [
    `-- Backfill der Regionsschlüssel für ${country} (fn-31.7), erzeugt von src/scripts/region-backfill.ts.`,
    `-- ${values.length} Gemeinde-Gruppen. Wiederholbar: geschrieben wird nur, was abweicht.`,
    "set statement_timeout = '10min';",
    "set lock_timeout = '5s';",
    // Ohne Trigger dieser Sitzung: `events_updated_at` würde sonst `updated_at`
    // jeder Zeile auf jetzt setzen (Sitemap-lastmod, alles, was nach
    // Änderungsdatum liest). Die Schlüssel sind abgeleitete Angaben, kein
    // inhaltlicher Stand. Gilt nur für diese Verbindung.
    'set session_replication_role = replica;',
    'create temp table region_map (name text, plz text, land text, kreis text, region_id text, kreis_key text, gemeinde_key text) on commit preserve rows;',
  ];
  for (let i = 0; i < values.length; i += 500) {
    out.push(`insert into region_map values\n${values.slice(i, i + 500).join(',\n')};`);
  }
  out.push('create index on region_map (name, land);', 'analyze region_map;');
  // 16 Scheiben nach der ersten Stelle der id: kurze Transaktionen, Pause dazwischen.
  for (const hex of '0123456789abcdef') {
    out.push(
      `update events e set region_id = m.region_id, kreis_key = m.kreis_key, gemeinde_key = m.gemeinde_key
from region_map m
where e.country = '${country}'
  and left(e.id::text, 1) = '${hex}'
  and e.location_resolution->'gemeinde'->>'name' = m.name
  and e.location_resolution->'gemeinde'->>'bundesland' = m.land
  and coalesce(e.location_resolution->'gemeinde'->>'plz', '') = coalesce(m.plz, '')
  and coalesce(e.location_resolution->'gemeinde'->>'bezirk', '') = coalesce(m.kreis, '')
  and (e.region_id is distinct from m.region_id or e.kreis_key is distinct from m.kreis_key or e.gemeinde_key is distinct from m.gemeinde_key);`,
      'select pg_sleep(2);',
    );
  }
  out.push(
    `select count(*) filter (where gemeinde_key is not null) as mit_gemeinde, count(*) filter (where region_id is not null) as mit_land, count(*) as gesamt from events where country = '${country}';`,
  );
  return { sql: out.join('\n') + '\n', tally };
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

if ((process.argv[1] ?? '').split('\\').join('/').endsWith('src/scripts/region-backfill.ts')) {
  const country = arg('country');
  const groupsFile = arg('groups');
  const outFile = arg('out');
  if ((country !== 'AT' && country !== 'DE') || !groupsFile || !outFile) {
    console.error('Aufruf: region-backfill.ts --country AT|DE --groups <csv> --out <sql>');
    process.exit(1);
  }
  const rows = parseCsv(readFileSync(groupsFile, 'utf8')).slice(1);
  const groups: Group[] = rows.map(([name, plz, land, kreis, n]) => ({ name, plz, land, kreis, n: Number(n) }));
  const plan = planBackfill(country, groups);
  writeFileSync(outFile, plan.sql);
  const total = Object.values(plan.tally).reduce((s, t) => s + t.events, 0);
  for (const [kind, t] of Object.entries(plan.tally)) {
    console.log(`${kind}: ${t.events} Events (${total ? ((t.events / total) * 100).toFixed(2) : '0'} %), ${t.gruppen} Gruppen`);
  }
  console.log(`SQL geschrieben: ${outFile}`);
}
