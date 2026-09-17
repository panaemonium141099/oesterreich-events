/**
 * Barrierefreiheit von Freizeitaktivitäten (poi_activities).
 *
 * REIN, ohne Runtime-Imports — wird vom Deskline-Ingest, vom kuratierten
 * Barrierefrei-Import, von der API und von Client-Komponenten benutzt.
 *
 * Datenmodell (Migration 20260917150000_poi_activities_accessibility.sql):
 *   accessibility          jsonb  Befund aus der Quelle Deskline
 *                                 ({basis, themes, features}), NULL = kein Befund.
 *   accessibility_curated  jsonb  kuratierte Angaben (austria.info und die
 *                                 verlinkten Regionsseiten), vom Deskline-
 *                                 Update-Pfad nie berührt.
 *   accessible             bool   GENERATED: eines von beiden gesetzt.
 *
 * Warum zwei Spalten: der wöchentliche Deskline-Upsert schreibt alle
 * mutablen Business-Spalten zurück. Läge die kuratierte Markierung in
 * derselben Spalte, würde der nächste Lauf sie mit dem Deskline-Befund
 * überschreiben (NULL-Clobber, siehe ingest-transform.ts).
 */

/** Merkmals-Vokabular, Reihenfolge = Anzeigereihenfolge. */
export const ACCESSIBILITY_FEATURES = [
  'rollstuhl',
  'parkplatz',
  'wc',
  'lift',
  'leihrollstuhl',
  'badelift',
  'blind',
  'gehoerlos',
  'leichte-sprache',
  'assistenzhund',
] as const;

export type AccessibilityFeature = (typeof ACCESSIBILITY_FEATURES)[number];

const FEATURE_SET = new Set<string>(ACCESSIBILITY_FEATURES);

export function isAccessibilityFeature(value: unknown): value is AccessibilityFeature {
  return typeof value === 'string' && FEATURE_SET.has(value);
}

const LABELS_DE: Record<AccessibilityFeature, string> = {
  rollstuhl: 'Rollstuhlgerecht',
  parkplatz: 'Behindertenparkplatz',
  wc: 'Barrierefreies WC',
  lift: 'Aufzug',
  leihrollstuhl: 'Leihrollstuhl',
  badelift: 'Badelift / Schwimmrollstuhl',
  blind: 'Angebote für blinde und sehbehinderte Menschen',
  gehoerlos: 'Gebärdensprache / Angebote für gehörlose Menschen',
  'leichte-sprache': 'Leichte Sprache',
  assistenzhund: 'Assistenzhunde willkommen',
};

const LABELS_EN: Record<AccessibilityFeature, string> = {
  rollstuhl: 'Wheelchair accessible',
  parkplatz: 'Accessible parking',
  wc: 'Accessible toilet',
  lift: 'Elevator',
  leihrollstuhl: 'Wheelchair loan',
  badelift: 'Pool lift / swimming wheelchair',
  blind: 'Offers for blind and visually impaired visitors',
  gehoerlos: 'Sign language / offers for deaf visitors',
  'leichte-sprache': 'Easy-to-read information',
  assistenzhund: 'Assistance dogs welcome',
};

export function accessibilityFeatureLabel(feature: string, locale: string): string {
  if (!isAccessibilityFeature(feature)) return feature;
  return locale.startsWith('en') ? LABELS_EN[feature] : LABELS_DE[feature];
}

// ── Erkennung ───────────────────────────────────────────────────────────────

/** Deskline-holidayThemes, die Barrierefreiheit bedeuten (live verprobt
 *  2026-09-17: "Barrierefrei", "Rollstuhlgängig" in SalzburgerLand und
 *  Salzkammergut). */
const THEME_RE = /barrierefrei|rollstuhl/i;

export function detectAccessibilityFromThemes(themeNames: ReadonlyArray<string>): string[] {
  return themeNames.filter((n) => typeof n === 'string' && THEME_RE.test(n));
}

/**
 * Positive Aussagen. Wortstämme, damit "barrierefreier Zugang",
 * "Barrierefreiheit", "rollstuhlgerechtes WC" und "rollstuhltauglich"
 * gleichermaßen treffen.
 */
const POSITIVE_RE =
  /\b(barrierefrei\w*|barrierearm\w*|rollstuhlgerecht\w*|rollstuhlg[äa]ngig\w*|rollstuhltauglich\w*|rollstuhlfahrer\w*|behindertengerecht\w*|behindertenparkplatz\w*|behinderten-?wc|stufenlos\w*|badelift\w*|schwimmrollstuhl\w*)/gi;

/** Verneinung unmittelbar vor der Aussage ("nicht barrierefrei", "kein
 *  barrierefreier Zugang", "keine Barrierefreiheit", "leider nicht ..."). */
const NEGATION_BEFORE_RE = /\b(nicht|kein|keine|keinen|keinerlei|ohne)\s+(\w+\s+){0,2}$/i;

/**
 * true, wenn der Text mindestens EINE nicht verneinte positive Aussage
 * enthält. "Erdgeschoss barrierefrei, Turm nicht barrierefrei" ist damit
 * barrierefrei (mit Einschränkung) — die Einschränkung steht ohnehin im
 * Text auf der Detailseite.
 */
export function detectAccessibilityFromText(text: string | null | undefined): boolean {
  if (!text) return false;
  const re = new RegExp(POSITIVE_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (!NEGATION_BEFORE_RE.test(before)) return true;
  }
  return false;
}

const FEATURE_PATTERNS: ReadonlyArray<readonly [AccessibilityFeature, RegExp]> = [
  ['rollstuhl', /rollstuhl|barrierefrei\w*\s+(zugang|zugänglich|erreichbar|eingang)|stufenlos/i],
  ['parkplatz', /behindertenparkplatz|behindertenparkpl|barrierefreie[rn]?\s+parkpl/i],
  ['wc', /behinderten-?wc|barrierefreie[sn]?\s+(wc|toilette)|rollstuhlgerechte[sn]?\s+(wc|toilette)|behindertentoilette|euro-?key/i],
  ['lift', /\baufzug|\blift\b|\blifte\b|fahrstuhl|treppenlift/i],
  ['leihrollstuhl', /leihrollst|rollstuhlverleih|rollst[üu]hle?\s+(zum\s+)?(ausleihen|leihen)|rollstuhl\s+kann\s+ausgeliehen/i],
  ['badelift', /badelift|poollift|pool-lift|schwimmrollstuhl|lift\s+ins\s+wasser/i],
  ['blind', /\bblinde|sehbehindert|sehbeeinträchtig|tastmodell|audiodeskription|taktil|blindenschrift|braille/i],
  ['gehoerlos', /geh[öo]rlos|gebärdensprache|gebaerdensprache|h[öo]rbehindert|h[öo]rbeeinträchtig|induktions/i],
  ['leichte-sprache', /leichte[rn]?\s+sprache|einfache[rn]?\s+sprache/i],
  ['assistenzhund', /assistenzhund|blindenhund|blindenführhund|begleithund/i],
];

/** Merkmale aus einem Freitext, in Vokabular-Reihenfolge, ohne Duplikate. */
export function detectAccessibilityFeatures(text: string | null | undefined): AccessibilityFeature[] {
  if (!text) return [];
  const found: AccessibilityFeature[] = [];
  for (const [feature, re] of FEATURE_PATTERNS) {
    if (re.test(text)) found.push(feature);
  }
  return found;
}

// ── Deskline-Befund ────────────────────────────────────────────────────────

export interface DesklineAccessibility {
  basis: 'deskline-theme' | 'deskline-text';
  /** Die getroffenen holidayThemes im Original. */
  themes: string[];
  features: AccessibilityFeature[];
}

/**
 * Befund aus holidayThemes + Beschreibungstexten. Ein Thema ist ein
 * strukturiertes Signal der Region und schlägt den Text; der Text liefert
 * dann nur noch die Merkmale. NULL = kein (oder nur verneintes) Signal.
 */
export function buildDesklineAccessibility(
  themeNames: ReadonlyArray<string>,
  texts: ReadonlyArray<string>,
): DesklineAccessibility | null {
  const themes = detectAccessibilityFromThemes(themeNames);
  const text = texts.filter((t) => typeof t === 'string' && t.trim() !== '').join('\n');
  if (themes.length > 0) {
    return { basis: 'deskline-theme', themes, features: detectAccessibilityFeatures(text) };
  }
  if (detectAccessibilityFromText(text)) {
    return { basis: 'deskline-text', themes: [], features: detectAccessibilityFeatures(text) };
  }
  return null;
}

// ── Textbausteine ohne Aussagekraft ────────────────────────────────────────

/** Sätze eines Textes, die eine positive Aussage enthalten (fuer den
 *  Bausteinvergleich; Whitespace normalisiert). */
export function accessibilityKeywordSentences(text: string | null | undefined): string[] {
  if (!text) return [];
  const flat = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  for (const raw of flat.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const re = new RegExp(POSITIVE_RE.source, 'i');
    if (re.test(sentence)) out.push(sentence);
  }
  return out;
}

/** Mindestzahl an Orten, ab der ein identischer Satz als Baustein gilt. */
export const SHARED_SENTENCE_MIN = 3;

/**
 * Tourismusregionen haengen an viele Orte denselben Ortstext ("Waldhausen
 * liegt in einer reizvollen Huegellandschaft. Der Badesee, rollstuhl-
 * taugliche Wanderwege ..."). Der Satz sagt nichts ueber den einzelnen
 * Ort aus — 9 POIs in Waldhausen waren am 2026-09-17 nur deshalb
 * "barrierefrei". Regel: ein Text-Befund (basis deskline-text) zaehlt
 * nicht, wenn JEDER seiner Aussage-Saetze in >= SHARED_SENTENCE_MIN
 * Orten des uebergebenen Bestands vorkommt. Themen-Befunde bleiben.
 */
export function suppressSharedTextEvidence<
  T extends { accessibility: DesklineAccessibility | null; description: string | null; description_short: string | null },
>(rows: T[], minShared: number = SHARED_SENTENCE_MIN): T[] {
  const counts = new Map<string, number>();
  const sentencesOf = new Map<T, string[]>();
  for (const row of rows) {
    if (row.accessibility?.basis !== 'deskline-text') continue;
    const sentences = [
      ...new Set([
        ...accessibilityKeywordSentences(row.description),
        ...accessibilityKeywordSentences(row.description_short),
      ]),
    ];
    sentencesOf.set(row, sentences);
    for (const s of sentences) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return rows.map((row) => {
    const sentences = sentencesOf.get(row);
    if (!sentences || sentences.length === 0) return row;
    const allShared = sentences.every((s) => (counts.get(s) ?? 0) >= minShared);
    return allShared ? { ...row, accessibility: null } : row;
  });
}

// ── Kuratierte Angaben ─────────────────────────────────────────────────────

/** Shape der Spalte accessibility_curated (JSON, wird auf der Detailseite
 *  gelesen — defensiv parsen, Fremddaten). */
export interface CuratedAccessibility {
  features: AccessibilityFeature[];
  /** Kurzer Hinweis in eigenen Worten (Einschränkungen, Ausstattung). */
  note: string | null;
  /** Seite, auf der die Angabe steht (Attribution). */
  source_url: string;
  /** Anzeigename der Quelle, z. B. "Niederösterreich Werbung". */
  source_label: string;
  /** ISO-Datum der Prüfung. */
  checked_at: string;
}

/** Defensiver Parser für accessibility_curated aus dem jsonb. */
export function parseCuratedAccessibility(raw: unknown): CuratedAccessibility | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.source_url !== 'string' || typeof o.source_label !== 'string') return null;
  const features = Array.isArray(o.features) ? o.features.filter(isAccessibilityFeature) : [];
  return {
    features,
    note: typeof o.note === 'string' && o.note.trim() !== '' ? o.note : null,
    source_url: o.source_url,
    source_label: o.source_label,
    checked_at: typeof o.checked_at === 'string' ? o.checked_at : '',
  };
}

/** Defensiver Parser für accessibility (Deskline-Befund) aus dem jsonb. */
export function parseDesklineAccessibility(raw: unknown): DesklineAccessibility | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.basis !== 'deskline-theme' && o.basis !== 'deskline-text') return null;
  return {
    basis: o.basis,
    themes: Array.isArray(o.themes) ? o.themes.filter((t): t is string => typeof t === 'string') : [],
    features: Array.isArray(o.features) ? o.features.filter(isAccessibilityFeature) : [],
  };
}
