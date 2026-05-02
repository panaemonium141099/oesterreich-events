'use client';

/**
 * MapTopBar — Variante A · Airbnb-clean header for the /map surface.
 *
 * Replaces the dark Header + 8-chip FilterBar. One row:
 *   [logo] · [search-pill: search · region · date hint] · [filter-button (badge)] · [bell] · [avatar]
 *
 * The search pill is the canonical entry point for autocomplete + Gemeinde
 * lookup (delegated to the parent via `onSearchSubmit` / `onGemeindeSelect`).
 * The filter button opens the FilterDrawer for everything else (Kategorie,
 * Region, Distanz, Enrichment …).
 *
 * Note: this is a deliberate light-mode rebrand of the discovery surface.
 * Other pages keep the existing dark Header. evening-mode is suppressed
 * here on purpose — Variante A is light by design.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { T, countActiveFilters } from './tokens';
import { defaultDateTo } from './datePresets';
import type { EventFilters } from '@/types/events';
import type { Bundesland } from '@/lib/bundeslaender';
import { useAuth } from '@/lib/supabase/auth-context';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { trackEvent } from '@/lib/analytics';

interface Gemeinde {
  n: string;
  b: string;
  i: string;
  p: string;
  lat: number;
  lng: number;
}

interface EventSuggestion {
  id: string;
  title: string;
  category?: string;
  location_name?: string;
}

interface MapTopBarProps {
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  bundesland: Bundesland;
  onOpenFilter: () => void;
  onGemeindeSelect?: (g: { name: string; bundeslandId: string; lat: number; lng: number }) => void;
  /** Slot for the centered ViewToggle (Karte | Liste) — rendered by parent
   *  so we can position it absolutely inside the map area below the bar. */
  rightSlot?: React.ReactNode;
}

export function MapTopBar({
  filters,
  onFiltersChange,
  bundesland,
  onOpenFilter,
  onGemeindeSelect,
}: MapTopBarProps) {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [searchFocused, setSearchFocused] = useState(false);
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>([]);
  const [suggestions, setSuggestions] = useState<Gemeinde[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<EventSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const eventFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isUserTypingRef = useRef(false);

  // Keep searchValue in sync when filters.search changes externally (URL nav, reset)
  useEffect(() => {
    if (!searchFocused) setSearchValue(filters.search || '');
  }, [filters.search, searchFocused]);

  // Lazy-load gemeinden on first focus (saves ~300KB on mobile cold-start)
  const loadGemeinden = useCallback(async () => {
    if (gemeinden.length > 0) return;
    try {
      const res = await fetch('/gemeinden.json');
      const data = await res.json();
      setGemeinden(data);
    } catch {
      /* swallow */
    }
  }, [gemeinden.length]);

  // Debounced suggestion fetcher — gemeinde + event titles
  useEffect(() => {
    const q = searchValue.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setEventSuggestions([]);
      return;
    }

    // Local gemeinde match — instant
    const lower = q.toLowerCase();
    const matches = gemeinden
      .filter((g) => g.n.toLowerCase().includes(lower) || g.p.startsWith(lower))
      .sort((a, b) => {
        const aStarts = a.n.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.n.toLowerCase().startsWith(lower) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.n.localeCompare(b.n);
      })
      .slice(0, 4);
    setSuggestions(matches);

    // Remote event-title match — debounced
    if (eventFetchRef.current) clearTimeout(eventFetchRef.current);
    eventFetchRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/events?search=${encodeURIComponent(q)}&limit=5&sort=score&suggest=true`,
          { signal: ctrl.signal, cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        setEventSuggestions((data.events ?? []).slice(0, 5));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setEventSuggestions([]);
      }
    }, 250);

    return () => {
      if (eventFetchRef.current) clearTimeout(eventFetchRef.current);
    };
  }, [searchValue, gemeinden]);

  const totalSuggestions = suggestions.length + eventSuggestions.length;

  const closeSuggestions = () => {
    isUserTypingRef.current = false;
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleSelectGemeinde = (g: Gemeinde) => {
    closeSuggestions();
    setSearchValue(g.n);
    onFiltersChange({ ...filters, search: g.n });
    onGemeindeSelect?.({ name: g.n, bundeslandId: g.i, lat: g.lat, lng: g.lng });
    trackEvent('search', { query: g.n, kind: 'gemeinde' });
  };

  const handleSelectEvent = (ev: EventSuggestion) => {
    closeSuggestions();
    setSearchValue(ev.title);
    onFiltersChange({ ...filters, search: ev.title });
    trackEvent('search', { query: ev.title, kind: 'event' });
  };

  const handleSubmitSearch = () => {
    closeSuggestions();
    const q = searchValue.trim();
    onFiltersChange({ ...filters, search: q || undefined });
    if (q) trackEvent('search', { query: q, kind: 'free' });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, totalSuggestions - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < eventSuggestions.length) {
        handleSelectEvent(eventSuggestions[selectedIndex]);
      } else if (selectedIndex >= eventSuggestions.length && suggestions[selectedIndex - eventSuggestions.length]) {
        handleSelectGemeinde(suggestions[selectedIndex - eventSuggestions.length]);
      } else {
        handleSubmitSearch();
      }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  };

  // Outside-click closes the dropdown without losing the typed query
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        inputWrapRef.current &&
        !inputWrapRef.current.contains(e.target as Node)
      ) {
        closeSuggestions();
        setSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const dDefault = defaultDateTo();
  const activeCount = countActiveFilters(filters, dDefault);

  // Search-pill placeholder: shows current Bundesland scope as a hint.
  const placeholder =
    bundesland.id === 'all' ? 'Suche · Österreich' : `Suche · ${bundesland.name}`;

  return (
    <header
      style={{
        background: '#fff',
        borderBottom: `1px solid ${T.border}`,
      }}
      className="z-50 sticky top-0"
    >
      <div className="flex items-center gap-3 lg:gap-4 px-4 lg:px-6 py-3">
        {/* Logo — clicks back to /?home with the brand curtain */}
        <Link
          href="/?home"
          aria-label="Zur Startseite"
          style={{ color: T.ink, fontWeight: 700, fontSize: 17, letterSpacing: '-0.025em' }}
          className="press-haptic shrink-0"
        >
          lasstreffen<span style={{ color: T.ink50, fontWeight: 500 }}>.at</span>
        </Link>

        {/* Search pill */}
        <div ref={inputWrapRef} className="flex-1 min-w-0 relative max-w-[760px] mx-auto">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 14px',
              background: '#fff',
              borderRadius: 9999,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadow,
              minWidth: 0,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              ...(searchFocused ? { borderColor: T.ink, boxShadow: T.shadowL } : {}),
            }}
          >
            <SearchIcon size={16} color={T.ink60} />
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              placeholder={placeholder}
              autoComplete="off"
              onFocus={() => {
                setSearchFocused(true);
                loadGemeinden();
                if (searchValue.length >= 2) setShowSuggestions(true);
              }}
              onChange={(e) => {
                isUserTypingRef.current = true;
                setSearchValue(e.target.value);
                setShowSuggestions(e.target.value.trim().length >= 2);
              }}
              onKeyDown={handleKey}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontWeight: 500,
                color: T.ink,
                fontFamily: 'inherit',
                letterSpacing: '-0.005em',
              }}
            />
            {searchValue && (
              <button
                onClick={() => {
                  setSearchValue('');
                  onFiltersChange({ ...filters, search: undefined });
                  inputRef.current?.focus();
                }}
                aria-label="Suche löschen"
                className="press-haptic"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: T.panel,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CloseIcon size={11} color={T.ink70} />
              </button>
            )}
          </div>

          {showSuggestions && totalSuggestions > 0 && typeof document !== 'undefined' && (
            <SuggestionsDropdown
              eventSuggestions={eventSuggestions}
              gemeindeSuggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelectEvent={handleSelectEvent}
              onSelectGemeinde={handleSelectGemeinde}
              onHover={setSelectedIndex}
              anchor={inputWrapRef}
            />
          )}
        </div>

        {/* Filter button with active-count badge */}
        <button
          onClick={onOpenFilter}
          aria-label={`Filter öffnen${activeCount ? ` (${activeCount} aktiv)` : ''}`}
          className="press-haptic shrink-0"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '11px 14px',
            background: '#fff',
            border: `1px solid ${T.border}`,
            borderRadius: 9999,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: T.ink,
            boxShadow: T.shadow,
            fontFamily: 'inherit',
            letterSpacing: '-0.005em',
            minHeight: 44,
          }}
        >
          <SlidersIcon size={14} color={T.ink} />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: T.ink,
                color: '#fff',
                padding: '1px 6px',
                borderRadius: 9999,
                minWidth: 18,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* Bell + Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          {user && <NotificationBell className="w-9 h-9 rounded-full hover:bg-[var(--mv3-panel)]" />}

          {!authLoading && (
            <div className="relative" ref={userMenuRef}>
              {user ? (
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-label="Mein Profil"
                  className="press-haptic"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `1px solid ${T.border}`,
                    background: T.panel,
                    overflow: 'hidden',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: T.ink,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (profile?.first_name?.[0] || user.email?.[0] || '?').toUpperCase()
                  )}
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="press-haptic"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9999,
                    background: T.ink,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  Anmelden
                </Link>
              )}

              {userMenuOpen && user && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    minWidth: 220,
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    boxShadow: T.shadowL,
                    overflow: 'hidden',
                    zIndex: 70,
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {profile?.first_name || user.email?.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: T.ink60 }}>{user.email}</div>
                  </div>
                  {[
                    { href: '/profile', label: 'Mein Profil' },
                    { href: '/saved', label: 'Gespeichert' },
                    { href: '/feed', label: 'Feed' },
                    { href: '/groups', label: 'Meine Gruppen' },
                  ].map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setUserMenuOpen(false)}
                      style={{ display: 'block', padding: '10px 14px', fontSize: 13, color: T.ink }}
                      className="hover:bg-[#f7f7f8]"
                    >
                      {it.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      signOut();
                      setUserMenuOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#c0392b',
                      borderTop: `1px solid ${T.border}`,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Abmelden
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Suggestions dropdown ─────────────────────────────────────────────── */

interface SuggestionsDropdownProps {
  eventSuggestions: EventSuggestion[];
  gemeindeSuggestions: Gemeinde[];
  selectedIndex: number;
  onSelectEvent: (ev: EventSuggestion) => void;
  onSelectGemeinde: (g: Gemeinde) => void;
  onHover: (i: number) => void;
  anchor: React.RefObject<HTMLDivElement | null>;
}

function SuggestionsDropdown({
  eventSuggestions,
  gemeindeSuggestions,
  selectedIndex,
  onSelectEvent,
  onSelectGemeinde,
  onHover,
  anchor,
}: SuggestionsDropdownProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const update = () => {
      if (!anchor.current) return;
      const r = anchor.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 320) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: T.shadowL,
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {eventSuggestions.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 14px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: T.ink50,
              background: T.panel,
            }}
          >
            Events
          </div>
          {eventSuggestions.map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              onMouseEnter={() => onHover(i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: i === selectedIndex ? T.panel : '#fff',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom:
                  i === eventSuggestions.length - 1 && gemeindeSuggestions.length === 0
                    ? 'none'
                    : `1px solid ${T.border}`,
              }}
            >
              <SearchIcon size={14} color={T.ink40} />
              <span style={{ flex: 1, fontSize: 13, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.title}
              </span>
              {ev.category && (
                <span style={{ fontSize: 10, color: T.ink50, fontWeight: 600 }}>{ev.category}</span>
              )}
            </button>
          ))}
        </>
      )}

      {gemeindeSuggestions.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 14px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: T.ink50,
              background: T.panel,
            }}
          >
            Orte
          </div>
          {gemeindeSuggestions.map((g, i) => {
            const flat = eventSuggestions.length + i;
            return (
              <button
                key={`${g.n}-${g.p}`}
                onClick={() => onSelectGemeinde(g)}
                onMouseEnter={() => onHover(flat)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: flat === selectedIndex ? T.panel : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: i === gemeindeSuggestions.length - 1 ? 'none' : `1px solid ${T.border}`,
                }}
              >
                <PinIcon size={14} color={T.ink40} />
                <span style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>{g.n}</span>
                <span style={{ fontSize: 11, color: T.ink50, fontWeight: 500 }}>{g.b}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: T.ink40 }}>{g.p}</span>
              </button>
            );
          })}
        </>
      )}
    </div>,
    document.body,
  );
}

/* ─── Inline icons (Lucide-style stroke; avoid extra dep) ─────────────── */

function SearchIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}
function CloseIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function SlidersIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}
function PinIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
