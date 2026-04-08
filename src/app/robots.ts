import type { MetadataRoute } from 'next';

// Note: Low-quality events (quality_score < 30) and non-published events
// are noindexed via meta robots tags in src/app/events/[id]/page.tsx.
// The sitemap (src/app/sitemap.ts) only includes events with quality_score >= 40.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/auth/', '/profile/'],
    },
    sitemap: 'https://lasstreffen.at/sitemap.xml',
  };
}
