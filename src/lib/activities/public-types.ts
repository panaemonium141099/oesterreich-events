/**
 * Frontend-sichere Aktivitaets-Typen (fn-18 Task 3).
 *
 * Bewusst OHNE Runtime-Imports (kein supabase-js, kein node:crypto) —
 * dieses Modul darf ueberall importiert werden, auch in Client-
 * Komponenten. Spaltenauswahl == Public-View poi_activities_public
 * (Migration 20260724120000_poi_activities.sql); `is_closed` ist
 * zusaetzlich enthalten, weil der Service-Role-Detail-Loader die
 * Basistabelle liest und die Seite geschlossene POIs mit Hinweis
 * rendert (noindex via indexability.ts).
 */

import type { NormalizedOpeningWindow } from './opening';

/** images-jsonb-Eintrag (Attribution-Pflicht: copyright/author anzeigen). */
export interface PublicActivityImage {
  urls: string[];
  copyright: string | null;
  license: string | null;
  author: string | null;
}

export interface PublicActivity {
  id: string;
  slug: string;
  shortid: string;
  name: string;
  description: string | null;
  description_short: string | null;
  tags: string[];
  setting: 'indoor' | 'outdoor' | 'mixed' | null;
  lat: number;
  lng: number;
  town: string | null;
  gemeinde_slug: string | null;
  bundesland: string;
  opening_times: NormalizedOpeningWindow[] | null;
  online_bookable: boolean;
  images: PublicActivityImage[] | null;
  guest_cards: unknown;
  price_hint: string | null;
  affiliate_product: unknown;
  source: string;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}
