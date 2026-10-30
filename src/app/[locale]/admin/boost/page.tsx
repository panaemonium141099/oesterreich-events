'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Megaphone, Rocket, Search, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BoostControl } from '@/components/Admin/BoostControl';
import { setEventBoost, setLandingFeature, type LandingFeatureBooking } from '@/lib/admin/boost';
import { EVENT_TZ, toViennaDate, viennaToday } from '@/lib/utils/event-time';
import { SITE_COUNTRY } from '@/lib/site-country';
import { eventEndDay } from '@/lib/v4/landing-picks';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  category: string | null;
  source_name: string | null;
  is_boosted: boolean;
  boost_until: string | null;
  publish_status: string | null;
  country: string | null;
  end_date: string | null;
}

/** Startseiten-Buchung (landing_features) eines Events. */
interface FeatureInfo {
  kind: 'sponsored' | 'editorial';
  sponsor_name: string | null;
  starts_at: string;
  ends_at: string | null;
}

/**
 * Zustand einer Buchung aus Admin-Sicht. „abgelaufen“ heißt: das Event ist
 * vorbei oder das Fenster zu, die Startseite zeigt den Fallback; „Event
 * nicht mehr sichtbar“: nicht veröffentlicht oder nicht aus dem Land der
 * Seite (Pflicht-Filter der Landing, isPinnable).
 */
type FeatureStatus = 'aktiv' | 'geplant' | 'abgelaufen' | 'Event nicht mehr sichtbar';

function featureStatus(f: FeatureInfo, e: EventRow, now: Date): FeatureStatus {
  if (e.publish_status !== 'published' || (e.country ?? null) !== SITE_COUNTRY) {
    return 'Event nicht mehr sichtbar';
  }
  const end = eventEndDay(e);
  if (!end || end < toViennaDate(now)) return 'abgelaufen';
  if (f.ends_at && new Date(f.ends_at).getTime() <= now.getTime()) return 'abgelaufen';
  if (new Date(f.starts_at).getTime() > now.getTime()) return 'geplant';
  return 'aktiv';
}

/** Laufzeit eines Startseiten-Pins. days=0 => bis das Event vorbei ist. */
const FEATURE_DURATIONS: { days: number; label: string }[] = [
  { days: 7, label: '1 Woche' },
  { days: 14, label: '2 Wochen' },
  { days: 28, label: '4 Wochen' },
  { days: 0, label: 'Bis zum Event' },
];

const SELECT =
  'id, title, start_date, end_date, location_name, bundesland, category, source_name, is_boosted, boost_until, publish_status, country';

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-AT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: EVENT_TZ,
  });
}

export default function BoostAdminPage() {
  const supabase = createClient();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [active, setActive] = useState<EventRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [featuredRows, setFeaturedRows] = useState<EventRow[]>([]);
  const [features, setFeatures] = useState<Map<string, FeatureInfo>>(new Map());

  // ── Startseiten-Buchungen laden: aktive und künftige (Fenster noch offen) ──
  const loadFeatures = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('landing_features')
      .select(`kind, sponsor_name, starts_at, ends_at, event:events!inner(${SELECT})`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order('starts_at', { ascending: true })
      .limit(50);
    type Row = FeatureInfo & { event: EventRow | EventRow[] | null };
    const rows = ((data as unknown as Row[]) || [])
      .map((r) => ({
        info: {
          kind: r.kind === 'sponsored' ? ('sponsored' as const) : ('editorial' as const),
          sponsor_name: r.sponsor_name ?? null,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
        },
        event: Array.isArray(r.event) ? r.event[0] : r.event,
      }))
      .filter((r): r is { info: FeatureInfo; event: EventRow } => !!r.event);
    setFeaturedRows(rows.map((r) => r.event));
    setFeatures(new Map(rows.map((r) => [r.event.id, r.info])));
  }, [supabase]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  // ── Aktive Boosts laden ──────────────────────────────────────────────
  const loadActive = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select(SELECT)
      .eq('is_boosted', true)
      .order('boost_until', { ascending: true, nullsFirst: false })
      .limit(100);
    setActive((data as EventRow[]) || []);
  }, [supabase]);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  // ── Suche ────────────────────────────────────────────────────────────
  // Nutzt die robuste Volltext-RPC search_event_ids (dieselbe Engine wie die
  // App-Hauptsuche: case-insensitiv, mehrwortig, Trigram-tolerant). Eine
  // hand-gestrickte .or()-ILIKE-Suche scheiterte an Leerzeichen im Titel.
  // Es werden nur KOMMENDE Events gezeigt (start_date >= heute) — geboostet
  // wird in die Zukunft, nicht in die Vergangenheit.
  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    setSearching(true);
    setSearched(true);

    const today = new Date().toISOString().slice(0, 10);
    // Sonderzeichen entfernen (mirror der Haupt-Suche in /api/events).
    const q = raw.replace(/[,.*()%_\\]/g, ' ').replace(/\s+/g, ' ').trim();

    let rows: EventRow[] = [];
    const { data: matched, error } = await supabase.rpc('search_event_ids', {
      q,
      max_ids: 150,
      // Kappen erst NACH dem Zukunftsfilter, sonst fressen vergangene
      // Treffer die 150 Plätze.
      from_date: today,
    });

    if (!error && matched) {
      const ids = (matched as { id: string }[]).map((r) => r.id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from('events')
          .select(SELECT)
          .in('id', ids)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(60);
        rows = (data as EventRow[]) || [];
      }
    } else {
      // Fallback (RPC nicht verfügbar): einfache Titel-Suche, robust mit Leerzeichen.
      const { data } = await supabase
        .from('events')
        .select(SELECT)
        .ilike('title', `%${q}%`)
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(60);
      rows = (data as EventRow[]) || [];
    }

    setResults(rows);
    setSearching(false);
  };

  // ── Boost setzen/beenden — beide Listen synchron halten ──────────────
  const applyBoost = async (eventId: string, boosted: boolean, days = 0) => {
    setBusyId(eventId);
    try {
      const { boost_until } = await setEventBoost(eventId, boosted, days);
      const patch = (e: EventRow) =>
        e.id === eventId ? { ...e, is_boosted: boosted, boost_until } : e;
      setResults((prev) => prev.map(patch));
      await loadActive();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Boost fehlgeschlagen');
    } finally {
      setBusyId(null);
    }
  };

  // ── Startseiten-Buchung setzen/entfernen ─────────────────────────────
  // Die API meldet 409 (Tag belegt) und 422 (Event nicht buchbar) mit
  // Klartext; die Meldung wird unverändert angezeigt.
  const applyFeature = async (eventId: string, featured: boolean, booking?: LandingFeatureBooking) => {
    setBusyId(eventId);
    try {
      await setLandingFeature(eventId, featured, booking);
      await loadFeatures();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Startseiten-Buchung fehlgeschlagen');
    } finally {
      setBusyId(null);
    }
  };

  const rowProps = (e: EventRow) => ({
    e,
    busy: busyId === e.id,
    feature: features.get(e.id) ?? null,
    onStart: (days: number) => applyBoost(e.id, true, days),
    onEnd: () => applyBoost(e.id, false),
    onFeature: (booking: LandingFeatureBooking) => applyFeature(e.id, true, booking),
    onUnfeature: () => applyFeature(e.id, false),
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Rocket className="w-5 h-5 text-violet-300" />
        <h1 className="text-2xl font-semibold text-white/90">Event boosten</h1>
      </div>
      <p className="text-sm text-white/40 mb-6 max-w-2xl">
        Such ein beliebiges Event (auch gescrapte) und hebe es hervor: geboostete
        Events werden auf der Karte nicht geclustert, mit violettem Marker
        dargestellt und ranken im Featured-Carousel vorne. „Startseite“ bucht
        ein Event auf die Startseite: als Anzeige wird es Tipp des Tages für
        einen Kalendertag (ein Platz pro Tag, mit Sponsorname und sichtbarem
        „Anzeige“), als Redaktion steht es in der Saison-Karte vor der
        automatischen Rotation.
      </p>

      {/* Suche */}
      <form onSubmit={runSearch} className="flex gap-2 mb-3 max-w-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Event-Titel oder Ort suchen …"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {searching ? 'Suche …' : 'Suchen'}
        </button>
      </form>

      {/* Suchergebnisse */}
      {searched && (
        <div className="mb-10">
          {results.length === 0 && !searching ? (
            <p className="text-sm text-white/30 py-4">Keine Events gefunden.</p>
          ) : (
            <div className="space-y-2">
              {results.map((e) => (
                <EventBoostRow key={e.id} {...rowProps(e)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Startseiten-Pins */}
      <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium mb-3 flex items-center gap-2">
        <Home className="w-3.5 h-3.5 text-amber-300" />
        Auf der Startseite ({featuredRows.length})
      </h2>
      {featuredRows.length === 0 ? (
        <div className="text-center py-8 mb-10 rounded-xl border border-dashed border-white/[0.06]">
          <p className="text-xs text-white/20">
            Keine Buchungen: Tipp des Tages und Saison-Karte laufen über die automatische Auswahl
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-10">
          {featuredRows.map((e) => (
            <EventBoostRow key={e.id} {...rowProps(e)} />
          ))}
        </div>
      )}

      {/* Aktive Boosts */}
      <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium mb-3 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        Aktive Boosts ({active.length})
      </h2>
      {active.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-white/[0.06]">
          <p className="text-xs text-white/20">Aktuell keine geboosteten Events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((e) => (
            <EventBoostRow key={e.id} {...rowProps(e)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventBoostRow({
  e,
  busy,
  feature,
  onStart,
  onEnd,
  onFeature,
  onUnfeature,
}: {
  e: EventRow;
  busy: boolean;
  feature: FeatureInfo | null;
  onStart: (days: number) => void;
  onEnd: () => void;
  onFeature: (booking: LandingFeatureBooking) => void;
  onUnfeature: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate text-white/90">{e.title}</p>
          {e.is_boosted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-violet-500/20 text-violet-300 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {e.boost_until ? `bis ${formatDate(e.boost_until)}` : 'unbegrenzt'}
            </span>
          )}
          {feature && <FeatureBadge feature={feature} event={e} />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-white/30">{formatDate(e.start_date)}</span>
          {e.location_name && (
            <span className="text-xs text-white/20 truncate">{e.location_name}</span>
          )}
          {e.source_name && (
            <span className="text-[10px] text-white/20">· {e.source_name}</span>
          )}
        </div>
      </div>
      <FeatureControl featured={!!feature} busy={busy} onStart={onFeature} onEnd={onUnfeature} />
      <BoostControl boosted={e.is_boosted} busy={busy} onStart={onStart} onEnd={onEnd} />
    </div>
  );
}

const STATUS_CLASS: Record<FeatureStatus, string> = {
  aktiv: 'bg-emerald-500/20 text-emerald-300',
  geplant: 'bg-sky-500/20 text-sky-300',
  abgelaufen: 'bg-white/10 text-white/50',
  'Event nicht mehr sichtbar': 'bg-red-500/20 text-red-300',
};

/** Art, Sponsor, Tag bzw. Fenster und Status einer Buchung. */
function FeatureBadge({ feature, event }: { feature: FeatureInfo; event: EventRow }) {
  const status = featureStatus(feature, event, new Date());
  const sponsored = feature.kind === 'sponsored';
  const when = sponsored
    ? `am ${formatDate(feature.starts_at)}`
    : feature.ends_at
      ? `bis ${formatDate(feature.ends_at)}`
      : 'bis zum Event';
  return (
    <>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
          sponsored ? 'bg-amber-500/20 text-amber-300' : 'bg-teal-500/20 text-teal-300'
        }`}
        title={sponsored ? 'Tipp des Tages (Anzeige)' : 'Saison-Karte (Redaktion)'}
      >
        {sponsored ? <Megaphone className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
        {sponsored ? 'Anzeige' : 'Redaktion'}
        {sponsored && feature.sponsor_name ? ` · ${feature.sponsor_name}` : ''}
        {` · ${when}`}
      </span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[status]}`}>
        {status}
      </span>
    </>
  );
}

const INPUT_CLASS =
  'text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 placeholder-white/25 [color-scheme:dark] focus:outline-none focus:border-white/30 disabled:opacity-50';

/**
 * Startseiten-Buchung pro Event: Art wählen (Anzeige = Tipp des Tages an
 * einem Kalendertag mit Sponsorname; Redaktion = Saison-Karte mit Laufzeit)
 * und buchen, oder Buchung entfernen.
 */
function FeatureControl({
  featured,
  busy,
  onStart,
  onEnd,
}: {
  featured: boolean;
  busy: boolean;
  onStart: (booking: LandingFeatureBooking) => void;
  onEnd: () => void;
}) {
  const [kind, setKind] = useState<'sponsored' | 'editorial'>('editorial');
  const [days, setDays] = useState<number>(0);
  const [sponsorName, setSponsorName] = useState('');
  const [day, setDay] = useState<string>(() => viennaToday());

  if (featured) {
    return (
      <button
        onClick={onEnd}
        disabled={busy}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 transition-colors disabled:opacity-50 shrink-0"
        title="Buchung von der Startseite nehmen"
      >
        <Home className="w-3.5 h-3.5" />
        Entfernen
      </button>
    );
  }

  const sponsored = kind === 'sponsored';
  const canBook = !sponsored || (sponsorName.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day));

  const submit = () => {
    if (sponsored) {
      onStart({ kind: 'sponsored', sponsorName: sponsorName.trim(), day });
    } else {
      onStart({ kind: 'editorial', days });
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <select
        value={kind}
        onChange={(ev) => setKind(ev.target.value as 'sponsored' | 'editorial')}
        disabled={busy}
        className={INPUT_CLASS}
        title="Art der Buchung"
      >
        <option value="editorial" className="bg-gray-900">
          Redaktion (Saison-Karte)
        </option>
        <option value="sponsored" className="bg-gray-900">
          Anzeige (Tipp des Tages)
        </option>
      </select>
      {sponsored ? (
        <>
          <input
            type="text"
            value={sponsorName}
            onChange={(ev) => setSponsorName(ev.target.value)}
            disabled={busy}
            placeholder="Sponsorname"
            maxLength={120}
            className={`${INPUT_CLASS} w-36`}
            title="Steht als Sponsor neben „Anzeige“ auf der Karte"
          />
          <input
            type="date"
            value={day}
            min={viennaToday()}
            onChange={(ev) => setDay(ev.target.value)}
            disabled={busy}
            className={INPUT_CLASS}
            title="Kalendertag (Wien), an dem das Event Tipp des Tages ist"
          />
        </>
      ) : (
        <select
          value={days}
          onChange={(ev) => setDays(Number(ev.target.value))}
          disabled={busy}
          className={INPUT_CLASS}
          title="Wie lange in der Saison-Karte"
        >
          {FEATURE_DURATIONS.map((d) => (
            <option key={d.days} value={d.days} className="bg-gray-900">
              {d.label}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={submit}
        disabled={busy || !canBook}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white/50 hover:bg-amber-500/10 hover:text-amber-300 transition-colors disabled:opacity-50"
        title={sponsored ? 'Als Tipp des Tages buchen' : 'In die Saison-Karte der Startseite pinnen'}
      >
        {sponsored ? <Megaphone className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
        Startseite
      </button>
    </div>
  );
}
