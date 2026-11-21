/**
 * Blog für die native App: Liste und Beitrag. Ein Beitrag ist auf der
 * Website ein typisiertes Objekt (`FestivalPost`) mit festen Feldern, kein
 * Markdown-Dokument; die Detailseite setzt die Felder in fester Reihenfolge
 * (`src/app/[locale]/blog/[slug]/page.tsx`). Hier entsteht daraus dieselbe
 * Reihenfolge als Liste einfacher Blöcke, die die App nur noch zeichnet.
 *
 * Pur: keine Abfragen. Die Ticket-Termine (`BlogTicketBox`) und die
 * passenden Events (`RelatedEvents`) holt die Route mit den Ladern der
 * Website und reicht sie herein.
 */
import type { RelatedEvent } from '@/components/Blog/RelatedEvents';
import { formatDate as formatRelatedDate, formatPrice as formatRelatedPrice } from '@/components/Blog/RelatedEvents';
import type { TicketEvent } from '@/components/Blog/BlogTicketBox';
import { formatDate as formatTicketDate, formatPrice as formatTicketPrice } from '@/components/Blog/BlogTicketBox';
import type { FestivalPost } from '@/content/blog/types';
import { parseProse, parseRuns, type ProseRun } from '@/lib/blog/prose';
import { buildAffiliateStayLink, deriveCityFromLocation } from '@/lib/booking/affiliate';
import { shortDateWithYear } from '@/lib/landing/day-labels';
import { absoluteUrl } from './landing';

export const APP_BLOG_VERSION = 1;

export interface AppBlogContext {
  locale: 'de';
  origin: string;
}

export interface AppBlogCard {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  /** „Kultur & Bühne · 12. Nov. 2026". */
  meta: string;
  readingTime: number;
}

export interface AppBlogList {
  version: typeof APP_BLOG_VERSION;
  /** Reiter der Liste; `categories` null heißt alle. */
  tabs: Array<{ label: string; categories: string[] | null }>;
  posts: AppBlogCard[];
}

export type AppBlogBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; runs: ProseRun[]; lead: boolean }
  | { type: 'list'; style: 'cards' | 'numbered'; items: string[] }
  | {
      type: 'facts';
      title: string;
      rows: Array<{ label: string; value: string }>;
      ticket: { url: string; label: string; note: string } | null;
      website: { url: string; label: string } | null;
    }
  | {
      type: 'tickets';
      title: string;
      badge: string;
      items: Array<{ eventId: string; dateLabel: string; title: string; place: string | null; price: string | null; url: string }>;
    }
  | { type: 'lineup'; note: string | null; groups: Array<{ label: string; acts: Array<{ name: string; day: string | null }> }> }
  | { type: 'image'; src: string; alt: string; caption: string }
  | { type: 'info'; rows: Array<{ label: string; text: string }> }
  | {
      type: 'stays';
      title: string;
      badge: string;
      cta: string;
      note: string;
      items: Array<{ name: string; kind: string; place: string; description: string; url: string }>;
    }
  | { type: 'stay'; title: string; badge: string; text: string; hint: string; cta: string; note: string; url: string }
  | { type: 'faq'; items: Array<{ question: string; answer: string }> }
  | {
      type: 'events';
      title: string;
      sub: string;
      items: Array<{ id: string; dateLabel: string; title: string; place: string | null; tickets: boolean; price: string | null }>;
    }
  | { type: 'cta'; eyebrow: string; title: string; label: string; path: string };

export interface AppBlogPost {
  version: typeof APP_BLOG_VERSION;
  slug: string;
  /** Adresse des Beitrags auf der Website, zum Teilen. */
  url: string;
  title: string;
  subtitle: string;
  category: string;
  readingLabel: string;
  /** „12.–14. Juni 2027 · Wiesen" aus den Eckdaten. */
  meta: string;
  image: string;
  /** Bildnachweis: steht sichtbar am Bild. */
  imageCredit: string | null;
  /** Quadratisches Veranstalter-Artwork: nicht über die Breite ziehen. */
  poster: boolean;
  blocks: AppBlogBlock[];
}

/**
 * Reiter der Blog-Liste wie `FILTER_TABS` der Website (dort privat in der
 * Seiten-Datei): ein Reiter fasst mehrere gespeicherte Rubriken zusammen.
 */
export const APP_BLOG_TABS: AppBlogList['tabs'] = [
  { label: 'Alle', categories: null },
  { label: 'Musik', categories: ['Musik', 'Musik & Festival', 'Musik & Konzerte'] },
  { label: 'Kultur', categories: ['Kultur & Tradition', 'Kultur & Bühne'] },
  { label: 'Märkte', categories: ['Kulinarik & Tradition', 'Essen & Trinken'] },
  { label: 'Sport', categories: ['Sport & Outdoor', 'Sport & Fitness'] },
  { label: 'Brauchtum', categories: ['Kultur & Tradition', 'Festivals & Feste', 'Open-Air & Feste'] },
  { label: 'Klassik', categories: ['Musik & Konzerte'] },
];

const AFFILIATE_NOTE =
  'Affiliate-Link: Buchst du über diesen Link, erhält LassTreffen.at eine Provision von Booking.com. Am Preis ändert sich für dich nichts.';

export function toAppBlogCard(post: FestivalPost, ctx: AppBlogContext): AppBlogCard {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    image: absoluteUrl(post.thumbnailImage || post.heroImage, ctx.origin),
    category: post.category,
    meta: [post.category, shortDateWithYear(post.publishDate, ctx.locale)].filter(Boolean).join(' · '),
    readingTime: post.readingTime,
  };
}

export function toAppBlogList(posts: FestivalPost[], ctx: AppBlogContext): AppBlogList {
  const used = new Set(posts.map(p => p.category));
  return {
    version: APP_BLOG_VERSION,
    // Reiter ohne einen einzigen Beitrag entfallen.
    tabs: APP_BLOG_TABS.filter(tab => tab.categories === null || tab.categories.some(c => used.has(c))),
    posts: posts.map(p => toAppBlogCard(p, ctx)),
  };
}

function prose(text: string): AppBlogBlock[] {
  return parseProse(text).map(block =>
    block.type === 'heading' ? block : { type: 'paragraph' as const, runs: block.runs, lead: false },
  );
}

/** Tag für den Check-in der Hotelsuche: nur wenn der Termin noch kommt. */
function futureCheckin(iso: string | undefined, today: string): string | null {
  const date = iso?.slice(0, 10) ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today ? date : null;
}

export interface AppBlogPostInput {
  post: FestivalPost;
  /** Buchbare Eventim-Termine zum Beitrag (`fetchTicketEvents`). */
  ticketEvents: TicketEvent[];
  /** Passende Events aus dem Kalender (`fetchRelatedEvents`). */
  relatedEvents: RelatedEvent[];
  /** Heutiger Tag (YYYY-MM-DD). */
  today: string;
}

export function toAppBlogPost({ post, ticketEvents, relatedEvents, today }: AppBlogPostInput, ctx: AppBlogContext): AppBlogPost {
  const blocks: AppBlogBlock[] = [];
  const facts = post.keyFacts;

  if (post.intro) blocks.push({ type: 'paragraph', runs: parseRuns(post.intro), lead: true });

  blocks.push({
    type: 'facts',
    title: 'Auf einen Blick',
    rows: [
      { label: 'Datum', value: facts.dates },
      { label: 'Ort', value: facts.location },
      { label: 'Genre', value: facts.genre },
      { label: 'Eintritt', value: facts.price },
      ...(facts.capacity ? [{ label: 'Kapazität', value: facts.capacity }] : []),
      ...(facts.since ? [{ label: 'Festival seit', value: facts.since }] : []),
    ].filter(row => row.value),
    ticket: post.ticketUrl
      ? { url: post.ticketUrl, label: 'Tickets sichern', note: 'Anzeige · Ticketkauf über Eventim' }
      : null,
    website: facts.website ? { url: facts.website, label: 'Offizielle Website' } : null,
  });

  if (ticketEvents.length > 0) {
    blocks.push({
      type: 'tickets',
      title: 'Tickets sichern',
      badge: 'Anzeige',
      items: ticketEvents.map(e => ({
        eventId: e.id,
        dateLabel: formatTicketDate(e.start_date),
        title: e.title,
        place: e.location_name,
        price: formatTicketPrice(e),
        url: e.ticket_url,
      })),
    });
  }

  if (post.history) blocks.push({ type: 'heading', text: post.historyTitle }, ...prose(post.history));

  if (post.funFacts && post.funFacts.length > 0) {
    blocks.push({ type: 'heading', text: 'Fun Facts' }, { type: 'list', style: 'cards', items: post.funFacts });
  }

  if (post.lineup && post.lineup.length > 0) {
    const custom = Boolean(post.lineupTitle);
    const head = post.lineup.filter(a => a.role === 'headliner');
    const rest = post.lineup.filter(a => a.role === 'support' || a.role === 'special');
    blocks.push(
      { type: 'heading', text: post.lineupTitle ?? `Lineup ${post.title}` },
      {
        type: 'lineup',
        note: post.lineupNote ?? null,
        groups: [
          { label: custom ? 'Highlights' : 'Headliner', acts: head.map(a => ({ name: a.name, day: a.day ?? null })) },
          { label: custom ? 'Weiteres Programm' : 'Weitere Acts', acts: rest.map(a => ({ name: a.name, day: null })) },
        ].filter(group => group.acts.length > 0),
      },
    );
  }

  for (const image of post.gallery) {
    blocks.push({ type: 'image', src: absoluteUrl(image.src, ctx.origin), alt: image.alt, caption: image.caption });
  }

  if (post.whatToExpect || post.whatToExpectList.length > 0) {
    blocks.push({ type: 'heading', text: post.whatToExpectTitle }, ...prose(post.whatToExpect));
    if (post.whatToExpectList.length > 0) blocks.push({ type: 'list', style: 'numbered', items: post.whatToExpectList });
  }

  if (post.stays && post.stays.length > 0) {
    blocks.push({
      type: 'stays',
      title: 'Die Unterkünfte im Überblick',
      badge: 'Anzeige',
      cta: 'Verfügbarkeit prüfen',
      note: AFFILIATE_NOTE,
      items: post.stays.map(stay => ({
        name: stay.name,
        kind: stay.kind,
        place: `${stay.place} · ${stay.region}`,
        description: stay.description,
        url: buildAffiliateStayLink({ ss: `${stay.name} ${stay.place}` }, `stay-article-${post.slug}`),
      })),
    });
  }

  if (post.practicalInfo.length > 0) {
    blocks.push(
      { type: 'heading', text: post.practicalInfoTitle },
      { type: 'info', rows: post.practicalInfo.map(info => ({ label: info.label, text: info.text })) },
    );
  }

  // Allgemeine Hotelsuche nur ohne kuratierte Unterkünfte, wie `BlogStayBox`.
  if (!post.stays || post.stays.length === 0) {
    const city =
      post.stayCity?.trim() ||
      deriveCityFromLocation(facts?.address) ||
      deriveCityFromLocation(post.jsonLdEvent?.location) ||
      deriveCityFromLocation(facts?.location);
    if (city) {
      const checkin = futureCheckin(post.jsonLdEvent?.startDate, today);
      blocks.push({
        type: 'stay',
        title: `Übernachten in ${city}`,
        badge: 'Anzeige',
        text: `Von auswärts dabei? Unterkünfte in ${city}${checkin ? ' rund um den Termin' : ''} findest du bei Booking.com.`,
        hint: checkin ? 'Stadt und Datum sind im Link schon vorausgefüllt.' : 'Die Stadt ist im Link schon vorausgefüllt.',
        cta: 'Unterkünfte ansehen',
        note: AFFILIATE_NOTE,
        url: buildAffiliateStayLink({ ss: city, checkin }, `blog-${post.slug}`),
      });
    }
  }

  if (post.faqs && post.faqs.length > 0) {
    blocks.push({ type: 'heading', text: 'Häufige Fragen' }, { type: 'faq', items: post.faqs });
  }

  if (relatedEvents.length > 0) {
    blocks.push({
      type: 'events',
      title: 'Passende Events und Termine',
      sub: 'Live aus unserem Kalender, täglich aktualisiert.',
      items: relatedEvents.map(e => ({
        id: e.id,
        dateLabel: formatRelatedDate(e.start_date),
        title: e.title,
        place: e.location_name,
        tickets: Boolean(e.ticket_url),
        price: formatRelatedPrice(e),
      })),
    });
  }

  blocks.push({
    type: 'cta',
    eyebrow: 'Mehr entdecken',
    title: 'Noch mehr Events in Österreich',
    label: post.ctaText,
    path: post.ctaLink,
  });

  return {
    version: APP_BLOG_VERSION,
    slug: post.slug,
    url: `${ctx.origin}/blog/${post.slug}`,
    title: post.title,
    subtitle: post.subtitle,
    category: post.category,
    readingLabel: `${post.readingTime} Min. Lesezeit`,
    meta: [facts.dates, facts.location].filter(Boolean).join(' · '),
    image: absoluteUrl(post.heroImage, ctx.origin),
    imageCredit: post.heroImageCredit ?? null,
    poster: post.heroLayout === 'poster',
    blocks,
  };
}
