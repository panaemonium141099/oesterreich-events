'use client';

/**
 * Lädt die Aktivitäten eines Orts seitenweise über /api/activities nach
 * (Gegenstück zu LoadMoreEvents). `apiParams` trägt denselben Ort wie die
 * Server-Abfrage der ersten Seite (Bundesland oder Rechteck), der Cursor
 * setzt nach deren letzter Karte fort.
 */

import { useCallback, useState } from 'react';
import type { WasTunActivity } from '@/lib/was-tun/content';
import { ActivityCard, type ActivityCardLabels } from './ActivityCard';

const PAGE = 20;

export function LoadMoreActivities({ apiParams, initialCursor, labels }: {
  apiParams: Record<string, string>;
  initialCursor: string | null;
  labels: ActivityCardLabels;
}) {
  const [items, setItems] = useState<WasTunActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams(apiParams);
      params.set('cursor', cursor);
      params.set('limit', String(PAGE));
      const res = await fetch(`/api/activities?${params.toString()}`);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = (await res.json()) as { activities?: WasTunActivity[]; nextCursor?: string | null };
      setItems((prev) => [...prev, ...(data.activities ?? [])]);
      setCursor(data.nextCursor ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, cursor, apiParams]);

  if (items.length === 0 && !cursor) return null;

  return (
    <div>
      {items.length > 0 && (
        <div className="v4-poster-grid mt-[18px]">
          {items.map((a) => <ActivityCard key={a.id} activity={a} labels={labels} grid />)}
        </div>
      )}
      {cursor && (
        <div className="flex flex-col items-center gap-2 mt-8">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="press-haptic px-6 py-2.5 rounded-full text-[13px] font-semibold text-[var(--v4-ink)] border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Mehr Ausflugsziele laden'}
          </button>
          {failed && (
            <p className="m-0 text-[13px] text-[var(--v4-ink-70)]">
              Das Nachladen hat nicht geklappt. Bitte noch einmal versuchen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
