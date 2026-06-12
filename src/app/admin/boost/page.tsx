'use client';

import { useState, useEffect, useCallback } from 'react';
import { Rocket, Search, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BoostControl } from '@/components/Admin/BoostControl';
import { setEventBoost } from '@/lib/admin/boost';

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
}

const SELECT =
  'id, title, start_date, location_name, bundesland, category, source_name, is_boosted, boost_until';

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-AT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Rocket className="w-5 h-5 text-violet-300" />
        <h1 className="text-2xl font-semibold text-white/90">Event boosten</h1>
      </div>
      <p className="text-sm text-white/40 mb-6 max-w-2xl">
        Such ein beliebiges Event (auch gescrapte) und hebe es hervor: geboostete
        Events werden auf der Karte nicht geclustert, mit violettem Marker
        dargestellt und ranken im Featured-Carousel vorne.
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
                <EventBoostRow
                  key={e.id}
                  e={e}
                  busy={busyId === e.id}
                  onStart={(days) => applyBoost(e.id, true, days)}
                  onEnd={() => applyBoost(e.id, false)}
                />
              ))}
            </div>
          )}
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
            <EventBoostRow
              key={e.id}
              e={e}
              busy={busyId === e.id}
              onStart={(days) => applyBoost(e.id, true, days)}
              onEnd={() => applyBoost(e.id, false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventBoostRow({
  e,
  busy,
  onStart,
  onEnd,
}: {
  e: EventRow;
  busy: boolean;
  onStart: (days: number) => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate text-white/90">{e.title}</p>
          {e.is_boosted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-violet-500/20 text-violet-300 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {e.boost_until ? `bis ${formatDate(e.boost_until)}` : 'unbegrenzt'}
            </span>
          )}
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
      <BoostControl boosted={e.is_boosted} busy={busy} onStart={onStart} onEnd={onEnd} />
    </div>
  );
}
