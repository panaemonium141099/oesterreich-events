/**
 * lasstreffen.at ist rein österreichisch: Smart-Suche, Newsletter,
 * Erinnerungen, Lifecycle-Mails und die eingeloggten Oberflächen (Kalender,
 * Memories, Feed, Planer, Künstler-Treffer) dürfen kein Event mit
 * country <> 'AT' zeigen oder verschicken.
 *
 * Die Abfragen laufen gegen eine kleine In-Memory-Tabelle, die eq/in/gte/
 * lte/lt/not/is/ilike/contains und eingebettete `events`-Joins (inner und
 * nicht inner, Filter auf `events.<spalte>`) wirklich auswertet. Die
 * Testdaten bilden die Prod-Befunde nach: DE-Events ohne Bundesland mit
 * höherem event_score, ein DE-Event in Lindau im Umkreis von Bregenz, ein
 * CH-Event mit österreichischem Bezirk, gemerkte und gematchte DE-Events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SITE_COUNTRY } from '@/lib/site-country';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('GEMINI_API_KEY', '');
vi.stubEnv('CRON_SECRET', '');

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  digestEvents: [] as { title: string }[][],
  genericMails: [] as { to: string; subject: string }[],
  artistMails: [] as { to: string; eventTitle: string }[],
}));

// ── In-Memory-PostgREST ─────────────────────────────────────────────

function asTime(v: unknown): number | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function cmp(a: unknown, b: unknown): number {
  const ta = asTime(a);
  const tb = asTime(b);
  if (ta !== null && tb !== null) return ta - tb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function ilikeToRegex(pattern: string): RegExp {
  return new RegExp(
    '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$',
    'i',
  );
}

/** Ein Teil einer or()-Klausel: `spalte.ilike.%x%` oder `spalte.ov.{a,b}`.
 *  Unbekannte Formen gelten als erfüllt (die Tests prüfen das Land). */
function orPartMatches(row: Row, part: string): boolean {
  const m = /^([a-z_]+)\.(ilike|ov)\.(.*)$/.exec(part);
  if (!m) return true;
  const [, col, op, raw] = m;
  if (op === 'ilike') return typeof row[col] === 'string' && ilikeToRegex(raw).test(row[col] as string);
  const wanted = raw.replace(/^\{|\}$/g, '').split(',');
  return Array.isArray(row[col]) && (row[col] as unknown[]).some((v) => wanted.includes(String(v)));
}

function splitOr(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expr) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

type Pred = (r: Row) => boolean;

function makeBuilder(table: string) {
  const preds: { col: string; pred: Pred }[] = [];
  let embed: { inner: boolean } | null = null;
  let limitN: number | null = null;
  let orderCol: string | null = null;
  let orderAsc = true;
  let updatePatch: Row | null = null;

  const add = (col: string, pred: Pred) => {
    preds.push({ col, pred });
    return b;
  };

  const evaluate = (): Row[] => {
    const events = state.tables.events ?? [];
    let rows: Row[] = (state.tables[table] ?? []).map((r) => ({ ...r }));
    if (embed) {
      rows = rows.map((r) => ({ ...r, events: events.find((e) => e.id === r.event_id) ?? null }));
    }
    for (const { col, pred } of preds) {
      if (col.startsWith('events.')) {
        const inner = col.slice('events.'.length);
        rows = rows
          .map((r) => {
            const ev = r.events as Row | null;
            if (ev && pred({ [inner]: ev[inner] })) return r;
            return embed?.inner ? null : { ...r, events: null };
          })
          .filter((r): r is Row => r !== null);
      } else {
        rows = rows.filter(pred);
      }
    }
    if (embed?.inner) rows = rows.filter((r) => r.events != null);
    if (orderCol) {
      const c = orderCol;
      rows = [...rows].sort((x, y) => (orderAsc ? 1 : -1) * cmp(x[c] ?? -Infinity, y[c] ?? -Infinity));
    }
    if (limitN !== null) rows = rows.slice(0, limitN);
    return rows;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: (cols?: string) => {
      const m = /\bevents(!inner)?\s*\(/.exec(cols ?? '');
      if (m) embed = { inner: !!m[1] };
      return b;
    },
    eq: (col: string, val: unknown) => add(col, (r) => r[col.replace(/^events\./, '')] === val),
    neq: (col: string, val: unknown) => add(col, (r) => r[col.replace(/^events\./, '')] !== val),
    in: (col: string, vals: unknown[]) => add(col, (r) => vals.includes(r[col.replace(/^events\./, '')])),
    gte: (col: string, val: unknown) => add(col, (r) => { const v = r[col.replace(/^events\./, '')]; return v != null && cmp(v, val) >= 0; }),
    gt: (col: string, val: unknown) => add(col, (r) => { const v = r[col.replace(/^events\./, '')]; return v != null && cmp(v, val) > 0; }),
    lte: (col: string, val: unknown) => add(col, (r) => { const v = r[col.replace(/^events\./, '')]; return v != null && cmp(v, val) <= 0; }),
    lt: (col: string, val: unknown) => add(col, (r) => { const v = r[col.replace(/^events\./, '')]; return v != null && cmp(v, val) < 0; }),
    not: (col: string, op: string, val: unknown) =>
      add(col, (r) => (op === 'is' && val === null ? r[col.replace(/^events\./, '')] != null : true)),
    is: (col: string, val: unknown) => add(col, (r) => (val === null ? r[col] == null : r[col] === val)),
    ilike: (col: string, pattern: string) =>
      add(col, (r) => typeof r[col] === 'string' && ilikeToRegex(pattern).test(r[col] as string)),
    contains: (col: string, vals: unknown[]) =>
      add(col, (r) => Array.isArray(r[col]) && vals.every((v) => (r[col] as unknown[]).includes(v))),
    or: (expr: string) => add('', (r) => splitOr(expr).some((p) => orPartMatches(r, p))),
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return b;
    },
    limit: (n: number) => {
      limitN = n;
      return b;
    },
    insert: async (row: Row) => {
      state.inserts.push({ table, row });
      return { error: null };
    },
    update: (patch: Row) => {
      updatePatch = patch;
      return b;
    },
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(
        updatePatch ? { data: null, error: null } : { data: evaluate(), error: null },
      ).then(onFulfilled, onRejected),
  };
  return b;
}

const fakeClient = vi.hoisted(() => ({ current: null as unknown }));

function client() {
  return {
    from: (table: string) => makeBuilder(table),
    rpc: async () => ({ data: [], error: null }),
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@test.at` } } }),
      },
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => fakeClient.current),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => fakeClient.current),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: vi.fn() };
  },
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
}));
vi.mock('@/lib/email', () => ({
  sendGenericEmail: vi.fn(async (to: string, subject: string) => {
    state.genericMails.push({ to, subject });
    return { success: true };
  }),
  sendArtistReminderEmail: vi.fn(async (to: string, data: { eventTitle: string }) => {
    state.artistMails.push({ to, eventTitle: data.eventTitle });
    return 'sent';
  }),
  generateUnsubscribeToken: vi.fn(async () => 'tok'),
  verifyUnsubscribeToken: vi.fn(async () => true),
}));
vi.mock('@/lib/event-reminder', () => ({
  reminderToken: vi.fn(async () => 'tok'),
  reminderMailHtml: vi.fn(() => '<html></html>'),
}));
vi.mock('@/emails/city-digest', () => ({
  renderCityDigestEmail: vi.fn((args: { events: { title: string }[] }) => {
    state.digestEvents.push(args.events);
    return '<html></html>';
  }),
}));
// Stabile Referenz wie im echten AuthProvider, sonst läuft der Lade-Effekt
// bei jedem Rendern neu
const authUser = vi.hoisted(() => ({ user: { id: 'u1' } }));
vi.mock('@/lib/supabase/auth-context', () => ({
  useAuth: () => authUser,
}));
vi.mock('@/components/Notifications/NotificationsProvider', () => ({
  useNotifications: () => ({ notifications: [], markOneRead: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}));

// ── Testdaten ───────────────────────────────────────────────────────

const DAY = 86_400_000;

function ev(over: Row): Row {
  return {
    visibility: 'public',
    publish_status: 'published',
    category: 'Musik',
    tags: [],
    image_url: 'https://img.example.at/bild.jpg',
    location_name: 'Halle',
    postal_code: null,
    address: null,
    district: null,
    bundesland: null,
    latitude: 48.2,
    longitude: 16.37,
    slug: null,
    event_score: 50,
    ...over,
  };
}

function inDays(days: number, hourUtc = 18): string {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

beforeEach(() => {
  fakeClient.current = client();
  state.tables = {};
  state.inserts = [];
  state.digestEvents = [];
  state.genericMails = [];
  state.artistMails = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Smart-Suche ─────────────────────────────────────────────────────

describe('Smart-Suche (runSmartSearch)', () => {
  it('Anfrage ohne Ort liefert nur österreichische Events, auch wenn DE/CH höher scoren', async () => {
    state.tables.events = [
      ev({ id: 'at-1', country: 'AT', title: 'Konzert Hans Zimmer Wien', bundesland: 'wien', start_date: inDays(10), event_score: 40 }),
      ev({ id: 'de-1', country: 'DE', title: 'Konzert Hans Zimmer München', start_date: inDays(10), event_score: 99 }),
      ev({ id: 'ch-1', country: 'CH', title: 'Konzert Hans Zimmer Zürich', district: 'graz-umgebung', start_date: inDays(10), event_score: 98 }),
    ];
    const { runSmartSearch } = await import('@/lib/search/smart-search');

    const res = await runSmartSearch('konzert hans zimmer', 20);

    const ids = res.matches.map((m) => (m as { id: string }).id);
    expect(ids).toContain('at-1');
    expect(ids).not.toContain('de-1');
    expect(ids).not.toContain('ch-1');
  });
});

// ── Wochen-Newsletter ───────────────────────────────────────────────

describe('Cron newsletter-weekly', () => {
  it("Region 'oesterreich' verschickt nur österreichische Events", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T06:00:00Z') }); // Freitag
    state.tables.newsletter_subscribers = [
      { email: 'leser@test.at', bundesland: 'oesterreich', confirmed_at: '2026-09-01T00:00:00Z', unsubscribed_at: null },
    ];
    state.tables.events = [
      ev({ id: 'at-a', country: 'AT', title: 'Fest Graz', start_date: '2026-10-10T16:00:00Z', event_score: 30 }),
      ev({ id: 'at-b', country: 'AT', title: 'Konzert Linz', start_date: '2026-10-10T18:00:00Z', event_score: 31 }),
      ev({ id: 'at-c', country: 'AT', title: 'Markt Wien', start_date: '2026-10-11T09:00:00Z', event_score: 32 }),
      ev({ id: 'de-a', country: 'DE', title: 'Show München', start_date: '2026-10-10T19:00:00Z', event_score: 99 }),
      ev({ id: 'ch-a', country: 'CH', title: 'Konzert Basel', start_date: '2026-10-11T19:00:00Z', event_score: 98 }),
    ];
    const { GET } = await import('@/app/api/cron/newsletter-weekly/route');

    const res = await GET(new NextRequest('http://localhost/api/cron/newsletter-weekly'));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(state.digestEvents).toHaveLength(1);
    const titles = state.digestEvents[0].map((e) => e.title);
    expect(titles.sort()).toEqual(['Fest Graz', 'Konzert Linz', 'Markt Wien']);
  });
});

// ── Erinnerungen ────────────────────────────────────────────────────

describe('Cron send-reminders', () => {
  it('erinnert an gemerkte, gematchte und anonym abonnierte Events nur in Österreich', async () => {
    const twoDays = new Date();
    twoDays.setUTCHours(0, 0, 0, 0);
    twoDays.setUTCDate(twoDays.getUTCDate() + 2);
    twoDays.setUTCHours(12);
    const inSeven = new Date(Date.now() + 7 * DAY).toISOString();

    state.tables.events = [
      ev({ id: 'at-7', country: 'AT', title: 'Konzert Wien', start_date: inSeven }),
      ev({ id: 'de-7', country: 'DE', title: 'Konzert München', start_date: inSeven }),
      ev({ id: 'at-2', country: 'AT', title: 'Markt Graz', start_date: twoDays.toISOString() }),
      ev({ id: 'de-2', country: 'DE', title: 'Markt Passau', start_date: twoDays.toISOString() }),
    ];
    state.tables.saved_events = [
      { user_id: 'u1', event_id: 'at-7' },
      { user_id: 'u1', event_id: 'de-7' },
    ];
    state.tables.artist_event_notifications = [
      { user_id: 'u2', event_id: 'at-7', artist_name: 'Hans Zimmer' },
      { user_id: 'u2', event_id: 'de-7', artist_name: 'Hans Zimmer' },
    ];
    const prefs = { channel_email: true, channel_in_app: true, reminder_7d: true, reminder_1d: true, artist_alerts_enabled: true };
    state.tables.notification_preferences = [
      { user_id: 'u1', ...prefs },
      { user_id: 'u2', ...prefs },
    ];
    const anon = {
      confirmed_at: '2026-09-01T00:00:00Z', unsubscribed_at: null,
      reminded_7d_at: null, reminded_2d_at: null, reminded_day_at: null, windows: ['2d', 'day'],
    };
    state.tables.event_email_reminders = [
      { id: 'r-at', email: 'gast@test.at', event_id: 'at-2', ...anon },
      { id: 'r-de', email: 'gast@test.at', event_id: 'de-2', ...anon },
    ];
    const { GET } = await import('@/app/api/cron/send-reminders/route');

    const res = await GET(new NextRequest('http://localhost/api/cron/send-reminders'));
    expect(res.status).toBe(200);

    const notified = state.inserts.filter((i) => i.table === 'notifications').map((i) => i.row.event_id);
    expect(notified.length).toBeGreaterThan(0);
    expect(new Set(notified)).toEqual(new Set(['at-7']));

    expect(state.artistMails.map((m) => m.eventTitle)).toEqual(['Konzert Wien', 'Konzert Wien']);

    expect(state.genericMails.map((m) => m.subject)).toEqual(['In 2 Tagen: Markt Graz']);
  });
});

// ── Lifecycle-Mails ─────────────────────────────────────────────────

describe('pickLifecycleEvents', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg', 'content-length': '1000' },
    })));
  });

  it('ohne Ort (landesweit nach event_score) nur österreichische Events', async () => {
    state.tables.events = [
      ev({ id: 'at-1', country: 'AT', title: 'Fest Graz', location_name: 'Kasematten', start_date: inDays(3), event_score: 40 }),
      ev({ id: 'de-1', country: 'DE', title: 'Show München', location_name: 'Olympiahalle', start_date: inDays(3), event_score: 99 }),
    ];
    const { pickLifecycleEvents } = await import('@/lib/lifecycle/event-picker');

    const picked = await pickLifecycleEvents({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: fakeClient.current as any,
      cohort: 'welcome',
      location: null,
      now: new Date(),
    });

    expect(picked.map((p) => p.title)).toEqual(['Fest Graz']);
  });

  it('mit Ort an der Grenze (Bregenz) kein Lindau-Event aus der bbox', async () => {
    state.tables.events = [
      ev({ id: 'at-b', country: 'AT', title: 'Seefest Bregenz', location_name: 'Seebühne', latitude: 47.505, longitude: 9.749, start_date: inDays(3), event_score: 40 }),
      ev({ id: 'de-l', country: 'DE', title: 'Inselfest Lindau', location_name: 'Inselhalle', latitude: 47.546, longitude: 9.684, start_date: inDays(3), event_score: 99 }),
    ];
    const { pickLifecycleEvents } = await import('@/lib/lifecycle/event-picker');

    const picked = await pickLifecycleEvents({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: fakeClient.current as any,
      cohort: 'welcome',
      location: { lat: 47.503, lng: 9.747, radius_km: 25, display: 'Bregenz', bundesland: 'vorarlberg', source: 'plz' },
      now: new Date(),
    });

    expect(picked.map((p) => p.title)).toEqual(['Seefest Bregenz']);
  });
});

// ── Eingeloggte Oberflächen ─────────────────────────────────────────

describe('Künstler-Treffer (/notifications)', () => {
  it('zeigt gespeicherte Treffer auf DE-Events nicht an, die Zeilen bleiben', async () => {
    state.tables.events = [
      ev({ id: 'at-1', country: 'AT', title: 'Hans Zimmer Wien', start_date: inDays(20) }),
      ev({ id: 'de-1', country: 'DE', title: 'Hans Zimmer München', start_date: inDays(21) }),
    ];
    state.tables.artist_event_notifications = [
      { user_id: 'u1', artist_name: 'Hans Zimmer', event_id: 'at-1', created_at: new Date().toISOString() },
      { user_id: 'u1', artist_name: 'Hans Zimmer', event_id: 'de-1', created_at: new Date().toISOString() },
    ];
    state.tables.followed_artists = [{ user_id: 'u1', artist_name: 'Hans Zimmer', spotify_image_url: null }];
    const { ArtistMatchBundles } = await import('@/components/Notifications/ArtistMatchBundles');

    render(<ArtistMatchBundles />);
    const toggle = await screen.findByRole('button', { name: /Hans Zimmer/ });
    expect(toggle).toHaveTextContent('1 Event');
    fireEvent.click(toggle);

    expect(screen.getByText('Hans Zimmer Wien')).toBeInTheDocument();
    expect(screen.queryByText('Hans Zimmer München')).not.toBeInTheDocument();
    expect(state.tables.artist_event_notifications).toHaveLength(2);
  });
});

describe('Feed', () => {
  it('Trending-Reihe zeigt nur österreichische Events', async () => {
    state.tables.events = [
      ev({ id: 'at-1', country: 'AT', title: 'Wien Fest', start_date: inDays(2) }),
      ev({ id: 'de-1', country: 'DE', title: 'München Fest', start_date: inDays(1) }),
    ];
    // Ohne Standortfreigabe: die Reihe nimmt dann die nächsten Events nach Datum
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fail: (e: Error) => void) => fail(new Error('denied')),
      },
    });
    const { TrendingRow } = await import('@/components/Feed/TrendingRow');

    render(<TrendingRow />);

    expect(await screen.findByText('Wien Fest')).toBeInTheDocument();
    expect(screen.queryByText('München Fest')).not.toBeInTheDocument();
  });

  it('Event verlinken findet nur österreichische Events', async () => {
    state.tables.events = [
      ev({ id: 'at-1', country: 'AT', title: 'Rock im Park Wien', start_date: inDays(5) }),
      ev({ id: 'de-1', country: 'DE', title: 'Rock im Park Nürnberg', start_date: inDays(4) }),
    ];
    const { CreatePost } = await import('@/components/Feed/CreatePost');

    render(<CreatePost userId="u1" userAvatar={null} userInitial="U" onPostCreated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Event verlinken' }));
    fireEvent.change(screen.getByPlaceholderText('Event suchen...'), { target: { value: 'Rock im Park' } });

    await waitFor(() => expect(screen.getByText('Rock im Park Wien')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.queryByText('Rock im Park Nürnberg')).not.toBeInTheDocument();
  });
});

// ── Quelltext-Wächter für die übrigen Event-Abfragen ────────────────
//
// Kalender, Memories und Planer bauen ihre Abfragen tief in Seiten- und
// Wizard-Zustand (Filter-Auswahl, Dialog-Schritte). Statt sie dafür
// durchzuklicken, prüft der Wächter jede Abfrage im Quelltext: jede Kette
// ab `.from('events')` trägt den Länderfilter, jede Kette über eine
// Tabelle mit eingebettetem `events` trägt ihn auf `events.country`.

const ROOT = process.cwd();

function chains(src: string, table: string): string[] {
  const out: string[] = [];
  const needle = `.from('${table}')`;
  let i = src.indexOf(needle);
  while (i !== -1) {
    const end = src.indexOf(';', i);
    out.push(src.slice(i, end === -1 ? undefined : end));
    i = src.indexOf(needle, i + needle.length);
  }
  return out;
}

const EMBED_TABLES = ['saved_events', 'artist_event_notifications', 'event_email_reminders'];

/** Ketten über `table`, die `events` einbetten. */
function embedded(src: string, table: string): string[] {
  return chains(src, table).filter((c) => /\bevents(!inner)?\s*\(/.test(c));
}

describe.each([
  'src/app/[locale]/calendar/CalendarPageClient.tsx',
  'src/app/[locale]/memories/MemoriesPageClient.tsx',
  'src/components/Planer/CreatePlanFlow.tsx',
  'src/components/Feed/CreatePost.tsx',
  'src/components/Feed/TrendingRow.tsx',
  'src/components/Notifications/ArtistMatchBundles.tsx',
  'src/app/api/cron/send-reminders/route.ts',
  'src/app/api/cron/newsletter-weekly/route.ts',
  'src/lib/lifecycle/event-picker.ts',
  'src/lib/search/smart-search.ts',
])('%s', (file) => {
  const src = readFileSync(path.join(ROOT, file), 'utf8');

  it('importiert SITE_COUNTRY statt das Land hart zu kodieren', () => {
    expect(src).toMatch(/import \{ SITE_COUNTRY \} from '@\/lib\/site-country';/);
    expect(src).not.toMatch(/['"]AT['"]/);
  });

  it("filtert jede Abfrage auf events mit .eq('country', SITE_COUNTRY)", () => {
    for (const chain of chains(src, 'events')) {
      expect(chain).toContain(".eq('country', SITE_COUNTRY)");
    }
  });

  it("filtert jede eingebettete events-Abfrage mit .eq('events.country', SITE_COUNTRY)", () => {
    for (const table of EMBED_TABLES) {
      for (const chain of embedded(src, table)) {
        expect(chain).toContain(".eq('events.country', SITE_COUNTRY)");
      }
    }
  });

  it('prüft wirklich Abfragen (sonst wäre der Wächter leer)', () => {
    const n = chains(src, 'events').length
      + EMBED_TABLES.reduce((sum, t) => sum + embedded(src, t).length, 0);
    expect(n).toBeGreaterThan(0);
  });
});
