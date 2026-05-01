/**
 * Closed vocabulary for the OpenAI-based enrichment pipeline.
 *
 * Single source of truth: docs/TAXONOMY.md §3. Every value in these lists
 * is a tag the AI is *allowed* to output. Anything else gets dropped
 * during validation. This is the contract that makes Wizard filters
 * deterministic: the user picks "studentenleben" once and gets matching
 * rows regardless of how the event was phrased.
 *
 * Rework note (2026-04-23): v2 of the taxonomy. Added occasion_tags and
 * price_flags as their own axes (per docs/TAXONOMY.md). Extended audience
 * with erasmus-freundlich, alleine-geeignet. Extended vibe with trashig,
 * underground, fancy, authentisch, zum-kennenlernen. Added new music and
 * nightlife activity tags (bar-night, shot-night, student-night,
 * motto-party variants, etc.).
 *
 * Philosophy:
 * - Prefer fewer, broader tags over long-tail specifics. Every tag is a
 *   place the wizard must have a UI affordance for later.
 * - Electronic-music subgenre granularity kept (techno/house/goa/DnB
 *   subgenres) because the user explicitly wants rave-level precision.
 * - Austrian-specific cultural tags (kirtag, perchten, heuriger, tracht)
 *   are kept because they're unambiguous discriminators.
 */

// v3-structural (2026-05-01): Prompt erweitert um structural fields
// (suggested_end_date_iso, suggested_address). Re-runt alle existing events
// damit fehlende Stamm-Daten gefüllt werden — fixt GSC Rich-Result-Warnings
// (endDate fehlt in 1.396 events, address in 1.061, description in 851).
export const ENRICHMENT_VERSION = 'enrich-v3-structural';

// ─────────────────────────────────────────────────────────────────────────
// TAGS — content / genre / subgenre / activity (0..5 per event)
// These are `secondary_tags` in the docs/TAXONOMY.md model.
// ─────────────────────────────────────────────────────────────────────────

export const TAGS = [
  // ── Musik: Klassisch & traditionell
  'klassik', 'oper', 'operette', 'ballett', 'kammermusik', 'chor', 'orgel',
  'jazz', 'bigband', 'swing',

  // ── Musik: Popular
  'pop', 'rock', 'indie', 'alternative', 'metal', 'punk', 'grunge', 'ska',
  'reggae', 'hip-hop', 'rap', 'r-n-b', 'soul', 'funk', 'disco', 'schlager',
  'country', 'folk', 'singer-songwriter', 'latin', 'balkan', 'weltmusik',

  // ── Musik: Österreich-spezifisch
  'volksmusik', 'blasmusik', 'heurigenmusik', 'alpine-musik',
  'austro-pop', 'dialekt-rap', 'tamburica',

  // ── Musik: Elektronik / Rave — Dach-Genres
  'techno', 'house', 'trance', 'dnb', 'dubstep', 'hardstyle', 'hardcore',
  'breakbeat', 'bass-music', 'ambient-chill', 'electro', 'disco-electronic',

  // ── Musik: Techno-Subgenres
  'minimal-techno', 'melodic-techno', 'hardtechno', 'schranz',
  'industrial-techno', 'detroit-techno', 'deep-techno', 'acid-techno',
  'dub-techno',

  // ── Musik: House-Subgenres
  'deep-house', 'tech-house', 'progressive-house', 'afro-house',
  'melodic-house', 'acid-house', 'disco-house', 'future-house', 'afro-tech',
  'chicago-house', 'uk-house', 'minimal-house',

  // ── Musik: Trance / Goa
  'psytrance', 'goa', 'progressive-trance', 'uplifting-trance',
  'hard-trance', 'vocal-trance', 'dark-psytrance', 'forest-psytrance',
  'full-on',

  // ── Musik: DnB
  'drum-and-bass', 'liquid-dnb', 'neurofunk', 'jungle', 'jump-up',
  'dnb-rollers', 'dancefloor-dnb', 'deep-dnb', 'minimal-dnb',

  // ── Musik: Bass / Dubstep
  'riddim', 'brostep', 'future-bass', 'trap-edm', 'uk-garage',
  '2-step', 'speed-garage', 'bassline', 'grime',

  // ── Musik: Hardstyle / Hardcore
  'rawstyle', 'gabber', 'uk-hardcore', 'uptempo', 'frenchcore',
  'terror', 'speedcore', 'happy-hardcore',

  // ── Musik: Disco/Retro-Electronic
  'nu-disco', 'italo-disco', 'synthwave', 'vaporwave', 'electroclash',
  'electroswing', 'idm', 'leftfield',

  // ── Musik/Party: Format
  'live-konzert', 'dj-set', 'live-band', 'acoustic-session',
  'jam-session', 'karaoke', 'open-mic', 'poetry-slam',
  'outdoor-festival', 'indoor-festival', 'multi-stage-festival',

  // ── Nightlife: Party/Bar-Aktivitäten (NEU in v2)
  'club-night', 'rave', 'open-air-rave', 'afterhour', 'warehouse-party',
  'free-party', 'tekno-party', 'boiler-room', 'silent-disco',
  'boat-party', 'rooftop-party', 'daytime-rave', '24h-rave',
  'underground-party', 'afterparty',
  'bar-night', 'happy-hour', 'cocktail-night', 'shot-night',
  'student-night', 'ladies-night', 'open-bar',
  'pub-crawl', 'tanznacht',
  // Motto-Parties (NEU in v2)
  'motto-party', '80s-party', '90s-party', '2000er-party',
  'latino-night', 'afro-night', 'erasmus-night',
  'halloween-party', 'fasching-party', 'silvester-party',
  'schlager-party', 'retro-party',

  // ── Kultur & Bühne
  'theater', 'kabarett', 'lesung', 'musical', 'ausstellung', 'vortrag',
  'film', 'kino', 'performance-art', 'improtheater', 'comedy',
  'stand-up', 'stadtführung', 'burgführung', 'museumstour',

  // ── Sport & Bewegung
  'wandern', 'laufen', 'radfahren', 'mountainbike', 'ski', 'langlauf',
  'snowboard', 'schwimmen', 'klettern', 'bouldern', 'yoga', 'pilates',
  'fitness', 'crossfit', 'hiit', 'turnier',
  'fussball', 'eishockey', 'tennis', 'reiten', 'wassersport',
  'marathon', 'halbmarathon',
  'tanzkurs', 'salsa-night', 'zumba',

  // ── Natur & Abenteuer
  'naturführung', 'vogelbeobachtung', 'geführte-wanderung',
  'astronomie', 'ökologie-event', 'kräuterwanderung', 'pilzwanderung',
  'rafting', 'kanutour', 'kajak', 'segel-tour',
  'klettertour', 'bergtour', 'alpen-tour', 'escape-room',

  // ── Märkte & Feste
  'christkindlmarkt', 'ostermarkt', 'adventmarkt',
  'flohmarkt', 'bauernmarkt', 'wochenmarkt',
  'kunsthandwerk', 'designmarkt', 'antikmarkt',
  'dorffest', 'stadtfest', 'kirtag', 'pfarrfest', 'schützenfest',
  'feuerwehrfest', 'heurigenfest',
  'maibaumfest', 'sonnwendfeier', 'dämmerschoppen', 'frühschoppen',
  'tracht', 'perchten', 'perchtenlauf', 'krampuslauf',
  'erntedank', 'fasching', 'ball', 'almabtrieb',

  // ── Essen & Trinken
  'weinverkostung', 'bier-verkostung', 'cocktail-tasting', 'gin-tasting',
  'whiskey-tasting', 'heuriger', 'buschenschank',
  'weinfest', 'biermesse',
  'kulinarik-tour', 'genussmesse', 'street-food', 'food-truck',
  'brunch', 'dinner', 'fine-dining',
  'kochkurs', 'barbecue', 'grillen',

  // ── Wissen & Karriere
  'seminar', 'workshop', 'kurs', 'sprachkurs', 'lecture',
  'messe', 'konferenz', 'networking', 'startup-pitch', 'tech-meetup',
  'branchentreff', 'career-fair', 'gründer-event', 'campus-info',

  // ── Community & Freizeit (NEU als Achse in v2)
  'pub-quiz', 'brettspielabend', 'game-night', 'lan-party',
  'speed-dating', 'single-night',
  'stammtisch', 'vereinstreffen', 'community-meetup',
  'hobby-gruppe', 'nachbarschaftsevent',
  'comedy-abend',

  // ── Familie & Kinder
  'kinder-workshop', 'puppentheater', 'familien-picknick', 'kinderkino',
  'spielfest', 'ferienprogramm', 'geburtstag', 'kindertheater',
  'kinderfest',

  // ── Wellness & Spiritualität
  'meditation', 'breathwork', 'achtsamkeit', 'sound-healing',
  'retreat', 'wellness-day', 'sauna-special', 'thermen-special',
  'yoga-retreat',
  'gottesdienst', 'wallfahrt', 'prozession', 'andacht', 'pilgern',
  'gesundheitsmesse', 'selbsthilfegruppe',
] as const;

export type Tag = typeof TAGS[number];
export const TAG_SET = new Set<string>(TAGS);

// ─────────────────────────────────────────────────────────────────────────
// AUDIENCE — who the event is for (1..3 per event)
// ─────────────────────────────────────────────────────────────────────────

export const AUDIENCES = [
  'studenten',
  'junge-erwachsene',
  'erasmus-freundlich',            // NEU v2: international/English-friendly
  'familien-mit-kleinkindern',
  'familien-mit-kindern',
  'familien-mit-teens',
  'kinder-allein',
  'erwachsene-allgemein',
  'senioren',
  'singles',
  'paare',
  'fuer-gruppen',                  // NEU v2
  'alleine-geeignet',              // NEU v2: solo-friendly
  'queer-friendly',                // renamed from lgbtq for consistency
  'english-speaking',              // NEU v2: event in English
  'anfängerfreundlich',            // NEU v2
  'touristenfreundlich',           // NEU v2
  'lokal-insider',                 // NEU v2: einheimischer spot
  'traditionell',
] as const;

export type Audience = typeof AUDIENCES[number];
export const AUDIENCE_SET = new Set<string>(AUDIENCES);

// ─────────────────────────────────────────────────────────────────────────
// VIBE — emotional tone of the event (1..3 per event)
// ─────────────────────────────────────────────────────────────────────────

export const VIBES = [
  // Plan-Vibes (essential set)
  'entspannt',
  'laut',
  'elegant',
  'kreativ',
  'abenteuerlich',
  'romantisch',
  'gemütlich',
  'wild',
  'exklusiv',
  'alternativ',
  'mainstream',
  'lokal',
  'kultig',

  // Extension-Vibes für AI-Query-Matching (NEU v2)
  'trashig',                       // billig, rough, low-budget-Charme
  'underground',                   // nicht-poliert, rough-edge, insider
  'fancy',                         // nobel, chic, polish
  'authentisch',                   // ur-österreichisch, nicht designed
  'zum-kennenlernen',              // meet-new-people-Signal
  'touristen-frei',                // nur Einheimische

  // Beibehalten aus v1 (überlappen teilweise, aber hilft dem Modell)
  'kulturell', 'spirituell', 'intellektuell', 'festlich', 'edgy',
  'kindergerecht', 'euphoric', 'psychedelic', 'dark', 'industrial',
  'hypnotic',
] as const;

export type Vibe = typeof VIBES[number];
export const VIBE_SET = new Set<string>(VIBES);

// ─────────────────────────────────────────────────────────────────────────
// OCCASION — what the event is "good for" (0..3 per event). NEU in v2.
// Used for Discovery-UI modules and natural-language AI queries like
// "billig saufen gehen heute abend" → occasion ∋ [ausgehen, saufen-gehen,
// fuer-den-abend].
// ─────────────────────────────────────────────────────────────────────────

export const OCCASIONS = [
  'ausgehen',
  'afterwork',
  'date-night',
  'erstes-date',
  'wochenendplan',
  'feierabend',
  'tagesausflug',
  'regentag',                      // indoor-alternative
  'geburtstagsidee',
  'teamevent',
  'spontan',                       // kurzfristig/last-minute
  'kurzfristig-heute',
  'fuer-den-abend',
  'saufen-gehen',                  // explizit: "billig saufen" query
  'kennenlernen',
  'networking-anlass',
] as const;

export type Occasion = typeof OCCASIONS[number];
export const OCCASION_SET = new Set<string>(OCCASIONS);

// ─────────────────────────────────────────────────────────────────────────
// SETTING — format/location style (0..3 per event).
// Extended in v2 with zeit-tags (abendevent, late-night, …).
// ─────────────────────────────────────────────────────────────────────────

export const SETTINGS = [
  // Physical setting
  'indoor', 'outdoor', 'hybrid', 'online',
  'am-see', 'in-den-bergen', 'städtisch', 'dörflich',
  'kirche', 'festival-gelände', 'bar-club', 'konzertsaal', 'arena', 'park',
  'spielplatz', 'museum', 'schloss', 'warehouse', 'underground-location',
  'industrial-venue', 'open-air-location', 'forest', 'strand',
  'rave-cave', 'techno-club', 'nightclub',

  // Zeit-/Format-Tags (NEU v2 — merged into setting)
  'open-air',
  'tagesevent',
  'abendevent',
  'ganztägig',
  'kurzformat',                    // < 2h
  'late-night',                    // startet nach 22h
  'mehrtägig',
  'saisonal',
  'wiederkehrend',
] as const;

export type Setting = typeof SETTINGS[number];
export const SETTING_SET = new Set<string>(SETTINGS);

// ─────────────────────────────────────────────────────────────────────────
// PRICE_FLAGS — binary barrier/deal flags (0..many per event). NEU in v2.
// Complements price_tier (which is the coarse bucket).
// ─────────────────────────────────────────────────────────────────────────

export const PRICE_FLAGS = [
  'freier-eintritt',               // free entry, konsum may cost
  'happy-hour',
  'getraenke-special',             // "2 für 1", "3€ Spritzer"
  'studentenrabatt',
  'damenrabatt',                   // ladies night free/discounted
  'mit-anmeldung',
  'ohne-anmeldung',
  'barrierefrei',
  'kinderwagengeeignet',
  'fuer-anfaenger',                // low-barrier participation
  'unter-20-euro',
] as const;

export type PriceFlag = typeof PRICE_FLAGS[number];
export const PRICE_FLAG_SET = new Set<string>(PRICE_FLAGS);

// ─────────────────────────────────────────────────────────────────────────
// Single-choice enums (unchanged from v1)
// ─────────────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  'deutsch', 'dialekt', 'englisch', 'mehrsprachig', 'ohne-sprache',
] as const;
export type Language = typeof LANGUAGES[number];
export const LANGUAGE_SET = new Set<string>(LANGUAGES);

export const PRICE_TIERS = [
  'gratis', 'günstig', 'mittel', 'premium', 'unbekannt',
] as const;
export type PriceTier = typeof PRICE_TIERS[number];
export const PRICE_TIER_SET = new Set<string>(PRICE_TIERS);

export const DURATION_TYPES = [
  'kurz', 'abend', 'ganztag', 'mehrtägig', 'dauerausstellung',
  'nacht-bis-morgen', '24-stunden', '48-stunden',
] as const;
export type DurationType = typeof DURATION_TYPES[number];
export const DURATION_TYPE_SET = new Set<string>(DURATION_TYPES);

// ─────────────────────────────────────────────────────────────────────────
// PRIMARY_CATEGORY — NEW in v2. The 11 Hauptkategorien from docs/TAXONOMY.md.
// This is the AI's output for event.category, replacing the rule-based
// classifier. See taxonomy.ts CATEGORIES for the canonical list.
// ─────────────────────────────────────────────────────────────────────────

export const PRIMARY_CATEGORIES = [
  'Musik',
  'Kultur & Bühne',
  'Nightlife & Party',
  'Essen & Trinken',
  'Märkte & Feste',
  'Sport & Bewegung',
  'Natur & Abenteuer',
  'Wissen & Karriere',
  'Familie & Kinder',
  'Community & Freizeit',
  'Wellness & Spiritualität',
  'Sonstiges',
] as const;
export type PrimaryCategory = typeof PRIMARY_CATEGORIES[number];
export const PRIMARY_CATEGORY_SET = new Set<string>(PRIMARY_CATEGORIES);

// ─────────────────────────────────────────────────────────────────────────
// Full result shape — what the enrichment emits per event (v2)
// ─────────────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  primary_category: PrimaryCategory | null;   // NEU v2
  tags: string[];                              // bis 5, Activity/Genre
  audience: string[];                          // bis 3
  vibe: string[];                              // bis 3
  occasion: string[];                          // NEU v2, bis 3
  setting: string[];                           // bis 3
  price_tier: PriceTier | null;
  price_flags: string[];                       // NEU v2
  duration_type: DurationType | null;
  language: Language | null;
  is_student_friendly: boolean;
  is_family_friendly: boolean;
}

/**
 * Validate and coerce a raw LLM response into the enrichment shape.
 * Anything not in the allowed sets is silently dropped — we'd rather
 * lose a tag than corrupt the schema.
 */
export function validateEnrichment(raw: unknown): EnrichmentResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  const filterArray = (value: unknown, set: Set<string>, cap: number): string[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of value) {
      if (typeof v !== 'string') continue;
      const norm = v.trim().toLowerCase();
      if (!set.has(norm)) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
      if (out.length >= cap) break;
    }
    return out;
  };

  const pickEnum = <T extends string>(value: unknown, set: Set<string>): T | null => {
    if (typeof value !== 'string') return null;
    const norm = value.trim().toLowerCase();
    return set.has(norm) ? (norm as T) : null;
  };

  // Primary category is case-sensitive (matches docs/TAXONOMY.md exactly)
  const pickCategory = (value: unknown): PrimaryCategory | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return PRIMARY_CATEGORY_SET.has(trimmed) ? (trimmed as PrimaryCategory) : null;
  };

  return {
    primary_category: pickCategory(r.primary_category),
    tags: filterArray(r.tags, TAG_SET, 5),
    audience: filterArray(r.audience, AUDIENCE_SET, 3),
    vibe: filterArray(r.vibe, VIBE_SET, 3),
    occasion: filterArray(r.occasion, OCCASION_SET, 3),
    setting: filterArray(r.setting, SETTING_SET, 3),
    price_tier: pickEnum<PriceTier>(r.price_tier, PRICE_TIER_SET),
    price_flags: filterArray(r.price_flags, PRICE_FLAG_SET, 6),
    duration_type: pickEnum<DurationType>(r.duration_type, DURATION_TYPE_SET),
    language: pickEnum<Language>(r.language, LANGUAGE_SET),
    is_student_friendly: r.is_student_friendly === true,
    is_family_friendly: r.is_family_friendly === true,
  };
}
