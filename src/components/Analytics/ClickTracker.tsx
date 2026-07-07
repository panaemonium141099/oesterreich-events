'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

/**
 * Globaler Klick-Tracker für `data-track`-Attribute. Im Root-Layout gemountet.
 *
 * Viele Komponenten tragen seit v4 deklarative Marker wie
 * `data-track="ticket_click"` — bis 2026-07 gab es aber keinen Listener, der
 * sie einsammelt (MASTERPLAN §7.1: 0 ticket_clicks in analytics_events).
 * Dieser eine delegierte Listener macht alle Marker scharf, ohne dass
 * Komponenten eigene Handler brauchen.
 *
 * Capture-Phase, damit auch Klicks zählen, deren Ziel-Handler die Propagation
 * stoppen. `trackEvent` nutzt fetch mit keepalive — überlebt also auch die
 * Navigation bei Links ohne target="_blank".
 *
 * Kontext-Konvention: `data-track-id` (z.B. Event-UUID) und
 * `data-track-provider` (z.B. Ticket-Anbieter) werden, falls vorhanden,
 * als Payload mitgeschickt; bei Links zusätzlich das href.
 */
export function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.('[data-track]');
      if (!el) return;
      const type = el.getAttribute('data-track');
      if (!type) return;

      const data: Record<string, unknown> = {};
      const id = el.getAttribute('data-track-id');
      if (id) data.id = id;
      const provider = el.getAttribute('data-track-provider');
      if (provider) data.provider = provider;
      const href = el.getAttribute('href');
      if (href) data.href = href;

      trackEvent(type, data);
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
