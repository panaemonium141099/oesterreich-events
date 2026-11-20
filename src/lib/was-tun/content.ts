/**
 * Inhalt der Seiten „Was kann man in X machen?" (/was-tun/[slug]): Titel,
 * Antworttext, FAQ und strukturierte Daten. Alles pur, damit jede Regel
 * ohne Seiten-Render testbar ist.
 *
 * Die Seite gibt es nur auf Deutsch (/en kanonisiert auf die deutsche URL),
 * die Texte stehen deshalb hier und nicht in messages/.
 *
 * Alle Aussagen kommen aus den geladenen Daten: Namen und Termine werden
 * gelesen, nie formuliert. Zahlen sind der gezählte Gesamtbestand des Orts
 * (`WasTunTotals`), nicht die Länge der ersten Seite.
 */

import { buildEventUrlV2, type EventForUrl } from '@/lib/utils/slugify';
import { buildFAQPageSchema, type FAQEntry } from '@/lib/seo/faq';
import { activityCanonicalUrl } from '@/lib/activities/indexability';
import { getSite } from '@/lib/site';
import { DE_LOCALE } from '@/lib/site/intl';
import { WAS_TUN_BASE, type WasTunPlace } from './places';
import type { WasTunTheme } from './themes';

export interface WasTunEvent extends EventForUrl {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  category: string | null;
  image_url: string | null;
  event_score: number | null;
}

export interface WasTunActivity {
  id: string;
  slug: string;
  name: string;
  tags: string[] | null;
  town: string | null;
  price_hint: string | null;
  /** Roh-jsonb, nur über ActivityCardImage lesen. */
  images: unknown;
}

/** Gezählter Gesamtbestand des Orts. */
export interface WasTunTotals {
  events: number;
  activities: number;
}

/** Unter so vielen Einträgen ist die Seite zu dünn für den Index. */
export const WAS_TUN_MIN_ITEMS = 3;

export function wasTunIsIndexable(totals: WasTunTotals): boolean {
  return totals.events + totals.activities >= WAS_TUN_MIN_ITEMS;
}

// ───────────────────────────────────────────────────────────────────────
// Texte
// ───────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Zahl mit Tausenderpunkt: „8.542". Von Hand, weil die österreichische
 * Locale ein schmales Leerzeichen setzt („8 542") und die Seite überall
 * sonst den Punkt zeigt.
 */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Erste `limit` verschiedene Namen (Serien und doppelt gelieferte Ziele nur einmal). */
export function distinctNames(names: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** Tag und Monat in Wiener Zeit: „22.11." */
export function viennaDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(DE_LOCALE, {
    timeZone: 'Europe/Vienna',
    day: 'numeric',
    month: 'numeric',
  }).format(d);
}

/** Ortsangabe samt Thema: „in Lofer bei Regen". */
function whereOf(place: WasTunPlace, theme: WasTunTheme | null): string {
  return theme ? `${place.where} ${theme.phrase}` : place.where;
}

export function wasTunQuestion(place: WasTunPlace, theme: WasTunTheme | null = null): string {
  return `Was kann man ${whereOf(place, theme)} machen?`;
}

function countParts(totals: WasTunTotals): string[] {
  const parts: string[] = [];
  if (totals.events > 0) parts.push(`${formatCount(totals.events)} Veranstaltungen`);
  if (totals.activities > 0) parts.push(`${formatCount(totals.activities)} Ausflugsziele und Freizeitaktivitäten`);
  return parts;
}

const TITLE_MAX = 60;

export function buildWasTunMeta(
  place: WasTunPlace,
  totals: WasTunTotals,
  theme: WasTunTheme | null = null,
): { title: string; description: string } {
  const question = wasTunQuestion(place, theme);
  const long = `${question} Events & Ausflugsziele`;
  const title = long.length <= TITLE_MAX ? long : question;

  const brand = getSite().brand;
  const parts = countParts(totals);
  const description = parts.length > 0
    ? `${capitalize(whereOf(place, theme))}: ${parts.join(' und ')} auf einen Blick. Mit Terminen, Karte und Infos auf ${brand}.`
    : `Veranstaltungen, Ausflugsziele und Freizeitaktivitäten ${whereOf(place, theme)} auf ${brand}.`;
  return { title, description };
}

/** Das Gebiet, das die Seite abdeckt, als ganzer Satz; null beim Bundesland. */
export function scopeSentence(place: WasTunPlace): string | null {
  if (!place.center) return null;
  const around = place.kind === 'region' && place.anchorName ? place.anchorName : place.name;
  return `Die Seite deckt den Umkreis von rund ${place.center.radiusKm} km um ${around} ab.`;
}

/**
 * Die Antwort auf die Frage der Seite, aus den Daten gebaut. Steht als
 * Einleitung unter der Überschrift und als erste FAQ-Antwort.
 */
export function buildAnswer(
  place: WasTunPlace,
  totals: WasTunTotals,
  activities: WasTunActivity[],
  theme: WasTunTheme | null = null,
): string {
  const where = capitalize(place.where);
  const parts = countParts(totals);
  if (parts.length === 0) {
    return theme
      ? `${where} ist ${theme.phrase} aktuell nichts eingetragen. ${theme.note}`
      : `${where} sind aktuell keine Veranstaltungen und Ausflugsziele eingetragen.`;
  }
  let text = theme
    ? `${where} gibt es ${theme.phrase} ${parts.join(' und ')}. ${theme.note}`
    : `${where} findest du aktuell ${parts.join(' und ')}.`;
  const top = distinctNames(activities.map((a) => a.name), 3);
  if (top.length > 0) text += ` Zu den Ausflugszielen gehören ${joinNames(top)}.`;
  return text;
}

/**
 * @param events     erste Seite der Events (nächster Termin zuerst)
 * @param activities erste Seite der Aktivitäten
 */
export function buildWasTunFaq(
  place: WasTunPlace,
  totals: WasTunTotals,
  events: WasTunEvent[],
  activities: WasTunActivity[],
  theme: WasTunTheme | null = null,
): FAQEntry[] {
  if (totals.events === 0 && totals.activities === 0) return [];
  const where = whereOf(place, theme);
  const entries: FAQEntry[] = [
    { question: wasTunQuestion(place, theme), answer: buildAnswer(place, totals, activities, theme) },
  ];

  // Je Titel der nächste Termin: eine tägliche Serie füllt nicht alle drei Plätze.
  const byDate = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const nextTitles = distinctNames(byDate.map((e) => e.title), 3);
  if (nextTitles.length > 0) {
    const list = nextTitles.map((title) => {
      const e = byDate.find((x) => x.title.trim().toLowerCase() === title.toLowerCase())!;
      const day = viennaDayMonth(e.start_date);
      return day ? `${title} (${day})` : title;
    });
    entries.push({
      question: theme ? `Welche Veranstaltungen gibt es ${where}?` : `Welche Veranstaltungen gibt es demnächst ${where}?`,
      answer: `Die nächsten Termine: ${joinNames(list)}. Alle weiteren Veranstaltungen stehen in der Liste auf dieser Seite.`,
    });
  }

  const names = distinctNames(activities.map((a) => a.name), 5);
  if (names.length > 0) {
    entries.push({
      question: `Welche Ausflugsziele gibt es ${where}?`,
      answer: `Zu den Ausflugszielen und Freizeitaktivitäten ${where} gehören ${joinNames(names)}.`,
    });
  }
  return entries;
}

// ───────────────────────────────────────────────────────────────────────
// Strukturierte Daten
// ───────────────────────────────────────────────────────────────────────

const ITEM_LIST_LIMIT = 10;

export function wasTunCanonicalUrl(slug: string, theme: WasTunTheme | null = null): string {
  return `${getSite().url}${WAS_TUN_BASE}/${slug}${theme ? `/${theme.slug}` : ''}`;
}

export function buildWasTunJsonLd(
  place: WasTunPlace,
  totals: WasTunTotals,
  events: WasTunEvent[],
  activities: WasTunActivity[],
  theme: WasTunTheme | null = null,
): string {
  const site = getSite().url;
  const url = wasTunCanonicalUrl(place.slug, theme);
  const where = whereOf(place, theme);

  const crumbs = [
    { name: 'Home', item: site },
    { name: 'Was tun', item: `${site}${WAS_TUN_BASE}` },
    ...(place.kind === 'bundesland'
      ? []
      : [{ name: place.bundeslandName, item: `${site}${WAS_TUN_BASE}/${place.bundeslandId}` }]),
    { name: place.name, item: wasTunCanonicalUrl(place.slug) },
    ...(theme ? [{ name: theme.label, item: url }] : []),
  ];

  const graph: unknown[] = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumbs`,
      itemListElement: crumbs.map((c, idx) => ({ '@type': 'ListItem', position: idx + 1, ...c })),
    },
  ];

  // Je Art eine Liste; numberOfItems ist der Gesamtbestand, nicht die Auswahl.
  const eventItems = events.slice(0, ITEM_LIST_LIMIT);
  if (eventItems.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#events`,
      name: `Veranstaltungen ${where}`,
      numberOfItems: totals.events,
      itemListElement: eventItems.map((e, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: `${site}${buildEventUrlV2(e)}`, name: e.title,
      })),
    });
  }
  const activityItems = activities.slice(0, ITEM_LIST_LIMIT);
  if (activityItems.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#activities`,
      name: `Ausflugsziele und Freizeitaktivitäten ${where}`,
      numberOfItems: totals.activities,
      itemListElement: activityItems.map((a, idx) => ({
        '@type': 'ListItem', position: idx + 1, url: activityCanonicalUrl(a.slug), name: a.name,
      })),
    });
  }

  // Erst ab drei Fragen (Regel von buildFAQPageSchema).
  const faqPage = buildFAQPageSchema(buildWasTunFaq(place, totals, events, activities, theme));
  if (faqPage) graph.push(faqPage);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/<\/script>/gi, '<\\/script>');
}
