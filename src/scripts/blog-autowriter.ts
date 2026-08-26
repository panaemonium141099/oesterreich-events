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
}

interface AutowriterState {
  covered: Array<{ eventId: string; slug: string; title: string; writtenAt: string }>;
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
    .select('id, title, start_date, end_date, location_name, address, postal_code, bundesland, image_url, source_name, source_url, ticket_url, quality_score, description')
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
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600`;
    const res = await fetch(api, { headers: { 'User-Agent': 'LassTreffenBot/1.0 (https://lasstreffen.at)' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const json = await res.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }> }> };
    };
    for (const page of Object.values(json.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const license = meta.LicenseShortName?.value ?? '';
      const url = info?.thumburl ?? info?.url;
      if (!url || !/(^CC|Public domain)/i.test(license)) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(url)) continue;
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
      const research = await researchEvent(ai, c);
      if (research.trim().length < 800) {
        log('  Recherche zu dünn — skip');
        continue;
      }

      const draft = await composePost(ai, c, research);
      sanitizeDraft(draft, c);
      const errors = validateDraft(draft);
      if (errors.length > 0) {
        log(`  Entwurf verworfen: ${errors.join('; ')}`);
        continue;
      }

      if (dryRun) {
        log(`  DRY-RUN ok: ${slug} — "${draft.title as string}"`);
        written++;
        continue;
      }

      const hero = await resolveHero(c, slug);
      if (!hero) {
        log('  Kein brauchbares Hero-Bild — skip');
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
      written++;
      log(`  ✓ geschrieben: ${slug}`);
    } catch (err) {
      log(`  Fehler bei "${c.title}": ${err instanceof Error ? err.message : String(err)} — skip`);
    }
  }

  if (written === 0) {
    throw new Error('Kein Post geschrieben — alle Kandidaten verworfen (siehe Log)');
  }
  log(`Fertig: ${written} Post(s) — ${writtenSlugs.join(', ')}`);
  // Für den Commit-Step der GitHub-Action
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) fs.appendFileSync(ghOutput, `slugs=${writtenSlugs.join(' ')}\n`);
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
