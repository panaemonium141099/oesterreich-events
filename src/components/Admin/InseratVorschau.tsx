'use client';

/**
 * InseratVorschau — Vollbild-Vorschau eines Inserats vor der Freigabe.
 *
 * Rendert dieselbe Detail-Komponente wie die öffentliche Event-Seite
 * (V4EventDetail) mit dem Event, das die Freigabe anlegen würde — inklusive
 * aller Korrekturen aus der Maske. Oben eine Leiste mit dem Befund zur
 * Adresse und den Knöpfen „Freigeben" und „Zurück zur Bearbeitung".
 *
 * Nicht enthalten: „Ähnliche Events" (Server-Komponente mit DB-Abfragen,
 * für die Beurteilung des Inserats ohne Belang) und JSON-LD.
 */

import { useEffect } from 'react';
import { Check, Loader2, MapPinOff, X } from 'lucide-react';
import type { Event } from '@/types/events';
import { V4EventDetail } from '@/components/Events/v4';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import { deriveTicketMeta } from '@/lib/v4/ticket-meta';

export interface InseratVorschauProps {
  event: Event;
  /** Kandidat, auf den der Geocoder getroffen hat; null = keine Koordinaten. */
  geocodedFrom: string | null;
  busy: boolean;
  onApprove: () => void;
  onClose: () => void;
}

export function InseratVorschau({ event, geocodedFrom, busy, onApprove, onClose }: InseratVorschauProps) {
  // Die Admin-Seite dahinter darf nicht mitscrollen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = deriveEventState(event, {
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  });
  const { provider, priceFrom, priceAtDoor } = deriveTicketMeta(event);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vorschau des Inserats"
      className="fixed inset-0 z-[300] overflow-y-auto bg-[var(--v4-surface)]"
    >
      <div className="sticky top-0 z-10 border-b border-amber-400/30 bg-[#1a1507]/95 backdrop-blur px-4 py-2.5">
        <div className="max-w-[1180px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-amber-300/80 font-semibold">
              Vorschau
            </p>
            <p className="text-xs text-white/60">
              So erscheint das Event nach der Freigabe. Noch ist nichts veröffentlicht.
            </p>
            {geocodedFrom ? (
              <p className="text-[11px] text-white/40 mt-0.5 truncate">
                Kartenpin aus „{geocodedFrom}"
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-[11px] text-red-300 mt-0.5">
                <MapPinOff className="w-3.5 h-3.5" />
                Adresse ließ sich nicht auf Koordinaten auflösen. Bitte Adresse, PLZ und Ort korrigieren.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-green-300 text-sm hover:bg-green-400/15 disabled:opacity-40 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Freigeben &amp; veröffentlichen
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/15 text-white/80 text-sm hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              <X className="w-4 h-4" />
              Zurück zur Bearbeitung
            </button>
          </div>
        </div>
      </div>

      <V4EventDetail
        event={event}
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        priceAtDoor={priceAtDoor}
      />
    </div>
  );
}
