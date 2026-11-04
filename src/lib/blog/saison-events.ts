/**
 * Event-Auswahl und Nachzieh-Regel für Saison-Guides (pur, getestet).
 *
 * Hintergrund (2026-11-03): Der Silvester-Guide behauptete „Programm noch
 * nicht angekündigt", obwohl über 300 Silvester-Events in der Datenbank
 * lagen. Der Generator zog Events nur nach Kategorie und Score, und weil der
 * Score Nähe belohnt, waren alle 120 Treffer Novemberkonzerte. Seitdem gilt:
 *
 *   • Ein Kalender-Eintrag mit `topic` holt zuerst die Events SEINES Themas
 *     (Titel-Suchwörter in einem festen Datumsfenster). Gibt es davon genug,
 *     kommen nur die in den Guide. Erst ohne Thementreffer füllen die
 *     Kategorie-Events auf.
 *   • „Noch nicht angekündigt" darf ein Guide nur schreiben, wenn die
 *     Themenabfrage wirklich leer ist (`programmeKnown`).
 *   • Ein bestehender Guide wird nachgezogen, sobald die Themenabfrage
 *     deutlich mehr liefert als beim letzten Stand (`needsRefresh`).
 */

export interface SaisonTopic {
  /** Suchwörter im Event-Titel (Groß/Klein egal, Teilwort). */
  keywords: string[];
  /** Titel mit diesen Wörtern zählen nicht (z. B. „fußball" bei „ball"). */
  excludeKeywords?: string[];
  /** Festes Saison-Fenster als MM-TT; `to` vor `from` heißt über den Jahreswechsel. */
  window: { from: string; to: string };
}

export interface SaisonEvent {
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  price_text: string | null;
  source_url: string | null;
  event_score: number | null;
}

/** Ab so vielen Thementreffern gilt das Programm als bekannt und trägt den Guide allein. */
export const MIN_PROGRAMME_EVENTS = 9;
/** Frühestens nach so vielen Tagen wird derselbe Guide erneut nachgezogen. */
export const REFRESH_MIN_INTERVAL_DAYS = 14;
/** Nachziehen erst, wenn die Themenabfrage um diesen Faktor gewachsen ist. */
export const REFRESH_GROWTH_FACTOR = 1.5;

const DAY_MS = 86_400_000;

function isoDay(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/**
 * Das konkrete Saison-Fenster zum heutigen Tag: die früheste Ausgabe des
 * Fensters, die noch nicht vorbei ist. Am 1. Jänner ist Silvester
 * (30.12. bis 02.01.) also noch die laufende Ausgabe, nicht die in elf Monaten.
 */
export function topicWindow(
  window: SaisonTopic['window'],
  today = new Date(),
): { from: string; to: string } {
  const [fm, fd] = window.from.split('-').map(Number);
  const [tm, td] = window.to.split('-').map(Number);
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const year = today.getUTCFullYear();
  for (const y of [year - 1, year, year + 1]) {
    const from = Date.UTC(y, fm - 1, fd);
    let to = Date.UTC(y, tm - 1, td);
    if (to < from) to = Date.UTC(y + 1, tm - 1, td);
    if (to >= utcToday) return { from: isoDay(from), to: isoDay(to) };
  }
  // Unerreichbar: das Fenster von `year + 1` endet immer nach heute.
  throw new Error(`Kein Saison-Fenster für ${window.from}..${window.to}`);
}

/** Passt der Titel zum Thema? Teilwort, Groß/Klein egal, Ausschlusswörter gewinnen. */
export function matchesTopic(title: string, topic: Pick<SaisonTopic, 'keywords' | 'excludeKeywords'>): boolean {
  const t = title.toLowerCase();
  if (topic.excludeKeywords?.some((k) => t.includes(k.toLowerCase()))) return false;
  return topic.keywords.some((k) => t.includes(k.toLowerCase()));
}

export interface PickOptions {
  /** Höchstens so viele je Bundesland im ersten Durchgang (regionale Streuung). */
  perBundesland?: number;
  /** Gesamtgröße der Auswahl. */
  max?: number;
  minProgramme?: number;
}

export interface SeasonPick {
  events: SaisonEvent[];
  /** Wie viele Thementreffer es insgesamt gab (nicht nur die ausgewählten). */
  topicCount: number;
  /** Gibt es Programm zum Thema? Nur wenn nicht, darf der Guide „nicht angekündigt" schreiben. */
  programmeKnown: boolean;
}

function byScore(a: SaisonEvent, b: SaisonEvent): number {
  return (b.event_score ?? 0) - (a.event_score ?? 0);
}

/** Gleicher Titel am gleichen Tag ist dieselbe Veranstaltung (Doppelzeilen aus mehreren Quellen). */
function dayKey(e: SaisonEvent): string {
  return `${e.title.trim().toLowerCase()}|${e.start_date.slice(0, 10)}`;
}

/**
 * Regional streuen: reihum ein Event je Bundesland (nach Score), bis jedes
 * Bundesland `perBl` hat oder `max` erreicht ist; dann (wenn `overflow`) der
 * Rest nach Score. Reihum statt Bundesland für Bundesland, sonst fällt das
 * neunte Bundesland weg, sobald 8 × perBl die Auswahl füllen (Vorarlberg
 * beim Silvester-Check 2026-11-04).
 */
function spread(events: SaisonEvent[], perBl: number, max: number, overflow: boolean): SaisonEvent[] {
  const seen = new Set<string>();
  const sorted = [...events].sort(byScore).filter((e) => {
    const k = dayKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const queues = new Map<string, SaisonEvent[]>();
  for (const e of sorted) {
    const bl = e.bundesland ?? 'unbekannt';
    if (!queues.has(bl)) queues.set(bl, []);
    queues.get(bl)!.push(e);
  }
  const picked: SaisonEvent[] = [];
  for (let round = 0; round < perBl && picked.length < max; round++) {
    for (const q of queues.values()) {
      if (picked.length >= max) break;
      const e = q.shift();
      if (e) picked.push(e);
    }
  }
  if (overflow) {
    const rest = [...queues.values()].flat().sort(byScore);
    for (const e of rest) {
      if (picked.length >= max) break;
      picked.push(e);
    }
  }
  return picked;
}

/**
 * Auswahl für den Guide. Thementreffer zuerst; reichen sie (≥ `minProgramme`),
 * bleiben die Kategorie-Events draußen, sonst füllen sie regional gestreut auf.
 */
export function pickSeasonEvents(
  topicHits: SaisonEvent[],
  generic: SaisonEvent[],
  opts: PickOptions = {},
): SeasonPick {
  const perBl = opts.perBundesland ?? 5;
  const max = opts.max ?? 36;
  const minProgramme = opts.minProgramme ?? MIN_PROGRAMME_EVENTS;

  const topicPicked = spread(topicHits, perBl, max, true);
  if (topicHits.length >= minProgramme) {
    return { events: topicPicked, topicCount: topicHits.length, programmeKnown: true };
  }
  const seen = new Set(topicPicked.map((e) => `${e.title}|${e.start_date}`));
  const fill = spread(generic.filter((e) => !seen.has(`${e.title}|${e.start_date}`)), perBl, max - topicPicked.length, false);
  return {
    events: [...topicPicked, ...fill],
    topicCount: topicHits.length,
    programmeKnown: topicHits.length > 0,
  };
}

const DENIAL_RE = /(noch )?nicht (angekündigt|bekannt|veröffentlicht|festgelegt)|(noch )?keine?\s+\S*\s*(bekannt|angekündigt)|liegen (noch )?keine|nichts (angekündigt|bekannt)/i;
/**
 * Bezug auf unser eigenes Wissen. Alle falschen Sätze des Silvester-Guides
 * vom 03.11.2026 hatten ihn („in unserer Datenbank noch nicht angekündigt",
 * „bei uns noch nicht angekündigt"). Belegte Aussagen über einzelne
 * Veranstaltungen („das Bühnenprogramm des Silvesterpfads ist laut
 * Veranstalter noch nicht veröffentlicht") sind wahr und erlaubt; an zwei
 * solchen Sätzen scheiterten die ersten Läufe nach PR #440.
 */
const OWN_KNOWLEDGE_RE = /datenbank|bei uns|uns (noch )?(nicht )?bekannt|lasstreffen|wir (kennen|wissen|haben)/i;

/**
 * Behauptet der Entwurf, WIR kennten das Programm nicht? Liefert den ersten
 * Satz, der eine Verneinung mit unserem eigenen Wissen verbindet, sonst
 * undefined. Preis-Sätze („Preise bei uns noch nicht bekannt") zählen nicht.
 */
export function deniesProgramme(draft: unknown): string | undefined {
  const texts: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(draft);
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?;])\s+/)) {
      if (!DENIAL_RE.test(sentence)) continue;
      if (/preis|eintritt|kosten|€|euro/i.test(sentence)) continue;
      if (OWN_KNOWLEDGE_RE.test(sentence)) return sentence.trim();
    }
  }
  return undefined;
}

/** Stand eines geschriebenen Guides (src/content/blog/saison-state.json). */
export interface SaisonGuideState {
  /** Thementreffer beim letzten Schreiben. */
  topicCount: number;
  /** ISO-Tag des letzten Schreibens (Erstfassung oder Nachziehen). */
  writtenAt: string;
}

/**
 * Soll ein bestehender Guide nachgezogen werden? Ja, wenn das Programm jetzt
 * bekannt ist (≥ MIN_PROGRAMME_EVENTS), beim letzten Stand nicht war oder
 * seitdem um den Faktor gewachsen ist, und der letzte Stand alt genug ist.
 * Ohne gespeicherten Stand (Guides von vor dieser Regel) zählt der alte
 * Stand als null Treffer.
 */
export function needsRefresh(
  prev: SaisonGuideState | undefined,
  topicCount: number,
  today = new Date(),
): boolean {
  if (topicCount < MIN_PROGRAMME_EVENTS) return false;
  if (!prev) return true;
  const ageDays = (Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`) - Date.parse(`${prev.writtenAt}T00:00:00Z`)) / DAY_MS;
  if (ageDays < REFRESH_MIN_INTERVAL_DAYS) return false;
  if (prev.topicCount < MIN_PROGRAMME_EVENTS) return true;
  return topicCount >= prev.topicCount * REFRESH_GROWTH_FACTOR;
}
