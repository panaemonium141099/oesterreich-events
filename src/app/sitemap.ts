import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ALL_POSTS } from '@/content/blog';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { CATEGORY_SLUGS, LANDING_CITIES, STUDENT_CITIES, STUDENT_FILTERS } from '@/lib/landing-slugs';
import { buildEventUrl } from '@/lib/utils/slugify';

export const revalidate = 86400; // 24h ISR

const BASE_URL = 'https://lasstreffen.at';
const CHUNK_SIZE = 5000;

function getSupabase() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function generateSitemaps(): Promise<{ id: number }[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Quality-gated: only count events with quality_score >= 40 and valid publish status
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 40);

  if (error || count == null) {
    // Fallback: return a single sitemap
    return [{ id: 0 }];
  }

  const total = Math.ceil(count / CHUNK_SIZE);
  return Array.from({ length: Math.max(total, 1) }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Quality-gated: only include events with quality_score >= 40, exclude suppressed/duplicate/needs_review
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, updated_at, event_score, quality_score')
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 40)
    .order('event_score', { ascending: false })
    .order('id', { ascending: true })
    .range(id * CHUNK_SIZE, id * CHUNK_SIZE + CHUNK_SIZE - 1);

  // Priority based on quality_score: >= 80 -> 0.8, >= 60 -> 0.6, >= 40 -> 0.4
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

  // Include static pages in chunk 0
  if (id === 0) {
    const staticPages: MetadataRoute.Sitemap = [
      {
        url: BASE_URL,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1.0,
      },
      {
        url: `${BASE_URL}/map`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/impressum`,
        lastModified: new Date(),
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      },
      {
        url: `${BASE_URL}/datenschutz`,
        lastModified: new Date(),
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      },
    ];

    // Blog index page
    const blogIndexUrl: MetadataRoute.Sitemap = [
      {
        url: `${BASE_URL}/blog`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
    ];

    // Individual blog post URLs
    const blogPostUrls: MetadataRoute.Sitemap = ALL_POSTS.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedDate ?? post.publishDate),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    // Landing pages: Bundesland + Stadt + Kategorie + Zeitkontext
    const landingPages: MetadataRoute.Sitemap = [];
    const bundeslaender = BUNDESLAENDER.filter((b) => b.id !== 'all');
    const categorySlugs = [...CATEGORY_SLUGS.keys()];
    const timeFilters = ['heute', 'wochenende'];

    for (const bl of bundeslaender) {
      // /[bundesland]
      landingPages.push({
        url: `${BASE_URL}/${bl.id}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      });
      // /[bundesland]/heute, /[bundesland]/wochenende
      for (const tf of timeFilters) {
        landingPages.push({
          url: `${BASE_URL}/${bl.id}/${tf}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
      }
      // /[bundesland]/[category]
      for (const cs of categorySlugs) {
        landingPages.push({
          url: `${BASE_URL}/${bl.id}/${cs}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
        // /[bundesland]/[category]/heute, /wochenende
        for (const tf of timeFilters) {
          landingPages.push({
            url: `${BASE_URL}/${bl.id}/${cs}/${tf}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.6,
          });
        }
      }
    }

    // Stadt pages (exclude Wien — handled via /wien bundesland route)
    const stadtCities = LANDING_CITIES.filter((c) => c.filterMode === 'city');
    for (const city of stadtCities) {
      landingPages.push({
        url: `${BASE_URL}/stadt/${city.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      });
      for (const tf of timeFilters) {
        landingPages.push({
          url: `${BASE_URL}/stadt/${city.slug}/${tf}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
      }
      for (const cs of categorySlugs) {
        landingPages.push({
          url: `${BASE_URL}/stadt/${city.slug}/${cs}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
        for (const tf of timeFilters) {
          landingPages.push({
            url: `${BASE_URL}/stadt/${city.slug}/${cs}/${tf}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.6,
          });
        }
      }
    }

    // Student pages
    const studentPages: MetadataRoute.Sitemap = [];
    studentPages.push({
      url: `${BASE_URL}/studenten`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    });
    for (const sc of STUDENT_CITIES) {
      studentPages.push({
        url: `${BASE_URL}/studenten/${sc.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      });
      for (const sf of STUDENT_FILTERS) {
        studentPages.push({
          url: `${BASE_URL}/studenten/${sc.slug}/${sf}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
      }
    }

    // Venue pages: only venues with qualifying future events
    const { data: activeVenueIds } = await supabase
      .from('events')
      .select('venue_id')
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .gte('quality_score', 40)
      .not('venue_id', 'is', null);

    const uniqueVenueIds = [...new Set(
      (activeVenueIds ?? [])
        .map((e: { venue_id: string | null }) => e.venue_id)
        .filter(Boolean),
    )];

    const venuePages: MetadataRoute.Sitemap = uniqueVenueIds.map((vid) => ({
      url: `${BASE_URL}/venues/${vid}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...blogIndexUrl, ...blogPostUrls, ...landingPages, ...studentPages, ...venuePages, ...eventUrls];
  }

  return eventUrls;
}
