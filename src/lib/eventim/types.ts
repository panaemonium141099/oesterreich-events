/**
 * TypeScript interfaces for the Eventim/oeticket PFT JSON feed.
 * Verified against a live feed snapshot (2026-06-16). The feed may add
 * fields at any time — keep these tolerant (optional where not guaranteed).
 */

export interface EventimPriceCategory {
  /** "buchbar" = on sale, "nicht buchbar" = sold out / not yet on sale. */
  inventory: 'buchbar' | 'nicht buchbar' | string;
  price: string;
  currency: string;
  priceCategoryId: string;
  priceCategoryName: string;
  priceCategoryNumber: string;
  productType: string;
  onsaleDate?: string;
  onsaleTime?: string;
}

export interface EventimEvent {
  eventId: string;
  eventName: string;
  /** ISO8601 with TZ offset, e.g. "2026-06-16T20:15:00.000+02:00". */
  eventDateIso8601: string;
  /** "2" = AVAILABLE, "1" = CANCELED, "4" = SOLD_OUT, "6" = NO_AMOUNT, etc. */
  eventStatus: string;
  /** "1" = Ticket event, 4 = Voucher, 5 = Package, 6 = Product, 3 = Link. */
  eventType: string;
  /** If false, delivery (and therefore sale) is not possible. */
  deliverable: boolean;
  eventCity: string;
  eventCountry: string;
  eventZip?: string | null;
  eventStreet?: string | null;
  eventVenue: string;
  eventVenueId: string;
  venueLatitude?: number;
  venueLongitude?: number;
  minPrice?: number;
  maxPrice?: number;
  /** Affiliate deeplink — already contains `?affiliate=J70`. */
  evoLink: string;
  priceCategories?: EventimPriceCategory[];
}

export interface EventimArtist {
  artistId: string;
  artistName: string;
  artistImage?: string;
  evoLink?: string;
}

export interface EventimSeries {
  esId: string;
  esName: string;
  esText?: string;
  esPictureBig?: string;
  esCategories?: { category: string }[];
  artists?: EventimArtist[];
  events?: EventimEvent[];
}

export interface EventimFeed {
  eventserie: EventimSeries[];
}
