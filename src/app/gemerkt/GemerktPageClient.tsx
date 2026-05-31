'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { toast } from 'sonner';

interface SavedEvent {
  id: string;
  saved_at: string;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  district: string | null;
  bundesland: string | null;
  image_url: string | null;
  category: string | null;
}

type Tab = 'future' | 'past';

export function GemerktPageClient() {
  const { user } = useAuth();
  const supabase = createClient();

  const [items, setItems] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('future');
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/saved-events');
        if (res.ok) {
          const data = await res.json();
          if (alive) setItems(data.items ?? []);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /** Inline remove with optimistic update. */
  const handleRemove = useCallback(async (eventId: string) => {
    if (!user) return;
    const prev = items;
    setItems((cur) => cur.filter((e) => e.id !== eventId));
    try {
      const { error } = await supabase
        .from('saved_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId);
      if (error) throw error;
      toast.success('Aus „Gemerkt" entfernt');
    } catch (err) {
      console.error('[gemerkt] remove failed', err);
      setItems(prev);
      toast.error('Konnte nicht entfernt werden');
    }
  }, [user, items, supabase]);

  // ── Split + filter ──────────────────────────────────────────────────
  // Use today (00:00 local) as the cutoff so an event happening today
  // still shows under "Kommende", not "Vergangene".
  const todayCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const { futureItems, pastItems } = useMemo(() => {
    const future: SavedEvent[] = [];
    const past: SavedEvent[] = [];
    for (const ev of items) {
      const t = Date.parse(ev.start_date);
      if (Number.isFinite(t) && t >= todayCutoff) future.push(ev);
      else past.push(ev);
    }
    // Future: chronological (next first). Past: reverse-chronological (most recent first).
    future.sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
    past.sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
    return { futureItems: future, pastItems: past };
  }, [items, todayCutoff]);

  const visibleItems = tab === 'future' ? futureItems : pastItems;

  // Available categories for the filter dropdown — only what's actually
  // present in the current tab, so we don't show "Konzert" when there's
  // no Konzert in past saves.
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ev of visibleItems) if (ev.category) set.add(ev.category);
    return Array.from(set).sort();
  }, [visibleItems]);

  // Switching tabs drops the active-category filter — it would silently
  // hide everything if a category exists in one tab but not the other.
  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    setActiveCategories(new Set());
  }, []);

  const filteredItems = useMemo(() => {
    if (activeCategories.size === 0) return visibleItems;
    return visibleItems.filter((ev) => ev.category && activeCategories.has(ev.category));
  }, [visibleItems, activeCategories]);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      {/* Header */}
      <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-14">
        <div className="max-w-[860px] mx-auto px-4 md:px-14">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Gemerkt</p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Deine gemerkten Events
          </h1>
          <p className="mt-3 text-[14px] text-[var(--v4-ink-50)] leading-relaxed">
            {futureItems.length} kommend{futureItems.length === 1 ? '' : 'e'} · {pastItems.length} vergangen{pastItems.length === 1 ? '' : 'e'}
          </p>
        </div>
      </section>

      {/* Controls: tab pill + filter button */}
      <section className="sticky top-[64px] z-10 bg-[var(--v4-surface)]/95 backdrop-blur border-b border-[var(--v4-hairline-1)]">
        <div className="max-w-[860px] mx-auto px-4 md:px-14 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div
            role="tablist"
            aria-label="Zeitraum"
            className="inline-flex rounded-full p-1 border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)]"
          >
            <TabPill
              active={tab === 'future'}
              onClick={() => switchTab('future')}
              count={futureItems.length}
            >
              Kommende
            </TabPill>
            <TabPill
              active={tab === 'past'}
              onClick={() => switchTab('past')}
              count={pastItems.length}
            >
              Vergangene
            </TabPill>
          </div>

          <FilterButton
            available={availableCategories}
            active={activeCategories}
            onChange={setActiveCategories}
            open={filterOpen}
            setOpen={setFilterOpen}
          />
        </div>
      </section>

      {/* List */}
      <div className="max-w-[860px] mx-auto px-4 md:px-14 py-6 md:py-10">
        {loading ? (
          <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade gemerkte Events …</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState tab={tab} hasAnyInTab={visibleItems.length > 0} />
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredItems.map((ev) => (
              <SavedEventRow key={ev.id} ev={ev} onRemove={() => handleRemove(ev.id)} dimmed={tab === 'past'} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Tab pill ────────────────────────────────────────────────────────────

function TabPill({
  active, onClick, count, children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-[var(--v4-ink)] text-[#0a0a0c]'
          : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]'
      }`}
    >
      {children}
      <span className={`ml-1.5 text-[11px] font-medium ${active ? 'opacity-70' : 'opacity-50'}`}>
        {count}
      </span>
    </button>
  );
}

// ── Filter button + dropdown ────────────────────────────────────────────

function FilterButton({
  available, active, onChange, open, setOpen,
}: {
  available: string[];
  active: Set<string>;
  onChange: (next: Set<string>) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  const toggle = (cat: string) => {
    const next = new Set(active);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    onChange(next);
  };

  const disabled = available.length === 0;
  const count = active.size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[13px] font-semibold transition-colors ${
          disabled
            ? 'border-[var(--v4-hairline-1)] text-[var(--v4-ink-50)] cursor-not-allowed'
            : count > 0
            ? 'border-[#c8553d] text-[#c8553d] bg-[rgba(200,85,61,0.08)]'
            : 'border-[var(--v4-hairline-1)] text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        Filter
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#c8553d] text-white text-[10.5px] font-bold">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] max-w-[300px] rounded-xl border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-[var(--v4-hairline-1)] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--v4-ink-50)]">Kategorien</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11.5px] font-semibold text-[#c8553d] hover:underline"
              >
                Zurücksetzen
              </button>
            )}
          </div>
          <ul className="py-1 max-h-[280px] overflow-auto">
            {available.map((cat) => {
              const isActive = active.has(cat);
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => toggle(cat)}
                    role="menuitemcheckbox"
                    aria-checked={isActive}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-[13px] text-[var(--v4-ink)] hover:bg-[var(--v4-ink)]/[0.04] transition-colors"
                  >
                    <span>{cat}</span>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8553d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Event row ───────────────────────────────────────────────────────────

function SavedEventRow({
  ev, onRemove, dimmed,
}: {
  ev: SavedEvent;
  onRemove: () => void;
  dimmed: boolean;
}) {
  const url = buildEventUrlV2({
    id: ev.id,
    start_date: ev.start_date,
    postal_code: ev.postal_code,
    bundesland: ev.bundesland,
    location_name: ev.location_name,
  });

  const venue = ev.location_name?.trim() || ev.district?.trim() || ev.bundesland?.trim() || '';

  return (
    <li
      className={`group flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)] hover:border-[var(--v4-hairline-3)] transition-colors ${
        dimmed ? 'opacity-75' : ''
      }`}
    >
      <Link href={url} className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        <div className="relative shrink-0 w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-lg overflow-hidden bg-[var(--v4-surface)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/img/${ev.id}?w=176&h=176`}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--v4-ink-50)]">
            {ev.category && <span className="text-[#c8553d]">{ev.category}</span>}
            {ev.category && <span aria-hidden>·</span>}
            <span>{formatDateDE(ev.start_date)}</span>
          </div>
          <h3 className="m-0 text-[15px] md:text-[16px] font-bold tracking-[-0.01em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">
            {ev.title}
          </h3>
          {venue && (
            <div className="text-[12.5px] text-[var(--v4-ink-70)] leading-snug line-clamp-1">
              {venue}
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Aus Gemerkt entfernen"
        className="shrink-0 p-2 rounded-full text-[var(--v4-ink-50)] hover:text-[#c8553d] hover:bg-[rgba(200,85,61,0.08)] transition-colors"
        title="Aus Gemerkt entfernen"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
        </svg>
      </button>
    </li>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState({ tab, hasAnyInTab }: { tab: Tab; hasAnyInTab: boolean }) {
  // Two flavours: nothing at all in this tab vs. filter hid everything.
  if (!hasAnyInTab) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-10 text-center">
        <p className="m-0 text-[var(--v4-ink-70)] text-sm leading-relaxed max-w-md mx-auto">
          {tab === 'future'
            ? 'Du hast aktuell keine kommenden Events gemerkt. Stöbere durch /entdecken und tipp bei einem Event auf das Lesezeichen-Symbol.'
            : 'Noch keine vergangenen gemerkten Events — willkommen in der Zukunft.'}
        </p>
        {tab === 'future' && (
          <Link
            href="/entdecken"
            className="press-haptic inline-flex items-center justify-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            Events entdecken →
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center">
      <p className="m-0 text-[var(--v4-ink-70)] text-sm leading-relaxed">
        Keine Events in dieser Kategorie. Setze den Filter zurück oder wähle eine andere.
      </p>
    </div>
  );
}

function formatDateDE(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-AT', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
