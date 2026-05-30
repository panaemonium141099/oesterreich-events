'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { V4PlansList, V4SavedStats } from '@/components/Plans/v4';
import type { Plan } from '@/types/plans';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

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

export function V4SavedPageClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Fetch both in parallel — different endpoints, independent failures.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/plans');
        if (res.ok) {
          const data = await res.json();
          if (alive) setPlans(data.plans ?? []);
        }
      } finally { if (alive) setLoadingPlans(false); }
    })();
    (async () => {
      try {
        const res = await fetch('/api/saved-events');
        if (res.ok) {
          const data = await res.json();
          if (alive) setSavedEvents(data.items ?? []);
        }
      } finally { if (alive) setLoadingSaved(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-14">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Meine Pläne</p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Was hast du dir vorgenommen?
          </h1>
        </div>
      </section>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12 flex flex-col gap-10">

        {/* Pläne (existing) */}
        <section className="flex flex-col gap-7">
          {loadingPlans ? (
            <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade Pläne …</div>
          ) : (
            <>
              {plans.length > 0 && <V4SavedStats plans={plans}/>}
              <V4PlansList plans={plans}/>
            </>
          )}
        </section>

        {/* Gemerkte Events (new) */}
        <section className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">Gemerkt</p>
              <h2 className="m-0 text-[22px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)]">
                {savedEvents.length === 0 ? 'Noch nichts gemerkt' : `${savedEvents.length} gemerkte Event${savedEvents.length === 1 ? '' : 's'}`}
              </h2>
            </div>
          </div>

          {loadingSaved ? (
            <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade gemerkte Events …</div>
          ) : savedEvents.length === 0 ? (
            <EmptySavedState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedEvents.map((ev) => <SavedEventCard key={ev.id} ev={ev}/>)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SavedEventCard({ ev }: { ev: SavedEvent }) {
  const url = buildEventUrlV2({
    id: ev.id,
    start_date: ev.start_date,
    postal_code: ev.postal_code,
    bundesland: ev.bundesland,
    location_name: ev.location_name,
  });

  const venue = ev.location_name?.trim() || ev.district?.trim() || ev.bundesland?.trim() || '';

  return (
    <Link
      href={url}
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)] hover:border-[var(--v4-hairline-3)] transition-colors"
    >
      <div className="relative aspect-[16/10] bg-[var(--v4-surface)] overflow-hidden">
        {/* Use the same image proxy the lifecycle emails do — clean uniform sizing + placeholder fallback */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/img/${ev.id}?w=480&h=300`}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {ev.category && (
          <span
            className="absolute top-3 left-3 inline-block px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-[0.06em]"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            {ev.category}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--v4-ink-50)]">
          {formatDateDE(ev.start_date)}
        </div>
        <h3 className="m-0 text-[16px] font-bold tracking-[-0.012em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">
          {ev.title}
        </h3>
        {venue && (
          <div className="text-[13px] text-[var(--v4-ink-70)] leading-snug line-clamp-1">
            📍 {venue}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptySavedState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center">
      <p className="m-0 text-[var(--v4-ink-70)] text-sm leading-relaxed">
        Tipp auf das Lesezeichen-Symbol bei einem Event, um es hier zu sammeln.
      </p>
      <Link
        href="/entdecken"
        className="press-haptic inline-flex items-center justify-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
      >
        Events entdecken →
      </Link>
    </div>
  );
}

function formatDateDE(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-AT', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}
