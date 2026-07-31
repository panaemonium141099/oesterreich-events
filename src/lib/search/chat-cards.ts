/**
 * chat-cards — gemeinsame Typen für die Entity-Karten des
 * Concierge-Chats (fn-19 Phase B). Eigene Datei, damit die Client-UI
 * die Typen importieren kann, ohne die Route zu importieren.
 */

export interface ChatEventCard {
  kind: 'event';
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  category: string | null;
  image_url: string | null;
  price_text: string | null;
  slug: string | null;
  /** Für buildEventUrlV2 (kanonische /events/{plz}-{ort}/…-URL). */
  postal_code: string | null;
  address: string | null;
}

export interface ChatActivityCard {
  kind: 'activity';
  id: string;
  slug: string;
  name: string;
  town: string | null;
  bundesland: string | null;
  setting: 'indoor' | 'outdoor' | 'mixed' | null;
  price_hint: string | null;
  image_url: string | null;
}

/**
 * fn-19 Tipp-Karten: freie Concierge-Ideen (ohne DB-Referenz), damit
 * auch KI-eigene Vorschläge in die Timeline wandern können. Landen beim
 * Plan-Speichern als Ideen-Zeilen in der Notiz.
 */
export interface ChatSuggestionCard {
  kind: 'suggestion';
  /** Stabiler Key = normalisierter Titel (dedupliziert über Chat-Runden). */
  id: string;
  title: string;
}

export type ChatEntityCard = ChatEventCard | ChatActivityCard | ChatSuggestionCard;
