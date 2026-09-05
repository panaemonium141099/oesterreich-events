/**
 * Blog-Autowriter (fn-19): schreibt täglich 1-2 SEO-Blogposts zu aktuellen
 * Events/Festivals — vollautomatisch (User-Entscheidung 2026-08-26).
 *
 * Pipeline pro Post:
 *   1. Kandidat aus Supabase: kommendes Event (10-75 Tage), quality_score
 *      hoch, MIT Bild (Hero-Pflicht!), Eventim/Ticket-Events bevorzugt
 *      (Affiliate), Dedupe gegen bestehende Posts + autowriter-state.json.
 *   2. Recherche: Gemini 2.5 Flash + Google-Search-Grounding — echte
 *      Fakten (Termine, Preise, Programm, Geschichte) statt Halluzination.
 *   3. Komposition: zweiter Gemini-Call OHNE Tools im JSON-Modus gegen
 *      ein striktes Template; harte Felder (Datum, Ort, JSON-LD-Termine)
 *      kommen aus der DB, nie vom Modell.
 *   4. Hero-Bild: event.image_url herunterladen (Promo-Bild des Happenings
 *      selbst, v. a. Eventim-PFT); Fallback Wikimedia-Commons-CC-Suche;
 *      ohne Bild wird der Kandidat verworfen — nie ein Post ohne Hero.
 *   5. Validierung (Mindestlängen, SEO-Limits, Slug-Kollision) →
 *      TS-Datei via JSON-Serialisierung (garantiert kompilierbar) +
 *      Registry-Eintrag über Marker-Kommentare in index.ts + Smoke-Import.
 *
 * Läuft in GitHub Actions (blog-autowriter.yml) und committet direkt auf
 * master → Vercel deployt, sitemap-core.xml zieht ALL_POSTS automatisch.
 *
 * Aufruf: tsx src/scripts/blog-autowriter.ts [--count 2] [--dry-run]
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startWorkflowRun, finishWorkflowRun, type WorkflowItem } from '../lib/reporting/workflow-run';

const ROOT = path.resolve(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'blog', 'posts');
const INDEX_FILE = path.join(ROOT, 'src', 'content', 'blog', 'index.ts');
const STATE_FILE = path.join(ROOT, 'src', 'content', 'blog', 'autowriter-state.json');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'blog');

const IMPORT_MARKER = '// AUTOWRITER-IMPORTS-END';
const POSTS_MARKER = '// AUTOWRITER-POSTS-END';

/** Feste Kategorie→Farbe-Zuordnung (Vokabular der bestehenden 64 Posts). */
const CATEGORIES: Record<string, string> = {
  'Musik & Festival': 'bg-purple-700 text-white',
  'Kultur & Tradition': 'bg-teal-700 text-white',
  'Kultur & Bühne': 'bg-blue-700 text-white',
  'Kulinarik & Tradition': 'bg-amber-800 text-white',
  'Sport & Outdoor': 'bg-green-700 text-white',
};
const DEFAULT_CATEGORY = 'Kultur & Tradition';

interface Candidate {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  ticket_url: string | null;
  quality_score: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AutowriterState {
  covered: Array<{ eventId: string; slug: string; title: string; writtenAt: string }>;
  /** fn-21: abgearbeitete Stay-Guide-Topics (Topic-Slugs, rotieren). */
  stayGuides?: string[];
}

// ─── Utilities ────────────────────────────────────────────────────────────

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function normTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => w.length >= 4),
  );
}

/** Jaccard-Ähnlichkeit der Titel-Tokens — schützt vor Doppel-Coverage
 *  (gleiches Festival unter leicht anderem Event-Titel). */
function titleSimilarity(a: string, b: string): number {
  const ta = normTokens(a);
  const tb = normTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

function log(msg: string): void {
  console.log(`[autowriter] ${msg}`);
}

// ─── Kandidaten ───────────────────────────────────────────────────────────

async function fetchCandidates(supabase: SupabaseClient): Promise<Candidate[]> {
  const from = new Date(Date.now() + 10 * 86400_000).toISOString();
  const to = new Date(Date.now() + 75 * 86400_000).toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('id, title, start_date, end_date, location_name, address, postal_code, bundesland, image_url, source_name, source_url, ticket_url, quality_score, description, latitude, longitude')
    .eq('publish_status', 'published')
    .eq('visibility', 'public')
    .gte('quality_score', 70)
    .gte('start_date', from)
    .lte('start_date', to)
    .not('image_url', 'is', null)
    .order('quality_score', { ascending: false })
    .limit(80);

  if (error) throw new Error(`candidate query failed: ${error.message}`);

  // Eventim-/Ticket-Events zuerst (Affiliate-Monetarisierung), dann
  // "Festival-hafte" Titel — die tragen als Blog-Thema am weitesten.
  const festivalRe = /festival|fest\b|open.?air|festspiele|kirtag|messe|lauf|marathon|konzert|tour/i;
  return (data as Candidate[]).sort((a, b) => {
    const score = (e: Candidate) =>
      (e.ticket_url ? 2 : 0) + (festivalRe.test(e.title) ? 1 : 0) + (e.quality_score ?? 0) / 100;
    return score(b) - score(a);
  });
}

// ─── Gemini ───────────────────────────────────────────────────────────────

function textOf(response: unknown): string {
  const r = response as { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  if (typeof r.text === 'string' && r.text.length > 0) return r.text;
  return (r.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
}

async function researchEvent(ai: GoogleGenAI, c: Candidate): Promise<string> {
  const prompt = `Recherchiere gründlich das folgende Event in Österreich für einen Blogartikel. Nutze aktiv die Google-Suche und liefere NUR verifizierte Fakten mit heutigem Stand — wenn du etwas nicht findest, schreib "unbekannt" statt zu raten.

Event: ${c.title}
Datum laut unserer Datenbank: ${datePart(c.start_date)}${c.end_date ? ` bis ${datePart(c.end_date)}` : ''}
Ort: ${[c.location_name, c.address, c.bundesland].filter(Boolean).join(', ')}
${c.description ? `Beschreibung der Quelle: ${c.description.slice(0, 600)}` : ''}

Recherchiere und liste strukturiert:
1. Offizielle Website und exakte Termine/Öffnungszeiten
2. Programm/Lineup/Highlights (mit Namen, sofern bekannt)
3. Ticketpreise / Eintritt
4. Geschichte und Bedeutung des Events (seit wann, Besucherzahlen)
5. Anreise, Location-Details
6. Praktische Tipps (Wetter/Ausrüstung/Verpflegung, was man wissen muss)
7. Häufig gestellte Fragen von Besuchern und deren Antworten`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 4000,
      temperature: 0.2,
    },
  });
  return textOf(response);
}

// ─── fn-21: Unterkünfte ───────────────────────────────────────────────────

/**
 * Deterministische Übernachtungs-Erwähnung für Event-Posts: Name + Entfernung
 * kommen aus unserer eigenen stay_pois-Tabelle (OSM) via nearby_stays-RPC —
 * NICHT vom Modell, damit hier nichts halluziniert werden kann. Liefert einen
 * practicalInfo-Eintrag oder null (Event ohne Koordinaten / keine Treffer).
 */
async function nearbyStayInfo(
  supabase: SupabaseClient,
  c: Candidate,
): Promise<{ icon: string; label: string; text: string } | null> {
  if (c.latitude == null || c.longitude == null) return null;
  const { data, error } = await supabase.rpc('nearby_stays', {
    p_lat: c.latitude,
    p_lng: c.longitude,
    p_limit: 2,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const fmt = (km: number) =>
    km < 0.95 ? `${Math.max(1, Math.round(km * 10)) * 100} m` : `${km.toFixed(1).replace('.', ',')} km`;
  const [a, b] = data as Array<{ name: string; distance_km: number }>;
  const second = b ? `, das ${b.name} ${fmt(b.distance_km)}` : '';
  return {
    icon: '🛏️',
    label: 'Übernachten',
    text: `Wer nach dem Event nicht mehr fahren will: Das ${a.name} liegt nur ${fmt(a.distance_km)} vom Veranstaltungsort entfernt${second} — weitere Unterkünfte mit passendem Check-in-Datum in der Übernachten-Box weiter unten.`,
  };
}

/**
 * Stay-Guide-Themen (rotieren wöchentlich, State: stayGuides). Kuratierte
 * Region×Anlass-Paare mit stabiler Slug-Basis und Wikimedia-Suchbegriff
 * fürs Hero-Bild. ctaLink zeigt auf den passenden Bundesland-Hub.
 */
interface StayTopic {
  slug: string;
  region: string;
  angle: string;
  heroQuery: string;
  ctaLink: string;
  ctaText: string;
}

const STAY_TOPICS: StayTopic[] = [
  { slug: 'graz-konzertbesucher', region: 'Graz', angle: 'Konzert- und Festivalbesucher (zentrumsnah, spätes Einchecken)', heroQuery: 'Graz Uhrturm Schlossberg', ctaLink: '/steiermark', ctaText: 'Events in der Steiermark entdecken' },
  { slug: 'wien-guenstig', region: 'Wien', angle: 'günstig übernachten für Konzert- und Festivalnächte', heroQuery: 'Wien Stephansdom Panorama', ctaLink: '/wien', ctaText: 'Events in Wien entdecken' },
  { slug: 'salzburg-festspielzeit', region: 'Salzburg', angle: 'Festspiel- und Konzertbesucher in der Altstadt', heroQuery: 'Salzburg Altstadt Festung Hohensalzburg', ctaLink: '/salzburg', ctaText: 'Events in Salzburg entdecken' },
  { slug: 'neusiedler-see-festivalsommer', region: 'Neusiedler See / Seewinkel', angle: 'Festivalsommer zwischen Nova Rock und Seefestspielen', heroQuery: 'Neusiedler See Schilf', ctaLink: '/burgenland', ctaText: 'Events im Burgenland entdecken' },
  { slug: 'innsbruck-berge', region: 'Innsbruck', angle: 'Städtetrip mit Bergblick, Konzerte und Bergsilvester', heroQuery: 'Innsbruck Nordkette Goldenes Dachl', ctaLink: '/tirol', ctaText: 'Events in Tirol entdecken' },
  { slug: 'woerthersee-eventsommer', region: 'Wörthersee', angle: 'Eventsommer am See (Ironman, Fêtes, Starnacht)', heroQuery: 'Wörthersee Klagenfurt', ctaLink: '/kaernten', ctaText: 'Events in Kärnten entdecken' },
  { slug: 'linz-staedtetrip', region: 'Linz', angle: 'Städtetrip zu Klangwolke, Ars Electronica und Konzerten', heroQuery: 'Linz Donau Hauptplatz', ctaLink: '/oberoesterreich', ctaText: 'Events in Oberösterreich entdecken' },
  { slug: 'wachau-weinherbst', region: 'Wachau', angle: 'Weinherbst, Feste und Konzerte im Welterbe-Tal', heroQuery: 'Wachau Dürnstein Donau Weinberge', ctaLink: '/niederoesterreich', ctaText: 'Events in Niederösterreich entdecken' },
  { slug: 'bregenz-festspiele', region: 'Bregenz', angle: 'Bregenzer Festspiele und Bodensee-Events', heroQuery: 'Bregenz Bodensee Seebühne', ctaLink: '/vorarlberg', ctaText: 'Events in Vorarlberg entdecken' },
  { slug: 'thermen-oststeiermark', region: 'Thermenregion Oststeiermark', angle: 'Thermenwochenende kombiniert mit Festen und Kulinarik-Events', heroQuery: 'Steiermark Thermenland Landschaft', ctaLink: '/steiermark', ctaText: 'Events in der Steiermark entdecken' },
  { slug: 'salzkammergut-sommer', region: 'Salzkammergut', angle: 'Seenhopping zwischen Festivals, Kirtagen und Konzerten', heroQuery: 'Hallstatt Salzkammergut See', ctaLink: '/oberoesterreich', ctaText: 'Events in Oberösterreich entdecken' },
  { slug: 'zillertal-winter', region: 'Zillertal', angle: 'Skihütten und Après-Events im Winter', heroQuery: 'Zillertal Winter Berge', ctaLink: '/tirol', ctaText: 'Events in Tirol entdecken' },
];

async function researchStayGuide(ai: GoogleGenAI, topic: StayTopic): Promise<string> {
  const prompt = `Recherchiere per Google-Suche ECHTE, aktuell existierende Unterkünfte in/um ${topic.region} (Österreich), die besonders gut passen für: ${topic.angle}.

Liefere 6-8 Unterkünfte, für JEDE strukturiert und nur mit verifizierten Fakten (wenn unbekannt: "unbekannt" schreiben, NICHTS raten):
- Exakter Name der Unterkunft
- Ort/Gemeinde
- Art (Hotel, Pension, Ferienwohnung, Almhütte, Camping, Design-Hotel, Therme ...)
- Was sie besonders macht (Lage, Ausstattung, Geschichte — 2-3 Fakten)
- Preisniveau grob (günstig / mittel / gehoben), falls auffindbar

Danach zusätzlich:
- 3-4 praktische Tipps zum Übernachten in ${topic.region} (beste Buchungszeit, Anreise, Viertel/Lagen)
- 3-4 häufige Fragen von Besuchern mit Antworten`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 4000,
      temperature: 0.2,
    },
  });
  return textOf(response);
}

async function composeStayGuide(ai: GoogleGenAI, topic: StayTopic, research: string): Promise<Record<string, unknown>> {
  const prompt = `Du schreibst für LassTreffen.at (österreichische Event-Plattform) einen deutschen SEO-Blogartikel der Rubrik "Übernachten": besondere/passende Unterkünfte in ${topic.region} für ${topic.angle}. Basis sind AUSSCHLIESSLICH die Recherche-Fakten unten — erfinde keine Unterkünfte und keine Fakten dazu; nimm NUR Unterkünfte, die in der Recherche vorkommen.

RECHERCHE:
${research}

Antworte NUR mit einem JSON-Objekt exakt dieser Form (alle Texte Deutsch, Sie-Form, magazinig aber faktentreu):
{
  "title": "prägnanter Titel mit ${topic.region}",
  "subtitle": "eine Zeile mit konkretem Nutzenversprechen",
  "excerpt": "150-250 Zeichen Teaser",
  "intro": "3-5 Sätze Einstieg mit Bezug zu Events/Anlass, min. 400 Zeichen",
  "historyTitle": "Überschrift, z. B. 'Warum ${topic.region} besonders übernachtet'",
  "history": "Kontext zur Region/Unterkunftslandschaft, min. 300 Zeichen",
  "whatToExpectTitle": "Überschrift zur Auswahl",
  "whatToExpect": "Wie die Auswahl zustande kommt / für wen was passt, min. 250 Zeichen",
  "whatToExpectList": ["5-7 kompakte Merkpunkte"],
  "practicalInfo": [{ "icon": "ein Emoji", "label": "Buchen|Anreise|Lage|...", "text": "konkreter Tipp aus der Recherche" }],
  "stays": [{ "name": "EXAKTER Name aus der Recherche", "place": "Ort", "region": "Teilregion/Bundesland", "kind": "Kurz-Attribut wie 'Design-Hotel' oder 'Almhütte'", "description": "2-4 faktenbasierte Sätze aus der Recherche" }],
  "seoTitle": "max. 60 Zeichen, Haupt-Keyword vorn (übernachten/${topic.region})",
  "seoDescription": "max. 155 Zeichen",
  "keywords": ["6-10 deutsche Suchbegriffe"],
  "faqs": [{ "question": "…", "answer": "…" }]
}
Mindestens 5 stays, mindestens 3 practicalInfo, mindestens 3 faqs. KEINE Preise in Euro nennen (ändern sich) — nur Preisniveau in Worten.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8000,
      temperature: 0.5,
    },
  });
  return JSON.parse(textOf(response)) as Record<string, unknown>;
}

/**
 * Anti-Halluzinations-Gate: jede Unterkunft muss namentlich in der
 * GEGROUNDETEN Recherche vorkommen — was Gemini beim Komponieren dazu
 * erfindet, fliegt raus. Danach müssen >= 4 übrig sein.
 */
function verifyStaysAgainstResearch(
  stays: Array<Record<string, unknown>>,
  research: string,
): Array<Record<string, unknown>> {
  const haystack = research.toLowerCase();
  return stays.filter((s) => {
    const name = String(s.name ?? '').trim();
    if (name.length < 3) return false;
    // Tokenweise: die zwei längsten Namens-Tokens müssen beide vorkommen
    // (übersteht Zusätze wie "Hotel"/"Das" im komponierten Namen).
    const tokens = name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 4)
      .sort((a, b) => b.length - a.length).slice(0, 2);
    if (tokens.length === 0) return false;
    return tokens.every(t => haystack.includes(t));
  });
}

async function composePost(ai: GoogleGenAI, c: Candidate, research: string): Promise<Record<string, unknown>> {
  const categories = Object.keys(CATEGORIES).join(' | ');
  const prompt = `Du schreibst für LassTreffen.at (österreichische Event-Plattform) einen hochwertigen deutschen SEO-Blogartikel über dieses Event. Basis sind AUSSCHLIESSLICH die Recherche-Fakten unten — erfinde nichts dazu; wo die Recherche "unbekannt" sagt, formuliere ohne konkrete Zahl.

EVENT: ${c.title}
DATUM (fix, nicht ändern): ${datePart(c.start_date)}
ORT: ${[c.location_name, c.address, c.bundesland].filter(Boolean).join(', ')}

RECHERCHE:
${research}

Antworte NUR mit einem JSON-Objekt exakt dieser Form (alle Texte Deutsch, Sie-Form wie ein Magazin, lebendig aber faktentreu):
{
  "title": "prägnanter Titel ohne Jahreszahl-Spam",
  "subtitle": "eine Zeile, macht Lust aufs Event — mit Ortsnennung",
  "excerpt": "150-250 Zeichen Teaser",
  "category": "${categories} — wähle EINE",
  "keyFacts": {
    "dates": "menschenlesbare Termine",
    "location": "Venue/Spielorte",
    "address": "Straße, PLZ Ort",
    "genre": "Genre/Art des Events",
    "price": "Preisinfo oder 'Eintritt frei'",
    "website": "offizielle URL",
    "capacity": "Besucher/Kapazität oder weglassen",
    "since": "Gründungsjahr oder weglassen"
  },
  "lineup": [{ "name": "Act/Programmpunkt", "role": "headliner|support|special", "stage": "Bühne/Ort optional" }],
  "lineupTitle": "Lineup ODER Programm-Highlights",
  "lineupNote": "optionaler Hinweis, z. B. wann das volle Programm erscheint",
  "intro": "3-5 Sätze szenischer Einstieg, min. 400 Zeichen",
  "historyTitle": "Überschrift zur Geschichte",
  "history": "Geschichte/Bedeutung, min. 400 Zeichen",
  "whatToExpectTitle": "Überschrift",
  "whatToExpect": "Was Besucher erwartet, min. 300 Zeichen",
  "whatToExpectList": ["5-7 konkrete Highlights"],
  "practicalInfo": [{ "icon": "ein Emoji", "label": "Tickets|Anreise|...", "text": "konkreter Tipp" }],
  "ctaText": "Call-to-Action, z. B. 'Alle Events in <Bundesland> entdecken'",
  "seoTitle": "max. 60 Zeichen, Haupt-Keyword vorn",
  "seoDescription": "max. 155 Zeichen",
  "keywords": ["6-10 deutsche Suchbegriffe"],
  "faqs": [{ "question": "…", "answer": "…" }],
  "endDate": "yyyy-mm-dd letzter Eventtag laut Recherche, sonst leer"
}
Mindestens 4 faqs, mindestens 3 practicalInfo-Einträge.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8000,
      temperature: 0.5,
    },
  });
  return JSON.parse(textOf(response)) as Record<string, unknown>;
}

// ─── Validierung ──────────────────────────────────────────────────────────

const isStr = (v: unknown, min = 1, max = 100_000): v is string =>
  typeof v === 'string' && v.trim().length >= min && v.length <= max;

/** Kuerzt an einer Wortgrenze auf max. `max` Zeichen. */
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '');
}

/** Mechanisch fixbare Verstoesse reparieren, BEVOR validiert wird
 *  (Befund E2E-Lauf 2026-08-26: Gemini schreibt seoDescription ein paar
 *  Zeichen zu lang und laesst website bei kleinen Events leer — beides
 *  liess JEDEN Kandidaten durchfallen und trieb den Job ins Timeout).
 *  Nur zu Kurzes bleibt ein harter Fehler. */
function sanitizeDraft(d: Record<string, unknown>, c: Candidate): void {
  if (typeof d.seoTitle === 'string') d.seoTitle = truncateAtWord(d.seoTitle, 65);
  if (typeof d.seoDescription === 'string') d.seoDescription = truncateAtWord(d.seoDescription, 158);
  if (typeof d.excerpt === 'string') d.excerpt = truncateAtWord(d.excerpt, 390);
  if (typeof d.subtitle === 'string') d.subtitle = truncateAtWord(d.subtitle, 200);
  // Lineup: Gemini schreibt statt der role-Enum gern Klartext
  // ("Regie", "Hauptrolle" — Befund Lauf 2026-08-27). Gueltige Enum-Werte
  // bleiben, alles andere wandert nach stage (dort rendert es die
  // Detailseite als Freitext) — nie einen Kandidaten dafuer verwerfen.
  if (Array.isArray(d.lineup)) {
    const VALID_ROLES = new Set(['headliner', 'support', 'special']);
    d.lineup = d.lineup
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && isStr((a as Record<string, unknown>).name))
      .map(a => {
        const entry: Record<string, unknown> = { name: String(a.name) };
        if (typeof a.role === 'string' && VALID_ROLES.has(a.role)) entry.role = a.role;
        else if (isStr(a.role) && !isStr(a.stage)) entry.stage = a.role;
        if (isStr(a.stage)) entry.stage = a.stage;
        if (isStr(a.day)) entry.day = a.day;
        if (isStr(a.time)) entry.time = a.time;
        return entry;
      });
  }

  const kf = d.keyFacts as Record<string, unknown> | undefined;
  if (kf && !/^https?:\/\//.test(String(kf.website ?? ''))) {
    // Kein Web-Fund -> Ticket-/Quell-URL aus der DB ist immer eine echte
    // URL zum Happening (Eventim-Deeplink traegt zudem die Affiliate-ID).
    const fallback = c.ticket_url ?? c.source_url;
    if (fallback) kf.website = fallback;
  }
}

/** Prüft den Gemini-Entwurf hart — bei Verstoß wird der Kandidat verworfen
 *  (fail loud im Log), NIE ein halbgarer Post publiziert. */
function validateDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

  need(isStr(d.title, 8, 120), 'title fehlt/zu kurz');
  need(isStr(d.subtitle, 10, 200), 'subtitle fehlt');
  need(isStr(d.excerpt, 100, 400), 'excerpt nicht 100-400 Zeichen');
  need(isStr(d.intro, 350), 'intro < 350 Zeichen');
  need(isStr(d.history, 350), 'history < 350 Zeichen');
  need(isStr(d.whatToExpect, 250), 'whatToExpect < 250 Zeichen');
  need(isStr(d.historyTitle, 5), 'historyTitle fehlt');
  need(isStr(d.whatToExpectTitle, 5), 'whatToExpectTitle fehlt');
  need(isStr(d.seoTitle, 20, 65), 'seoTitle nicht 20-65 Zeichen');
  need(isStr(d.seoDescription, 70, 160), 'seoDescription nicht 70-160 Zeichen');
  need(Array.isArray(d.keywords) && d.keywords.length >= 5, 'keywords < 5');
  need(Array.isArray(d.faqs) && d.faqs.length >= 4, 'faqs < 4');
  need(Array.isArray(d.practicalInfo) && d.practicalInfo.length >= 3, 'practicalInfo < 3');
  need(Array.isArray(d.whatToExpectList) && d.whatToExpectList.length >= 4, 'whatToExpectList < 4');

  const kf = d.keyFacts as Record<string, unknown> | undefined;
  need(!!kf && isStr(kf.dates) && isStr(kf.location) && isStr(kf.genre) && isStr(kf.price), 'keyFacts unvollständig');
  need(!!kf && isStr(kf.website) && /^https?:\/\//.test(String(kf.website)), 'keyFacts.website keine URL');
  return errors;
}

// ─── Hero-Bild ────────────────────────────────────────────────────────────

/** Bildbreite/-hoehe aus JPEG-SOF- bzw. PNG-IHDR-Header (ohne Dependency). */
function imageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xc3) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Ein Hero laeuft full-width ueber 75vh — darunter wird's sichtbar
 *  unscharf (User-Feedback E2E 2026-08-26: Eventim-Teaser sind 222px). */
const MIN_HERO_WIDTH = 900;

async function downloadImage(url: string, destDir: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LassTreffenBot/1.0; +https://lasstreffen.at)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Winzige Platzhalter/Tracking-Pixel aussortieren
    if (buf.length < 15_000) return null;
    const dims = imageDims(buf);
    if (!dims || dims.w < MIN_HERO_WIDTH) {
      log(`  Bild zu klein (${dims ? dims.w + 'px' : 'unlesbar'}): ${url}`);
      return null;
    }
    fs.mkdirSync(destDir, { recursive: true });
    const file = path.join(destDir, `hero.${ext}`);
    fs.writeFileSync(file, buf);
    return `hero.${ext}`;
  } catch {
    return null;
  }
}

interface HeroResult { heroImage: string; credit: string }

/** Wikimedia-Commons-Fallback: CC-Foto des Happenings selbst. */
async function wikimediaHero(title: string, destDir: string): Promise<HeroResult | null> {
  try {
    const q = encodeURIComponent(title.replace(/\b(19|20)\d{2}\b/g, '').trim());
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1800`;
    const res = await fetch(api, { headers: { 'User-Agent': 'LassTreffenBot/1.0 (https://lasstreffen.at)' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const json = await res.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }> }> };
    };
    // Querformat zuerst — der Hero ist breit; Hochkant beschneidet Koepfe.
    const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => {
      const ratio = (p: typeof a) => {
        const i = p.imageinfo?.[0];
        return i?.width && i?.height ? i.width / i.height : 0;
      };
      return ratio(b) - ratio(a);
    });
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const license = meta.LicenseShortName?.value ?? '';
      const url = info?.thumburl ?? info?.url;
      if (!url || !/(^CC|Public domain)/i.test(license)) continue;
      if ((info?.width ?? 0) < 1200) continue;
      if (!/\.(jpe?g|png)/i.test(url)) continue;
      const file = await downloadImage(url, destDir);
      if (!file) continue;
      const artist = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();
      return {
        heroImage: file,
        credit: `Foto: ${artist || 'Wikimedia Commons'}, ${license}, Wikimedia Commons`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveHero(c: Candidate, slug: string): Promise<HeroResult | null> {
  const destDir = path.join(IMAGES_DIR, slug);
  if (c.image_url) {
    const file = await downloadImage(c.image_url, destDir);
    if (file) {
      return { heroImage: file, credit: `Foto: ${c.source_name ?? 'Veranstalter'}` };
    }
    log(`  Bild-Download fehlgeschlagen (${c.image_url}) — versuche Wikimedia`);
  }
  return wikimediaHero(c.title, destDir);
}

// ─── Datei-Ausgabe ────────────────────────────────────────────────────────

function importNameFor(slug: string): string {
  const camel = slug.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
  return /^[0-9]/.test(camel) ? `post${camel}` : camel;
}

function writePostFile(slug: string, post: Record<string, unknown>): string {
  const file = path.join(POSTS_DIR, `${slug}.ts`);
  const body = `import type { FestivalPost } from '../types';

// Automatisch generiert vom Blog-Autowriter (fn-19) am ${new Date().toISOString().slice(0, 10)}.
// Recherche: Gemini + Google-Search-Grounding; harte Fakten (Termine, Ort,
// JSON-LD) stammen aus der Events-DB, nicht vom Modell.
export const post: FestivalPost = ${JSON.stringify(post, null, 2)};
`;
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function updateRegistry(slug: string): void {
  const name = importNameFor(slug);
  let src = fs.readFileSync(INDEX_FILE, 'utf8');
  if (!src.includes(IMPORT_MARKER) || !src.includes(POSTS_MARKER)) {
    throw new Error('Registry-Marker fehlen in index.ts — Abbruch statt kaputter Registry');
  }
  if (src.includes(`'./posts/${slug}'`)) {
    throw new Error(`Slug ${slug} bereits registriert`);
  }
  src = src.replace(IMPORT_MARKER, `import { post as ${name} } from './posts/${slug}';\n${IMPORT_MARKER}`);
  src = src.replace(POSTS_MARKER, `${name},\n  ${POSTS_MARKER}`);
  fs.writeFileSync(INDEX_FILE, src, 'utf8');
}

async function smokeTest(slug: string): Promise<void> {
  const mod = await import(pathToFileURL(path.join(POSTS_DIR, `${slug}.ts`)).href) as { post?: { slug?: string; heroImage?: string } };
  if (mod.post?.slug !== slug) throw new Error(`Smoke-Import fehlgeschlagen für ${slug}`);
  const hero = path.join(ROOT, 'public', mod.post.heroImage!.replace(/^\//, ''));
  if (!fs.existsSync(hero)) throw new Error(`Hero-Bild fehlt auf Disk: ${hero}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Lauf-Protokoll fuer die Bericht-Mail. Schlaegt es fehl, laeuft der
  // Autowriter trotzdem weiter — der Bericht ist nie wichtiger als der Post.
  const runId = await startWorkflowRun('blog-autowriter');
  const reportItems: WorkflowItem[] = [];
  const reportErrors: string[] = [];

  const args = process.argv.slice(2);
  const count = Number(args[args.indexOf('--count') + 1]) || 2;
  const dryRun = args.includes('--dry-run');

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY erforderlich');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Bestehende Posts für Dedupe (Import via tsx — gleiche Quelle wie die App)
  const { ALL_POSTS } = await import('../content/blog/index') as { ALL_POSTS: Array<{ slug: string; title: string }> };
  const state: AutowriterState = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    : { covered: [] };

  // fn-21: --stay-guide schreibt EINEN Unterkunfts-Artikel (Rubrik
  // "Übernachten") aus der rotierenden Topic-Liste und beendet sich.
  if (args.includes('--stay-guide')) {
    await writeStayGuide(ai, state, dryRun, new Set(ALL_POSTS.map(p => p.slug)));
    return;
  }

  const knownTitles = [
    ...ALL_POSTS.map(p => p.title),
    ...state.covered.map(c => c.title),
  ];
  const knownSlugs = new Set([...ALL_POSTS.map(p => p.slug), ...state.covered.map(c => c.slug)]);
  const coveredIds = new Set(state.covered.map(c => c.eventId));

  const candidates = fetchCandidatesFiltered(await fetchCandidates(supabase), knownTitles, coveredIds);
  log(`${candidates.length} Kandidaten nach Dedupe`);

  let written = 0;
  let attempts = 0;
  // Jeder Versuch kostet ~1-2 min Gemini-Zeit; Cap haelt den Job weit
  // unter dem 30-min-Timeout und failt lieber laut mit Log.
  const maxAttempts = count * 5;
  const writtenSlugs: string[] = [];
  for (const c of candidates) {
    if (written >= count || attempts >= maxAttempts) break;
    attempts++;
    log(`Kandidat: "${c.title}" (${datePart(c.start_date)}, ${c.bundesland ?? '?'}, qs=${c.quality_score})`);

    const year = new Date(c.start_date).getFullYear();
    let slug = `${slugifyTitle(c.title)}-${year}`;
    if (knownSlugs.has(slug)) slug = `${slug}-${c.id.slice(0, 6)}`;

    try {
      // Hero ZUERST (billige HTTP-Checks): ohne brauchbares Bild sparen
      // wir uns die zwei teuren Gemini-Calls komplett.
      const hero = await resolveHero(c, slug);
      if (!hero) {
        log('  Kein brauchbares Hero-Bild — skip');
        continue;
      }

      const research = await researchEvent(ai, c);
      if (research.trim().length < 800) {
        log('  Recherche zu duenn — skip');
        continue;
      }

      const draft = await composePost(ai, c, research);
      sanitizeDraft(draft, c);
      const errors = validateDraft(draft);
      if (errors.length > 0) {
        log(`  Entwurf verworfen: ${errors.join('; ')}`);
        continue;
      }

      // fn-21: deterministische Übernachtungs-Erwähnung (Name+Distanz aus
      // stay_pois, nicht vom Modell) als zusätzlicher practicalInfo-Punkt.
      const stayInfo = await nearbyStayInfo(supabase, c);
      if (stayInfo && Array.isArray(draft.practicalInfo)) {
        (draft.practicalInfo as unknown[]).push(stayInfo);
        log(`  Übernachten-Tipp: ${stayInfo.text.slice(0, 70)}…`);
      }

      if (dryRun) {
        log(`  DRY-RUN ok: ${slug} — "${draft.title as string}"`);
        written++;
        continue;
      }

      const kf = draft.keyFacts as Record<string, string>;
      const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.endDate ?? ''))
        && String(draft.endDate) >= datePart(c.start_date)
        ? String(draft.endDate)
        : datePart(c.end_date ?? c.start_date);
      const category = CATEGORIES[draft.category as string] ? (draft.category as string) : DEFAULT_CATEGORY;
      const heroPath = `/images/blog/${slug}/${hero.heroImage}`;

      const post: Record<string, unknown> = {
        slug,
        title: draft.title,
        subtitle: draft.subtitle,
        heroImage: heroPath,
        heroImageCredit: hero.credit,
        // Direkter Kauf-Button (Eventim-Deeplink traegt Affiliate-ID J70)
        ...(c.ticket_url ? { ticketUrl: c.ticket_url } : {}),
        publishDate: new Date().toISOString().slice(0, 10),
        updatedDate: new Date().toISOString().slice(0, 10),
        readingTime: Math.max(4, Math.round(
          [draft.intro, draft.history, draft.whatToExpect].join(' ').split(/\s+/).length / 180,
        ) + 3),
        excerpt: draft.excerpt,
        category,
        categoryColor: CATEGORIES[category],
        keyFacts: {
          dates: kf.dates,
          location: kf.location,
          address: kf.address || [c.address, c.location_name].filter(Boolean).join(', ') || (c.bundesland ?? 'Österreich'),
          genre: kf.genre,
          price: kf.price,
          website: kf.website,
          ...(kf.capacity ? { capacity: kf.capacity } : {}),
          ...(kf.since ? { since: kf.since } : {}),
        },
        lineup: Array.isArray(draft.lineup) ? draft.lineup : [],
        ...(draft.lineupTitle ? { lineupTitle: draft.lineupTitle } : {}),
        ...(draft.lineupNote ? { lineupNote: draft.lineupNote } : {}),
        intro: draft.intro,
        historyTitle: draft.historyTitle,
        history: draft.history,
        whatToExpectTitle: draft.whatToExpectTitle,
        whatToExpect: draft.whatToExpect,
        whatToExpectList: draft.whatToExpectList,
        practicalInfoTitle: 'Praktische Informationen',
        practicalInfo: draft.practicalInfo,
        gallery: [],
        ctaText: isStr(draft.ctaText, 5, 60) ? draft.ctaText : 'Alle Events entdecken',
        ctaLink: '/entdecken',
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        keywords: draft.keywords,
        // Harte Fakten aus der DB — nie vom Modell (Halluzinationsschutz).
        jsonLdEvent: {
          name: draft.title,
          startDate: datePart(c.start_date),
          endDate,
          location: [c.location_name, c.address].filter(Boolean).join(', ') || (c.bundesland ?? 'Österreich'),
          addressCountry: 'AT',
          url: kf.website,
          description: draft.excerpt,
          image: `https://lasstreffen.at${heroPath}`,
        },
        faqs: draft.faqs,
      };

      writePostFile(slug, post);
      updateRegistry(slug);
      await smokeTest(slug);

      state.covered.push({ eventId: c.id, slug, title: c.title, writtenAt: new Date().toISOString() });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
      knownSlugs.add(slug);
      knownTitles.push(c.title);
      writtenSlugs.push(slug);
      reportItems.push({
        // Der Post-Body kommt als lose typisiertes JSON aus dem Modell;
        // fuer den Bericht reicht die Zeichenkette, wie sie im File landet.
        title: String(post.title ?? c.title),
        excerpt: post.excerpt ? String(post.excerpt) : undefined,
        url: `https://lasstreffen.at/blog/${slug}`,
        meta: {
          Anlass: c.title,
          Termin: datePart(c.start_date),
          Bundesland: c.bundesland ?? '—',
          Lesezeit: `${post.readingTime} min`,
        },
      });
      written++;
      log(`  ✓ geschrieben: ${slug}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  Fehler bei "${c.title}": ${msg} — skip`);
      // Auch bei insgesamt erfolgreichem Lauf im Bericht ausweisen: ein
      // Kandidat, der regelmaessig scheitert, ist ein Hinweis auf ein
      // Muster (fehlendes Hero-Bild, Recherche ohne Treffer).
      reportErrors.push(`Kandidat verworfen — "${c.title}": ${msg}`);
    }
  }

  if (written === 0) {
    await finishWorkflowRun(runId, {
      status: 'failed',
      metrics: { Kandidaten: candidates.length, Versuche: attempts, Geschrieben: 0 },
      errors: [...reportErrors, 'Kein Post geschrieben — alle Kandidaten verworfen.'],
    });
    throw new Error('Kein Post geschrieben — alle Kandidaten verworfen (siehe Log)');
  }
  log(`Fertig: ${written} Post(s) — ${writtenSlugs.join(', ')}`);

  await finishWorkflowRun(runId, {
    // Verworfene Kandidaten sind normal (Dedupe, fehlendes Bild). Erst
    // wenn WENIGER als gewuenscht herauskam, ist der Lauf unvollstaendig.
    status: written < count ? 'partial' : 'success',
    metrics: {
      Kandidaten: candidates.length,
      Versuche: attempts,
      Geschrieben: written,
      Gewuenscht: count,
      Verworfen: reportErrors.length,
    },
    items: reportItems,
    errors: reportErrors,
  });

  // Für den Commit-Step der GitHub-Action
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) fs.appendFileSync(ghOutput, `slugs=${writtenSlugs.join(' ')}\n`);
}

// ─── fn-21: Stay-Guide-Lauf ───────────────────────────────────────────────

async function writeStayGuide(
  ai: GoogleGenAI,
  state: AutowriterState,
  dryRun: boolean,
  knownSlugs: Set<string>,
): Promise<void> {
  const covered = new Set(state.stayGuides ?? []);
  // Rotation: erst alle Topics einmal, dann von vorn (Slug bekommt -2, -3 …)
  let topic = STAY_TOPICS.find(t => !covered.has(t.slug));
  let round = 1;
  if (!topic) {
    round = Math.floor(covered.size / STAY_TOPICS.length) + 1;
    topic = STAY_TOPICS[covered.size % STAY_TOPICS.length];
  }
  let slug = `uebernachten-${topic.slug}${round > 1 ? `-${round}` : ''}`;
  if (knownSlugs.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  log(`Stay-Guide: ${topic.region} — ${topic.angle} (${slug})`);

  // Hero ZUERST (billig): Wikimedia-Regionsbild mit Lizenz-Credit.
  const destDir = path.join(IMAGES_DIR, slug);
  const hero = await wikimediaHero(topic.heroQuery, destDir);
  if (!hero) throw new Error(`Kein Wikimedia-Hero für "${topic.heroQuery}" — Abbruch`);

  const research = await researchStayGuide(ai, topic);
  if (research.trim().length < 800) throw new Error('Stay-Recherche zu dünn — Abbruch');

  const draft = await composeStayGuide(ai, topic, research);
  if (typeof draft.seoTitle === 'string') draft.seoTitle = truncateAtWord(draft.seoTitle, 65);
  if (typeof draft.seoDescription === 'string') draft.seoDescription = truncateAtWord(draft.seoDescription, 158);
  if (typeof draft.excerpt === 'string') draft.excerpt = truncateAtWord(draft.excerpt, 390);

  const rawStays = Array.isArray(draft.stays) ? (draft.stays as Array<Record<string, unknown>>) : [];
  const stays = verifyStaysAgainstResearch(rawStays, research)
    .filter(s => isStr(s.name, 3, 120) && isStr(s.place, 2, 100) && isStr(s.description, 40, 800))
    .slice(0, 8)
    .map(s => ({
      name: String(s.name).trim(),
      place: String(s.place).trim(),
      region: isStr(s.region, 2, 80) ? String(s.region).trim() : topic.region,
      kind: isStr(s.kind, 2, 40) ? String(s.kind).trim() : 'Unterkunft',
      description: String(s.description).trim(),
    }));
  if (stays.length < 4) {
    throw new Error(`Nur ${stays.length} verifizierte Unterkünfte (von ${rawStays.length}) — Abbruch statt dünnem Artikel`);
  }
  log(`  ${stays.length}/${rawStays.length} Unterkünfte haben das Recherche-Gate passiert`);

  const required: Array<[string, number]> = [
    ['title', 10], ['subtitle', 10], ['excerpt', 100], ['intro', 300],
    ['historyTitle', 5], ['history', 250], ['whatToExpectTitle', 5],
    ['whatToExpect', 200], ['seoTitle', 20], ['seoDescription', 80],
  ];
  for (const [field, min] of required) {
    if (!isStr(draft[field], min)) throw new Error(`Stay-Draft: Feld ${field} fehlt/zu kurz`);
  }
  if (!Array.isArray(draft.whatToExpectList) || draft.whatToExpectList.length < 4) {
    throw new Error('Stay-Draft: whatToExpectList zu kurz');
  }
  if (!Array.isArray(draft.faqs) || draft.faqs.length < 3) throw new Error('Stay-Draft: faqs zu kurz');
  if (!Array.isArray(draft.practicalInfo) || draft.practicalInfo.length < 2) {
    throw new Error('Stay-Draft: practicalInfo zu kurz');
  }

  if (dryRun) {
    log(`DRY-RUN ok: ${slug} — "${draft.title as string}" mit ${stays.length} Unterkünften`);
    return;
  }

  const heroPath = `/images/blog/${slug}/${hero.heroImage}`;
  const today = new Date().toISOString().slice(0, 10);
  const post: Record<string, unknown> = {
    slug,
    title: draft.title,
    subtitle: draft.subtitle,
    heroImage: heroPath,
    heroImageCredit: hero.credit,
    publishDate: today,
    updatedDate: today,
    readingTime: Math.max(5, Math.round(
      [draft.intro, draft.history, draft.whatToExpect, ...stays.map(s => s.description)].join(' ').split(/\s+/).length / 180,
    ) + 3),
    excerpt: draft.excerpt,
    category: 'Übernachten',
    categoryColor: 'bg-emerald-700 text-white',
    keyFacts: {
      dates: 'Ganzjährig — beliebte Termine früh buchen',
      location: topic.region,
      address: `${topic.region}, Österreich`,
      genre: 'Besondere Unterkünfte',
      price: 'je nach Unterkunft und Saison',
      website: 'https://www.austria.info',
    },
    lineup: [],
    intro: draft.intro,
    historyTitle: draft.historyTitle,
    history: draft.history,
    whatToExpectTitle: draft.whatToExpectTitle,
    whatToExpect: draft.whatToExpect,
    whatToExpectList: draft.whatToExpectList,
    practicalInfoTitle: 'Gut zu wissen',
    practicalInfo: draft.practicalInfo,
    gallery: [],
    ctaText: topic.ctaText,
    ctaLink: topic.ctaLink,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    keywords: Array.isArray(draft.keywords) ? draft.keywords : [`übernachten ${topic.region.toLowerCase()}`],
    faqs: draft.faqs,
    // Bewusst KEIN jsonLdEvent — Guides sind keine Events (fn-21).
    stays,
  };

  writePostFile(slug, post);
  updateRegistry(slug);
  await smokeTest(slug);

  state.stayGuides = [...(state.stayGuides ?? []), topic.slug];
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
  log(`Fertig: Stay-Guide ${slug}`);
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) fs.appendFileSync(ghOutput, `slugs=${slug}\n`);
}

function fetchCandidatesFiltered(
  candidates: Candidate[],
  knownTitles: string[],
  coveredIds: Set<string>,
): Candidate[] {
  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (coveredIds.has(c.id)) continue;
    // Generische Titel ("Klavierkonzert", "Flohmarkt") taugen weder als
    // Blog-Thema noch als Recherche-Query — mind. 2 distinctive Tokens.
    if (normTokens(c.title).size < 2) continue;
    if (knownTitles.some(t => titleSimilarity(t, c.title) >= 0.5)) continue;
    // Auch innerhalb des Laufs nicht zweimal dasselbe Happening
    if (picked.some(p => titleSimilarity(p.title, c.title) >= 0.5)) continue;
    picked.push(c);
  }
  return picked;
}

main().catch(err => {
  console.error('[autowriter] FATAL:', err);
  process.exit(1);
});
