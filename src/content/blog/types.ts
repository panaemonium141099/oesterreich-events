export interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

export interface FestivalKeyFacts {
  dates: string;
  location: string;
  address: string;
  genre: string;
  price: string;
  website: string;
  capacity?: string;
  since?: string;
}

export interface LineupAct {
  name: string;
  role?: 'headliner' | 'support' | 'special';
  day?: string;
  time?: string;
  stage?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FestivalPost {
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  /** Direkter Ticket-Kauflink (traegt die Eventim-Affiliate-ID J70).
   *  Rendert einen prominenten Kauf-Button in der KeyFacts-Box. */
  ticketUrl?: string;
  /** Bildquelle/Lizenz-Zeile fuer das Hero-Bild (Attribution-Pflicht bei
   *  Fremdbildern, z. B. "Foto: Eventim" oder "Foto: <Autor>, CC BY 2.0,
   *  Wikimedia Commons"). Wird als Overlay unten rechts im Hero gerendert. */
  heroImageCredit?: string;
  thumbnailImage?: string;
  publishDate: string;
  updatedDate: string;
  readingTime: number;
  excerpt: string;
  category: string;
  categoryColor: string;
  keyFacts: FestivalKeyFacts;
  lineup: LineupAct[];
  /** Custom heading for the lineup section. Defaults to 'Lineup' if omitted. Use 'Programm-Highlights' for non-music events. */
  lineupTitle?: string;
  lineupNote?: string;
  intro: string;
  historyTitle: string;
  history: string;
  whatToExpectTitle: string;
  whatToExpect: string;
  whatToExpectList: string[];
  practicalInfoTitle: string;
  practicalInfo: { icon: string; label: string; text: string }[];
  gallery: GalleryImage[];
  ctaText: string;
  ctaLink: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  jsonLdEvent: {
    name: string;
    startDate: string;
    endDate: string;
    /** Human-readable address string used to build the Schema.org Place object. */
    location: string;
    /**
     * ISO 3166-1 alpha-2 country code for Schema.org PostalAddress.addressCountry.
     * Required for valid Event structured data (e.g. 'AT' for Austria).
     */
    addressCountry: string;
    url: string;
    description: string;
    /** URL of a representative image for Schema.org Event structured data. */
    image: string;
  };
  /** Optional FAQ section — rendered as visible Q&A and FAQPage JSON-LD schema for rich results. */
  faqs?: FaqItem[];
  /**
   * fn-21: explizite Stadt für die Booking.com-Unterkunfts-Box (BlogStayBox).
   * Optional — ohne Angabe wird die Stadt aus jsonLdEvent.location bzw.
   * keyFacts.location abgeleitet. Leerer String unterdrückt die Box nicht;
   * dafür schlicht keine ableitbare Stadt liefern.
   */
  stayCity?: string;
}
