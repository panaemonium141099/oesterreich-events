import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ALL_POSTS } from '@/content/blog';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { CATEGORY_SLUGS, LANDING_CITIES, STUDENT_CITIES, STUDENT_FILTERS } from '@/lib/landing-slugs';
import { buildEventUrl } from '@/lib/utils/slugify';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://lasstreffen.at';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[sitemap] Missing SUPABASE env vars, url:', !!url, 'key:', !!key);
    return null;
  }
  return createClient(url, key);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/impressum`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Blog
  const blogPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...ALL_POSTS.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedDate ?? post.publishDate),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];

  // Landing pages: Bundesland + Category + Time combos
  const landingPages: MetadataRoute.Sitemap = [];
  const bundeslaender = BUNDESLAENDER.filter((b) => b.id !== 'all');
  const categorySlugs = [...CATEGORY_SLUGS.keys()];
  const timeFilters = ['heute', 'wochenende'];

  for (const bl of bundeslaender) {
    landingPages.push({ url: `${BASE_URL}/${bl.id}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 });
    for (const tf of timeFilters) {
      landingPages.push({ url: `${BASE_URL}/${bl.id}/${tf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
    }
    for (const cs of categorySlugs) {
      landingPages.push({ url: `${BASE_URL}/${bl.id}/${cs}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
      for (const tf of timeFilters) {
        landingPages.push({ url: `${BASE_URL}/${bl.id}/${cs}/${tf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 });
      }
    }
  }

  // Stadt pages
  const stadtCities = LANDING_CITIES.filter((c) => c.filterMode === 'city');
  for (const city of stadtCities) {
    landingPages.push({ url: `${BASE_URL}/stadt/${city.slug}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 });
    for (const tf of timeFilters) {
      landingPages.push({ url: `${BASE_URL}/stadt/${city.slug}/${tf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
    }
    for (const cs of categorySlugs) {
      landingPages.push({ url: `${BASE_URL}/stadt/${city.slug}/${cs}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
      for (const tf of timeFilters) {
        landingPages.push({ url: `${BASE_URL}/stadt/${city.slug}/${cs}/${tf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 });
      }
    }
  }

  // Student pages
  const studentPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/studenten`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ];
  for (const sc of STUDENT_CITIES) {
    studentPages.push({ url: `${BASE_URL}/studenten/${sc.slug}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 });
    for (const sf of STUDENT_FILTERS) {
      studentPages.push({ url: `${BASE_URL}/studenten/${sc.slug}/${sf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
    }
  }

  // If Supabase is not available, return static pages only
  if (!supabase) {
    return [...staticPages, ...blogPages, ...landingPages, ...studentPages];
  }

  // Top events by quality score (10k keeps response under 2MB / 3s)
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, updated_at, quality_score')
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 40)
    .order('quality_score', { ascending: false })
    .order('id', { ascending: true })
    .limit(10000);

  const eventUrls: MetadataRoute.Sitemap = (events ?? []).map((event) => {
    const qs = event.quality_score ?? 0;
    const priority = qs >= 80 ? 0.8 : qs >= 60 ? 0.6 : 0.4;
    return {
      url: `${BASE_URL}${buildEventUrl(event.id, event.slug)}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority,
    };
  });

  // Venue pages
  const { data: activeVenueIds } = await supabase
    .from('events')
    .select('venue_id')
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .gte('quality_score', 40)
    .not('venue_id', 'is', null);

  const uniqueVenueIds = [...new Set(
    (activeVenueIds ?? []).map((e: { venue_id: string | null }) => e.venue_id).filter(Boolean),
  )];

  const venuePages: MetadataRoute.Sitemap = uniqueVenueIds.map((vid) => ({
    url: `${BASE_URL}/venues/${vid}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages, ...landingPages, ...studentPages, ...venuePages, ...eventUrls];
}
