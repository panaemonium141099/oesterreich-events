// Wächter: schreibende SECURITY-DEFINER-Funktionen dürfen weder für anon noch
// für authenticated ausführbar sein (registrieren kann sich jeder).
//
// Befund 2026-10-08 (Abschlussprüfung Dedup): bulk_update_event_publish & Co.
// liefen als supabase_admin (umgeht RLS) und waren für anon ausführbar. Wer den
// öffentlichen Anon-Key aus dem Browser nahm, konnte beliebige Events
// verstecken oder freischalten. Ursache: Supabase vergibt per Default-Privileges
// EXECUTE ausdrücklich an anon und authenticated; ein `REVOKE ... FROM PUBLIC`
// entfernt diese Einzelrechte nicht.
//
// Regel: Jede SECURITY-DEFINER-Funktion, die schreibt und kein Trigger ist,
// braucht nach ihrer letzten Definition ein
// `REVOKE EXECUTE ON FUNCTION <name> ... FROM PUBLIC, anon, authenticated`;
// ein späteres `GRANT ... TO anon|authenticated|PUBLIC` öffnet sie wieder.
// Bewusst für Nutzer aufrufbare Schreib-RPCs stehen mit Begründung in
// ALLOWED_PUBLIC_WRITERS (und in audit_public_write_rpcs()).
// Der Live-Stand prüft zusätzlich der Pipeline-Schritt security_audit.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const ROLES = ['anon', 'authenticated'] as const;

/** Bewusst für Nutzer aufrufbare Schreib-RPCs (prüfen selbst auth.uid()). */
const ALLOWED_PUBLIC_WRITERS = new Map<string, string>([
]);

/** Wie audit_public_write_rpcs(): Schreibbefehl irgendwo im Rumpf (auch in EXECUTE-Strings). */
const WRITES = /\b(update|insert\s+into|delete\s+from|truncate|merge\s+into)\b/;

/** Position über alle Migrationen hinweg (Datei-Reihenfolge, dann Offset). */
type Pos = [fileIndex: number, offset: number];
const after = (a: Pos, b: Pos) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

const NAME = String.raw`(?:"?public"?\.)?"?([a-z0-9_]+)"?`;

interface FnDef { name: string; file: string; pos: Pos; writes: boolean; trigger: boolean; definer: boolean }
interface Acl { name: string; pos: Pos; roles: Set<string>; kind: 'revoke' | 'grant' }

function functionDefs(sql: string, file: string, fileIndex: number): FnDef[] {
  const out: FnDef[] = [];
  const re = new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+${NAME}\s*\(([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\3\$([^;]*);`, 'gi');
  for (const m of sql.matchAll(re)) {
    const head = m[2].toLowerCase();
    const tail = m[5].toLowerCase();
    out.push({
      name: m[1].toLowerCase(),
      file,
      pos: [fileIndex, m.index ?? 0],
      definer: /security\s+definer/.test(head + ' ' + tail),
      trigger: /returns\s+trigger/.test(head),
      writes: WRITES.test(m[4].toLowerCase()),
    });
  }
  return out;
}

/** `ALTER FUNCTION <name>(…) SECURITY DEFINER|INVOKER` ändert eine bestehende Definition. */
function alters(sql: string, fileIndex: number): Array<{ name: string; pos: Pos; definer: boolean }> {
  const re = new RegExp(String.raw`alter\s+function\s+${NAME}\b[^;]*?\bsecurity\s+(definer|invoker)\b[^;]*;`, 'gi');
  return [...sql.matchAll(re)].map(m => ({ name: m[1].toLowerCase(), pos: [fileIndex, m.index ?? 0] as Pos, definer: m[2].toLowerCase() === 'definer' }));
}

/** REVOKE … FROM <rollen> und GRANT … TO <rollen> auf eine Funktion. */
function acls(sql: string, fileIndex: number): Acl[] {
  const out: Acl[] = [];
  const re = new RegExp(String.raw`\b(revoke|grant)\s+(?:execute|all)(?:\s+privileges)?\s+on\s+function\s+${NAME}\b[^;]*?\b(from|to)\b([^;]*);`, 'gi');
  for (const m of sql.matchAll(re)) {
    const list = m[4].toLowerCase();
    const roles = new Set<string>();
    for (const r of [...ROLES, 'public']) if (new RegExp(String.raw`\b${r}\b`).test(list)) roles.add(r);
    out.push({ name: m[2].toLowerCase(), pos: [fileIndex, m.index ?? 0], roles, kind: m[1].toLowerCase() as Acl['kind'] });
  }
  return out;
}

describe('SECURITY DEFINER: keine öffentlichen Schreib-RPCs', () => {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
  const sqlByFile = files.map(f => [f, readFileSync(join(MIGRATIONS, f), 'utf8')] as const);
  // Letzte Definition je Name zählt; eine Neuanlage bringt die Rechte über
  // die Default-Privileges zurück, also muss die Sperre DANACH stehen.
  const defs = new Map<string, FnDef>();
  const rules: Acl[] = [];
  sqlByFile.forEach(([f, s], i) => {
    const events: Array<{ pos: Pos; apply: () => void }> = [
      ...functionDefs(s, f, i).map(d => ({ pos: d.pos, apply: () => { defs.set(d.name, d); } })),
      ...alters(s, i).map(a => ({ pos: a.pos, apply: () => { const d = defs.get(a.name); if (d) d.definer = a.definer; } })),
    ].sort((x, y) => x.pos[1] - y.pos[1]);
    for (const e of events) e.apply();
    rules.push(...acls(s, i));
  });

  /** Ist die Funktion nach ihrer letzten Definition für diese Rolle gesperrt? */
  const lockedFor = (d: FnDef, role: string): boolean => {
    let locked = false;
    const mine = rules.filter(r => r.name === d.name && after(r.pos, d.pos))
      .sort((x, y) => (after(x.pos, y.pos) ? 1 : -1));
    for (const r of mine) {
      if (r.kind === 'revoke' && r.roles.has(role)) locked = true;
      if (r.kind === 'grant' && (r.roles.has(role) || r.roles.has('public'))) locked = false;
    }
    return locked;
  };

  it('erkennt die bekannten Bulk-RPCs überhaupt (Parser-Wächter)', () => {
    expect(defs.get('bulk_update_event_publish')?.writes).toBe(true);
    expect(defs.get('bulk_update_event_publish')?.definer).toBe(true);
  });

  it('ein späteres GRANT öffnet eine gesperrte Funktion wieder (Regel-Wächter)', () => {
    const sql = `CREATE FUNCTION public.x(p jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE events SET a = 1 $$;
REVOKE EXECUTE ON FUNCTION public.x(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.x(jsonb) TO authenticated;`;
    const [d] = functionDefs(sql, 't.sql', 99);
    const local = acls(sql, 99);
    const lockedAfter = (role: string) => local.filter(r => after(r.pos, d.pos))
      .reduce((l, r) => (r.kind === 'revoke' && r.roles.has(role) ? true : r.kind === 'grant' && r.roles.has(role) ? false : l), false);
    expect(lockedAfter('anon')).toBe(true);
    expect(lockedAfter('authenticated')).toBe(false);
  });

  it('jede schreibende SECURITY-DEFINER-Funktion ist nach ihrer letzten Definition für anon und authenticated gesperrt', () => {
    const open = [...defs.values()]
      .filter(d => d.definer && d.writes && !d.trigger && !ALLOWED_PUBLIC_WRITERS.has(d.name))
      .flatMap(d => ROLES.filter(role => !lockedFor(d, role)).map(role => `${d.name} → ${role} (${d.file})`));
    expect(open).toEqual([]);
  });
});
