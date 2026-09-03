import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/** Shape of event_data JSON stored in analytics_events rows */
interface AnalyticsEventData {
  event_id?: string;
  event_title?: string;
  query?: string;
  results_count?: number;
  filter_type?: string;
  value?: string;
  url?: string;
  type?: string;
  to?: string;
  [key: string]: unknown;
}

/** Row shape returned by the analytics_events select query */
interface AnalyticsRow {
  event_type: string;
  event_data: AnalyticsEventData;
  page: string | null;
  referrer: string | null;
  session_id: string | null;
  user_id: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['god', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    // Calculate date range
    const now = new Date();
    let since: Date;
    switch (period) {
      case 'today':
        since = new Date(now);
        since.setHours(0, 0, 0, 0);
        break;
      case '7d':
        since = new Date(now);
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since = new Date(now);
        since.setDate(since.getDate() - 30);
        break;
      case 'all':
        since = new Date('2020-01-01');
        break;
      default:
        since = new Date(now);
        since.setDate(since.getDate() - 7);
    }

    const sinceISO = since.toISOString();

    // Fetch all analytics events in period.
    // PostgREST deckelt jede Antwort bei PGRST_DB_MAX_ROWS (self-hosted: 1000).
    // Ohne Paging bekamen wir nur die AELTESTEN 1000 Events des Fensters — das
    // Panel blieb dadurch am Fensteranfang stehen ("seit Tagen keine Besucher").
    // Kurze Seiten bedeuten nicht Ende: der Server kuerzt still auf max_rows,
    // deshalb wird erst bei einer leeren Seite abgebrochen.
    const PAGE_SIZE = 10_000;
    const MAX_EVENTS = 200_000; // Sicherheitsnetz gegen Endlosschleifen
    const allEvents: AnalyticsRow[] = [];
    for (let offset = 0; offset < MAX_EVENTS; ) {
      const { data: page, error } = await supabase
        .from('analytics_events')
        .select('event_type, event_data, page, referrer, session_id, user_id, created_at')
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Analytics query error:', error);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }

      const rows = (page || []) as AnalyticsRow[];
      if (rows.length === 0) break;
      for (const row of rows) allEvents.push(row);
      offset += rows.length;
    }

    // ── Event-Typ-Gruppen ────────────────────────────────────────────
    //
    // Dieses Panel wurde gegen ein Namensschema gebaut, das so nie
    // implementiert wurde. Gegen die Prod-Tabelle geprueft (03.09.2026,
    // alle Zeilen seit Bestehen) existierten diese erwarteten Typen mit
    // NULL Zeilen: 'link_click', 'filter_change', 'nachtleben_toggle',
    // 'bundesland_switch', 'event_save'. Real gesendet werden die Namen
    // unten — sie stammen aus data-track-Attributen, die der globale
    // ClickTracker einsammelt, und wurden im Lauf der Zeit ergaenzt, ohne
    // dass diese Auswertung nachgezogen wurde.
    //
    // Die Gruppen stehen bewusst an EINER Stelle: wer ein neues
    // data-track einfuehrt, traegt es hier ein und alle Auswertungen
    // (Funnel, Top-Listen, Domain-Aufstellung) ziehen mit.
    const TICKET_CLICK_TYPES = ['ticket_click', 'ticket_click_mobile', 'wizard_ticket_external'];
    const EVENT_CLICK_TYPES = ['event_click', 'widget_event_click', 'chat_entity_click', 'blog_related_event', 'smart_sample_click'];
    const EVENT_SAVE_TYPES = ['event_save', 'event_saved_mobile'];
    // Alles, was den Nutzer auf eine fremde Domain schickt — die
    // affiliate-relevante Aufstellung.
    const EXTERNAL_CLICK_TYPES = [...TICKET_CLICK_TYPES, 'stay_click', 'tour_click', 'wizard_booking_open'];

    // === Overview stats ===
    const pageViews = allEvents.filter(e => e.event_type === 'page_view');
    const uniqueSessions = new Set(allEvents.map(e => e.session_id).filter(Boolean));
    const searches = allEvents.filter(e => e.event_type === 'search');
    const uniqueUsers = new Set(allEvents.map(e => e.user_id).filter(Boolean));

    // Today stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const pageViewsToday = pageViews.filter(e => e.created_at >= todayISO).length;
    const sessionsToday = new Set(
      allEvents.filter(e => e.created_at >= todayISO).map(e => e.session_id).filter(Boolean)
    ).size;

    // This week stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekISO = weekStart.toISOString();
    const pageViewsWeek = pageViews.filter(e => e.created_at >= weekISO).length;
    const sessionsWeek = new Set(
      allEvents.filter(e => e.created_at >= weekISO).map(e => e.session_id).filter(Boolean)
    ).size;

    // === Page views per day ===
    const viewsByDay: Record<string, number> = {};
    pageViews.forEach(e => {
      const day = e.created_at.slice(0, 10);
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    // Fill in missing days
    const daysList: { date: string; count: number }[] = [];
    const current = new Date(since);
    while (current <= now) {
      const dayStr = current.toISOString().slice(0, 10);
      daysList.push({ date: dayStr, count: viewsByDay[dayStr] || 0 });
      current.setDate(current.getDate() + 1);
    }

    // === Top events (by click) ===
    const eventClicks = allEvents.filter(e => EVENT_CLICK_TYPES.includes(e.event_type));
    const eventSaves = allEvents.filter(e => EVENT_SAVE_TYPES.includes(e.event_type));

    const clickCounts: Record<string, { title: string; clicks: number; saves: number }> = {};
    eventClicks.forEach(e => {
      const id = e.event_data?.event_id || 'unknown';
      const title = e.event_data?.event_title || 'Unbekannt';
      if (!clickCounts[id]) clickCounts[id] = { title, clicks: 0, saves: 0 };
      clickCounts[id].clicks++;
    });
    eventSaves.forEach(e => {
      const id = e.event_data?.event_id || 'unknown';
      // Frueher nur `if (clickCounts[id])` — ein gespeichertes Event ohne
      // vorherigen getrackten Klick fiel damit ganz aus der Liste.
      if (!clickCounts[id]) {
        clickCounts[id] = { title: e.event_data?.event_title || 'Unbekannt', clicks: 0, saves: 0 };
      }
      clickCounts[id].saves++;
    });

    const topEvents = Object.entries(clickCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.clicks + b.saves) - (a.clicks + a.saves))
      .slice(0, 20);

    // === Top searches ===
    const searchCounts: Record<string, { count: number; totalResults: number }> = {};
    searches.forEach(e => {
      const query = (e.event_data?.query || '').toLowerCase().trim();
      if (!query) return;
      if (!searchCounts[query]) searchCounts[query] = { count: 0, totalResults: 0 };
      searchCounts[query].count++;
      searchCounts[query].totalResults += e.event_data?.results_count || 0;
    });

    const topSearches = Object.entries(searchCounts)
      .map(([query, data]) => ({
        query,
        count: data.count,
        avgResults: data.count > 0 ? Math.round(data.totalResults / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // === User behavior ===
    // 'filter_change' wurde NIE gesendet (0 Zeilen seit Bestehen der
    // Tabelle). Der Filter-Tracker feuert 'filter_apply' — der Name hier
    // war schlicht falsch, weshalb die Filter-Statistik dauerhaft leer blieb.
    const filterChanges = allEvents.filter(e => e.event_type === 'filter_apply');
    // Der Tracker sendet als Nutzlast NUR { count_active: n } — kein
    // filter_type, kein value. Die frueher gebaute Aufschluesselung
    // `${filter_type}: ${value}` ergab deshalb ausschliesslich Zeilen
    // "unknown: ". Aggregiert wird jetzt das, was wirklich vorliegt:
    // wie viele Filter die Nutzer gleichzeitig aktiv hatten.
    const filterCounts: Record<string, number> = {};
    filterChanges.forEach(e => {
      const n = Number(e.event_data?.count_active);
      const key = Number.isFinite(n)
        ? `${n} Filter gleichzeitig`
        : 'ohne Angabe';
      filterCounts[key] = (filterCounts[key] || 0) + 1;
    });

    const topFilters = Object.entries(filterCounts)
      .map(([filter, count]) => ({ filter, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // 'nachtleben_toggle' wurde nie gesendet und es gibt im Nicht-Admin-Code
    // auch keinen Sender mehr — das Feature existiert nicht. Bleibt als 0
    // im Response, damit die Panel-Kachel nicht undefined rendert; die
    // Kachel selbst ist im Frontend entfernt.
    const nachtlebenToggles = 0;

    // Session durations (approx: first to last event per session)
    const sessionTimes: Record<string, { first: string; last: string }> = {};
    allEvents.forEach(e => {
      if (!e.session_id) return;
      if (!sessionTimes[e.session_id]) {
        sessionTimes[e.session_id] = { first: e.created_at, last: e.created_at };
      } else {
        if (e.created_at > sessionTimes[e.session_id].last) {
          sessionTimes[e.session_id].last = e.created_at;
        }
      }
    });

    const durations = Object.values(sessionTimes).map(s => {
      return (new Date(s.last).getTime() - new Date(s.first).getTime()) / 1000;
    }).filter(d => d > 0);

    const avgSessionDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Events by hour
    const hourCounts = new Array(24).fill(0);
    allEvents.forEach(e => {
      const hour = new Date(e.created_at).getHours();
      hourCounts[hour]++;
    });

    // === Link clicks ===
    const linkClicks = allEvents.filter(e => EXTERNAL_CLICK_TYPES.includes(e.event_type));
    const domainCounts: Record<string, { count: number; events: Set<string> }> = {};
    linkClicks.forEach(e => {
      // Die realen Tracker liefern nicht immer eine volle URL: der
      // ClickTracker schreibt data-track-provider nach event_data.provider.
      // Ohne diesen Fallback landete alles unter 'unknown'.
      const url = e.event_data?.url || '';
      let domain: string;
      try {
        domain = new URL(url).hostname;
      } catch {
        domain = String(e.event_data?.provider || '') || e.event_type;
      }
      if (!domainCounts[domain]) domainCounts[domain] = { count: 0, events: new Set() };
      domainCounts[domain].count++;
      const eventTitle = e.event_data?.event_title || '';
      if (eventTitle) domainCounts[domain].events.add(eventTitle);
    });

    const topDomains = Object.entries(domainCounts)
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        topEvents: Array.from(data.events).slice(0, 3),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // === Conversion funnel ===
    const funnelPageViews = pageViews.length;
    const funnelClicks = eventClicks.length;
    const funnelSaves = eventSaves.length;
    // Vorher: linkClicks.filter(e => e.event_data?.type === 'ticket') — also
    // ein nie gesendeter Typ, gefiltert auf ein nie gesetztes Feld. Die
    // Funnel-Stufe stand deshalb dauerhaft auf 0, obwohl ticket_click
    // laufend feuert.
    const funnelLinks = allEvents.filter(e => TICKET_CLICK_TYPES.includes(e.event_type)).length;

    // === Bundesland heatmap ===
    //
    // Quelle war 'bundesland_switch' — ein Typ, der nie gesendet wurde, also
    // ein dauerhaft leeres Panel. Ersetzt durch die tatsaechlichen
    // Seitenaufrufe: die getrackte `page`-Spalte enthaelt bei Gemeinde- und
    // Event-URLs die PLZ (/gemeinde/9551-…, /events/5020-stiegl/…), bei
    // Hub-Seiten direkt den Bundesland-Slug (/wien, /steiermark).
    // Erste PLZ-Ziffer -> Bundesland ist in Oesterreich eindeutig, einzige
    // Ausnahme ist 6: 6000-6899 Tirol, 6900-6999 Vorarlberg.
    const BL_BY_PLZ_PREFIX: Record<string, string> = {
      '1': 'wien', '2': 'niederoesterreich', '3': 'niederoesterreich',
      '4': 'oberoesterreich', '5': 'salzburg', '7': 'burgenland',
      '8': 'steiermark', '9': 'kaernten',
    };
    const BL_SLUGS = new Set([
      'wien', 'niederoesterreich', 'oberoesterreich', 'salzburg',
      'steiermark', 'kaernten', 'tirol', 'vorarlberg', 'burgenland',
    ]);
    function bundeslandFromPage(page: string | null): string | null {
      if (!page) return null;
      const seg = page.split('?')[0].split('/').filter(Boolean);
      if (seg.length === 0) return null;
      // /wien, /steiermark … (auch unter /en/ oder /de/)
      const first = seg[0] === 'en' || seg[0] === 'de' ? seg[1] : seg[0];
      if (first && BL_SLUGS.has(first)) return first;
      // /gemeinde/<plz>-<name> und /events/<plz>-<ort>/<datum>/<slug>
      const plzHolder = seg.find(x => /^\d{4}-/.test(x));
      if (!plzHolder) return null;
      const plz = plzHolder.slice(0, 4);
      if (plz[0] === '6') return Number(plz) >= 6900 ? 'vorarlberg' : 'tirol';
      return BL_BY_PLZ_PREFIX[plz[0]] ?? null;
    }
    const blCounts: Record<string, number> = {};
    pageViews.forEach(e => {
      const bl = bundeslandFromPage(e.page);
      if (bl) blCounts[bl] = (blCounts[bl] || 0) + 1;
    });

    // Also count page views with bundesland data from filter changes
    const blViewCounts: Record<string, number> = {};
    filterChanges.forEach(e => {
      if (e.event_data?.filter_type === 'bundesland') {
        const bl = e.event_data?.value || '';
        if (bl) blViewCounts[bl] = (blViewCounts[bl] || 0) + 1;
      }
    });

    // Merge
    const bundeslandStats = new Map<string, number>();
    Object.entries(blCounts).forEach(([bl, c]) => {
      bundeslandStats.set(bl, (bundeslandStats.get(bl) || 0) + c);
    });
    Object.entries(blViewCounts).forEach(([bl, c]) => {
      bundeslandStats.set(bl, (bundeslandStats.get(bl) || 0) + c);
    });

    const bundeslandHeatmap = Array.from(bundeslandStats.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // === Per-user activity (eingeloggte Nutzer) ===
    interface UserAgg {
      total: number;
      pageViews: number;
      searches: number;
      clicks: number;
      saves: number;
      lastActive: string;
    }
    const userAgg: Record<string, UserAgg> = {};
    for (const e of allEvents) {
      if (!e.user_id) continue;
      const u =
        userAgg[e.user_id] ??
        (userAgg[e.user_id] = {
          total: 0, pageViews: 0, searches: 0, clicks: 0, saves: 0, lastActive: e.created_at,
        });
      u.total++;
      if (e.event_type === 'page_view') u.pageViews++;
      else if (e.event_type === 'search') u.searches++;
      else if (e.event_type === 'event_click') u.clicks++;
      else if (e.event_type === 'event_save') u.saves++;
      if (e.created_at > u.lastActive) u.lastActive = e.created_at;
    }
    const userIds = Object.keys(userAgg);

    // Identitäten (Name + E-Mail) via Service-Role — der Caller ist bereits
    // als admin/god verifiziert. E-Mail liegt in auth.users, daher Service-Role.
    const identities: Record<string, { name: string; email: string | null }> = {};
    // Echte Anzahl aktuell gemerkter Events pro Nutzer (Status, all-time) —
    // nicht der lückenhafte/zeitraum-gebundene event_save-Aktions-Log.
    const savedCounts: Record<string, number> = {};
    if (userIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );
      const { data: profs } = await svc
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      for (const p of profs ?? []) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        identities[p.id] = { name: name || 'Unbenannt', email: null };
      }
      const { data: savedRows } = await svc
        .from('saved_events')
        .select('user_id')
        .in('user_id', userIds);
      for (const r of (savedRows ?? []) as { user_id: string }[]) {
        savedCounts[r.user_id] = (savedCounts[r.user_id] ?? 0) + 1;
      }
      // E-Mails aus auth.users nachladen — nur für die aktivsten Nutzer, damit
      // der Endpoint bei vielen Nutzern nicht durch N Einzelabfragen ausbremst.
      const topByActivity = [...userIds]
        .sort((a, b) => userAgg[b].total - userAgg[a].total)
        .slice(0, 50);
      await Promise.all(
        topByActivity.map(async (id) => {
          const { data } = await svc.auth.admin.getUserById(id);
          if (data?.user?.email) {
            identities[id] = {
              name: identities[id]?.name ?? 'Unbenannt',
              email: data.user.email,
            };
          }
        }),
      );
    }

    const users = userIds
      .map((id) => ({
        id,
        name: identities[id]?.name ?? 'Unbenannt',
        email: identities[id]?.email ?? null,
        ...userAgg[id],
        savedTotal: savedCounts[id] ?? 0,
      }))
      .sort((a, b) => b.total - a.total);

    // === Anonyme Besucher (nicht eingeloggt, je session_id) ===
    interface AnonAgg {
      total: number;
      pageViews: number;
      searches: number;
      clicks: number;
      firstSeen: string;
      lastActive: string;
      entryPage: string | null;
      referrer: string | null;
    }
    const anonAgg: Record<string, AnonAgg> = {};
    for (const e of allEvents) {
      if (e.user_id) continue; // nur anonyme Events
      const sid = e.session_id || 'unknown';
      let a = anonAgg[sid];
      if (!a) {
        // allEvents ist aufsteigend sortiert → erste Begegnung = Einstieg.
        a = anonAgg[sid] = {
          total: 0, pageViews: 0, searches: 0, clicks: 0,
          firstSeen: e.created_at, lastActive: e.created_at,
          entryPage: e.page, referrer: e.referrer || null,
        };
      }
      a.total++;
      if (e.event_type === 'page_view') a.pageViews++;
      else if (e.event_type === 'search') a.searches++;
      else if (e.event_type === 'event_click') a.clicks++;
      if (e.created_at > a.lastActive) a.lastActive = e.created_at;
      if (!a.referrer && e.referrer) a.referrer = e.referrer;
    }
    const anonIds = Object.keys(anonAgg);
    const anonTotals = {
      sessions: anonIds.length,
      pageViews: anonIds.reduce((s, id) => s + anonAgg[id].pageViews, 0),
      searches: anonIds.reduce((s, id) => s + anonAgg[id].searches, 0),
      clicks: anonIds.reduce((s, id) => s + anonAgg[id].clicks, 0),
    };
    const anonSessions = anonIds
      .map((id) => ({ id, ...anonAgg[id] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 80);

    return NextResponse.json({
      overview: {
        pageViews: pageViews.length,
        pageViewsToday,
        pageViewsWeek,
        uniqueSessions: uniqueSessions.size,
        sessionsToday,
        sessionsWeek,
        totalSearches: searches.length,
        activeUsers: uniqueUsers.size,
      },
      viewsByDay: daysList,
      topEvents,
      topSearches,
      behavior: {
        topFilters,
        nachtlebenToggles,
        avgSessionDuration,
        hourCounts,
      },
      linkClicks: topDomains,
      funnel: {
        pageViews: funnelPageViews,
        eventClicks: funnelClicks,
        eventSaves: funnelSaves,
        ticketClicks: funnelLinks,
      },
      bundeslandHeatmap,
      users,
      anonSessions,
      anonTotals,
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
