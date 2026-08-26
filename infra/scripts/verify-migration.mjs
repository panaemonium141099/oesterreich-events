#!/usr/bin/env node
/**
 * infra/scripts/verify-migration.mjs — Beweist, dass der Restore vollstaendig war (fn-19)
 *
 *   PGPASSWORD=... node infra/scripts/verify-migration.mjs <dump-verzeichnis>
 *
 * Vergleicht die neue Datenbank gegen die baseline-*.txt/tsv, die
 * dump-from-supabase.sh VOR dem Dump aus der Cloud gezogen hat.
 *
 * Warum ueberhaupt: pg_restore meldet Fehler auf stderr und laeuft trotzdem
 * weiter. Ein Restore, der 118 von 121 Tabellen gefuellt hat, sieht im
 * Terminal aus wie ein Erfolg. Dieses Skript ist der Unterschied zwischen
 * "hat funktioniert" und "ich habe nachgesehen".
 *
 * Nutzt psql als Unterprozess — keine neue npm-Dependency (das Projekt hat
 * bewusst keinen direkten Postgres-Treiber, siehe fn-19 Decision Context).
 *
 * Exit 0 = alles gruen. Exit 1 = mindestens ein Befund.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dumpDir = process.argv[2];
if (!dumpDir) {
  console.error('usage: verify-migration.mjs <dump-verzeichnis>');
  process.exit(1);
}

const PSQL_ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '127.0.0.1',
  PGPORT: process.env.PGPORT ?? '5432',
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

/** Fuehrt SQL aus und liefert Zeilen als Array von Feld-Arrays. */
function query(sql) {
  const out = execFileSync(
    'psql',
    ['--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '--field-separator=\t', '--command', sql],
    { env: PSQL_ENV, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split('\t'));
}

const findings = [];
const ok = [];
function check(label, passed, detail) {
  (passed ? ok : findings).push(`${label}${detail ? ` — ${detail}` : ''}`);
}

// ─────────────────────────────────────────────────── 1. Zeilenzahlen
// n_live_tup ist eine Schaetzung aus den Statistiken, keine exakte Zahl.
// Nach dem ANALYZE im Restore-Skript ist sie belastbar, aber nicht auf die
// Zeile genau — daher 2 % Toleranz. Eine LEERE Tabelle, die vorher gefuellt
// war, ist dagegen immer ein Befund, egal wie klein.
const baselinePath = join(dumpDir, 'baseline-rowcounts.tsv');
if (!existsSync(baselinePath)) {
  console.error(`FEHLER: ${baselinePath} fehlt. Ohne Baseline ist keine Aussage moeglich.`);
  process.exit(1);
}

const baseline = new Map(
  readFileSync(baselinePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, count] = l.split('\t');
      return [name, Number(count)];
    }),
);

const current = new Map(
  query(`
    select schemaname || '.' || relname, n_live_tup
    from pg_stat_user_tables
    where schemaname in ('public','auth','storage')
  `).map(([name, count]) => [name, Number(count)]),
);

let tablesOk = 0;
for (const [table, expected] of baseline) {
  const actual = current.get(table);

  if (actual === undefined) {
    findings.push(`FEHLT: Tabelle ${table} existiert nicht (erwartet ${expected} Zeilen)`);
    continue;
  }
  if (expected > 0 && actual === 0) {
    findings.push(`LEER: ${table} hat 0 Zeilen, erwartet ~${expected}`);
    continue;
  }
  if (expected > 0) {
    const drift = Math.abs(actual - expected) / expected;
    if (drift > 0.02) {
      findings.push(
        `ABWEICHUNG: ${table} hat ${actual}, erwartet ~${expected} (${(drift * 100).toFixed(1)} %)`,
      );
      continue;
    }
  }
  tablesOk++;
}
check(`Zeilenzahlen: ${tablesOk}/${baseline.size} Tabellen im Toleranzbereich`, tablesOk === baseline.size);

// ─────────────────────────────────────────────── 2. Schema-Objekte
const [[policies, functions, matviews, indexes]] = query(`
  select
    (select count(*) from pg_policies where schemaname='public'),
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'),
    (select count(*) from pg_matviews where schemaname='public'),
    (select count(*) from pg_indexes where schemaname='public')
`);

const baseObjPath = join(dumpDir, 'baseline-objects.txt');
if (existsSync(baseObjPath)) {
  const raw = readFileSync(baseObjPath, 'utf8');
  const expect = Object.fromEntries(
    [...raw.matchAll(/(\w+)=(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  check(`RLS-Policies: ${policies} (erwartet ${expect.policies})`, Number(policies) === expect.policies);
  check(`Funktionen: ${functions} (erwartet ${expect.functions})`, Number(functions) === expect.functions);
  check(`Materialized Views: ${matviews} (erwartet ${expect.matviews})`, Number(matviews) === expect.matviews);
  // Indizes duerfen minimal abweichen (Constraint-Indizes werden je nach
  // Restore-Reihenfolge anders benannt) — daher nur Warnung bei Unterdeckung.
  check(
    `Indizes: ${indexes} (erwartet ${expect.indexes})`,
    Number(indexes) >= expect.indexes,
    Number(indexes) < expect.indexes ? 'ES FEHLEN INDIZES — Queries werden langsam sein' : undefined,
  );
}

// ─────────────────────────────────────────────────────── 3. RPCs
// Die 10 Funktionen, die der Anwendungscode per supabase.rpc() aufruft.
// Fehlt eine, bricht ein Feature erst zur Laufzeit — genau das wollen wir
// hier vorher wissen.
const REQUIRED_RPCS = [
  'search_event_ids',
  'rewire_saved_events_to_primaries',
  'match_lineup_artists',
  'match_fuzzy_artist_titles',
  'match_exact_artist_title',
  'match_artist_descriptions',
  'execute_sql_query',
  'delete_derived_event',
  'bulk_update_event_scores',
  'apply_master_coords_bulk',
];
const presentRpcs = new Set(
  query(`
    select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  `).map(([n]) => n),
);
const missingRpcs = REQUIRED_RPCS.filter((r) => !presentRpcs.has(r));
check(
  `RPCs: ${REQUIRED_RPCS.length - missingRpcs.length}/${REQUIRED_RPCS.length} vorhanden`,
  missingRpcs.length === 0,
  missingRpcs.length ? `fehlt: ${missingRpcs.join(', ')}` : undefined,
);

// ──────────────────────────────────────────────── 4. Extensions
const REQUIRED_EXT = ['pg_trgm', 'vector', 'pg_cron', 'pg_net'];
const presentExt = new Set(query('select extname from pg_extension').map(([n]) => n));
const missingExt = REQUIRED_EXT.filter((e) => !presentExt.has(e));
check(
  `Extensions: ${REQUIRED_EXT.length - missingExt.length}/${REQUIRED_EXT.length}`,
  missingExt.length === 0,
  missingExt.length ? `fehlt: ${missingExt.join(', ')}` : undefined,
);

// ─────────────────────────────────────────────────── 5. Auth-User
const [[authUsers, confirmedUsers, identities]] = query(`
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where email_confirmed_at is not null),
    (select count(*) from auth.identities)
`);
check(
  `Auth: ${authUsers} User, ${confirmedUsers} bestaetigt, ${identities} Identities`,
  Number(authUsers) > 0,
  Number(identities) === 0 ? 'KEINE Identities — Google-OAuth-Logins werden fehlschlagen' : undefined,
);

// ───────────────────────────────────────── 6. RLS tatsaechlich aktiv
// Eine Policy zu haben und RLS eingeschaltet zu haben sind zwei Dinge.
// Ein Restore, der die Policies mitbringt aber RLS nicht aktiviert, macht
// alle 33 Policies wirkungslos — bei oeffentlich erreichbarem PostgREST ein
// echtes Datenleck.
const rlsOff = query(`
  select distinct t.tablename
  from pg_policies p
  join pg_tables t on t.schemaname = p.schemaname and t.tablename = p.tablename
  join pg_class c on c.relname = t.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
  where t.schemaname = 'public' and c.relrowsecurity = false
`).map(([t]) => t);
check(
  'RLS auf allen Tabellen mit Policies aktiv',
  rlsOff.length === 0,
  rlsOff.length ? `RLS AUS bei: ${rlsOff.join(', ')} — DATENLECK-RISIKO` : undefined,
);

// ───────────────────────────────────────────── 7. MVs nicht leer
const emptyMvs = query(`
  select matviewname from pg_matviews where schemaname='public' and not ispopulated
`).map(([n]) => n);
check(
  'Materialized Views befuellt',
  emptyMvs.length === 0,
  emptyMvs.length ? `leer: ${emptyMvs.join(', ')} — Karte/Stats liefern nichts` : undefined,
);

// ────────────────────────────────────────────────────── Ausgabe
console.log('\n─── OK ' + '─'.repeat(60));
for (const line of ok) console.log('  ✓ ' + line);

if (findings.length) {
  console.log('\n─── BEFUNDE ' + '─'.repeat(54));
  for (const line of findings) console.log('  ✗ ' + line);
  console.log(`\n${findings.length} Befund(e). Migration NICHT abgenommen.\n`);
  process.exit(1);
}

console.log('\nAlle Checks gruen. Migration verifiziert.\n');
