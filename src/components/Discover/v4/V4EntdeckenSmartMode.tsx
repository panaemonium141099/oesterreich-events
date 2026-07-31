'use client';

/**
 * V4EntdeckenSmartMode — natural-language semantic search mode.
 *
 * Extracted from the original /entdecken/page.tsx (275 LOC) and restyled
 * in v4. The actual /api/search/semantic NLP backend is unchanged — we
 * just wrap it in v4 tokens and switch result cards.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { trackEvent } from '@/lib/analytics';
import { V4ConciergeCard, type ConciergePayload } from './V4ConciergeCard';
import { V4SmartChat } from './V4SmartChat';
import { V4ActivityResultCard } from './V4ActivityResultCard';
import { buildUnderstoodChips } from './smart-chips';
import type { ActivitySearchMatch } from '@/lib/activities/public-types';

/**
 * Category → tinted gradient pair for image-less placeholder cards.
 * Mirrors the palette in EventListView so the look is consistent across
 * the two list surfaces. Falls back to a neutral slate-grey gradient when
 * the category is unknown.
 */
const CAT_GRADIENT: Record<string, [string, string]> = {
  Musik: ['#a855f7', '#7e22ce'],
  'Kultur & Bühne': ['#3b82f6', '#1d4ed8'],
  'Nightlife & Party': ['#ec4899', '#9d174d'],
  'Essen & Trinken': ['#f59e0b', '#b45309'],
  'Märkte & Feste': ['#10b981', '#047857'],
  'Sport & Bewegung': ['#ef4444', '#b91c1c'],
  'Natur & Abenteuer': ['#22c55e', '#15803d'],
  'Wissen & Karriere': ['#0ea5e9', '#0369a1'],
  'Familie & Kinder': ['#f472b6', '#be185d'],
  'Community & Freizeit': ['#8b5cf6', '#5b21b6'],
  'Wellness & Spiritualität': ['#06b6d4', '#0e7490'],
};
function gradientFor(cat?: string | null): [string, string] {
  return (cat && CAT_GRADIENT[cat]) || ['#475569', '#1e293b'];
}

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
    location_district?: string | null;
    location_bundesland?: string | null;
    content_types?: string[];
  };
  matches: SearchMatch[];
  count: number;
  /**
   * fn-18.6: Freizeit-POIs aus `poi_activities`. ADDITIV und optional —
   * `count`/`matches` bleiben event-only. Ältere Backends liefern das
   * Feld nicht; deshalb überall über `activityMatches` (siehe unten)
   * lesen, nie direkt über `result.activityMatches`.
   */
  activityMatches?: ActivitySearchMatch[];
}

const SAMPLE_QUERIES = [
  'Ich bin Student und will heute abend billig saufen gehen',
  'Romantisches Date für morgen',
  'Gratis Familienausflug am Wochenende',
  'Kostenloses Kulturprogramm heute',
  'Techno-Party am Wochenende',
  'Entspannter Afterwork-Drink',
];

interface V4EntdeckenSmartModeProps {
  initialQuery?: string;
}

export function V4EntdeckenSmartMode({ initialQuery = '' }: V4EntdeckenSmartModeProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string) {
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
        setError(`Suche fehlgeschlagen (${resp.status})`);
        setLoading(false);
        return;
      }
      const data: SearchResponse = await resp.json();
      setResult(data);
      // fn-19: bis hier war der GESAMTE Smart-Stack ungetrackt — Wert
      // nicht belegbar. Fire-and-forget, blockiert nie die UI.
      trackEvent('smart_search', {
        query: q,
        event_count: data.count,
        activity_count: data.activityMatches?.length ?? 0,
        intent_source: data.parsed.signals.includes('intent:ai') ? 'ai' : 'fallback',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Re-run on every initialQuery change. The previous `!result && !loading`
    // guard blocked re-search after the first result loaded, so a second
    // submit from the top-nav left the list pinned to the first query.
    if (initialQuery) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // fn-18.6 Consumer-Contract: `count` ist event-only. Eine
  // activity-only-Antwort (matches=[], count=0, activityMatches>0) darf
  // NIE als "keine Treffer" gerendert werden.
  const activityMatches: ActivitySearchMatch[] = result?.activityMatches ?? [];
  const hasResults = (result?.count ?? 0) > 0 || activityMatches.length > 0;

  // "Verstanden:"-Chips — zeigen transparent, welche Signale die Suche
  // aus der Alltagssprache gezogen hat (fn-19 Phase A).
  const understoodChips = useMemo(
    () => buildUnderstoodChips(result?.parsed),
    [result],
  );

  // Concierge-Payload bauen wann immer wir ein Result haben. Memoized per
  // result-Referenz damit V4ConciergeCard nur EIN neuer Call macht wenn
  // tatsächlich ein neues Result reinkommt (nicht bei jedem Render).
  const conciergePayload: ConciergePayload | null = useMemo(() => {
    if (!result) return null;
    return {
      query: result.query,
      parsed: result.parsed,
      count: result.count,
      matches: result.matches.slice(0, 5).map(m => ({
        title: m.title,
        location_name: m.location_name,
        category: m.category,
        start_date: m.start_date,
        bundesland: m.bundesland ?? null,
        price_text: m.price_text,
        _similarity: m._similarity,
      })),
      // Ohne diese Liste würde der Concierge bei activity-only-Antworten
      // "(Keine Treffer in unserer Datenbank.)" zu lesen bekommen und
      // dem User genau das erzählen.
      activityMatches: (result.activityMatches ?? []).slice(0, 5).map(a => ({
        name: a.name,
        town: a.town,
        bundesland: a.bundesland,
        setting: a.setting,
        tags: a.tags,
      })),
    };
  }, [result]);

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      <form
        onSubmit={e => { e.preventDefault(); if (query.trim()) runSearch(query.trim()); }}
        className="mt-2 mb-6"
      >
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Was hast du vor? Tipp ein in Alltagssprache …"
            className="w-full px-5 py-4 pr-28 rounded-2xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
            autoFocus={!initialQuery}
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="press-haptic absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '…' : 'Suchen'}
          </button>
        </div>
        <p className="text-[11px] text-[var(--v4-ink-30)] mt-2 px-1">
          KI-Suche über alle Events &amp; Ausflugsziele Österreichs — jede Empfehlung kommt direkt aus unserer Datenbank.
        </p>
      </form>

      {!result && !loading && (
        <div className="mb-8">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Probier mal:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => runSearch(s)}
                data-track="smart_sample_click"
                data-track-id={s}
                className="press-haptic text-left px-3 py-2 rounded-lg text-[12px] text-[var(--v4-ink-70)] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] hover:text-[var(--v4-ink)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-[rgba(198,112,121,0.10)] border border-[rgba(198,112,121,0.30)] text-[var(--v4-alert)] text-sm">
          {error}
        </div>
      )}

      {loading && <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Suche läuft …</div>}

      {/* "Verstanden:"-Chips — Transparenz, was die Suche aus der
          Alltagssprache gezogen hat (Datum/Preis/Ort/Absicht). */}
      {result && !loading && understoodChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">
            Verstanden:
          </span>
          {understoodChips.map(c => (
            <span
              key={c.key}
              className="px-2.5 py-1 rounded-full text-[11.5px] text-[var(--v4-ink-70)] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]"
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Concierge tip card — rendered above the results (or above the
          empty-state) whenever we have ANY result back. Self-aborts when
          payload changes. */}
      <V4ConciergeCard payload={conciergePayload}/>

      {/* fn-19 Phase B: Follow-up-Chat. Keyed auf die Query — neue Suche
          heißt neue Chat-Session (Server ist stateless). */}
      {result && !loading && (
        <V4SmartChat key={result.query} baseQuery={result.query}/>
      )}

      {result && !loading && !hasResults && (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Treffer für diese Suche.</p>
          <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Anderes Keyword probieren? Oder Zeitraum erweitern?</p>
        </div>
      )}

      {result && !loading && activityMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-[var(--v4-ink)] mb-1">Passende Aktivitäten</h2>
          <p className="text-[12px] text-[var(--v4-ink-50)] mb-4">
            Ausflugsziele und Freizeit-Einrichtungen — ganzjährig, ohne fixen Termin
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activityMatches.map(a => (
              <V4ActivityResultCard key={a.id} activity={a}/>
            ))}
          </div>
        </section>
      )}

      {result && !loading && result.count > 0 && (
        <>
          <p className="text-[12px] text-[var(--v4-ink-50)] mb-4">{result.count} Treffer — sortiert nach Relevanz</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.matches.map(ev => {
              const [g1, g2] = gradientFor(ev.category);
              return (
                <Link
                  key={ev.id}
                  href={buildEventUrlV2(ev)}
                  data-track="smart_result_click"
                  data-track-id={ev.id}
                  data-track-provider="event"
                  className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
                >
                  {/* Always render image area for uniform card height. Falls back
                      to category-tinted gradient when no image_url exists. */}
                  <div
                    className="w-full aspect-[16/9] relative overflow-hidden"
                    style={ev.image_url ? undefined : { background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                  >
                    {ev.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={ev.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy"/>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/90 text-center px-3 leading-tight">
                        {ev.category || 'Event'}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">{formatDate(ev.start_date)}</p>
                    <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">{ev.title}</h3>
                    {ev.location_name && <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">{ev.location_name}</p>}
                    <p className="text-[10.5px] text-[var(--v4-ink-30)] mt-auto">Relevanz {(ev._similarity * 100).toFixed(0)}%</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
