'use client';

/**
 * V4SmartPlanner — der Smart-Tab von /entdecken als Freitext-Suche mit
 * visueller Antwort (Variante A, 2026-10-23; Mockups in
 * docs/design/smart-planer, Befund in docs/design/smart-suche-analyse-
 * 2026-10-23.md).
 *
 * Ablauf: EIN großes Textfeld („Sag einfach, was du vorhast") → POST
 * /api/search/semantic (Intent → Taxonomie → indexierte Queries, ~1 bis
 * 2 s) → Verstanden-Chips, ein ehrlicher Concierge-Satz, Poster-Regale
 * (pro Tag oder pro Tagesphase, Ausflugsziele eigenes Regal) → mit + in
 * die Plan-Leiste (Desktop rechts, Handy als Bottom-Bar) → als Plan
 * speichern.
 *
 * Der frühere Concierge-Chat (V4SmartChat) wartete 10 bis 17 s auf Prosa
 * und zeigte die Treffer als 56-px-Zeilen; in 30 Tagen gab es 35 Suchen
 * und einen Klick auf ein Ergebnis. Der Chat-Endpunkt bleibt als API
 * bestehen, die Oberfläche nutzt ihn nicht mehr.
 *
 * `google-anno-skip`: AdSense-Auto-Anzeigen setzten Intent-Links in den
 * Erklärtext und legten am Handy einen Anchor über das Eingabefeld.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { consumeSmartAutorun } from '@/lib/search/smart-autorun';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatTime } from '@/lib/utils/date';
import { priceBadge } from '@/lib/v4/price-badge';
import { EVENT_TZ } from '@/lib/utils/event-time';
import { districtDisplayName } from '@/lib/districtsAT';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import type { ActivitySearchMatch } from '@/lib/activities/public-types';
import type { Event } from '@/types/events';
import { gradientFor } from './category-gradient';
import { buildUnderstoodChips, type ParsedSummary } from './smart-chips';
import { planSmartShelves } from './smart-shelves';
import { buildConciergeLine, buildRefineChips } from './smart-summary';

/* ─── Typen der API-Antwort ─────────────────────────────────────────── */

export interface SmartEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  district: string | null;
  bundesland: string | null;
  category: string | null;
  image_url: string | null;
  price_text: string | null;
  price_tier: Event['price_tier'];
  slug: string | null;
  duration_type?: string | null;
  series_count?: number;
  series_dates?: string[];
}

interface SmartResponse {
  query: string;
  parsed: ParsedSummary & { unmatched_terms?: string[] };
  matches: SmartEvent[];
  count: number;
  activityMatches: ActivitySearchMatch[];
}

type Selected =
  | { kind: 'event'; ev: SmartEvent }
  | { kind: 'activity'; act: ActivitySearchMatch };

type PlanSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; planId: string }
  | { status: 'auth' }
  | { status: 'error' };

type Status = 'idle' | 'loading' | 'done' | 'error';

const EXAMPLES = [
  'Bin Student und will heute abend billig saufen gehen',
  'Plan mir ein Date für Samstag in Graz',
  'Was tun bei Regen mit zwei Kindern in Linz?',
  'Wandern und danach gut essen, Tirol, Sonntag',
];

const RESULT_LIMIT = 40;

/* ─── Helfer ────────────────────────────────────────────────────────── */

function shortDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ }).replace(/\.$/, '');
}

function activityImage(a: ActivitySearchMatch): string | null {
  const images = a.images;
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    const u = img?.urls?.[0];
    if (typeof u === 'string' && u.length > 0) return u;
  }
  return null;
}

function selKey(s: Selected): string {
  return s.kind === 'event' ? `event:${s.ev.id}` : `activity:${s.act.slug}`;
}

/* ─── Karten ───────────────────────────────────────────────────────── */

function AddToggle({ selected, title, onClick }: { selected: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={selected ? `${title} aus dem Plan entfernen` : `${title} zum Plan hinzufügen`}
      title={selected ? 'Aus dem Plan entfernen' : 'Zum Plan hinzufügen'}
      className={`press-haptic absolute right-2 top-2 z-[2] w-[30px] h-[30px] rounded-full grid place-items-center border text-[17px] font-bold leading-none backdrop-blur transition-colors ${
        selected
          ? 'bg-[var(--v4-match)] border-[var(--v4-match)] text-[#0a0a0c]'
          : 'bg-[rgba(10,10,12,0.72)] border-[var(--v4-hairline-4)] text-white hover:bg-[rgba(10,10,12,0.9)]'
      }`}
    >
      {selected ? '✓' : '+'}
    </button>
  );
}

function EventCard({ ev, selected, onToggle }: { ev: SmartEvent; selected: boolean; onToggle: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const title = decodeEntities(ev.title ?? '');
  const time = formatTime(ev.start_date);
  const price = priceBadge({ price_text: ev.price_text, price_min: null, price_max: null, price_tier: ev.price_tier }, { free: 'Gratis', from: p => `ab ${p} €` });
  const region = ev.district ? districtDisplayName(ev.district) : ev.bundesland ? bundeslandDisplayName(ev.bundesland, 'de') : '';
  const place = [ev.location_name, region].filter(Boolean).join(' · ');
  const showImage = !!ev.image_url && !imgFailed;
  const [g1, g2] = gradientFor(ev.category);
  const series = (ev.series_count ?? 1) > 1 ? ev.series_count! - 1 : 0;

  return (
    <div className={`relative shrink-0 snap-start w-[168px] md:w-[212px] ${selected ? '[&_.ph]:outline [&_.ph]:outline-2 [&_.ph]:outline-[var(--v4-match)] [&_.ph]:-outline-offset-2' : ''}`}>
      <Link
        href={buildEventUrlV2(ev)}
        data-track="smart_result_click"
        data-track-id={ev.id}
        data-track-provider="event"
        className="press-haptic block"
      >
        <div
          className="ph relative aspect-square rounded-xl overflow-hidden"
          style={{ background: showImage ? 'var(--v4-surface-inset)' : `linear-gradient(135deg, ${g1}, ${g2})` }}
        >
          {showImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={ev.image_url!} alt="" loading="lazy" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-white/95 leading-tight">
              {ev.category ?? ''}
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-white text-[#0a0a0c] px-[7px] py-1 text-[11.5px] font-extrabold">
            {shortDay(ev.start_date)}{time ? ` · ${time}` : ''}
          </span>
          {price && (
            <span className={`absolute right-2 bottom-2 rounded-md bg-[#0a0a0c]/80 backdrop-blur px-[7px] py-1 text-[11.5px] font-bold ${price === 'Gratis' ? 'text-[var(--v4-go,#7bb794)]' : 'text-white'}`}>
              {price}
            </span>
          )}
          {series > 0 && (
            <span className="absolute left-2 bottom-2 rounded-md bg-[#0a0a0c]/80 backdrop-blur px-[7px] py-1 text-[11px] font-bold text-white/90">
              +{series} {series === 1 ? 'Termin' : 'Termine'}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 mb-0.5 text-[14px] font-bold tracking-[-0.01em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">{title}</h3>
        <p className="m-0 text-[12.5px] text-[var(--v4-ink-50)] truncate">{place}</p>
      </Link>
      <AddToggle selected={selected} title={title} onClick={onToggle} />
    </div>
  );
}

function ActivityCard({ act, selected, onToggle }: { act: ActivitySearchMatch; selected: boolean; onToggle: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = activityImage(act);
  const showImage = !!img && !imgFailed;
  const setting = act.setting === 'indoor' ? 'Indoor' : act.setting === 'outdoor' ? 'Outdoor' : act.setting === 'mixed' ? 'Indoor + Outdoor' : null;
  const dist = act.distance_km != null ? `${Math.round(act.distance_km)} km` : null;
  const place = [act.town, dist].filter(Boolean).join(' · ');

  return (
    <div className={`relative shrink-0 snap-start w-[168px] md:w-[212px] ${selected ? '[&_.ph]:outline [&_.ph]:outline-2 [&_.ph]:outline-[var(--v4-match)] [&_.ph]:-outline-offset-2' : ''}`}>
      <Link
        href={`/aktivitaet/${act.slug}`}
        data-track="smart_result_click"
        data-track-id={act.slug}
        data-track-provider="activity"
        className="press-haptic block"
      >
        <div className="ph relative aspect-square rounded-xl overflow-hidden" style={{ background: showImage ? 'var(--v4-surface-inset)' : 'linear-gradient(135deg, #475569, #1e293b)' }}>
          {showImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={img!} alt="" loading="lazy" onError={() => setImgFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
          )}
          {setting && (
            <span className="absolute left-2 top-2 rounded-md bg-white text-[#0a0a0c] px-[7px] py-1 text-[11.5px] font-extrabold">{setting}</span>
          )}
          {act.price_hint && (
            <span className="absolute right-2 bottom-2 rounded-md bg-[#0a0a0c]/80 backdrop-blur px-[7px] py-1 text-[11.5px] font-bold text-white">{act.price_hint}</span>
          )}
        </div>
        <h3 className="mt-2.5 mb-0.5 text-[14px] font-bold tracking-[-0.01em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">{act.name}</h3>
        <p className="m-0 text-[12.5px] text-[var(--v4-ink-50)] truncate">{place || 'Ausflugsziel'}</p>
      </Link>
      <AddToggle selected={selected} title={act.name} onClick={onToggle} />
    </div>
  );
}

/* ─── Regal ────────────────────────────────────────────────────────── */

function Shelf({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{title}</h2>
        {sub && <span className="text-[13px] text-[var(--v4-ink-50)] truncate">{sub}</span>}
        <div className="hidden md:flex gap-1 ml-auto">
          <button type="button" aria-label="Zurück scrollen" onClick={() => scroll(-1)} className="w-[30px] h-[30px] rounded-full border border-[var(--v4-hairline-3)] grid place-items-center text-[13px] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">‹</button>
          <button type="button" aria-label="Weiter scrollen" onClick={() => scroll(1)} className="w-[30px] h-[30px] rounded-full border border-[var(--v4-hairline-3)] grid place-items-center text-[13px] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">›</button>
        </div>
      </div>
      <div ref={track} className="flex gap-3.5 overflow-x-auto thin-scroll snap-x -mx-4 px-4 md:-mx-14 md:px-14 pb-1.5 [scroll-padding-left:16px] md:[scroll-padding-left:56px]">
        {children}
      </div>
    </section>
  );
}

function ShelfSkeleton() {
  return (
    <section className="mt-8 animate-pulse">
      <div className="h-[22px] w-40 rounded bg-[var(--v4-surface-elevated)] mb-3" />
      <div className="flex gap-3.5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[168px] md:w-[212px]">
            <div className="aspect-square rounded-xl bg-[var(--v4-surface-elevated)]" />
            <div className="mt-2.5 h-[14px] w-4/5 rounded bg-[var(--v4-surface-elevated)]" />
            <div className="mt-1.5 h-[12px] w-3/5 rounded bg-[var(--v4-surface-elevated)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Hauptkomponente ──────────────────────────────────────────────── */

export function V4SmartPlanner({ initialQuery = '' }: { initialQuery?: string }) {
  const [input, setInput] = useState('');
  /** Die zuletzt abgeschickte Anfrage (das Textfeld darf danach verändert werden). */
  const [lastQuery, setLastQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<SmartResponse | null>(null);
  const [selection, setSelection] = useState<Record<string, Selected>>({});
  const [planSave, setPlanSave] = useState<PlanSaveState>({ status: 'idle' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef<string | null>(null);

  const run = useCallback(async (raw: string, source: 'typed' | 'example' | 'chip' | 'autorun') => {
    const query = raw.trim();
    if (!query) return;
    trackEvent('smart_search', { query, mode: 'planner', source });
    setInput(query);
    setLastQuery(query);
    setStatus('loading');
    setResult(null);
    setPlanSave({ status: 'idle' });
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: RESULT_LIMIT }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = (await res.json()) as SmartResponse;
      if (controller.signal.aborted) return;
      setResult(data);
      setStatus('done');
      trackEvent('smart_result', {
        query,
        count: data.count,
        activities: data.activityMatches?.length ?? 0,
        intent: (data.parsed?.signals ?? []).includes('intent:ai') ? 'ai' : 'fallback',
        unmatched: (data.parsed?.unmatched_terms ?? []).length > 0,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setStatus('error');
    }
  }, []);

  // Deep-Link (?q=…): automatisch nur, wenn der Link in der App angeklickt
  // wurde (markSmartAutorun); direkt aufgerufene URLs werden nur
  // vorbefüllt (Crawler lösten über diesen Weg ~1.000 Anfragen pro Tag aus).
  useEffect(() => {
    const q = initialQuery.trim();
    if (!q || autoSentRef.current === q) return;
    autoSentRef.current = q;
    setSelection({});
    if (consumeSmartAutorun(q)) void run(q, 'autorun');
    else setInput(q);
  }, [initialQuery, run]);

  const chips = useMemo(() => buildUnderstoodChips(result?.parsed), [result]);
  const shelves = useMemo(() => planSmartShelves(result?.matches ?? []), [result]);
  const refine = useMemo(() => buildRefineChips(result?.parsed), [result]);
  const activities = result?.activityMatches ?? [];
  const conciergeLine = result
    ? buildConciergeLine({
        count: result.count,
        activities: activities.length,
        chips,
        signals: result.parsed?.signals ?? [],
        unmatchedTerms: result.parsed?.unmatched_terms ?? [],
      })
    : '';

  const toggle = useCallback((item: Selected) => {
    const key = selKey(item);
    setSelection(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = item;
        trackEvent('smart_select', { kind: item.kind, id: item.kind === 'event' ? item.ev.id : item.act.slug });
      }
      return next;
    });
    setPlanSave(p => (p.status === 'saved' ? { status: 'idle' } : p));
  }, []);

  const selected = Object.values(selection);
  const selectedEvents = selected
    .filter((s): s is Extract<Selected, { kind: 'event' }> => s.kind === 'event')
    .map(s => s.ev)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const selectedActivities = selected
    .filter((s): s is Extract<Selected, { kind: 'activity' }> => s.kind === 'activity')
    .map(s => s.act);

  async function savePlan() {
    if (selected.length === 0) return;
    setPlanSave({ status: 'saving' });
    trackEvent('smart_save_plan', { events: selectedEvents.length, activities: selectedActivities.length });
    const note = selectedActivities.length > 0
      ? 'Flexible Stopps:\n' + selectedActivities
          .map(a => `- ${a.name}${a.town ? ` (${a.town})` : ''} → https://lasstreffen.at/aktivitaet/${a.slug}`)
          .join('\n')
      : null;
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Plan: ${lastQuery.slice(0, 60)}`,
          plan_date: selectedEvents[0]?.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          note,
          event_ids: selectedEvents.map(e => e.id),
        }),
      });
      if (res.status === 401) setPlanSave({ status: 'auth' });
      else if (res.ok) {
        const { plan } = await res.json();
        setPlanSave({ status: 'saved', planId: plan.id });
      } else setPlanSave({ status: 'error' });
    } catch {
      setPlanSave({ status: 'error' });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run(input, 'typed');
    }
  }

  const hasResult = status === 'done' && result != null;
  const isEmpty = hasResult && result.count === 0 && activities.length === 0;

  const planRail = (
    <>
      <h4 className="m-0 mb-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-[var(--v4-ink)]">Dein Plan</h4>
      <p className="m-0 mb-3 text-[12px] text-[var(--v4-ink-50)]">
        {selected.length === 0 ? 'Noch leer' : `${selected.length} ${selected.length === 1 ? 'Stopp' : 'Stopps'}${planSave.status === 'saved' ? ' · gespeichert' : ' · noch nicht gespeichert'}`}
      </p>
      {selected.length === 0 ? (
        <p className="m-0 text-[12.5px] leading-[1.5] text-[var(--v4-ink-50)]">
          Tippe <b className="text-[var(--v4-ink)]">+</b> auf einer Karte. Events sortieren sich nach Uhrzeit, Ausflugsziele sind flexible Stopps.
        </p>
      ) : (
        <ol className="m-0 p-0 pl-3.5 border-l-2 border-[var(--v4-hairline-3)] list-none flex flex-col gap-2.5">
          {selectedEvents.map(e => (
            <li key={`e-${e.id}`} className="relative flex items-center gap-2.5 before:content-[''] before:absolute before:-left-[19px] before:top-[14px] before:w-2 before:h-2 before:rounded-full before:bg-[var(--v4-match)]">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[var(--v4-surface-inset)]">
                {e.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.image_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block text-[12.5px] leading-[1.25] text-[var(--v4-ink)] line-clamp-2">{decodeEntities(e.title)}</b>
                <span className="text-[11px] text-[var(--v4-ink-50)]">{shortDay(e.start_date)}{formatTime(e.start_date) ? ` · ${formatTime(e.start_date)}` : ''}{e.location_name ? ` · ${e.location_name}` : ''}</span>
              </div>
              <button type="button" onClick={() => toggle({ kind: 'event', ev: e })} aria-label={`${decodeEntities(e.title)} entfernen`} className="press-haptic shrink-0 text-[var(--v4-ink-30)] hover:text-[var(--v4-alert)] text-[14px]">✕</button>
            </li>
          ))}
          {selectedActivities.map(a => (
            <li key={`a-${a.slug}`} className="relative flex items-center gap-2.5 before:content-[''] before:absolute before:-left-[19px] before:top-[14px] before:w-2 before:h-2 before:rounded-full before:bg-[var(--v4-ink-30)]">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[var(--v4-surface-inset)]">
                {activityImage(a) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={activityImage(a)!} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block text-[12.5px] leading-[1.25] text-[var(--v4-ink)] line-clamp-2">{a.name}</b>
                <span className="text-[11px] text-[var(--v4-ink-50)]">flexibel{a.town ? ` · ${a.town}` : ''}</span>
              </div>
              <button type="button" onClick={() => toggle({ kind: 'activity', act: a })} aria-label={`${a.name} entfernen`} className="press-haptic shrink-0 text-[var(--v4-ink-30)] hover:text-[var(--v4-alert)] text-[14px]">✕</button>
            </li>
          ))}
        </ol>
      )}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3.5">
          {planSave.status === 'saved' ? (
            <Link href={`/plan/${planSave.planId}`} className="press-haptic inline-flex items-center px-4 py-2 rounded-full bg-[var(--v4-go,#22c55e)] text-[#0a0a0c] text-[13px] font-semibold">
              Plan gespeichert, öffnen
            </Link>
          ) : planSave.status === 'auth' ? (
            <Link href="/auth/login" className="press-haptic inline-flex items-center px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] text-[13px] font-semibold">
              Zum Speichern bitte anmelden
            </Link>
          ) : (
            <button type="button" onClick={savePlan} disabled={planSave.status === 'saving'} className="press-haptic inline-flex items-center px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13px] font-semibold disabled:opacity-40">
              {planSave.status === 'saving' ? 'Speichert …' : 'Als Plan speichern'}
            </button>
          )}
          {planSave.status === 'error' && <span className="text-[11.5px] text-[var(--v4-alert)]">Speichern fehlgeschlagen, nochmal probieren.</span>}
        </div>
      )}
    </>
  );

  return (
    <div className="google-anno-skip max-w-[1180px] mx-auto px-4 md:px-14 pb-28">
      {/* Freitext-Hero */}
      <section className={`text-center ${hasResult || status === 'loading' ? 'mt-4' : 'mt-8 md:mt-12'}`}>
        {!hasResult && status !== 'loading' && (
          <>
            <h1 className="m-0 text-[30px] md:text-[38px] font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--v4-ink)]">Sag einfach, was du vorhast.</h1>
            <p className="mt-2 mb-0 text-[14px] md:text-[14.5px] text-[var(--v4-ink-50)]">In deinen Worten, so wie du es einem Freund schreibst. Ort, Zeit und Budget lesen wir daraus.</p>
          </>
        )}
        <form
          onSubmit={e => { e.preventDefault(); void run(input, 'typed'); }}
          className={`relative mx-auto max-w-[780px] ${hasResult || status === 'loading' ? 'mt-0' : 'mt-5'}`}
        >
          <label htmlFor="smart-query" className="sr-only">Was hast du vor?</label>
          <textarea
            id="smart-query"
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            rows={hasResult ? 2 : 3}
            placeholder="Was hast du vor? Zum Beispiel: Konzert am Samstag in Graz, günstig"
            autoFocus={!initialQuery && !hasResult}
            className="block w-full resize-none rounded-[20px] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-3)] focus:border-[rgba(245,185,66,0.45)] focus:outline-none text-[var(--v4-ink)] text-[16px] md:text-[18px] leading-[1.4] font-medium placeholder-[var(--v4-ink-30)] px-5 pt-5 pb-16 md:pr-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === 'loading'}
            className="press-haptic absolute right-3 bottom-3 px-5 py-2.5 rounded-full bg-[var(--v4-match)] text-[#0a0a0c] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Suche …' : hasResult ? 'Neu suchen' : "Los geht's"}
          </button>
        </form>
        {!hasResult && status !== 'loading' && (
          <p className="mx-auto mt-3.5 max-w-[780px] text-left text-[13px] leading-[1.9] text-[var(--v4-ink-50)]">
            <span className="mr-2 whitespace-nowrap">Zum Beispiel:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => void run(ex, 'example')}
                data-track="smart_sample_click"
                data-track-id={ex}
                className="press-haptic mr-4 text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] border-b border-[var(--v4-hairline-4)] hover:border-[var(--v4-ink-50)] text-left"
              >
                {ex}
              </button>
            ))}
          </p>
        )}
        {!hasResult && status !== 'loading' && (
          <p className="mt-3 text-[11.5px] text-[var(--v4-ink-30)]">Suche über alle Events und Ausflugsziele Österreichs. Jede Empfehlung kommt aus unserer Datenbank.</p>
        )}
      </section>

      {/* Laden */}
      {status === 'loading' && (
        <div className="mt-5" aria-live="polite">
          <p className="text-[13px] text-[var(--v4-ink-50)] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--v4-match)] animate-pulse" />
            Suche in allen Events und Ausflugszielen Österreichs …
          </p>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </div>
      )}

      {/* Fehler */}
      {status === 'error' && (
        <div className="mt-5 rounded-2xl border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-4 text-[14px] text-[var(--v4-ink-70)]">
          Die Suche ist gerade nicht erreichbar. Probier es in einem Moment nochmal, die Liste daneben funktioniert weiterhin.
        </div>
      )}

      {/* Ergebnis */}
      {hasResult && (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_300px] md:gap-9 md:items-start">
          <div className="min-w-0">
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] tracking-[0.22em] uppercase font-bold text-[var(--v4-ink-50)] mr-1">Verstanden</span>
              {chips.map(c => (
                <span key={c.key} className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] text-[12.5px] font-semibold text-[var(--v4-ink)]">{c.label}</span>
              ))}
              {chips.length === 0 && <span className="text-[12.5px] text-[var(--v4-ink-50)]">keine festen Angaben, ich suche nach den Wörtern</span>}
              <button type="button" onClick={() => textareaRef.current?.focus()} className="press-haptic inline-flex items-center px-3 py-1.5 rounded-full border border-dashed border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)]">ändern</button>
            </div>

            <div className="mt-4 flex gap-3 items-start rounded-2xl border p-4" style={{ background: 'rgba(245,185,66,0.05)', borderColor: 'rgba(245,185,66,0.22)' }}>
              <div className="w-[30px] h-[30px] rounded-full bg-[var(--v4-match)] text-[#0a0a0c] grid place-items-center font-extrabold text-[13px] shrink-0">C</div>
              <p className="m-0 text-[14px] leading-[1.5] text-[var(--v4-ink)]">{conciergeLine}</p>
            </div>

            {shelves.map(shelf => (
              <Shelf key={shelf.key} title={shelf.title} sub={shelf.sub}>
                {shelf.events.map(ev => (
                  <EventCard key={ev.id} ev={ev} selected={!!selection[`event:${ev.id}`]} onToggle={() => toggle({ kind: 'event', ev })} />
                ))}
              </Shelf>
            ))}

            {activities.length > 0 && (
              <Shelf title="Ausflugsziele" sub="ohne festen Termin, als Zwischenstopp">
                {activities.map(act => (
                  <ActivityCard key={act.slug} act={act} selected={!!selection[`activity:${act.slug}`]} onToggle={() => toggle({ kind: 'activity', act })} />
                ))}
              </Shelf>
            )}

            {!isEmpty && (
              <section className="mt-8">
                <h2 className="m-0 mb-3 text-[20px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">Noch genauer?</h2>
                <div className="flex gap-2 flex-wrap">
                  {refine.map(r => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => void run(`${lastQuery} ${r.append}`, 'chip')}
                      className="press-haptic px-3.5 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[13px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-4)]"
                    >
                      {r.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => textareaRef.current?.focus()} className="press-haptic px-3.5 py-2 rounded-full border border-dashed border-[var(--v4-hairline-3)] text-[13px] font-semibold text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)]">Eigene Nachfrage tippen …</button>
                </div>
              </section>
            )}
          </div>

          <aside className="hidden md:block sticky top-[72px] rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-4" aria-label="Dein Plan">
            {planRail}
          </aside>
        </div>
      )}

      {/* Handy: Plan-Leiste unten + Sheet */}
      {hasResult && selected.length > 0 && (
        <div
          className="md:hidden fixed left-3 right-3 z-[22] flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-full bg-white text-[#0a0a0c] shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          style={{ bottom: 'calc(var(--v4-sticky-bottom, 82px) + 10px)' }}
        >
          <b className="flex-1 min-w-0 truncate text-[13px]">{selected.length} {selected.length === 1 ? 'Stopp' : 'Stopps'} im Plan</b>
          <button type="button" onClick={() => setSheetOpen(true)} className="press-haptic px-3.5 py-2 rounded-full bg-[#0a0a0c] text-white text-[12.5px] font-bold">Dein Plan</button>
        </div>
      )}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[1200]" role="dialog" aria-label="Dein Plan">
          <button type="button" aria-label="Schließen" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-4 pb-8">
            <button type="button" onClick={() => setSheetOpen(false)} className="press-haptic absolute right-4 top-3 text-[var(--v4-ink-50)] text-[18px]" aria-label="Schließen">✕</button>
            {planRail}
          </div>
        </div>
      )}
    </div>
  );
}
