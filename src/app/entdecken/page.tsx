'use client';

/**
 * /entdecken — Natural-language semantic event search.
 *
 * User types free-form German like:
 *   "Ich bin Student und will heute abend billig saufen gehen"
 *   "Romantisches Date-Ideen für morgen"
 *   "Gratis Familienausflug am Wochenende"
 *
 * → POSTs to /api/search/semantic which parses hard filters
 * (date, price) and runs a pgvector cosine match against the
 * embedding index. See docs/TAXONOMY.md §9 for architecture.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { TagChip } from '@/components/UI/TagChip';

interface SearchMatch {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  location_name: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  price_text: string | null;
  price_tier: string | null;
  slug: string | null;
  audience: string[] | null;
  vibe: string[] | null;
  occasion_tags: string[] | null;
  is_student_friendly: boolean | null;
  is_family_friendly: boolean | null;
  _similarity: number;
  // Fields needed by buildEventUrlV2 for canonical V3 URLs. Optional —
  // older API responses may not include them (buildEventUrlV2 falls back
  // gracefully).
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
}

interface SearchResponse {
  query: string;
  parsed: {
    embedded_text: string;
    after_date: string | null;
    before_date: string | null;
    max_price_tier: string | null;
    signals: string[];
  };
  matches: SearchMatch[];
  count: number;
}

const SAMPLE_QUERIES = [
  'Ich bin Student und will heute abend billig saufen gehen',
  'Romantisches Date für morgen',
  'Gratis Familienausflug am Wochenende',
  'Kostenloses Kulturprogramm heute',
  'Techno-Party am Wochenende',
  'Entspannter Afterwork-Drink',
];

export default function EntdeckenPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (q: string) => {
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 24 }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setError(err.error ?? `HTTP ${resp.status}`);
        setLoading(false);
        return;
      }
      const data: SearchResponse = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10 pb-24">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Entdecken</h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-xl">
            Tipp ein was du willst — komplett in Alltagssprache. Die Suche
            versteht Zeit („heute abend"), Preis („billig") und die Absicht
            dahinter („saufen gehen", „romantisch").
          </p>
        </header>

        {/* Search input */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) runSearch(query.trim()); }}
          className="mb-6"
        >
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Was hast du vor?"
              className="w-full px-5 py-4 rounded-xl bg-white/[0.04] border border-white/10 text-white text-base placeholder-white/30 focus:outline-none focus:border-white/25 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '…' : 'Suchen'}
            </button>
          </div>
        </form>

        {/* Sample queries */}
        {!result && !loading && (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-white/30 mb-3">Probier mal:</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((s) => (
                <button
                  key={s}
                  onClick={() => runSearch(s)}
                  className="px-3 py-2 rounded-lg text-xs text-white/60 bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:text-white/90 transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Parsed-intent readback — helps debug what the parser understood */}
        {result && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 space-y-1">
            <div>
              <span className="text-white/30">Embedded:</span>{' '}
              <span className="text-white/70 italic">&ldquo;{result.parsed.embedded_text}&rdquo;</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {result.parsed.after_date && (
                <span><span className="text-white/30">Ab:</span> {new Date(result.parsed.after_date).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' })}</span>
              )}
              {result.parsed.max_price_tier && (
                <span><span className="text-white/30">Max Preis:</span> {result.parsed.max_price_tier}</span>
              )}
              {result.parsed.signals.length > 0 && (
                <span><span className="text-white/30">Signale:</span> {result.parsed.signals.join(', ')}</span>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="text-white/40 text-sm animate-pulse">Suche läuft …</div>
        )}
        {result && !loading && result.count === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="mb-2">Keine Treffer für diese Suche.</p>
            <p className="text-xs text-white/25">
              Anderes Keyword probieren? Oder Zeitraum erweitern?
            </p>
          </div>
        )}
        {result && !loading && result.count > 0 && (
          <>
            <p className="text-xs text-white/40 mb-4">
              {result.count} Treffer — sortiert nach Relevanz
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.matches.map((ev) => (
                <Link
                  key={ev.id}
                  href={buildEventUrlV2(ev)}
                  className="block rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 overflow-hidden transition-colors"
                >
                  {ev.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.image_url}
                      alt=""
                      className="w-full h-32 object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <h3 className="text-sm font-semibold text-white/90 line-clamp-2">
                        {ev.title}
                      </h3>
                      <span className="text-[10px] text-white/25 tabular shrink-0">
                        {(ev._similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mb-2">
                      {formatDate(ev.start_date)}
                      {ev.location_name && ` · ${ev.location_name}`}
                    </p>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ev.category && <TagChip tag={ev.category} eveningMode size="sm" />}
                      {ev.price_tier === 'gratis' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                          Gratis
                        </span>
                      )}
                      {ev.is_student_friendly && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/40 text-cyan-300">
                          🎓
                        </span>
                      )}
                      {ev.is_family_friendly && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-900/40 text-pink-300">
                          👨‍👩‍👧
                        </span>
                      )}
                    </div>

                    {/* Occasion tags (the actual AI-match signals) */}
                    {ev.occasion_tags && ev.occasion_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ev.occasion_tags.slice(0, 3).map((o) => (
                          <span key={o} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-300 border border-violet-800/30">
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
