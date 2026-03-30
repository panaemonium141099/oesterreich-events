export interface Event {
  id: string;
  source_type?: string;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day?: boolean;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  price_text: string | null;
  price_min: number | null;
  price_max: number | null;
  image_url: string | null;
  organizer: string | null;
  tags: string[] | null;
  visibility?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapedEvent {
  source_id: string;
  source_name: string;
  source_url: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  bundesland?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  price_text?: string;
  price_min?: number;
  price_max?: number;
  image_url?: string;
  organizer?: string;
  tags?: string[];
}

export interface EventFilters {
  bundesland?: string;
  district?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  eveningOnly?: boolean;
  limit?: number;
  offset?: number;
}

export type Category =
  | 'Musik'
  | 'Nightlife'
  | 'Wein & Kulinarik'
  | 'Kultur'
  | 'Märkte'
  | 'Sport'
  | 'Familie'
  | 'Natur'
  | 'Feste & Brauchtum'
  | 'Bildung'
  | 'Gesundheit'
  | 'Religion'
  | 'Sonstiges';

export type District =
  | 'Neusiedl am See'
  | 'Eisenstadt'
  | 'Mattersburg'
  | 'Oberpullendorf'
  | 'Oberwart'
  | 'Güssing'
  | 'Jennersdorf';
