/**
 * GET /api/app/v1/blog/[slug] — ein Blog-Beitrag der nativen App als Liste
 * einfacher Blöcke, in der Reihenfolge der Detailseite der Website.
 *
 * Der Text kommt aus der Beitragsdatei; die Ticket-Termine und die
 * passenden Events holen dieselben Lader wie `BlogTicketBox` und
 * `RelatedEvents` der Seite (je bis zu vier bzw. sechs Zeilen, beide
 * fehlertolerant: ohne Antwort fehlt nur der Block). Die fertige Antwort
 * bleibt je Beitrag zehn Minuten im Speicher.
 */
import { NextResponse } from 'next/server';
import { fetchTicketEvents } from '@/components/Blog/BlogTicketBox';
import { fetchRelatedEvents } from '@/components/Blog/RelatedEvents';
import { getPostBySlug } from '@/content/blog';
import { toAppBlogPost, type AppBlogPost } from '@/lib/app-api/blog';
import { TtlCache } from '@/lib/search/search-cache';
import { SITE_ORIGIN } from '@/lib/site';
import { viennaToday } from '@/lib/utils/event-time';

const cache = new TtlCache<AppBlogPost>(10 * 60_000, 300);
const SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = SLUG.test(slug) ? getPostBySlug(slug) : undefined;
  if (!post) {
    return NextResponse.json({ error: 'Diesen Beitrag gibt es nicht (mehr).' }, { status: 404 });
  }
  const headers = { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600' };
  const cached = cache.get(slug);
  if (cached) return NextResponse.json(cached, { headers });

  // Beide Lader fangen ihre Fehler nicht alle selbst: ohne sie bleibt der Text lesbar.
  const [ticketEvents, relatedEvents] = await Promise.all([
    fetchTicketEvents(post.title).catch(() => []),
    fetchRelatedEvents(post.title, post.keywords ?? [], post.category ?? '', post.relatedEvents).catch(() => []),
  ]);
  const body = toAppBlogPost(
    { post, ticketEvents, relatedEvents, today: viennaToday() },
    { locale: 'de', origin: SITE_ORIGIN },
  );
  cache.set(slug, body);
  return NextResponse.json(body, { headers });
}
