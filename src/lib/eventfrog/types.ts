/**
 * Eventfrog Public API v1 (https://docs.api.eventfrog.net/#publicapi-v1).
 * Geprüft gegen echte Antworten vom 2026-10-27 (country=AT/DE/CH). Die API
 * kann Felder ergänzen — deshalb tolerant (optional, wo nicht garantiert).
 */

/** Mehrsprachiger Text; fehlende Sprachen kommen als null. */
export type EventfrogI18n = Record<string, string | null | undefined>;

export interface EventfrogImage {
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface EventfrogEvent {
  /** 64-Bit-Ganzzahl als String. */
  id: string;
  /** Gesetzt, wenn Eventfrog das Event aus einer Fremdquelle übernommen hat (z. B. "Saiten"). */
  extSrcId?: string | null;
  extId?: string | null;
  /** "0", wenn das Event zu keiner Gruppe gehört. */
  groupId?: string;
  rubricId: number;
  title: EventfrogI18n;
  url: string;
  organizerId?: string;
  organizerName?: string;
  websiteUrl?: string;
  presaleLink?: string;
  presaleText?: string;
  /** Eventbild, sonst Gruppen- oder Rubrikbild, oder nichts. */
  emblemToShow?: EventfrogImage | null;
  emblemCredits?: string;
  /** ISO 8601 mit Offset, z. B. "2026-10-27T19:30:00+01:00". */
  begin: string;
  end?: string | null;
  cancelled: boolean;
  visible: boolean;
  published: boolean;
  /** Reiner Kalendereintrag, Eventfrog verkauft keine Tickets. */
  agendaEntryOnly: boolean;
  littleTicketsLeft?: boolean | null;
  soldOut?: boolean | null;
  lowestTicketPrice?: number | null;
  locationIds: string[];
  locationAlias?: EventfrogI18n;
  modifyDate: string;
  shortDescription?: EventfrogI18n;
  descriptionAsHTML?: EventfrogI18n;
}

export interface EventfrogLocation {
  id: string;
  title: EventfrogI18n;
  url: string;
  addressLine?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  zip?: string;
  city?: string;
  lat?: number;
  lng?: number;
  websiteUrl?: string;
  modifyDate: string;
}

export interface EventfrogRubric {
  id: number;
  /** 0 = Oberrubrik. */
  parentId: number;
  title: EventfrogI18n;
}

export interface EventfrogEventsPage {
  totalNumberOfResources: number;
  events: EventfrogEvent[];
}

export interface EventfrogLocationsPage {
  totalNumberOfResources: number;
  locations: EventfrogLocation[];
}

export interface EventfrogRubricsPage {
  totalNumberOfResources: number;
  rubrics: EventfrogRubric[];
}
