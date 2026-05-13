'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { resolveSearchIntent } from '@/lib/search-intent';

interface Gemeinde {
  n: string;   // name
  b: string;   // bundesland display name
  i: string;   // bundesland id
  p: string;   // plz
  lat: number;
  lng: number;
}

/**
 * fn-15.9 — Above-fold pure-RSC refactor.
 *
 * This is the ONLY Client-Island above the fold. Extracted from the
 * previous `HeroSection` (which mixed the static "Entdecke …" hint with
 * an interactive Gemeinde-search box). Splitting them lets the hint +
 * the animate-fade-in-up wrapper render as plain HTML in the prerendered
 * ISR response, while only this ~3 KB-gz JS module hydrates for the
 * search interaction.
 *
 * What's inside:
 *   - The search input + button (interactive: keyboard nav, focus,
 *     suggestions dropdown).
 *   - Lazy-load `/gemeinden.json` (~100 KB) on first keystroke.
 *   - Soft-nav prefetch of `/map?view=list` + `/map` on idle, so the
 *     "Entdecken" click feels instant.
 *   - The curtain-down navigation animation (DOM-only).
 *
 * What's NOT inside:
 *   - The "Konzerte · Nightlife · …" category hint paragraph (now
 *     rendered by the RSC parent — pure static text).
 *   - The h1 title, the stats badge, the tagline — all rendered above
 *     this in the page-level RSC tree.
 *
 * Why a separate file (not just inline-Client inside HeroSection): if
 * `HeroSection.tsx` itself were `'use client'`, every prop from the page
 * RSC into it would need to be serializable, and crucially the whole
 * subtree (including the static hint string) would be sent as JS to the
 * client. The split keeps the JS payload tight around the actual
 * interactive surface.
 */
export function HeroSearch() {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Gemeinde[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { trackEvent('page_view', { path: '/' }); }, []);

  // fn-15.5: removed the previous idle-time `import('@/components/Map/EventMap')`
  // prefetch. That import dragged the entire Mapbox dynamic chunk (~480 KB)
  // into the landing bundle even before the user expressed map intent — the
  // exact regression the bundle-analyzer flagged. The /map route now owns
  // its own Mapbox load on navigation; users either land there via the
  // "Karte zeigen" button or via a Gemeinde pick below. Vercel's prefetch
  // of the /map HTML still warms the cache for the route's static shell
  // (sub-1 KB), so the click-to-first-paint stays snappy without pulling
  // mapbox-gl into `/`.
  //
  // Route prefetches stay — they only fetch the .rsc payload, not the JS
  // chunks.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefetch = () => {
      router.prefetch('/map?view=list');
      router.prefetch('/map');
    };
    const ric =
      (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 800));
    const id = ric(prefetch, { timeout: 3000 });
    return () => {
      const cic =
        (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback ??
        ((h: number) => clearTimeout(h));
      cic(id as number);
    };
  }, [router]);

  // Lazy load gemeinden data on first keystroke
  const loadGemeinden = useCallback(async () => {
    if (gemeinden.length > 0) return;
    try {
      const res = await fetch('/gemeinden.json');
      const data = await res.json();
      setGemeinden(data);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to load gemeinden:', e);
    }
  }, [gemeinden.length]);

  // Filter suggestions
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = search.toLowerCase().trim();
    const matches = gemeinden
      .filter(g =>
        g.n.toLowerCase().includes(query) ||
        g.p.startsWith(query)
      )
      .sort((a, b) => {
        // Exact start match first
        const aStarts = a.n.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.n.toLowerCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.n.localeCompare(b.n);
      })
      .slice(0, 6);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(-1);
  }, [search, gemeinden]);

  const navigateWithCurtain = (url: string) => {
    // Trigger curtain animation on the landing page container
    const landing = document.getElementById('landing-curtain');
    if (landing) {
      landing.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.6s ease';
      landing.style.transform = 'translateY(-100vh)';
      landing.style.opacity = '0';
      setTimeout(() => router.push(url), 500);
    } else {
      router.push(url);
    }
  };

  const handleSelectGemeinde = (g: Gemeinde) => {
    setSearch(g.n);
    setShowSuggestions(false);
    // Picking a Gemeinde is "show me this place" intent — open the map view
    // directly with the fly-to coords, since the user wants the spatial
    // context they just confirmed.
    navigateWithCurtain(
      `/map?bundesland=${g.i}&lat=${g.lat}&lng=${g.lng}&zoom=13&search=${encodeURIComponent(g.n)}`,
    );
  };

  const handleDiscover = () => {
    setShowSuggestions(false);
    const intent = resolveSearchIntent(search, gemeinden);
    let url: string;
    switch (intent.kind) {
      case 'bundesland':
        url = `/map?bundeslands=${intent.bundeslandId}&view=list`;
        break;
      case 'district': {
        const p = new URLSearchParams({
          bundeslands: intent.bundeslandId,
          districts: intent.district,
          view: 'list',
        });
        url = `/map?${p.toString()}`;
        break;
      }
      case 'gemeinde': {
        const p = new URLSearchParams({
          bundesland: intent.bundeslandId,
          lat: String(intent.lat),
          lng: String(intent.lng),
          zoom: '13',
          search: intent.name,
          view: 'list',
        });
        url = `/map?${p.toString()}`;
        break;
      }
      case 'fallback':
      default:
        url = intent.search
          ? `/map?view=list&search=${encodeURIComponent(intent.search)}&sort=relevance`
          : '/map?view=list';
    }
    navigateWithCurtain(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectGemeinde(suggestions[selectedIndex]);
      } else {
        handleDiscover();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    loadGemeinden();
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder="Lass treffen in..."
          autoComplete="off"
          className="w-full bg-white/[0.05] border border-white/[0.15] rounded-xl pl-12 pr-4 py-4 text-white text-lg
                     placeholder-white/30 focus:outline-none focus:border-white/40 focus:bg-white/[0.08]
                     focus:shadow-[0_0_20px_rgba(255,255,255,0.06)] transition-all duration-300"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50"
          >
            {suggestions.map((g, i) => (
              <button
                key={`${g.n}-${g.p}`}
                onClick={() => handleSelectGemeinde(g)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150
                  ${i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/[0.06]'}
                  ${i !== suggestions.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <span className="text-white text-sm font-medium">{g.n}</span>
                  <span className="text-white/30 text-sm ml-2">{g.b}</span>
                </div>
                <span className="text-white/20 text-xs ml-auto">{g.p}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleDiscover}
        className="px-8 py-4 bg-white text-black font-semibold rounded-xl text-lg
                   hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]
                   active:scale-95 transition-all duration-300 cursor-pointer
                   sm:w-auto w-full"
      >
        Entdecken
      </button>
    </div>
  );
}
