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

/**
 * Steuert die "Passende Events"-Sektion unter einem Post.
 *
 * Ohne diese Angabe leitet RelatedEvents die Suchbegriffe aus den SEO-
 * Keywords ab. Saison-Seiten sollten sie setzen: bei "Halloween" ist das
 * Zeitfenster das viel staerkere Relevanzsignal als der Titel.
 */
export interface RelatedEventsSpec {
  /** ilike-Suchbegriffe, ODER-verknuepft. Ein Treffer reicht. */
  terms?: string[];
  /** Fruehestes Startdatum (ISO). Default: jetzt. */
  from?: string;
  /** Spaetestes Startdatum (ISO). Default: in 120 Tagen. */
  to?: string;
  /** Taxonomie-Kategorien fuers Auffuellen. Default: die Rubrik des Posts. */
  categories?: string[];
}

export interface FestivalPost {
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  /** Direkter Ticket-Kauflink (traegt die Eventim-Affiliate-ID J70).
   *  Rendert einen prominenten Kauf-Button in der KeyFacts-Box. */
  ticketUrl?: string;
  /** Wie das Hero-Bild im Kopf der Seite sitzt.
   *  `cover` (Default) = full-bleed ueber die ganze Breite — braucht ein
   *  breites Motiv ab ca. 900 px.
   *  `poster` = das Originalartwork bleibt scharf und vollstaendig sichtbar,
   *  dahinter fuellt eine unscharf gezoomte Kopie derselben Datei den Rahmen.
   *  Fuer quadratische Veranstalter-Artworks (Eventim liefert 222x222) — ein
   *  echtes kleines Bild ist richtiger als ein grosses fremdes.
   */
  heroLayout?: 'cover' | 'poster';
  /** Tatsaechliche Pixelbreite der Hero-Datei. Im Poster-Layout die
   *  Obergrenze fuer die Darstellung: ein 222px-Artwork wird nie
   *  hochskaliert, damit es scharf bleibt statt matschig gross. */
  heroImageWidth?: number;
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
  /**
   * fn-21: optional — Guide-/Unterkunfts-Artikel (stays) sind keine Events
   * und emittieren kein Event-Schema. Event-/Festival-Posts setzen es weiter.
   */
  jsonLdEvent?: {
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
  /**
   * fn-21: kuratierte Unterkünfte für Artikel der Rubrik "Übernachten".
   * Wenn gesetzt, rendert die Post-Seite eine BlogStayList (jede Unterkunft
   * mit Booking.com-Affiliate-Suchlink aus name+place) und unterdrückt die
   * generische BlogStayBox.
   */
  stays?: StayItem[];
  /** Steuert die "Passende Events"-Sektion (siehe RelatedEventsSpec). */
  relatedEvents?: RelatedEventsSpec;
}

/** Eine kuratierte Unterkunft in einem "Übernachten"-Artikel (fn-21). */
export interface StayItem {
  /** Echter Name der Unterkunft, z. B. "St. Martins Therme & Lodge". */
  name: string;
  /** Ort für den Booking-Suchlink, z. B. "Frauenkirchen". */
  place: string;
  /** Bundesland/Region als Anzeige-Badge. */
  region: string;
  /** Was macht sie besonders — 2-4 Sätze, faktenbasiert. */
  description: string;
  /** Kurzes Attribut wie "Weinfass", "Baumhaus", "Therme + Lodge". */
  kind: string;
}
