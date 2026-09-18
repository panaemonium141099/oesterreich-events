/**
 * Feratel Deskline: strukturierte Event-Merkmale -> Taxonomie.
 *
 * Die Deskline-WebAPI liefert pro Event einen kuratierten Kriterienbaum
 * (`criteria{groupName,items{name}}`, gepflegt von den Tourismusverbaenden),
 * Urlaubsthemen (`holidayThemes`), Start-/Dauer-Angaben
 * (`startTimeDurations`) und Bild-Metadaten. Bis 2026-09 wurden davon nur
 * `mainCriteria` und `eventGroups` als lose Tags durchgereicht; 52 % der
 * Feratel-Events landeten in "Sonstiges" und kein Event hatte eine Endzeit.
 *
 * Alles hier ist pur (keine I/O) und wird von FeratelScraper.parseEvent
 * benutzt. Vokabular-Stand: Stichprobe 10.675 Events aus 128 Regionen,
 * 2026-09-18 (scratch: deskline_events/vocab.json).
 */

import type { Category } from '@/types/events';
import { PRIORITY_ORDER } from '@/lib/category-classifier/taxonomy';

/** Kriterium (Item-Name, getrimmt) -> Hauptkategorie + kanonische Tags. */
interface CriterionMap {
  category: Category;
  tags?: string[];
}

const C = (category: Category, tags?: string[]): CriterionMap => ({ category, tags });

/**
 * Item-Namen des Deskline-Kriterienbaums. Nur Eintraege, die eindeutig
 * einer Hauptkategorie zuzuordnen sind; Sammelbegriffe wie "Diverse
 * Veranstaltungen/Feste", "Vergnügungsveranstaltung", "Open air" oder
 * "Besichtigung / Führung" bleiben absichtlich draussen (die entscheidet
 * der Text-Klassifizierer).
 */
const CRITERIA: Record<string, CriterionMap> = {
  // ── Musik ────────────────────────────────────────────────────────────
  'Musikveranstaltung / Konzerte': C('Musik', ['live-konzert']),
  'Musikveranstaltung': C('Musik', ['live-konzert']),
  'Diverse Musikveranstaltungen': C('Musik'),
  'Konzert': C('Musik', ['live-konzert']),
  'Volksmusik': C('Musik', ['volksmusik']),
  'Blasmusik': C('Musik', ['blasmusik']),
  'Klassik': C('Musik', ['klassik']),
  'Kammermusik': C('Musik', ['kammermusik']),
  'Blues / Jazz / Gospel': C('Musik', ['jazz']),
  'Rock / Pop': C('Musik', ['rock', 'pop']),
  'Chanson / Schlager': C('Musik', ['schlager']),
  'Folk / Country': C('Musik', ['folk', 'country']),
  'Zeitgenössische Musik': C('Musik'),
  'Kirchenmusik': C('Musik'),
  'Chor / Chorkonzert': C('Musik', ['chor']),
  'Ethnomusik': C('Musik', ['weltmusik']),
  'Advent-Konzert': C('Musik', ['live-konzert']),
  'Dinner Konzerte': C('Musik', ['live-konzert', 'dinner']),
  'Musical': C('Kultur & Bühne', ['musical']),
  'Oper / Operette': C('Kultur & Bühne', ['oper']),
  'Disco': C('Nightlife & Party', ['club-night']),
  // ── Kultur & Bühne ───────────────────────────────────────────────────
  'Diverse Ausstellungen': C('Kultur & Bühne', ['ausstellung']),
  'Ausstellung': C('Kultur & Bühne', ['ausstellung']),
  'Kunst': C('Kultur & Bühne', ['ausstellung']),
  'Kulturen / Geschichte': C('Kultur & Bühne', ['ausstellung']),
  'Kunsthandwerk': C('Kultur & Bühne', ['ausstellung', 'kunsthandwerk']),
  'Vernissage': C('Kultur & Bühne', ['ausstellung']),
  'Plastik / Skulpturen': C('Kultur & Bühne', ['ausstellung']),
  'Graphik / Design': C('Kultur & Bühne', ['ausstellung']),
  'Photo / Videokunst': C('Kultur & Bühne', ['ausstellung']),
  'Volkskunde': C('Kultur & Bühne', ['ausstellung']),
  'Technik / Verkehr': C('Kultur & Bühne', ['ausstellung']),
  'Architektur': C('Kultur & Bühne', ['ausstellung']),
  'Schmuck': C('Kultur & Bühne', ['ausstellung']),
  'Modenschau': C('Kultur & Bühne'),
  'Natur - Tiere/Pflanzen': C('Kultur & Bühne', ['ausstellung']),
  'Kunst-/Kulturvermittlung': C('Kultur & Bühne', ['museumstour']),
  'Führungen': C('Kultur & Bühne', ['museumstour']),
  'Altstadtführung': C('Kultur & Bühne', ['stadtführung']),
  'Stadtführung': C('Kultur & Bühne', ['stadtführung']),
  'Kabarett / Satire': C('Kultur & Bühne', ['kabarett']),
  'Lesungen / Vorträge': C('Kultur & Bühne', ['lesung']),
  'Autorenlesung / Vortrag': C('Kultur & Bühne', ['lesung']),
  'Lesung': C('Kultur & Bühne', ['lesung']),
  'Buchpräsentation': C('Kultur & Bühne', ['lesung']),
  'Sprechtheater / Schauspiel': C('Kultur & Bühne', ['theater']),
  'Theatervorstellung': C('Kultur & Bühne', ['theater']),
  'Volkstheater': C('Kultur & Bühne', ['theater']),
  'Musiktheater': C('Kultur & Bühne', ['theater']),
  'Theater': C('Kultur & Bühne', ['theater']),
  'Ballett / Tanztheater': C('Kultur & Bühne', ['theater']),
  'Performance': C('Kultur & Bühne', ['performance-art']),
  'Zirkus': C('Kultur & Bühne'),
  'Show': C('Kultur & Bühne'),
  'Kino': C('Kultur & Bühne', ['kino']),
  'Film- / Video- / Diashow': C('Kultur & Bühne', ['film']),
  'Marionetten / Puppentheater': C('Familie & Kinder', ['puppentheater']),
  'Krimifest': C('Kultur & Bühne'),
  'Darstellende Kunst': C('Kultur & Bühne'),
  // ── Märkte & Feste ───────────────────────────────────────────────────
  'Advent / Christkindl- / Weihnachtsmärkte': C('Märkte & Feste', ['adventmarkt']),
  'Advent-Veranstaltung': C('Märkte & Feste'),
  'Weihnachten / Advent': C('Märkte & Feste'),
  'Markt / Markttage': C('Märkte & Feste', ['wochenmarkt']),
  'Bauernmarkt': C('Märkte & Feste', ['bauernmarkt']),
  'Flohmarkt': C('Märkte & Feste', ['flohmarkt']),
  'Straßenmarkt': C('Märkte & Feste'),
  'Jahrmarkt / Kirchtag / Kirtag': C('Märkte & Feste', ['kirtag']),
  'Brauchtumsveranstaltung': C('Märkte & Feste', ['tracht']),
  'Heimat- / Brauchtumsabend': C('Märkte & Feste'),
  'Krampus/Perchtenläufe': C('Märkte & Feste', ['perchtenlauf', 'krampuslauf']),
  'Fasching': C('Märkte & Feste', ['fasching']),
  'Brauchtum zu Ostern': C('Märkte & Feste'),
  'Diverse Veranstaltungen zu Ostern': C('Märkte & Feste'),
  'Almabtrieb': C('Märkte & Feste', ['almabtrieb']),
  'Volksfest': C('Märkte & Feste', ['dorffest']),
  'Stadtfest / Dorffest': C('Märkte & Feste', ['dorffest']),
  'Vereinsfest': C('Märkte & Feste'),
  'Almfest': C('Märkte & Feste'),
  'Bauernherbstfest': C('Märkte & Feste', ['erntedank']),
  'Umzug': C('Märkte & Feste'),
  'Schneefest': C('Märkte & Feste'),
  'Silvester / Neujahr': C('Märkte & Feste', ['silvester-party']),
  'Silvester': C('Märkte & Feste', ['silvester-party']),
  'Ball': C('Märkte & Feste', ['ball']),
  // ── Essen & Trinken ──────────────────────────────────────────────────
  'Kulinarisches Fest': C('Essen & Trinken'),
  'Weinfest': C('Essen & Trinken', ['weinfest']),
  'Sonstige Weinveranstaltung': C('Essen & Trinken'),
  'Kulinarische Angebote': C('Essen & Trinken'),
  'Kulinarische Veranstaltungen': C('Essen & Trinken'),
  'Kulinarik Veranstaltung Bauernherbst': C('Essen & Trinken'),
  'Regionale Kulinarik': C('Essen & Trinken'),
  'Weinproben': C('Essen & Trinken', ['weinverkostung']),
  'Weinprobe': C('Essen & Trinken', ['weinverkostung']),
  'Weinverkostung': C('Essen & Trinken', ['weinverkostung']),
  'Weinführung': C('Essen & Trinken', ['weinverkostung']),
  'Neuer Wein': C('Essen & Trinken', ['heuriger']),
  'Zwiebelkuchen': C('Essen & Trinken'),
  'Slow Food': C('Essen & Trinken'),
  'Kultur & Kulinarik': C('Essen & Trinken'),
  // ── Sport & Bewegung ─────────────────────────────────────────────────
  'Diverse Sportarten': C('Sport & Bewegung'),
  'Wintersport': C('Sport & Bewegung', ['ski']),
  'Skifahren': C('Sport & Bewegung', ['ski']),
  'Snowboarden': C('Sport & Bewegung', ['snowboard']),
  'Langlaufen': C('Sport & Bewegung', ['langlauf']),
  'Rodeln': C('Sport & Bewegung'),
  'Eissport': C('Sport & Bewegung', ['eishockey']),
  'Radsport': C('Sport & Bewegung', ['radfahren']),
  'Bike': C('Sport & Bewegung', ['mountainbike']),
  'Laufsport': C('Sport & Bewegung', ['laufen']),
  'Nordic walking': C('Sport & Bewegung', ['laufen']),
  'Sommersport': C('Sport & Bewegung'),
  'Bergsport': C('Natur & Abenteuer', ['bergtour']),
  'Sportkurse': C('Sport & Bewegung', ['kurs']),
  'Wassersport': C('Sport & Bewegung', ['wassersport']),
  'Wildwassersport': C('Natur & Abenteuer', ['rafting']),
  'Schießsport': C('Sport & Bewegung'),
  'Fußball / Rugby': C('Sport & Bewegung', ['fussball']),
  'Klettern': C('Sport & Bewegung', ['klettern']),
  'Golf / Minigolf': C('Sport & Bewegung'),
  'Pferdesport / Hundesport': C('Sport & Bewegung', ['reiten']),
  'Tennis / Squash / Badminton': C('Sport & Bewegung', ['tennis']),
  'Asiatische Sportarten': C('Sport & Bewegung'),
  'Motorsport': C('Sport & Bewegung'),
  'Flugsport': C('Sport & Bewegung'),
  'Tanzsport': C('Sport & Bewegung', ['tanzkurs']),
  'Schneeschuhwandern': C('Natur & Abenteuer', ['wandern']),
  'Yoga': C('Sport & Bewegung', ['yoga']),
  // ── Natur & Abenteuer ────────────────────────────────────────────────
  'Wandern': C('Natur & Abenteuer', ['wandern']),
  'Wanderung / Bergtour': C('Natur & Abenteuer', ['wandern', 'bergtour']),
  'Diverse Ausflüge/Exkursionen': C('Natur & Abenteuer'),
  'Ausflug': C('Natur & Abenteuer'),
  'Fahrradtour': C('Natur & Abenteuer', ['radfahren']),
  'Rundfahrten': C('Natur & Abenteuer'),
  'Nostalgiefahrten': C('Natur & Abenteuer'),
  'Schiffs- / Bootstouren': C('Natur & Abenteuer', ['segel-tour']),
  'Nationalpark Exkursion': C('Natur & Abenteuer', ['naturführung']),
  // ── Familie & Kinder ─────────────────────────────────────────────────
  'Kinder- & Familienveranstaltungen': C('Familie & Kinder'),
  'Kinder- / Familienfest': C('Familie & Kinder', ['kinderfest']),
  'Kinderfest': C('Familie & Kinder', ['kinderfest']),
  'Kinderfasching': C('Familie & Kinder', ['fasching']),
  'Führungen für Kinder': C('Familie & Kinder'),
  'Kinderanimation': C('Familie & Kinder', ['ferienprogramm']),
  'Exkursion/Ausflug für Kinder': C('Familie & Kinder'),
  'Kinder- und Jugendkurse': C('Familie & Kinder', ['kinder-workshop']),
  // ── Wissen & Karriere ────────────────────────────────────────────────
  'Diverse Kurse/Seminare/Workshops': C('Wissen & Karriere', ['workshop']),
  'Bastel- und Malkurse': C('Wissen & Karriere', ['workshop']),
  'Handarbeitskurse': C('Wissen & Karriere', ['workshop']),
  'Seniorenkurse': C('Wissen & Karriere', ['kurs']),
  'Workshop/Kurs': C('Wissen & Karriere', ['workshop']),
  'Seminar': C('Wissen & Karriere', ['seminar']),
  'Vortrag': C('Wissen & Karriere', ['vortrag']),
  'Vorträge': C('Wissen & Karriere', ['vortrag']),
  'Diverse Messen': C('Wissen & Karriere', ['messe']),
  'Kongress': C('Wissen & Karriere', ['konferenz']),
  'Gesundheit / Fitness': C('Wissen & Karriere', ['gesundheitsmesse']),
  // ── Wellness & Spiritualität ─────────────────────────────────────────
  'Wellness / Entspannung': C('Wellness & Spiritualität', ['wellness-day']),
  'Medizinische Beratung': C('Wellness & Spiritualität'),
  'Ernährungsberatung': C('Wellness & Spiritualität'),
  'Diverse Analysen': C('Wellness & Spiritualität'),
  'Messe / Gottesdienst': C('Wellness & Spiritualität', ['gottesdienst']),
  'Festgottesdienste': C('Wellness & Spiritualität', ['gottesdienst']),
  'Relig. Veranstaltung/Gottesdienst': C('Wellness & Spiritualität', ['gottesdienst']),
  'Prozessionen': C('Wellness & Spiritualität', ['prozession']),
  'Bergmessen': C('Wellness & Spiritualität', ['gottesdienst']),
  'Patrozinium': C('Wellness & Spiritualität', ['gottesdienst']),
  'Wallfahrten': C('Wellness & Spiritualität', ['wallfahrt']),
  // ── Nightlife & Party ────────────────────────────────────────────────
  'Clubbing / Party': C('Nightlife & Party', ['club-night']),
  // ── Community & Freizeit ─────────────────────────────────────────────
  'Benefizveranstaltungen': C('Community & Freizeit'),
};

/** Gruppen-Namen als Rueckfall, wenn kein Item gemappt ist. */
const GROUPS: Record<string, Category> = {
  'Musik': 'Musik',
  'Ausstellungen': 'Kultur & Bühne',
  'Theater / Show / Tanz / Film / Kleinkunst': 'Kultur & Bühne',
  'Literatur': 'Kultur & Bühne',
  'Film/Medienkunst': 'Kultur & Bühne',
  'Kunst & Kultur Veranstaltungen': 'Kultur & Bühne',
  'Volkskultur / Brauchtum / Märkte': 'Märkte & Feste',
  'Kulinarik & Wein': 'Essen & Trinken',
  'Wein und Kulinarik': 'Essen & Trinken',
  'Sport': 'Sport & Bewegung',
  'Kurse / Seminare': 'Wissen & Karriere',
  'Messen': 'Wissen & Karriere',
  'Kongresse': 'Wissen & Karriere',
  'Religiöse Veranstaltungen': 'Wellness & Spiritualität',
  'Gesundheit & Wellness': 'Wellness & Spiritualität',
  'Kinder-/Jugendkultur': 'Familie & Kinder',
};

export interface FeratelCriterion {
  groupName: string | null;
  items: string[];
}

export interface FeratelCategoryResult {
  /** Beste Hauptkategorie (null, wenn kein Kriterium gemappt ist). */
  category: Category | null;
  /** true = genau eine Hauptkategorie belegt -> darf gesperrt werden. */
  unambiguous: boolean;
  /** Alle belegten Hauptkategorien in Prioritaetsreihenfolge. */
  categories: Category[];
  /** Kanonische Tags (TAGS-Vokabular) aus den Kriterien, dedupliziert. */
  tags: string[];
}

function norm(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function byPriority(a: Category, b: Category): number {
  const ia = PRIORITY_ORDER.indexOf(a);
  const ib = PRIORITY_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
}

/**
 * Hauptkategorie aus dem Kriterienbaum: Item-Zuordnung zuerst, sonst die
 * Gruppe. Genau eine belegte Kategorie gilt als eindeutig (Sperre im
 * Schreibpfad); bei mehreren entscheidet PRIORITY_ORDER nur die Vorgabe,
 * der Text-Klassifizierer behaelt das letzte Wort.
 */
export function feratelCategoryFromCriteria(criteria: FeratelCriterion[], mainCriteria?: string | null): FeratelCategoryResult {
  const hits = new Set<Category>();
  const tags: string[] = [];
  const consider = (name: string | null | undefined, group: string | null | undefined) => {
    const item = CRITERIA[norm(name)];
    if (item) {
      hits.add(item.category);
      for (const t of item.tags ?? []) if (!tags.includes(t)) tags.push(t);
      return;
    }
    const g = GROUPS[norm(group)];
    if (g) hits.add(g);
  };
  for (const c of criteria) {
    if (c.items.length === 0) consider(null, c.groupName);
    for (const item of c.items) consider(item, c.groupName);
  }
  if (mainCriteria) consider(mainCriteria, null);
  const categories = [...hits].sort(byPriority);
  return {
    category: categories[0] ?? null,
    unambiguous: categories.length === 1,
    categories,
    tags,
  };
}

export interface FeratelFacetInput {
  holidayThemes: string[];
  criteria: FeratelCriterion[];
  isTopEvent?: boolean | null;
  onlineBookable?: boolean | null;
  guestCards?: string[];
  /** Detail-Seite: handicapClassifications/-Facilities gesetzt. */
  handicap?: boolean;
}

export interface FeratelFacets {
  audience: string[];
  setting: string[];
  occasion_tags: string[];
  price_flags: string[];
  language: 'deutsch' | 'englisch' | 'mehrsprachig' | null;
  is_family_friendly: boolean | null;
  /** Lose Herkunfts-Tags fuer source_tags_raw (Top-Event, Gaestekarten ...). */
  rawTags: string[];
}

const FAMILY_ITEMS = new Set([
  'Kinder- & Familienveranstaltungen', 'Kinder- / Familienfest', 'Führungen für Kinder', 'Kinderanimation',
  'Exkursion/Ausflug für Kinder', 'Programm für Kinder', 'Kinderfest', 'Kinderfasching', 'Kinder- und Jugendkurse',
  'Marionetten / Puppentheater',
]);

/**
 * Urlaubsthemen und Eignungs-Kriterien -> Zielgruppe, Setting, Anlass,
 * Preis-Flags (Vokabular aus enrichment-taxonomy.ts). Nur Werte, die die
 * Quelle ausdruecklich setzt; nichts wird aus dem Text geraten.
 */
export function feratelFacets(input: FeratelFacetInput): FeratelFacets {
  const themes = new Set(input.holidayThemes.map(norm));
  const items = new Set<string>();
  const groups = new Set<string>();
  for (const c of input.criteria) {
    groups.add(norm(c.groupName));
    for (const i of c.items) items.add(norm(i));
  }
  const has = (...names: string[]) => names.some((n) => themes.has(n) || items.has(n));

  const audience: string[] = [];
  const family = has('Familie', 'Kinder') || groups.has('Familie') || groups.has('Kinder-/Jugendkultur') || [...items].some((i) => FAMILY_ITEMS.has(i));
  if (family) audience.push('familien-mit-kindern');
  if (has('SeniorInnen', 'Senioren', 'Seniorenkurse')) audience.push('senioren');
  if (has('Studierende', 'Studenten')) audience.push('studenten');
  if (has('Gruppen')) audience.push('fuer-gruppen');
  if (has('VA Englisch')) audience.push('erasmus-freundlich');

  const setting: string[] = [];
  if (has('Indoor')) setting.push('indoor');
  if (has('Outdoor')) setting.push('outdoor');
  if (has('Open air')) setting.push('open-air');

  const occasion_tags: string[] = [];
  if (has('Schlechtwetter Tipp')) {
    occasion_tags.push('regentag');
    if (!setting.includes('indoor')) setting.push('indoor');
  }
  if (has('Weekend')) occasion_tags.push('wochenendplan');

  const price_flags: string[] = [];
  if (has('Barrierefrei') || input.handicap) price_flags.push('barrierefrei');
  if (has('Kostenloser Eintritt')) price_flags.push('freier-eintritt');

  const de = has('VA Deutsch');
  const en = has('VA Englisch');
  const language = de && en ? 'mehrsprachig' : en ? 'englisch' : de ? 'deutsch' : null;

  const rawTags: string[] = [];
  if (input.isTopEvent) rawTags.push('Top-Event');
  if (input.onlineBookable) rawTags.push('Online buchbar');
  if (has('Gratis mit Gästekarte')) rawTags.push('Gratis mit Gästekarte');
  if (has('öffentlich erreichbar', 'Anreise mit Öffis')) rawTags.push('Öffentlich erreichbar');
  for (const card of input.guestCards ?? []) {
    const c = norm(card);
    if (c) rawTags.push(`Gästekarte: ${c}`);
  }

  return {
    audience,
    setting,
    occasion_tags,
    price_flags,
    language,
    is_family_friendly: family ? true : null,
    rawTags,
  };
}

/**
 * Dauer-Angabe der Deskline-Startzeiten: Werte bis 24 sind Stunden
 * ("Platzkonzert 2", "Huskytour 5"), groessere Werte Minuten ("Bauernhof-
 * erlebnis 90", "Bauernmarkt 420"); 0 = keine Angabe (55 % der Events).
 */
export function feratelDurationMinutes(duration: number | null | undefined): number | null {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return null;
  const minutes = duration <= 24 ? duration * 60 : duration;
  // Mehrtaegige Angaben (>= 24 h) sind keine Uhrzeit-Endzeit
  return minutes >= 24 * 60 ? null : Math.round(minutes);
}

export interface FeratelStartTimeDuration {
  time?: string | null;
  weekDays?: number | null;
  duration?: number | null;
}

/**
 * Endzeit als naive Wandzeit ("2026-09-20T13:00:00") aus dem Startdatum
 * und dem passenden startTimeDurations-Eintrag (gleiche Uhrzeit, sonst der
 * erste mit Dauer). null, wenn keine Dauer bekannt ist.
 */
export function feratelLocalEnd(localStart: string, durations: FeratelStartTimeDuration[] | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localStart);
  if (!m || !durations || durations.length === 0) return null;
  const startTime = `${m[4]}:${m[5]}`;
  const entry = durations.find((d) => d.time === startTime && feratelDurationMinutes(d.duration)) ?? durations.find((d) => feratelDurationMinutes(d.duration));
  const minutes = feratelDurationMinutes(entry?.duration);
  if (!minutes) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi) + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`;
}

export interface FeratelImage {
  urls?: string[] | null;
  copyright?: string | null;
  license?: string | null;
  author?: string | null;
  resolutionX?: number | null;
  resolutionY?: number | null;
  ai?: { isAiGenerated?: boolean | null } | null;
}

/**
 * Erstes echtes Foto: KI-generierte Bilder (Deskline-Flag `ai.isAiGenerated`,
 * 35 von 15.761 in der Stichprobe) werden uebersprungen, damit kein
 * Fabrikat als Veranstaltungsbild erscheint.
 */
export function pickFeratelImage(images: FeratelImage[] | null | undefined): { url: string; credit: string | null } | null {
  for (const img of images ?? []) {
    if (img?.ai?.isAiGenerated) continue;
    let url = img?.urls?.[0];
    if (!url) continue;
    if (url.startsWith('//')) url = `https:${url}`;
    const credit = norm(img.copyright) || norm(img.author) || null;
    return { url, credit };
  }
  return null;
}

/** Beschreibung: Langtext (32), sonst Kurztext (33). */
export function pickFeratelDescription(descriptions: Array<{ description?: string | null; type?: number | null }> | null | undefined): string | null {
  const byType = (t: number) => descriptions?.find((d) => d.type === t && norm(d.description))?.description ?? null;
  return byType(32) ?? byType(33) ?? descriptions?.find((d) => norm(d.description))?.description ?? null;
}

/**
 * Betraege aus einer Preisangabe der Quelle ("Preis Erwachsene: EUR 69,00
 * Kinder auf Anfrage", "€ 19,-/Erw. (€ 9,-/Kind)", "10,70", "Eintritt frei").
 * min = erster genannter Betrag (die Regionen nennen den Erwachsenenpreis
 * zuerst), max = groesster Betrag, wenn er darueber liegt. "frei/gratis/
 * kostenlos" ohne Betrag = 0. Ohne erkennbaren Betrag null.
 */
export function parseFeratelPrice(text: string | null | undefined): { min: number; max: number | null } | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');
  const amounts: number[] = [];
  const re = /(?:€|eur|euro)\s*(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:,-|,–|€|eur\b|euro\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const raw = (m[1] ?? m[2] ?? '').replace(',', '.');
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0 && v < 10000) amounts.push(v);
  }
  if (amounts.length === 0) {
    // "10,70" ohne Waehrung, aber als einziger Inhalt
    const bare = /^\s*(\d{1,4}[.,]\d{2})\s*$/.exec(t);
    if (bare) amounts.push(Number(bare[1].replace(',', '.')));
  }
  if (amounts.length === 0) {
    return /\b(eintritt\s*frei|frei(?:er)?\s*eintritt|gratis|kostenlos|kostenfrei|free)\b/i.test(t) ? { min: 0, max: null } : null;
  }
  const min = amounts[0];
  const max = Math.max(...amounts);
  return { min, max: max > min ? max : null };
}
