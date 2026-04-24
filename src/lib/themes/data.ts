/**
 * Theme-hub configuration — one entry per /thema/[slug] page.
 *
 * Each theme bridges three layers:
 *
 *   - URL slug             →  `/thema/musik`
 *   - DB category (v3)     →  `events.category = 'Musik'`
 *   - Bundesland-slug (v3) →  `/wien/musik`, `/steiermark/musik`, …
 *
 * The slug MUST match the key used in `src/lib/landing-slugs.ts`
 * CATEGORY_SLUGS so that the cross-link "Musik in Wien" →
 * /wien/musik resolves on the existing bundesland landing-page shell.
 * If you add a new theme here, also add the slug there (and vice versa).
 *
 * The SEO copy (`title`, `description`, `heroText`, `bodyIntro`) is hand-
 * written per theme — generic boilerplate never ranks. Keep titles ≤60
 * chars (serp snippet limit) and descriptions ≤160 chars.
 *
 * Images point at the same Unsplash URLs used by the landing-page
 * `PopularCategories` tiles, so the visual language stays consistent
 * when a user clicks a tile → lands on /thema/… .
 */

export interface Theme {
  /** URL path segment under /thema/. Must match landing-slugs.ts. */
  slug: string;
  /** DB category string — matches `events.category` after taxonomy v3. */
  category: string;
  /** Display title (used in H1 + breadcrumb). */
  title: string;
  /** <title> tag — truncated/padded to a SERP-safe length. */
  seoTitle: string;
  /** <meta description> — 140-160 char sweet spot. */
  description: string;
  /** Subtitle under the H1; 1 sentence. */
  heroText: string;
  /** SEO body paragraph — shown above the event grid for context. */
  bodyIntro: string;
  /** Unsplash hero image URL (same as landing-tile for consistency). */
  image: string;
}

export const ALL_THEMES: Theme[] = [
  {
    slug: 'musik',
    category: 'Musik',
    title: 'Konzerte, Festivals & Live-Musik in Österreich',
    seoTitle: 'Konzerte & Festivals 2026 — Live-Musik in Österreich',
    description: 'Alle Konzerte, Festivals und Live-Musik-Events in Österreich auf einen Blick. Rock, Pop, Klassik, Elektronik — täglich aktualisiert für alle Bundesländer.',
    heroText: 'Von Festival-Wochenenden bis Wohnzimmer-Konzerten — die österreichische Musik-Agenda an einem Ort.',
    bodyIntro: 'Österreich hat eine dichte Musik-Szene: vom Frequency-Festival und Nova Rock über die Wiener Staatsoper bis zu Heurigen-Konzerten im Burgenland. LassTreffen.at aggregiert täglich aus offiziellen Ticket-Anbietern, Venue-Kalendern und regionalen Veranstaltungs-Portalen, damit du keine Show verpasst.',
    image: 'https://images.unsplash.com/photo-1711336622443-d53a1f1156bc?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'kultur',
    category: 'Kultur & Bühne',
    title: 'Kultur & Bühne — Theater, Kunst, Kabarett',
    seoTitle: 'Theater, Kabarett & Ausstellungen in Österreich',
    description: 'Theater-Premieren, Kabarett-Abende, Kunst-Ausstellungen und Bühnen-Events in ganz Österreich. Täglich aktualisierter Kultur-Kalender.',
    heroText: 'Bühne, Leinwand, Galerie — Kultur in Österreich, täglich aktualisiert.',
    bodyIntro: 'Von Wiener Burgtheater-Premieren und Grazer Kulturhauptstadt-Projekten bis zu Regional-Kabaretts in Bregenz: die österreichische Kultur-Landschaft ist dicht, regional und meistens ausverkauft. LassTreffen.at sammelt Theater, Lesungen, Vernissagen und Kleinkunst an einem Ort.',
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'nightlife',
    category: 'Nightlife & Party',
    title: 'Nightlife & Party — Clubs, DJ-Sets, After-Show',
    seoTitle: 'Clubs, Partys & DJ-Sets in Österreich',
    description: 'Club-Nächte, DJ-Sets, Open-Air-Raves und Partys in Wien, Graz, Innsbruck, Salzburg und dem Rest Österreichs. Immer aktuell.',
    heroText: 'Bis die Lichter angehen — und ein bisschen länger.',
    bodyIntro: 'Das österreichische Nightlife reicht vom Wiener Flex und Grazer Postgarage über Burgenlands Sommer-Open-Airs bis zu Innsbrucker Après-Ski-Clubs. Wir aggregieren Club-Line-ups, Festival-Closings und Pop-up-Events, damit du nicht erst am Weg zum nächsten Gig erfährst, dass da einer war.',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'kulinarik',
    category: 'Essen & Trinken',
    title: 'Essen & Trinken — Heurige, Weinfeste, Food-Events',
    seoTitle: 'Weinfeste, Heurige & Food-Events in Österreich',
    description: 'Heurige, Weinverkostungen, Street-Food-Märkte, Brauerei-Touren und kulinarische Wochenenden in allen Bundesländern.',
    heroText: 'Wein vom Winzer, Bier von der Brauerei, Food-Trucks am Marktplatz.',
    bodyIntro: 'Österreichs Kulinarik-Kalender ist dichter als sein Wein-Keller: Burgenländer Weinkost, steirischer Kürbisfest-Herbst, Wiener Naschmarkt-Events und Tiroler Brauerei-Touren. LassTreffen.at bündelt Genuss-Termine aus allen neun Bundesländern.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'maerkte',
    category: 'Märkte & Feste',
    title: 'Märkte & Feste — Flohmarkt, Dorffest, Adventmarkt',
    seoTitle: 'Märkte, Feste & Kirtage in Österreich',
    description: 'Flohmärkte, Bauernmärkte, Adventmärkte, Dorffeste und Kirtage — die österreichische Tradition-Agenda auf einen Blick.',
    heroText: 'Wo Österreich sich trifft — mit Punsch, Bier und Bratl.',
    bodyIntro: 'Von den Wiener Christkindlmärkten und dem Linzer Urfahraner Markt bis zu Dorfkirchtagen in entlegenen steirischen und burgenländischen Gemeinden: Märkte + Feste sind Österreichs dichtester Event-Typ. Wir scrapen offizielle Gemeinde- und Tourismus-Kalender, damit auch die kleinen Feste sichtbar werden.',
    image: 'https://images.unsplash.com/photo-1576181456177-2b99ac0aa1ef?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'sport',
    category: 'Sport & Bewegung',
    title: 'Sport & Bewegung — Läufe, Spiele, Turniere',
    seoTitle: 'Laufevents, Fußballspiele & Sport in Österreich',
    description: 'Volksläufe, Fußball-Heimspiele, Marathon, Skiweltcup und Amateur-Turniere in allen Bundesländern. Aktueller Sport-Kalender.',
    heroText: 'Startnummer abholen, Trikot anziehen, los.',
    bodyIntro: 'Von der Rapid-Heimpartie und dem Wings-for-Life-Run über die steirischen Skiweltcup-Rennen bis zu Amateur-Wettkämpfen: Österreichs Sport-Kalender lebt vom Mix aus Profi-Events und Vereinssport. LassTreffen.at aggregiert beides — von der Bundesliga bis zum Gemeinde-Dorflauf.',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'natur',
    category: 'Natur & Abenteuer',
    title: 'Natur & Abenteuer — Wandern, Klettern, Outdoor',
    seoTitle: 'Wanderungen, Outdoor-Events & Natur in Österreich',
    description: 'Geführte Wanderungen, Klettertouren, Radmarathons, Naturerlebnisse und Outdoor-Events in allen österreichischen Bundesländern.',
    heroText: 'Alpenblick, Neusiedler-See-Weite, Donau-Auen — draußen passiert was.',
    bodyIntro: 'Österreichs Natur-Kalender reicht von den Hohen Tauern und dem Großglockner-Trail über die Wachau-Radwege bis zum Nationalpark Neusiedlersee. LassTreffen.at listet geführte Touren, Naturpark-Events und Outdoor-Workshops aus allen neun Bundesländern — inklusive der kleinen Vereins-Wanderungen.',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'bildung',
    category: 'Wissen & Karriere',
    title: 'Wissen & Karriere — Vorträge, Workshops, Messen',
    seoTitle: 'Vorträge, Workshops & Karriere-Events Österreich',
    description: 'Vorträge, Weiterbildungs-Workshops, Karrieremessen, Startup-Events und Hochschul-Termine in ganz Österreich.',
    heroText: 'Vom Lehrgang zum Kongress zur Messe — Inputs fürs Hirn.',
    bodyIntro: 'Österreichs Wissens-Landschaft ist von der Universität Wien und der TU Graz bis zu FH-Regionalstandorten und privaten Weiterbildungs-Anbietern breit gestreut. LassTreffen.at aggregiert Vortragsreihen, Karrieremessen, Startup-Meetups und Hochschul-Events — inklusive der öffentlich zugänglichen Termine aller AT-Unis und FHs.',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'familie',
    category: 'Familie & Kinder',
    title: 'Familie & Kinder — Events mit und für Kids',
    seoTitle: 'Familien- & Kinderveranstaltungen in Österreich',
    description: 'Kindertheater, Familienfeste, Ferien-Workshops, Kletterparks und Wochenend-Aktivitäten für Familien in allen Bundesländern.',
    heroText: 'Für Kinder die was erleben wollen und Eltern die was planen müssen.',
    bodyIntro: 'Von der Wiener Musikverein-Kinderreihe über Schönbrunner Kindertheater bis zu Burgen-Rittertagen und bäuerlichen Erlebnis-Bauernhöfen im Salzkammergut: LassTreffen.at sammelt Familien-Events aus allen Bundesländern — täglich aktualisiert aus offiziellen Quellen, sodass auch spontane Wochenend-Planung klappt.',
    image: 'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'community',
    category: 'Community & Freizeit',
    title: 'Community & Freizeit — Meetups, Vereine, Stammtische',
    seoTitle: 'Meetups, Stammtische & Community-Events Österreich',
    description: 'Sprach-Stammtische, Meetups, Vereinsabende, Freizeit-Clubs und Community-Events in Wien, Graz, Linz, Salzburg und ganz Österreich.',
    heroText: 'Neue Leute treffen, alte Hobbies ausleben.',
    bodyIntro: 'Österreichs Community-Szene wächst: vom Wiener Sprachcafé über Grazer Brettspiel-Meetups bis zu Linzer Startup-Stammtischen. LassTreffen.at zieht Meetup-, Eventbrite- und Vereins-Feeds zusammen, damit du dich nicht durch zehn Apps klicken musst um rauszukriegen wann das nächste Community-Event in deiner Nähe stattfindet.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=75&auto=format&fit=crop',
  },
  {
    slug: 'wellness',
    category: 'Wellness & Spiritualität',
    title: 'Wellness & Spiritualität — Yoga, Meditation, Retreats',
    seoTitle: 'Yoga, Meditation & Retreats in Österreich',
    description: 'Yoga-Retreats, Meditations-Sessions, Thermen-Events, Wellness-Wochenenden und spirituelle Veranstaltungen in ganz Österreich.',
    heroText: 'Atem holen, zur Ruhe kommen, nachspüren.',
    bodyIntro: 'Österreichs Thermen, Yoga-Studios, Meditations-Zentren und spirituelle Retreats ergeben zusammen einen eigenen Event-Kanon. LassTreffen.at aggregiert Thermen-Wochenend-Events, Yoga-Workshops, Achtsamkeits-Retreats und Kirchen-Veranstaltungen aus allen neun Bundesländern.',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=75&auto=format&fit=crop',
  },
];

/** Fast slug → Theme lookup for page.tsx. */
const BY_SLUG = new Map<string, Theme>(ALL_THEMES.map(t => [t.slug, t]));

export function getThemeBySlug(slug: string): Theme | null {
  return BY_SLUG.get(slug) ?? null;
}
