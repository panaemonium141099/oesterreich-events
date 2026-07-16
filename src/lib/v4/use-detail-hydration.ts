'use client';

/**
 * useDetailHydration — fn-16 Option A (User-Go 2026-07-16).
 *
 * Die Liste arbeitet auf Points (title=null, aus dem Karten-Snapshot);
 * dieser Hook holt für die GERADE SICHTBAREN Karten die Anzeige-Felder
 * (Titel, Bild, Ort, Slug) nach — deterministische 24er-Chunks in
 * Listen-Reihenfolge, damit alle Besucher mit gleichen Filtern identische
 * ids-Strings anfragen (= Edge-Cache-HITs auf /api/events/details).
 *
 * Wichtig: Er dekoriert NACH Sortierung/Slicing — die Reihenfolge kommt
 * stabil aus den Punkten (event_score/Datum), Hydration löst kein
 * Re-Sortieren aus. Die Kurz-ID bleibt als `id` erhalten (stabile React-
 * Keys; Event-URLs lösen ohnehin über das 8-Hex-Präfix auf).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Event } from '@/types/events';

const CHUNK = 24;

interface DetailRow {
  id: string;
  slug: string | null;
  title: string | null;
  image_url: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  start_date: string;
  end_date: string | null;
  price_text: string | null;
}

/** Volle UUID → 12-Hex-Kurz-ID (Schlüsselformat des Snapshots). */
function toShortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12).toLowerCase();
}

export function useDetailHydration(events: Event[]): Event[] {
  const [details, setDetails] = useState<Record<string, Partial<Event>>>({});
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    // Nur Punkte (title=null) ohne vorliegende/laufende Details.
    const missing = events
      .filter((e) => e.title == null && !details[e.id] && !inflight.current.has(e.id))
      .map((e) => e.id);
    if (missing.length === 0) return;

    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK);
      chunk.forEach((id) => inflight.current.add(id));
      fetch(`/api/events/details?ids=${chunk.join(',')}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { events?: DetailRow[] } | null) => {
          setDetails((prev) => {
            const next = { ...prev };
            for (const d of data?.events ?? []) {
              // Kurz-ID als Key + als id behalten (stabile Keys/Links).
              const sid = toShortId(String(d.id));
              next[sid] = { ...d, id: sid } as Partial<Event>;
            }
            // Nicht gefundene (z. B. zwischenzeitlich depubliziert) markieren,
            // sonst fragt der Effekt sie endlos erneut an.
            for (const id of chunk) {
              if (!next[id]) next[id] = { title: 'Event nicht mehr verfügbar' };
            }
            return next;
          });
        })
        .catch(() => {
          // Netzfehler: wieder freigeben — nächster Render versucht es erneut.
          chunk.forEach((id) => inflight.current.delete(id));
        });
    }
  }, [events, details]);

  return useMemo(
    () =>
      events.map((e) => {
        if (e.title != null) return e; // volle Events (Batch-Fallback) unberührt
        const d = details[e.id];
        return d ? ({ ...e, ...d, id: e.id } as Event) : e;
      }),
    [events, details],
  );
}
