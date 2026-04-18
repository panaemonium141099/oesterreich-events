import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ALL_POSTS } from '@/content/blog';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { CATEGORY_SLUGS, LANDING_CITIES, STUDENT_CITIES, STUDENT_FILTERS } from '@/lib/landing-slugs';
import { buildEventUrl } from '@/lib/utils/slugify';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://lasstreffen.at';

/**
 * Sitemap chunk size. Google accepts up to 50k URLs / 50MB per sitemap;
 * keeping chunks smaller (5k) helps Googlebot process them faster on new
 * domains where crawl budget is tight.
 */
const EVENTS_PER_SITEMAP = 5000;
const MAX_EVENTS_TOTAL = 20000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[sitemap] Missing SUPABASE env vars, url:', !!url, 'key:', !!key);
    return null;
  }
  return createClient(url, key);
}

/**
 * Tells Next.js to generate N separate sitemap files: sitemap/0.xml,
 * sitemap/1.xml, etc. Google likes smaller indexable sitemaps, especially
 * on new domains where crawl budget is limited. Sitemap 0 contains static
 * + landing + blog + venue URLs; sitemaps 1+ contain event URLs in chunks.
 */
export async function generateSitemaps() {
  const eventChunks = Math.ceil(MAX_EVENTS_TOTAL / EVENTS_PER_SITEMAP);
  return Array.from({ length: 1 + eventChunks }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Sitemap 0 = all non-event URLs (static + landing + blog + venues)
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
      { url: `${BASE_URL}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
      { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
      { url: `${BASE_URL}/quellen`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
      { url: `${BASE_URL}/impressum`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
      { url: `${BASE_URL}/datenschutz`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ];

    const blogPages: MetadataRoute.Sitemap = ALL_POSTS.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedDate ?? post.publishDate),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

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

    const studentPages: MetadataRoute.Sitemap = [
      { url: `${BASE_URL}/studenten`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ];
    for (const sc of STUDENT_CITIES) {
      studentPages.push({ url: `${BASE_URL}/studenten/${sc.slug}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 });
      for (const sf of STUDENT_FILTERS) {
        studentPages.push({ url: `${BASE_URL}/studenten/${sc.slug}/${sf}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 });
      }
    }

    // Venue pages (unique venue_ids that have upcoming published events)
    let venuePages: MetadataRoute.Sitemap = [];
    if (supabase) {
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

      venuePages = uniqueVenueIds.map((vid) => ({
        url: `${BASE_URL}/venues/${vid}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }

    return [...staticPages, ...blogPages, ...landingPages, ...studentPages, ...venuePages];
  }

  // Sitemaps 1..N = event chunks, ordered by quality_score desc.
  // Ranking events by score means Google sees the highest-quality ones
  // first — improves the chance that they get indexed quickly.
  if (!supabase) return [];

  const offset = (id - 1) * EVENTS_PER_SITEMAP;
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, updated_at, quality_score')
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 40)
    .order('quality_score', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + EVENTS_PER_SITEMAP - 1);

  return (events ?? []).map((event) => {
    const qs = event.quality_score ?? 0;
    const priority = qs >= 80 ? 0.8 : qs >= 60 ? 0.6 : 0.4;
    return {
      url: `${BASE_URL}${buildEventUrl(event.id, event.slug)}`,
      lastModified: event.updated_at ? new Date(event.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority,
    };
  });
}
