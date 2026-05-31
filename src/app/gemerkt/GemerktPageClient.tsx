'use client';

import { useEffect, useState, useCallback } from 'react';
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

export function GemerktPageClient() {
  const { user } = useAuth();
  const supabase = createClient();

  const [items, setItems] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  /**
   * Remove a bookmark inline. Optimistic update — the item is filtered
   * out of the local list immediately; on DB failure we toast + revert.
   */
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

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-14">
        <div className="max-w-[860px] mx-auto px-4 md:px-14">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Gemerkt</p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            {items.length === 0
              ? 'Deine gemerkten Events'
              : `${items.length} gemerkte Event${items.length === 1 ? '' : 's'}`}
          </h1>
          <p className="mt-3 text-[14px] text-[var(--v4-ink-50)] leading-relaxed">
            Alles was du mit „Merken" gespeichert hast — in der Reihenfolge, in der du es gespeichert hast.
          </p>
        </div>
      </section>

      <div className="max-w-[860px] mx-auto px-4 md:px-14 py-8 md:py-12">
        {loading ? (
          <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade gemerkte Events …</div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((ev) => (
              <SavedEventRow key={ev.id} ev={ev} onRemove={() => handleRemove(ev.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SavedEventRow({ ev, onRemove }: { ev: SavedEvent; onRemove: () => void }) {
  const url = buildEventUrlV2({
    id: ev.id,
    start_date: ev.start_date,
    postal_code: ev.postal_code,
    bundesland: ev.bundesland,
    location_name: ev.location_name,
  });

  const venue = ev.location_name?.trim() || ev.district?.trim() || ev.bundesland?.trim() || '';

  return (
    <li className="group flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)] hover:border-[var(--v4-hairline-3)] transition-colors">
      <Link href={url} className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        {/* Image via the same /api/img proxy used by emails — uniform sizing + placeholder fallback */}
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-10 text-center">
      <p className="m-0 text-[var(--v4-ink-70)] text-sm leading-relaxed max-w-md mx-auto">
        Hier landet alles, was du dir merkst.<br />
        Tipp auf das Lesezeichen-Symbol bei einem Event und es taucht hier auf.
      </p>
      <Link
        href="/entdecken"
        className="press-haptic inline-flex items-center justify-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
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
