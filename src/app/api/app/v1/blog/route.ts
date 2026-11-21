/**
 * GET /api/app/v1/blog — alle Blog-Beiträge der nativen App als Karten,
 * neueste zuerst, dazu die Reiter der Liste.
 *
 * Die Beiträge liegen als Dateien im Repo (`ALL_POSTS`), keine Abfrage.
 * Umrechnung in `src/lib/app-api/blog.ts`.
 */
import { NextResponse } from 'next/server';
import { ALL_POSTS } from '@/content/blog';
import { toAppBlogList } from '@/lib/app-api/blog';
import { SITE_ORIGIN } from '@/lib/site';

export function GET() {
  return NextResponse.json(toAppBlogList(ALL_POSTS, { locale: 'de', origin: SITE_ORIGIN }), {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
