/**
 * Künstler folgen und Erkennung je Land (fn-31.17).
 *
 * lasstreffen.de zeigt dieselben Künstler wie lasstreffen.at, gemeldet wird
 * aber nur, was im Land der Seite stattfindet, auf der gefolgt wurde: ein
 * Follow von .de meldet Termine in Deutschland, einer von .at Termine in
 * Österreich. Geprüft an beiden Implementierungen der Erkennung
 * (`src/lib/artist-matching.ts` und die Edge Function `match-artists`), an
 * der Migration und an jeder Stelle, die Follows liest oder schreibt.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  alertSite,
  collectMatchesByCountry,
  groupFollowsByCountry,
  matchDescriptionNames,
  matchExactNames,
  matchFuzzyNames,
  matchLineupArtists,
  type FollowedArtist,
  type MatchingStats,
} from '@/lib/artist-matching';
import { SITE_COUNTRY } from '@/lib/site-country';
import { SITES } from '@/lib/site/sites';

const follow = (id: string, user: string, name: string, country?: string | null): FollowedArtist => ({
  id, user_id: user, artist_name: name, artist_name_normalized: name.toLowerCase(), country,
});

const emptyStats = (): MatchingStats => ({
  events_processed: 0, matches_found: 0, notifications_created: 0,
  artists_checked: 0, skipped_short_names: 0, lineupMatches: 0,
});

/** Events je Land: die RPCs liefern nur, was im angefragten Land liegt. */
const EVENTS: Record<string, { event_id: string; event_title: string }> = {
  AT: { event_id: 'ev-wien', event_title: 'Bilderbuch live in Wien' },
  DE: { event_id: 'ev-berlin', event_title: 'Bilderbuch live in Berlin' },
};

function fakeDb() {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const ev = EVENTS[String(args.p_country)];
    if (fn === 'match_fuzzy_artist_titles' && ev) {
      return { data: [{ ...ev, artist_name: 'bilderbuch', similarity: 1 }], error: null };
    }
    return { data: [], error: null };
  });
  return { db: { rpc } as never, calls };
}

describe('Follows nach Land', () => {
  it('Zeilen ohne Land gelten als Österreich, Österreich steht zuerst', () => {
    const groups = groupFollowsByCountry([
      follow('1', 'u1', 'Wanda', 'DE'),
      follow('2', 'u2', 'Wanda'),
      follow('3', 'u3', 'Falco', null),
      follow('4', 'u4', 'Falco', 'AT'),
    ]);
    expect([...groups.keys()]).toEqual(['AT', 'DE']);
    expect(groups.get('AT')!.map(f => f.id)).toEqual(['2', '3', '4']);
    expect(groups.get('DE')!.map(f => f.id)).toEqual(['1']);
  });
});

describe('Erkennung je Land (Pipeline)', () => {
  it('ein DE-Follow trifft nur den Termin in Deutschland, ein AT-Follow nur den in Österreich', async () => {
    const { db, calls } = fakeDb();
    const matches = await collectMatchesByCountry(db, [
      follow('1', 'nutzer-at', 'Bilderbuch', 'AT'),
      follow('2', 'nutzer-de', 'Bilderbuch', 'DE'),
    ], '1970-01-01T00:00:00Z', emptyStats());

    expect(matches.map(m => [m.user_id, m.event_id]).sort()).toEqual([
      ['nutzer-at', 'ev-wien'],
      ['nutzer-de', 'ev-berlin'],
    ]);
    // Jeder RPC-Aufruf nennt ein Land, und nur die beiden der Follows.
    expect(calls.length).toBeGreaterThan(0);
    expect([...new Set(calls.map(c => c.args.p_country))].sort()).toEqual(['AT', 'DE']);
  });

  it('wer nur auf lasstreffen.at folgt, bekommt nichts aus Deutschland (und umgekehrt)', async () => {
    const at = fakeDb();
    const nurAt = await collectMatchesByCountry(at.db, [follow('1', 'u', 'Bilderbuch', 'AT')], '1970-01-01T00:00:00Z', emptyStats());
    expect(nurAt.map(m => m.event_id)).toEqual(['ev-wien']);
    expect(at.calls.every(c => c.args.p_country === 'AT')).toBe(true);

    const de = fakeDb();
    const nurDe = await collectMatchesByCountry(de.db, [follow('1', 'u', 'Bilderbuch', 'DE')], '1970-01-01T00:00:00Z', emptyStats());
    expect(nurDe.map(m => m.event_id)).toEqual(['ev-berlin']);
    expect(de.calls.every(c => c.args.p_country === 'DE')).toBe(true);
  });

  it('derselbe Nutzer mit Follow auf beiden Seiten bekommt beide Termine, je einmal', async () => {
    const { db } = fakeDb();
    const matches = await collectMatchesByCountry(db, [
      follow('1', 'u', 'Bilderbuch', 'AT'),
      follow('2', 'u', 'Bilderbuch', 'DE'),
    ], '1970-01-01T00:00:00Z', emptyStats());
    expect(matches.map(m => m.event_id).sort()).toEqual(['ev-berlin', 'ev-wien']);
  });

  it('der Bestand ohne Land sucht wie bisher in Österreich', async () => {
    const { db, calls } = fakeDb();
    const matches = await collectMatchesByCountry(db, [follow('1', 'u', 'Bilderbuch')], '1970-01-01T00:00:00Z', emptyStats());
    expect(matches.map(m => m.event_id)).toEqual(['ev-wien']);
    expect(calls.every(c => c.args.p_country === 'AT')).toBe(true);
  });
});

describe('RPC-Aufrufer nennen das Land', () => {
  const since = '1970-01-01T00:00:00Z';

  it('mit Angabe: dieses Land; ohne Angabe: das Land der Seite', async () => {
    for (const country of ['DE', undefined] as const) {
      const { db, calls } = fakeDb();
      await matchExactNames(db, ['rin'], since, country);
      await matchFuzzyNames(db, ['bilderbuch'], since, country);
      await matchDescriptionNames(db, ['bilderbuch'], since, new Set(), country);
      await matchLineupArtists(db, [follow('1', 'u', 'Bilderbuch')], since, country);
      expect(calls.map(c => c.fn)).toEqual([
        'match_exact_artist_title', 'match_fuzzy_artist_titles', 'match_artist_descriptions', 'match_lineup_artists',
      ]);
      expect(calls.map(c => c.args.p_country)).toEqual(Array(4).fill(country ?? SITE_COUNTRY));
    }
  });
});

describe('Mail zu einem Treffer', () => {
  it('ein Termin in Deutschland verlinkt auf lasstreffen.de, Österreich bleibt wie bisher', () => {
    const appUrl = 'https://beispiel.at';
    expect(alertSite('DE', appUrl)).toEqual({ url: SITES.DE.url, countryName: 'Deutschland' });
    expect(alertSite('AT', appUrl)).toEqual({ url: appUrl, countryName: 'Österreich' });
    expect(alertSite(null, appUrl)).toEqual({ url: appUrl, countryName: 'Österreich' });
    expect(alertSite('CH', appUrl)).toEqual({ url: appUrl, countryName: 'Österreich' });
  });
});

// ── Edge Function (zweite Implementierung, läuft stündlich per pg_cron) ──

describe('Edge Function match-artists', () => {
  const src = readFileSync('supabase/functions/match-artists/index.ts', 'utf8');

  it('liest das Land der Follows und sucht je Land', () => {
    expect(src).toContain('.select("id, user_id, artist_name, artist_name_normalized, country")');
    expect(src).toMatch(/for \(const \[country, follows\] of groupFollowsByCountry\(allArtists\)\)/);
    expect(src).toContain('const country = f.country || "AT";');
  });

  it('jeder Matching-RPC bekommt das Land', () => {
    const rpcCalls = [...src.matchAll(/supabase\.rpc\("(match_[a-z_]+)", \{([\s\S]*?)\}\)/g)];
    expect(rpcCalls.map(c => c[1]).sort()).toEqual([
      'match_artist_descriptions', 'match_exact_artist_title', 'match_exact_artist_titles_batch',
      'match_exact_artist_titles_music_only', 'match_fuzzy_artist_titles',
    ]);
    for (const c of rpcCalls) expect([c[1], c[2].includes('p_country: country')]).toEqual([c[1], true]);
  });
});

// ── Migration ───────────────────────────────────────────────────────────

describe('Migration Künstler je Land', () => {
  const sql = readFileSync('supabase/migrations/20261115120000_kuenstler_je_land.sql', 'utf8');
  const FUNCTIONS = [
    'match_exact_artist_title', 'match_exact_artist_titles_batch', 'match_exact_artist_titles_music_only',
    'match_fuzzy_artist_titles', 'match_artist_descriptions', 'match_lineup_artists', 'get_artist_appearances',
  ];

  it('Follows tragen ein Land, Bestand Österreich, eindeutig je Nutzer, Künstler und Land', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'AT'/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_followed_user_artist_country\s+ON public\.followed_artists \(user_id, artist_name_normalized, country\)/);
  });

  it('alle sieben Funktionen filtern auf p_country, Vorgabe Österreich, kein festes Land mehr', () => {
    for (const fn of FUNCTIONS) {
      const def = sql.match(new RegExp(`CREATE FUNCTION public\\.${fn}\\(([^)]*)\\)[\\s\\S]*?\\$function\\$;`));
      expect([fn, !!def]).toEqual([fn, true]);
      expect([fn, def![1].endsWith("p_country text DEFAULT 'AT'")]).toEqual([fn, true]);
      expect([fn, /country = p_country/.test(def![0])]).toEqual([fn, true]);
      // Fest steht 'AT' nur noch als Vorgabe und bei Festivals ohne eigenes Event.
      const fixed = def![0].replace("DEFAULT 'AT'", '').replaceAll("p_country = 'AT'", '');
      expect([fn, fixed.includes("'AT'")]).toEqual([fn, false]);
    }
  });

  it('Auftritte außerhalb Österreichs nur mit Follow des Landes', () => {
    // Aus der Zeit vor 20261008100000 liegen Treffer in DE und CH zu Follows
    // von lasstreffen.at vor; lasstreffen.de darf sie nicht zeigen.
    expect(sql).toContain("and (p_country = 'AT' or fo.id is not null)");
  });

  it('die alte Fassung ohne Land wird entfernt (sonst wäre ein Aufruf ohne Land mehrdeutig)', () => {
    for (const fn of FUNCTIONS) expect([fn, new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(`).test(sql)]).toEqual([fn, true]);
  });

  it('Rechte ausdrücklich: nie anon, authenticated nur für die vier der Follow-Route', () => {
    const grants = [...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.([a-z_]+)\([^)]*\) TO ([^;]+);/g)];
    expect(grants.map(g => g[1]).sort()).toEqual([...FUNCTIONS].sort());
    const withAuthenticated = grants.filter(g => g[2].includes('authenticated')).map(g => g[1]).sort();
    expect(withAuthenticated).toEqual([
      'match_artist_descriptions', 'match_exact_artist_title', 'match_fuzzy_artist_titles', 'match_lineup_artists',
    ]);
    for (const g of grants) {
      expect([g[1], /\banon\b|PUBLIC/.test(g[2])]).toEqual([g[1], false]);
      expect([g[1], g[2].includes('service_role')]).toEqual([g[1], true]);
    }
    expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
  });
});

// ── Wächter: jede Stelle, die Follows liest oder schreibt, kennt das Land ──

describe('Wächter followed_artists', () => {
  /** Die Erkennung liest alle Follows und teilt sie selbst nach Land. */
  const READS_ALL = new Set(['src/lib/artist-matching.ts']);

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
      } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p.replace(/\\/g, '/'));
    }
    return out;
  }

  it('jede Abfrage auf followed_artists filtert oder setzt das Land', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of walk('src')) {
      if (file === 'src/types/database.ts') continue;
      const src = readFileSync(file, 'utf8');
      const re = /\.from\(['"]followed_artists['"]\)/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        seen++;
        // Die Anweisung reicht bis zum nächsten Semikolon (bei einem Upsert
        // mit Objektliteral dahinter bis zum onConflict).
        const statement = src.slice(m.index, m.index + 900);
        const end = statement.search(/;\s*\n/);
        const stmt = end > 0 ? statement.slice(0, end) : statement;
        const ok = READS_ALL.has(file)
          ? stmt.includes('country')
          : /\.eq\('country', SITE_COUNTRY\)|country: SITE_COUNTRY/.test(stmt);
        if (!ok) offenders.push(`${file}: ${stmt.split('\n').slice(0, 3).join(' ').trim()}`);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(7);
    expect(offenders).toEqual([]);
  });

  it('Schreiben trifft die Eindeutigkeit mit Land', () => {
    for (const file of ['src/app/api/artists/follow/route.ts', 'src/app/auth/spotify/callback/route.ts']) {
      const src = readFileSync(file, 'utf8');
      expect([file, src.includes("onConflict: 'user_id,artist_name_normalized,country'")]).toEqual([file, true]);
      expect([file, src.includes("onConflict: 'user_id,artist_name_normalized'")]).toEqual([file, false]);
    }
  });
});
