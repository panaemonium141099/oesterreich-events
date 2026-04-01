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

export interface FestivalPost {
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  thumbnailImage?: string;
  publishDate: string;
  updatedDate: string;
  readingTime: number;
  excerpt: string;
  category: string;
  categoryColor: string;
  keyFacts: FestivalKeyFacts;
  lineup: LineupAct[];
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
    /** Plain address string used for display. For Schema.org structured data use addressCountry. */
    location: string;
    /** ISO 3166-1 alpha-2 country code, e.g. 'AT' for Austria. */
    addressCountry?: string;
    url: string;
    description: string;
    /** URL of a representative image for Schema.org Event structured data. */
    image?: string;
  };
}
