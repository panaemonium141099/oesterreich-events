/**
 * Closed vocabulary for the local-LLM enrichment pipeline.
 *
 * Every value in these lists is a tag Qwen is *allowed* to output. Anything
 * else from the model gets dropped during validation. This is the contract
 * that makes Wizard filters deterministic: the user picks "studenten" once
 * and gets matching rows regardless of how the event was phrased.
 *
 * Philosophy:
 * - Prefer fewer, broader tags over long-tail specifics. Every tag is a
 *   place the wizard must have a UI affordance for later.
 * - Music genre list is intentionally big because the user explicitly wants
 *   rave-granularity (DnB liquid vs neurofunk, goa vs progressive-trance).
 * - Austrian-specific cultural tags (kirtag, perchten, heuriger, tracht)
 *   are kept because they're unambiguous discriminators.
 */

export const ENRICHMENT_VERSION = 'enrich-v1-prompt1';

// ─────────────────────────────────────────────────────────────────────────
// TAGS — content / genre / subgenre / format (0..5 per event)
// ─────────────────────────────────────────────────────────────────────────

export const TAGS = [
  // ── Musik: Klassisch
  'klassik', 'oper', 'operette', 'ballett', 'kammermusik', 'chor', 'orgel',
  'jazz', 'bigband', 'swing',

  // ── Musik: Popular
  'pop', 'rock', 'indie', 'alternative', 'metal', 'punk', 'grunge', 'ska',
  'reggae', 'hip-hop', 'rap', 'r-n-b', 'soul', 'funk', 'disco', 'schlager',
  'country', 'folk', 'singer-songwriter', 'latin', 'balkan', 'weltmusik',

  // ── Musik: Österreich-spezifisch
  'volksmusik', 'blasmusik', 'heurigenmusik', 'alpine-musik',
  'austro-pop', 'dialekt-rap',

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

  // ── Musik: Format
  'rave', 'open-air-rave', 'afterhour', 'warehouse-party', 'free-party',
  'tekno-party', 'boiler-room', 'club-night', 'silent-disco', 'boat-party',
  'outdoor-festival', 'indoor-festival', 'multi-stage-festival',
  'rooftop-party', 'daytime-rave', '24h-rave', 'underground-party',
  'dj-set', 'live-band', 'acoustic-session', 'jam-session', 'karaoke',

  // ── Kultur
  'theater', 'kabarett', 'lesung', 'musical', 'ausstellung', 'vortrag',
  'film', 'kino', 'performance-art', 'improtheater', 'comedy',

  // ── Sport
  'wandern', 'laufen', 'radfahren', 'mountainbike', 'ski', 'langlauf',
  'snowboard', 'schwimmen', 'klettern', 'yoga', 'fitness', 'turnier',
  'fussball', 'eishockey', 'tennis', 'reiten', 'wassersport',

  // ── Märkte
  'christkindlmarkt', 'ostermarkt', 'flohmarkt', 'bauernmarkt',
  'wochenmarkt', 'kunsthandwerk', 'designmarkt', 'antikmarkt',

  // ── Kulinarik
  'weinfest', 'biermesse', 'heuriger', 'verkostung', 'kulinarik-tour',
  'genussmesse', 'street-food', 'brunch',

  // ── Österreich: Feste & Brauchtum
  'kirtag', 'kirchweih', 'zeltfest', 'dorffest', 'sommerfest', 'pfarrfest',
  'schützenfest', 'almabtrieb', 'maibaumfest', 'sonnwendfeier',
  'dämmerschoppen', 'frühschoppen', 'tracht', 'perchten', 'krampuslauf',
  'erntedank', 'fasching', 'ball',

  // ── Religion
  'gottesdienst', 'wallfahrt', 'prozession', 'meditation', 'retreat',
  'andacht', 'pilgern',

  // ── Familie
  'kinder-workshop', 'puppentheater', 'familien-picknick', 'kinderkino',
  'spielfest', 'ferienprogramm', 'geburtstag', 'kindertheater',

  // ── Bildung
  'seminar', 'workshop', 'kurs', 'sprachkurs', 'lecture',

  // ── Wirtschaft / Business
  'messe', 'konferenz', 'networking', 'startup-pitch', 'tech-meetup',
  'branchentreff',

  // ── Natur
  'naturführung', 'vogelbeobachtung', 'geführte-wanderung',
  'astronomie', 'ökologie-event',

  // ── Gesundheit
  'gesundheitsmesse', 'wellness', 'achtsamkeit', 'selbsthilfegruppe',
] as const;

export type Tag = typeof TAGS[number];
export const TAG_SET = new Set<string>(TAGS);

// ─────────────────────────────────────────────────────────────────────────
// AUDIENCE — who the event is for (1..4 per event)
// ─────────────────────────────────────────────────────────────────────────

export const AUDIENCES = [
  'studenten',
  'junge-erwachsene',
  'familien-mit-kleinkindern',
  'familien-mit-kindern',
  'familien-mit-teens',
  'kinder-allein',
  'erwachsene-allgemein',
  'senioren',
  'singles',
  'paare',
  'lgbtq',
  'traditionell',
] as const;

export type Audience = typeof AUDIENCES[number];
export const AUDIENCE_SET = new Set<string>(AUDIENCES);

// ─────────────────────────────────────────────────────────────────────────
// VIBE — emotional tone of the event (1..2 per event)
// ─────────────────────────────────────────────────────────────────────────

export const VIBES = [
  'chill', 'energetisch', 'wild', 'kulturell', 'spirituell',
  'intellektuell', 'romantisch', 'festlich', 'gemütlich', 'edgy',
  'kindergerecht', 'traditionell',
  'rave', 'euphoric', 'psychedelic', 'dark', 'industrial',
  'hypnotic', 'underground', 'mainstream', 'alternative',
] as const;

export type Vibe = typeof VIBES[number];
export const VIBE_SET = new Set<string>(VIBES);

// ─────────────────────────────────────────────────────────────────────────
// SETTING — where / how the event takes place (1..2 per event)
// ─────────────────────────────────────────────────────────────────────────

export const SETTINGS = [
  'indoor', 'outdoor', 'am-see', 'in-den-bergen', 'städtisch', 'dörflich',
  'kirche', 'festival-gelände', 'bar-club', 'konzertsaal', 'arena', 'park',
  'spielplatz', 'museum', 'schloss',
  'warehouse', 'underground-location', 'industrial-venue',
  'open-air-location', 'forest', 'strand', 'rave-cave', 'techno-club',
  'nightclub',
] as const;

export type Setting = typeof SETTINGS[number];
export const SETTING_SET = new Set<string>(SETTINGS);

// ─────────────────────────────────────────────────────────────────────────
// Single-choice enums
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
// Full result shape — what the classifier emits per event
// ─────────────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  tags: string[];             // Tag[] but validated at runtime
  audience: string[];
  vibe: string[];
  setting: string[];
  language: Language | null;
  price_tier: PriceTier | null;
  duration_type: DurationType | null;
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

  return {
    tags: filterArray(r.tags, TAG_SET, 5),
    audience: filterArray(r.audience, AUDIENCE_SET, 4),
    vibe: filterArray(r.vibe, VIBE_SET, 2),
    setting: filterArray(r.setting, SETTING_SET, 2),
    language: pickEnum<Language>(r.language, LANGUAGE_SET),
    price_tier: pickEnum<PriceTier>(r.price_tier, PRICE_TIER_SET),
    duration_type: pickEnum<DurationType>(r.duration_type, DURATION_TYPE_SET),
    is_student_friendly: r.is_student_friendly === true,
    is_family_friendly: r.is_family_friendly === true,
  };
}
