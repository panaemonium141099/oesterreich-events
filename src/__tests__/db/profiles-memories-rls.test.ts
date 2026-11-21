// Wächter: public.profiles bleibt für Besucher zu und zeigt angemeldeten
// Nutzern nur die Spalten der Oberfläche; die Memory-Policies fragen sich
// nicht wieder gegenseitig ab.
//
// Befund 2026-11-21 (Prod): Policy „Anyone can view profiles“ (SELECT, Rolle
// public, USING true) plus Tabellenrecht SELECT für anon. Mit dem öffentlichen
// Anon-Key waren 99 Profile samt E-Mail lesbar, 43 mit Telefonnummer, 70 mit
// Geburtsdatum, 28 mit Adresse. Am selben Tag: die SELECT-Policies von
// memories, memory_participants und memory_photos riefen sich gegenseitig auf,
// jede Abfrage endete mit 42P17 (infinite recursion).
//
// Regeln seit 20261121120000 / 20261121120100:
//   * keine Lese-Policy auf profiles für anon oder public,
//   * kein Tabellenrecht SELECT auf profiles für anon/authenticated, nur die
//     Spalten in PUBLIC_COLUMNS,
//   * Code mit Nutzer-Client liest aus profiles nur diese Spalten; das eigene
//     Profil kommt aus get_my_profile(), die Suche aus search_profiles(),
//   * SELECT-Policies der Memory-Tabellen lesen keine Tabelle direkt.
//
// Der Wächter liest Dateien. Das Verhalten selbst (42501, 42P17, Zeilenzahlen)
// wurde beim Schreiben der Migration gegen ein lokales Postgres geprüft; nach dem
// Ausführen misst man es an Prod nach, siehe PR.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const FUNCTIONS = '20261121120000_profile_funktionen_memory_policies.sql';
const LOCK = '20261121120100_profiles_spaltenrechte.sql';

/** Was jeder angemeldete Nutzer von jedem Profil lesen darf. */
const PUBLIC_COLUMNS = ['id', 'first_name', 'last_name', 'avatar_url', 'role'];
const API_ROLES = /\b(anon|authenticated|public)\b/i;

// Windows-Checkouts mit core.autocrlf liefern \r\n.
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
/** SQL ohne Zeilenkommentare: Kopftexte nennen die alten Zustände wörtlich. */
const code = (sql: string) => sql.replace(/^\s*--.*$/gm, '');

const migrationFiles = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
/** Die Sperre und alles, was nach ihr kommt. */
const sinceLock = migrationFiles.filter(f => f >= LOCK).map(f => [f, code(read(join(MIGRATIONS, f)))] as const);
const sinceFunctions = migrationFiles.filter(f => f >= FUNCTIONS).map(f => [f, code(read(join(MIGRATIONS, f)))] as const);

const functions = code(read(join(MIGRATIONS, FUNCTIONS)));
const lock = code(read(join(MIGRATIONS, LOCK)));

/** `CREATE POLICY <name> ON <tabelle> …;` */
function policies(sql: string, table: RegExp) {
  const re = /create\s+policy\s+("[^"]+"|\w+)\s+on\s+(?:public\.)?(\w+)\b([^;]*);/gi;
  return [...sql.matchAll(re)]
    .filter(m => table.test(m[2]))
    .map(m => {
      const body = m[3];
      const cmd = (/\bfor\s+(select|insert|update|delete|all)\b/i.exec(body)?.[1] ?? 'all').toLowerCase();
      const to = /\bto\s+([\w\s,]+?)\s+(?:using|with\s+check)\b/i.exec(body)?.[1]?.toLowerCase() ?? 'public';
      return { name: m[1].replace(/"/g, ''), table: m[2].toLowerCase(), cmd, to, body };
    });
}

/** `GRANT <rechte> ON [TABLE] <tabelle> TO <rollen>;` */
function tableGrants(sql: string) {
  const re = /\bgrant\s+([^;]*?)\s+on\s+(?!function\b|schema\b|sequence\b)(?:table\s+)?([^;]*?)\s+to\s+([^;]*);/gi;
  return [...sql.matchAll(re)].map(m => ({ privileges: m[1], target: m[2], roles: m[3], text: m[0] }));
}

/** Spalten aus `SELECT (a, b)`; null, wenn SELECT ohne Spaltenliste oder ALL vergeben wird. */
function grantedSelectColumns(privileges: string): string[] | null | undefined {
  if (/\ball\b/i.test(privileges)) return null;
  const select = /\bselect\b\s*(\(([^)]*)\))?/i.exec(privileges);
  if (!select) return undefined; // kein Leserecht in diesem GRANT
  if (!select[1]) return null;
  return select[2].split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
}

describe('profiles: die Sperre (20261121120100)', () => {
  it('entfernt die offene Policy und legt die Lese-Policy nur für authenticated an', () => {
    expect(lock).toMatch(/drop policy if exists "Anyone can view profiles" on public\.profiles;/i);
    const created = policies(lock, /^profiles$/i);
    expect(created.map(p => [p.name, p.cmd, p.to])).toEqual([['profiles_authenticated_read', 'select', 'authenticated']]);
  });

  it('nimmt das Tabellenrecht allen drei Rollen zusammen und vergibt genau die fünf Spalten', () => {
    expect(lock).toMatch(/revoke select on public\.profiles from public, anon, authenticated;/i);
    const grants = tableGrants(lock).filter(g => /\bprofiles\b/i.test(g.target));
    expect(grants).toHaveLength(1);
    expect(grantedSelectColumns(grants[0].privileges)).toEqual(PUBLIC_COLUMNS);
  });

  it('prüft das Ergebnis in der Datenbank und lädt das PostgREST-Schema neu', () => {
    expect(lock).toMatch(/has_column_privilege\(r\.rolname, a\.attrelid, a\.attnum, 'SELECT'\)/);
    expect(lock).toMatch(/raise exception 'profiles: Spalten weiterhin lesbar/i);
    expect(lock).toMatch(/raise exception 'profiles: Lese-Policy gilt weiterhin/i);
    expect(lock).toMatch(/NOTIFY pgrst, 'reload schema';/);
  });
});

describe('profiles: keine spätere Migration öffnet die Tabelle wieder', () => {
  it('erkennt offene Policies und Rechte (Parser-Wächter)', () => {
    const open = policies('CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);', /^profiles$/i);
    expect(open[0]).toMatchObject({ cmd: 'select', to: 'public' });
    const all = policies('create policy p on profiles using (true);', /^profiles$/i);
    expect(all[0]).toMatchObject({ cmd: 'all', to: 'public' });
    expect(grantedSelectColumns('SELECT')).toBeNull();
    expect(grantedSelectColumns('ALL PRIVILEGES')).toBeNull();
    expect(grantedSelectColumns('SELECT (id, email), UPDATE')).toEqual(['id', 'email']);
    expect(grantedSelectColumns('UPDATE')).toBeUndefined();
    expect(tableGrants('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;')[0].target).toMatch(/all tables/i);
  });

  it('keine Lese-Policy auf profiles gilt für anon oder public', () => {
    const open = sinceLock.flatMap(([file, sql]) =>
      policies(sql, /^profiles$/i)
        .filter(p => (p.cmd === 'select' || p.cmd === 'all') && /\b(anon|public)\b/.test(p.to))
        .map(p => `${file}: ${p.name} (${p.cmd}, ${p.to})`));
    expect(open).toEqual([]);
  });

  it('kein GRANT gibt anon oder authenticated mehr als die fünf Spalten', () => {
    const open = sinceLock.flatMap(([file, sql]) =>
      tableGrants(sql)
        .filter(g => API_ROLES.test(g.roles))
        .filter(g => /\bprofiles\b/i.test(g.target) || /all\s+tables\s+in\s+schema\s+public/i.test(g.target))
        .filter(g => {
          const columns = grantedSelectColumns(g.privileges);
          if (columns === undefined) return false;
          return columns === null || columns.some(c => !PUBLIC_COLUMNS.includes(c));
        })
        .map(g => `${file}: ${g.text.replace(/\s+/g, ' ')}`));
    expect(open).toEqual([]);
  });
});

describe('Funktionen für Profile und Memories (20261121120000)', () => {
  const fn = (name: string) => {
    const m = new RegExp(String.raw`create or replace function public\.${name}\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$;`, 'i').exec(functions);
    if (!m) throw new Error(`Funktion ${name} fehlt`);
    return { args: m[1], head: m[2], body: m[3] };
  };

  it.each([
    ['get_my_profile', ''],
    ['search_profiles', 'text, integer'],
    ['is_memory_member', 'uuid'],
  ])('%s: SECURITY DEFINER mit festem search_path, nur für authenticated ausführbar', (name, signature) => {
    const { head, body } = fn(name);
    expect(head).toMatch(/security definer/i);
    expect(head).toMatch(/set search_path = public, pg_temp/i);
    expect(head).toMatch(/\bstable\b/i);
    // Liest nur: der Wächter security-definer-grants.test.ts verlangt für
    // schreibende Definer-Funktionen die Sperre auch für authenticated.
    expect(body).not.toMatch(/\b(update|insert\s+into|delete\s+from|truncate|merge\s+into)\b/i);
    const esc = signature.replace(/[(),]/g, '\\$&');
    expect(functions).toMatch(new RegExp(String.raw`revoke all on function public\.${name}\(${esc}\) from public, anon, authenticated;`, 'i'));
    expect(functions).toMatch(new RegExp(String.raw`grant execute on function public\.${name}\(${esc}\) to authenticated, service_role;`, 'i'));
  });

  it('kein späteres GRANT öffnet eine der drei Funktionen für anon oder PUBLIC', () => {
    const open = sinceFunctions.flatMap(([file, sql]) =>
      [...sql.matchAll(/\bgrant\s+[^;]*?on\s+function\s+(?:public\.)?(get_my_profile|search_profiles|is_memory_member)\b[^;]*?\bto\b([^;]*);/gi)]
        .filter(m => /\b(anon|public)\b/i.test(m[2]))
        .map(m => `${file}: ${m[1]} → ${m[2].trim()}`));
    expect(open).toEqual([]);
  });

  it('get_my_profile liefert nur die Zeile des Aufrufers', () => {
    expect(fn('get_my_profile').body).toMatch(/where p\.id = \(select auth\.uid\(\)\)/i);
  });

  it('search_profiles gibt vier Spalten zurück und vergleicht die E-Mail nur exakt', () => {
    const { head, body } = fn('search_profiles');
    expect(head).toMatch(/returns table \(id uuid, first_name text, last_name text, avatar_url text\)/i);
    expect(body).toMatch(/select p\.id, p\.first_name, p\.last_name, p\.avatar_url\s+from public\.profiles p/i);
    expect(body).toMatch(/lower\(p\.email\) = lower\(q\.raw\)/i);
    expect(body).not.toMatch(/email\s+(i?like|~)/i);
    expect(body).toMatch(/\(select auth\.uid\(\)\) is not null/i);
    expect(body).toMatch(/p\.id <> \(select auth\.uid\(\)\)/i);
    // % und _ aus dem Suchtext sind Zeichen, keine Platzhalter.
    expect(body).toMatch(/'%', '\\%'\), '_', '\\_'\)/);
  });
});

describe('Memory-Policies fragen sich nicht gegenseitig ab', () => {
  const MEMORY_TABLES = /^(memories|memory_participants|memory_photos)$/i;

  it('die drei SELECT-Policies gelten für authenticated und rufen is_memory_member', () => {
    const select = policies(functions, MEMORY_TABLES).filter(p => p.cmd === 'select');
    expect(select.map(p => [p.table, p.to]).sort()).toEqual([
      ['memories', 'authenticated'],
      ['memory_participants', 'authenticated'],
      ['memory_photos', 'authenticated'],
    ]);
    for (const p of select) expect(p.body).toMatch(/public\.is_memory_member\((id|memory_id)\)/);
    // Vor jedem CREATE steht das DROP, sonst scheitert ein zweiter Lauf.
    for (const p of select) {
      expect(functions).toMatch(new RegExp(String.raw`drop policy if exists "${p.name}" on public\.${p.table};`, 'i'));
    }
  });

  it('keine SELECT-Policy einer Memory-Tabelle liest memories oder memory_participants direkt', () => {
    const recursive = sinceFunctions.flatMap(([file, sql]) =>
      policies(sql, MEMORY_TABLES)
        .filter(p => p.cmd === 'select' || p.cmd === 'all')
        .filter(p => /\bfrom\s+(?:public\.)?(memories|memory_participants|memory_photos)\b/i.test(p.body))
        .map(p => `${file}: ${p.name} on ${p.table}`));
    expect(recursive).toEqual([]);
  });

  it('is_memory_member prüft Ersteller und Teilnehmer für den Aufrufer selbst', () => {
    const body = /function public\.is_memory_member\(p_memory_id uuid\)[\s\S]*?\$\$([\s\S]*?)\$\$;/i.exec(functions)?.[1] ?? '';
    expect(body).toMatch(/from public\.memories m\s+where m\.id = p_memory_id and m\.created_by = \(select auth\.uid\(\)\)/i);
    expect(body).toMatch(/from public\.memory_participants mp\s+where mp\.memory_id = p_memory_id and mp\.user_id = \(select auth\.uid\(\)\)/i);
  });

  it('lädt das PostgREST-Schema neu', () => {
    expect(functions).toMatch(/NOTIFY pgrst, 'reload schema';/);
  });
});

// ─── Code: wer profiles mit dem Nutzer-Client liest, nennt nur erlaubte Spalten ──

/**
 * Dateien, die profiles mit dem Service-Key lesen (BYPASSRLS, alle Spalten).
 * Jede andere Datei läuft als anon oder authenticated und bekäme für eine
 * gesperrte Spalte 42501 statt Daten.
 */
const SERVICE_ROLE_READERS = new Map<string, string>([
  ['src/app/api/admin/users/route.ts', 'Nutzerliste für Admins, Rollenprüfung per requireAdmin'],
  ['src/app/api/admin/users/[id]/route.ts', 'Werbefrei-Schalter, Rollenprüfung per requireAdminWithCaller'],
  ['src/app/api/cron/lifecycle-emails/route.ts', 'Cron mit CRON_SECRET, verschickt Lifecycle-Mails'],
  ['src/scripts/send-welcome-blast.ts', 'Ops-Skript mit Service-Key'],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Spaltennamen einer PostgREST-Auswahl; Einbettungen `alias:tabelle!fk(…)` zählen nicht mit. */
function topLevelColumns(select: string): string[] {
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else if (depth === 0 || ch === '(') current += ch;
  }
  parts.push(current);
  return parts
    .map(p => p.trim())
    .filter(p => p && !p.includes('('))
    .map(p => p.split(':').pop()!.trim().split('::')[0].toLowerCase());
}

const FILTERS = 'eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|not|order|filter|match';

/** Gesperrte Spalten, die eine Datei aus profiles liest, filtert oder sortiert. */
function forbiddenProfileReads(source: string): string[] {
  const hits: string[] = [];
  const check = (columns: string[], where: string) => {
    for (const c of columns) if (!PUBLIC_COLUMNS.includes(c)) hits.push(`${c} (${where})`);
  };

  // 1) Einbettungen: profiles!fk(…) und profiles(…) in jeder Auswahl.
  for (const m of source.matchAll(/\bprofiles(?:!\w+)?\s*\(([^()]*)\)/g)) {
    // `from('profiles')` und Kommentare wie „profiles (Zeile)“ sind keine Einbettung.
    if (/^\s*['"`]/.test(m[1]) || !/^[\w\s,*:]+$/.test(m[1])) continue;
    check(topLevelColumns(m[1]), 'Einbettung');
  }

  // 2) Direkte Abfragen: from('profiles') bis zum Ende der Kette.
  for (const m of source.matchAll(/\.from\(\s*['"`]profiles['"`]\s*\)/g)) {
    const rest = source.slice(m.index! + m[0].length);
    const end = rest.search(/;|\n\s*\n|\.from\(/);
    const chain = end === -1 ? rest.slice(0, 800) : rest.slice(0, end);
    const select = /\.select\(\s*(['"`])([\s\S]*?)\1/.exec(chain);
    if (select) check(topLevelColumns(select[2]).flatMap(c => (c === '*' ? ['*'] : [c])), 'select');
    else if (/\.select\(\s*\)/.test(chain)) check(['*'], 'select');
    for (const f of chain.matchAll(new RegExp(String.raw`\.(?:${FILTERS})\(\s*['"\`](\w+)['"\`]`, 'g'))) check([f[1].toLowerCase()], 'Filter');
    for (const o of chain.matchAll(/\.or\(\s*(['"`])([\s\S]*?)\1/g)) {
      check([...o[2].matchAll(/(?:^|[,(])\s*(\w+)\.(?:not\.)?(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in)\./g)].map(c => c[1].toLowerCase()), 'or');
    }
  }
  return hits;
}

describe('Code liest aus profiles nur erlaubte Spalten', () => {
  it('erkennt gesperrte Spalten in Auswahl, Einbettung, Filter und Suche (Parser-Wächter)', () => {
    expect(forbiddenProfileReads(`supabase.from('profiles').select('*').eq('id', id).single();`)).toEqual(['* (select)']);
    expect(forbiddenProfileReads(`supabase.from('profiles').select('id, first_name, email').in('id', ids);`)).toEqual(['email (select)']);
    expect(forbiddenProfileReads(
      "supabase.from('friendships').select('id, requester:profiles!friendships_requester_id_fkey(id, first_name, email)');",
    )).toEqual(['email (Einbettung)']);
    expect(forbiddenProfileReads(`supabase.from('group_members').select('id, profile:profiles(id, phone)');`)).toEqual(['phone (Einbettung)']);
    expect(forbiddenProfileReads(
      "supabase.from('profiles').select('id').or(`first_name.ilike.%${q}%,email.ilike.%${q}%`).limit(10);",
    )).toEqual(['email (or)']);
    expect(forbiddenProfileReads(`supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', t);`)).toEqual(['created_at (Filter)']);
    expect(forbiddenProfileReads(`supabase.from('profiles').update({ phone }).eq('id', user.id);`)).toEqual([]);
    expect(forbiddenProfileReads(
      "supabase.from('activities').select('id, profile:profiles!activities_user_id_fkey(first_name, last_name, avatar_url)');",
    )).toEqual([]);
    expect(forbiddenProfileReads(`supabase.from('profiles').select('first_name, avatar_url, role').eq('id', userId).maybeSingle();`)).toEqual([]);
  });

  it('keine Datei außerhalb der Service-Key-Liste liest eine gesperrte Spalte', () => {
    const src = join(ROOT, 'src');
    const offenders = sourceFiles(src).flatMap(path => {
      const file = relative(ROOT, path).split(sep).join('/');
      if (SERVICE_ROLE_READERS.has(file)) return [];
      return forbiddenProfileReads(read(path)).map(hit => `${file}: ${hit}`);
    });
    expect(offenders).toEqual([]);
  });

  it('die Service-Key-Liste nennt nur Dateien, die es gibt und die den Service-Key nutzen', () => {
    for (const file of SERVICE_ROLE_READERS.keys()) {
      expect(read(join(ROOT, file)), file).toMatch(/SUPABASE_SERVICE_ROLE_KEY|getServiceClient|createServiceClient/);
    }
  });

  it('das eigene Profil und die Suche laufen über die Funktionen', () => {
    expect(read(join(ROOT, 'src/lib/supabase/auth-context.tsx')).match(/\.rpc\('get_my_profile'\)/g)).toHaveLength(2);
    const friends = read(join(ROOT, 'src/app/[locale]/friends/FriendsPageClient.tsx'));
    expect(friends).toMatch(/\.rpc\('search_profiles', \{ p_query: query, p_limit: 10 \}\)/);
    expect(friends).not.toMatch(/\.email\b/);
  });
});
