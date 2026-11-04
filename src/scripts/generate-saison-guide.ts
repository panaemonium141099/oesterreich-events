/**
 * Saison-Guide-Autopilot (MASTERPLAN P3).
 *
 * Laeuft taeglich als GitHub Action (saison-guide.yml) und arbeitet den
 * SAISON_KALENDER FRIST-getrieben ab: ein Eintrag wird faellig, sobald sein
 * `liveBy`-Termin naeher als `leadDays` ist. Eine Seite muss live und
 * indexiert sein, BEVOR die Suchnachfrage anzieht — ein Monats-Cron trifft
 * Fristen wie "live bis 20.09." nicht.
 *
 * Zwei Sorten Eintraege (siehe saison-kalender.ts):
 *
 *   • Sammel-Guides: Text entsteht aus echten Events der eigenen Datenbank.
 *
 *   • Themen-Seiten (`brief` + `facts`): handeln von Terminen und Preisen in
 *     der Welt. Diese Zahlen kommen NICHT aus dem Modell, sondern geprueft
 *     aus `facts` und werden woertlich uebernommen. Claude schreibt nur die
 *     Prosa darum herum und recherchiert per `claude -p` mit Websuche
 *     (src/lib/llm/claude-cli.ts, laeuft ueber das Claude-Abo).
 *     Ein Gate verwirft Entwuerfe, die eigene Jahreszahlen erfinden.
 *
 * Bewusst KEIN Event-Daten-Enrichment (Grundsatz MASTERPLAN §6).
 *
 * PROGRAMM ZUM THEMA (seit 2026-11-04): Eintraege mit `topic` holen zuerst
 * die Events ihres Themas (Titel-Suchwoerter im festen Saison-Fenster), die
 * Kategorie-Events fuellen nur auf, wenn das Thema zu wenig hergibt
 * (src/lib/blog/saison-events.ts). Der Silvester-Guide vom 03.11. schrieb
 * „Programm noch nicht angekuendigt", weil die Score-Sortierung ueber ein
 * Zwei-Monats-Fenster nur Novemberkonzerte lieferte, waehrend ueber 300
 * Silvester-Events in der DB lagen. Die Websuche laeuft fuer JEDEN Guide
 * (was findet jedes Jahr statt, mit Quelle), nicht nur fuer Themen-Seiten.
 *
 * NACHZIEHEN: ein geschriebener Guide wird neu generiert, sobald die
 * Themenabfrage deutlich mehr liefert als beim letzten Stand
 * (`needsRefresh`, Stand in src/content/blog/saison-state.json). Slug,
 * publishDate und Hero bleiben, updatedDate wandert.
 *
 * Aufruf: npx tsx src/scripts/generate-saison-guide.ts [--slug <s>] [--force] [--refresh] [--dry-run] [--check]
 *   ohne --slug: der faellige Kalender-Eintrag mit der naechsten Frist,
 *   sonst der naechste Guide, der nachgezogen werden muss.
 *   --refresh: nur nachziehen, keine neuen Guides.
 *   --check: nur die Event-Auswahl ausgeben (ohne Websuche und Modell).
 *   Existiert die Post-Datei schon, wird uebersprungen (ausser --force,
 *   das die Seite wie ein Nachziehen neu schreibt).
 * Exit 0 + Datei geschrieben = Workflow publiziert bzw. macht einen PR;
 * Exit 78 = nichts zu tun.
 *
 * Ausgaben fuer den Workflow (GITHUB_OUTPUT): slug, review ("true" wenn die
 * Fakten zu alt sind und ein Mensch draufschauen muss), mode ("new" oder
 * "refresh").
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { findCommonsPhoto, fetchImage, layoutFor } from '../lib/blog/hero-image';
import { factSourceUrls } from '../lib/blog/fact-sources';
import {
  topicWindow, pickSeasonEvents, matchesTopic, needsRefresh, deniesProgramme,
  type SaisonEvent, type SeasonPick, type SaisonGuideState,
} from '../lib/blog/saison-events';
import { SITE_COUNTRY } from '../lib/site-country';
import { claudeText, claudeJson, ClaudeRateLimitError } from '../lib/llm/claude-cli';
import {
  SAISON_KALENDER, daysUntilDeadline, isDue, factsAreStale,
  type SaisonGuideSpec,
} from '../content/blog/saison-kalender';

// Texte kommen von `claude -p` ueber das Claude-Abo (CLAUDE_CODE_OAUTH_TOKEN),
// seit 2026-09-13 statt Gemini. Recherche werkzeuglastig -> Sonnet reicht,
// Komposition entscheidet ueber die Textqualitaet -> Opus.
const MODEL_RESEARCH = process.env.CLAUDE_BLOG_MODEL_RESEARCH || 'sonnet';
const MODEL_COMPOSE = process.env.CLAUDE_BLOG_MODEL_COMPOSE || 'opus';

const POSTS_DIR = join(process.cwd(), 'src', 'content', 'blog', 'posts');
const INDEX_PATH = join(process.cwd(), 'src', 'content', 'blog', 'index.ts');
const STATE_PATH = join(process.cwd(), 'src', 'content', 'blog', 'saison-state.json');

type ResearchEvent = SaisonEvent;
const EVENT_COLUMNS = 'title,start_date,location_name,bundesland,price_text,source_url,event_score';

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / Key fehlen');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Programm zum Thema: sichtbare AT-Events, deren Titel ein Suchwort des
 * Themas traegt, im festen Saison-Fenster. Hoechstens 1000 Zeilen je
 * Antwort (PostgREST-Deckel), fuer die Auswahl von 36 reicht das.
 */
async function topicEvents(sb: SupabaseClient, spec: SaisonGuideSpec, today: Date): Promise<ResearchEvent[]> {
  if (!spec.topic) return [];
  const { from, to } = topicWindow(spec.topic.window, today);
  const orFilter = spec.topic.keywords.map((k) => `title.ilike.*${k.replace(/[,()*]/g, '')}*`).join(',');
  const { data, error } = await sb
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('country', SITE_COUNTRY)
    .eq('publish_status', 'published')
    .gte('start_date', `${from}T00:00:00Z`)
    .lte('start_date', `${to}T23:59:59Z`)
    .or(orFilter)
    .order('event_score', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Themen-Abfrage fehlgeschlagen: ${error.message}`);
  // Ausschlusswoerter (z. B. „fußball" bei „ball") prueft erst der Client.
  return (data ?? []).filter((e) => matchesTopic(e.title, spec.topic!));
}

/** Kategorie-Events im relativen Saison-Fenster (die bisherige Abfrage). */
async function categoryEvents(sb: SupabaseClient, spec: SaisonGuideSpec, today: Date): Promise<ResearchEvent[]> {
  const from = new Date(today);
  from.setMonth(from.getMonth() + spec.monthsAhead[0]);
  const to = new Date(today);
  to.setMonth(to.getMonth() + spec.monthsAhead[1]);

  const { data, error } = await sb
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('country', SITE_COUNTRY)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString())
    .eq('publish_status', 'published')
    .in('category', spec.categories)
    .order('event_score', { ascending: false })
    .limit(120);
  if (error) throw new Error(`Event-Recherche fehlgeschlagen: ${error.message}`);
  return data ?? [];
}

/**
 * Events fuer den Guide: Thementreffer zuerst, Kategorie-Events nur zum
 * Auffuellen. Regional gestreut (max. 5 je Bundesland im ersten Durchgang),
 * damit der Guide ganz Oesterreich abdeckt statt nur Wien.
 */
async function researchEvents(spec: SaisonGuideSpec, today = new Date()): Promise<SeasonPick> {
  const sb = supabase();
  const topic = await topicEvents(sb, spec, today);
  const generic = topic.length >= 9 ? [] : await categoryEvents(sb, spec, today);
  return pickSeasonEvents(topic, generic);
}

/** Nur die Zahl der Thementreffer (fuer die Nachzieh-Entscheidung, ohne Zeilen). */
async function topicCount(sb: SupabaseClient, spec: SaisonGuideSpec, today: Date): Promise<number> {
  return (await topicEvents(sb, spec, today)).length;
}

function readState(): Record<string, SaisonGuideState> {
  if (!existsSync(STATE_PATH)) return {};
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Record<string, SaisonGuideState>;
}

function writeState(slug: string, entry: SaisonGuideState): void {
  const state = readState();
  state[slug] = entry;
  const sorted = Object.fromEntries(Object.keys(state).sort().map((k) => [k, state[k]]));
  writeFileSync(STATE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

/**
 * Recherche mit Websuche: laesst Claude den aktuellen Stand zum Thema
 * zusammentragen. Das Ergebnis ist RECHERCHE-MATERIAL fuer die Prosa, keine
 * Faktenquelle — verbindlich sind allein die geprueften `facts` aus dem
 * Kalender. Faellt der Call aus, laeuft der Guide ohne Aussenrecherche
 * weiter (die Fakten stehen ja im Kalender).
 */
async function groundedResearch(spec: SaisonGuideSpec): Promise<string> {
  // Jeder Guide wird recherchiert, nicht nur Themen-Seiten mit `brief`:
  // was jedes Jahr stattfindet, laesst sich belegen, auch wenn die Ausgabe
  // dieses Jahres noch nicht angekuendigt ist (Silvester-Guide 2026-11-03).
  const prompt = `Recherchiere per Websuche den aktuellen Stand zu "${spec.title}" in Oesterreich fuer die kommende Saison.
${spec.brief ?? ''}
Trage zusaetzlich zusammen, welche Veranstaltungen, Braeuche und Orte zu dieser Saison JEDES JAHR wiederkehren (in allen Bundeslaendern, nicht nur Wien): Name, Ort, Veranstalter, seit wann, was dort typischerweise passiert. Diese Angaben duerfen in den Guide, ohne dass ein Termin fuer dieses Jahr feststeht.
${spec.sources?.length ? `Bevorzugte Primaerquellen: ${spec.sources.join(', ')}` : ''}
Antworte in Stichpunkten auf Deutsch. Schreibe zu jeder Angabe die URL dazu, woher sie stammt. Nenne nichts ohne Quelle.
Wenn etwas fuer die kommende Saison noch nicht offiziell angekuendigt ist, schreibe das ausdruecklich hin, statt eine Vermutung zu formulieren.`;
  try {
    return await claudeText(prompt, {
      model: MODEL_RESEARCH,
      allowedTools: ['WebSearch', 'WebFetch'],
      maxTurns: 12,
    });
  } catch (err) {
    if (err instanceof ClaudeRateLimitError) throw err;
    console.warn(`Grounding-Recherche fehlgeschlagen (${String(err)}) — weiter ohne.`);
    return '';
  }
}

/**
 * Sicherheitsnetz gegen erfundene Termine: jede Jahreszahl-Datumsangabe im
 * Entwurf (z. B. "5. Dezember 2026") muss auch in den geprueften Fakten oder
 * in den DB-Events vorkommen. 2026-09 hat sich eine Veranstalterin ueber eine
 * frei erfundene KI-Beschreibung beschwert — seitdem gilt: was ein Datum
 * behauptet, ist belegt oder fliegt raus.
 */
function unsupportedDates(draft: Record<string, unknown>, allowed: string): string[] {
  const MONTHS = ['jaenner', 'januar', 'februar', 'maerz', 'märz', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  const prose = JSON.stringify(draft).toLowerCase();
  const haystack = allowed.toLowerCase();
  const found = new Set<string>();
  for (const month of MONTHS) {
    const re = new RegExp(`(\\d{1,2})\\.\\s*${month}`, 'g');
    for (const m of prose.matchAll(re)) {
      const needle = `${m[1]}. ${month}`;
      const alt = `${m[1]}.${month}`;
      if (!haystack.includes(needle) && !haystack.includes(alt)) found.add(needle);
    }
  }
  return [...found];
}

async function generateDraft(
  spec: SaisonGuideSpec,
  pick: SeasonPick,
  research: string,
): Promise<Record<string, unknown>> {
  const events = pick.events;
  // Ob der Guide „noch nicht angekuendigt" schreiben darf, entscheidet die
  // Themenabfrage, nicht das Modell: mit Programm in der DB ist der Satz falsch.
  const programmeBlock = spec.topic
    ? pick.programmeKnown
      ? `PROGRAMM ZUM THEMA: Unsere Datenbank kennt ${pick.topicCount} Veranstaltungen zu „${spec.title}" in dieser Saison, ${events.length} davon stehen unten. Das Programm IST bekannt. Schreibe nirgends, uns oder unserer Datenbank sei das Programm noch nicht bekannt; schreibe über diese Veranstaltungen. Erlaubt bleibt, belegt und auf die einzelne Veranstaltung bezogen, dass deren Details (Bühnenprogramm, Uhrzeiten, Setlist) laut Veranstalter oder Recherche noch nicht veröffentlicht sind.`
      : `PROGRAMM ZUM THEMA: Unsere Datenbank kennt noch keine Veranstaltung zu „${spec.title}" in dieser Saison. Sag das an EINER Stelle ehrlich, aber mach daraus keinen Refrain. Erzähle stattdessen aus der Recherche, was jedes Jahr wiederkehrt (mit „traditionell" oder „jedes Jahr", ohne Termin für dieses Jahr), und nutze die Events unten nur, wenn sie zum Thema passen.`
    : '';
  // Die geprüften Fakten sind die einzige gültige Quelle für Termine und
  // Preise. Die Grounding-Recherche liefert nur Material für die Prosa.
  const factsBlock = spec.facts?.length
    ? `
GEPRÜFTE FAKTEN — an Primärquellen verifiziert am ${spec.factsVerified}. Das ist die einzige gültige Quelle für Termine, Preise und Öffnungszeiten. Übernimm sie unverändert und widersprich ihnen nirgends:
${spec.facts.map((f) => `- ${f.label}: ${f.value}`).join('\n')}
`
    : '';
  const researchBlock = research
    ? `
HINTERGRUND-RECHERCHE (Material für die Prosa, NICHT Faktenquelle für Termine oder Preise; im Zweifel gelten die geprüften Fakten oben). Was hier als jährlich wiederkehrend belegt ist, darfst du als Tradition nennen („findet jedes Jahr statt"), aber ohne Datum oder Preis für diese Saison, solange der Termin nicht oben in den Fakten oder Events steht:
${research.slice(0, 8000)}
`
    : '';

  const prompt = `Du schreibst für LassTreffen.at (österreichische Event-Plattform, Du-Form, warm, konkret, keine Superlative-Floskeln) einen saisonalen Sammel-Guide als Blog-Post.

Thema: ${spec.title} — ${spec.subtitle}
Such-Intentionen der Leser: ${spec.searchKeywords.join(', ')}
${spec.brief ? `
AUFTRAG: ${spec.brief}
` : ''}${factsBlock}${programmeBlock ? `\n${programmeBlock}\n` : ''}
ECHTE Events aus unserer Datenbank für diese Saison (nutze sie als konkrete Beispiele im Text, korrekt nach Bundesland; erfinde KEINE zusätzlichen Events oder Preise):
${events.map((e) => `- ${e.title} | ${e.start_date.slice(0, 10)} | ${e.location_name ?? '?'} | ${e.bundesland ?? '?'}${e.price_text ? ` | ${e.price_text}` : ''}`).join('\n')}
${researchBlock}
REGELN, die über allem stehen:
1. Nenne KEIN Datum, keinen Preis und keine Öffnungszeit, die nicht oben stehen. Lieber weglassen als schätzen.
2. Ist etwas für die kommende Saison noch nicht angekündigt, schreib genau das hin. Gib nicht das Vorjahr als Gegenwart aus.
3. Keine Gedankenstriche als Einschub im Fließtext.
4. Keine erfundenen Veranstalter, Adressen oder Zitate.

Schreibe auf Deutsch (de-AT). Der Guide soll Lesern helfen, die Saison zu planen: was es gibt, wann es stattfindet, regionale Highlights pro Bundesland, praktische Tipps.`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      excerpt: { type: 'STRING', description: '2 Sätze Teaser' },
      readingTime: { type: 'INTEGER' },
      keyFacts: {
        type: 'OBJECT',
        properties: {
          dates: { type: 'STRING' }, location: { type: 'STRING' },
          address: { type: 'STRING' }, genre: { type: 'STRING' },
          price: { type: 'STRING' }, website: { type: 'STRING' },
        },
        required: ['dates', 'location', 'address', 'genre', 'price', 'website'],
      },
      intro: { type: 'STRING', description: '1 Absatz, szenischer Einstieg' },
      historyTitle: { type: 'STRING' },
      history: { type: 'STRING', description: 'Hintergrund/Tradition der Saison, 1 Absatz' },
      whatToExpectTitle: { type: 'STRING' },
      whatToExpect: { type: 'STRING' },
      whatToExpectList: { type: 'ARRAY', items: { type: 'STRING' }, description: '5-7 konkrete Highlights mit echten Event-Namen' },
      practicalInfoTitle: { type: 'STRING' },
      practicalInfo: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { icon: { type: 'STRING' }, label: { type: 'STRING' }, text: { type: 'STRING' } },
          required: ['icon', 'label', 'text'],
        },
        description: '4-5 Einträge: Termine, Anreise, Preise, Tipps',
      },
      faqs: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
          required: ['question', 'answer'],
        },
        description: '4 FAQs entlang der Such-Intentionen',
      },
      seoTitle: { type: 'STRING', description: 'Title-Tag, max. 60 Zeichen, mit Jahr' },
      seoDescription: { type: 'STRING', description: 'Meta-Description, 140 bis 160 Zeichen' },
      keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: '5 Suchbegriffe, kleingeschrieben' },
      ctaText: { type: 'STRING', description: 'Button-Text zur Event-Suche, z. B. "Adventmärkte in ganz Österreich entdecken"' },
    },
    required: ['excerpt', 'readingTime', 'keyFacts', 'intro', 'historyTitle', 'history', 'whatToExpectTitle', 'whatToExpect', 'whatToExpectList', 'practicalInfoTitle', 'practicalInfo', 'faqs', 'seoTitle', 'seoDescription', 'keywords', 'ctaText'],
  };

  return claudeJson(prompt, toJsonSchema(responseSchema), { model: MODEL_COMPOSE });
}

/** Gemini-Schreibweise (OBJECT, STRING, …) in JSON-Schema-Typen drehen. */
function toJsonSchema(node: unknown): Record<string, unknown> {
  if (Array.isArray(node)) return node.map(toJsonSchema) as unknown as Record<string, unknown>;
  if (!node || typeof node !== 'object') return node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v);
  }
  return out;
}

interface SaisonHero {
  heroImage: string;
  heroImageCredit?: string;
  heroLayout?: 'cover' | 'poster';
  heroImageWidth?: number;
}

/**
 * Hero für eine Saison-Seite. Bevorzugt ein Foto aus der KURATIERTEN
 * Commons-Suche (`heroQuery`) inklusive Relevanz-Gate; erst wenn dabei nichts
 * Passendes herauskommt, greift das statische Kategorie-Bild aus dem Kalender.
 *
 * Der generische Kategorie-Pool ist nämlich nur ein Notnagel: maerkte-1.jpg
 * zeigt ein Supermarktregal, kultur-2.jpg ein Porträtfoto. Als Aufmacher für
 * "Christkindlmärkte" oder "Nationalfeiertag" wäre das genau die Sorte
 * thematisch falsches Bild, die diese Umstellung abstellen soll.
 */
async function resolveSaisonHero(spec: SaisonGuideSpec): Promise<SaisonHero> {
  if (!spec.heroQuery) return { heroImage: spec.heroImage };
  const hit = await findCommonsPhoto(spec.heroQuery, {
    onReject: (url) => console.log(`  Commons-Treffer verworfen (Thema passt nicht): ${url}`),
  });
  if (!hit) {
    console.log(`  Kein passendes Commons-Foto für "${spec.heroQuery}" — nehme ${spec.heroImage}`);
    return { heroImage: spec.heroImage };
  }
  const dl = await fetchImage(hit.url);
  if (!dl) {
    console.log(`  Commons-Download fehlgeschlagen — nehme ${spec.heroImage}`);
    return { heroImage: spec.heroImage };
  }
  const destDir = join(process.cwd(), 'public', 'images', 'blog', spec.slug);
  mkdirSync(destDir, { recursive: true });
  for (const f of readdirSync(destDir)) {
    if (/^hero\.(jpe?g|png|webp)$/i.test(f)) rmSync(join(destDir, f));
  }
  writeFileSync(join(destDir, `hero.${dl.ext}`), dl.buf);
  console.log(`  Hero: ${dl.width}x${dl.height} aus Commons (${hit.credit})`);
  return {
    heroImage: `/images/blog/${spec.slug}/hero.${dl.ext}`,
    heroImageCredit: hit.credit,
    heroLayout: layoutFor(dl.width),
    heroImageWidth: dl.width,
  };
}

/** Was beim Nachziehen aus der bestehenden Seite erhalten bleibt. */
interface ExistingPost {
  publishDate: string;
  hero: SaisonHero;
}

/**
 * Bestehende Seite lesen (Nachziehen): publishDate und Hero bleiben, damit
 * die URL ihre Autoritaet und ihr Bild behaelt. Laesst sich die Datei nicht
 * laden, startet die Seite wie neu.
 */
async function readExistingPost(slug: string): Promise<ExistingPost | undefined> {
  const file = join(POSTS_DIR, `${slug}.ts`);
  if (!existsSync(file)) return undefined;
  try {
    const mod = (await import(pathToFileURL(file).href)) as { post?: Record<string, unknown> };
    const p = mod.post;
    if (!p || typeof p.publishDate !== 'string' || typeof p.heroImage !== 'string') return undefined;
    return {
      publishDate: p.publishDate,
      hero: {
        heroImage: p.heroImage,
        ...(typeof p.heroImageCredit === 'string' ? { heroImageCredit: p.heroImageCredit } : {}),
        ...(p.heroLayout === 'poster' ? { heroLayout: 'poster' as const, heroImageWidth: Number(p.heroImageWidth) || undefined } : {}),
      },
    };
  } catch (err) {
    console.warn(`Bestehende Seite ${slug} nicht lesbar (${String(err)}) — wird wie neu geschrieben.`);
    return undefined;
  }
}

function writePostFile(
  spec: SaisonGuideSpec,
  gen: Record<string, unknown>,
  hero: SaisonHero,
  events: ResearchEvent[],
  existing?: ExistingPost,
): string {
  const today = new Date().toISOString().slice(0, 10);
  // Die geprüften Fakten stehen als eigener practicalInfo-Block ganz oben —
  // wörtlich aus dem Kalender, nicht aus dem Modell. Damit steht das, wonach
  // Leser suchen (Termin, Preis, Öffnungszeit), belegt in der Seite.
  const factRows = (spec.facts ?? []).map((f) => ({
    icon: 'check', label: f.label, text: f.value,
  }));
  const generated = Array.isArray(gen.practicalInfo) ? gen.practicalInfo : [];
  const post = {
    slug: spec.slug,
    title: spec.title,
    subtitle: spec.subtitle,
    heroImage: hero.heroImage,
    ...(hero.heroImageCredit ? { heroImageCredit: hero.heroImageCredit } : {}),
    ...(hero.heroLayout === 'poster' ? { heroLayout: 'poster', heroImageWidth: hero.heroImageWidth } : {}),
    publishDate: existing?.publishDate ?? today,
    updatedDate: today,
    // Belege der Termine: Primärquellen der geprüften Fakten und die Quellen
    // der DB-Events, aus denen der Entwurf Daten nehmen durfte (Gate oben).
    factSources: {
      checkedAt: spec.facts?.length && spec.factsVerified ? spec.factsVerified : today,
      urls: factSourceUrls(spec.sources ?? [], events.map((e) => e.source_url)),
    },
    readingTime: gen.readingTime ?? 7,
    excerpt: gen.excerpt,
    category: spec.category,
    categoryColor: spec.categoryColor,
    keyFacts: gen.keyFacts,
    intro: gen.intro,
    historyTitle: gen.historyTitle,
    history: gen.history,
    whatToExpectTitle: gen.whatToExpectTitle,
    whatToExpect: gen.whatToExpect,
    whatToExpectList: gen.whatToExpectList,
    practicalInfoTitle: gen.practicalInfoTitle,
    practicalInfo: [...factRows, ...generated],
    // Pflichtfelder von FestivalPost, die ein Saison-Guide nicht braucht,
    // aber ohne die der Build bricht (zweimal passiert: 15.09. und 18.09.2026).
    lineup: [],
    gallery: [],
    ctaText: typeof gen.ctaText === 'string' && gen.ctaText.trim() ? gen.ctaText.trim() : `${spec.title} entdecken`,
    ctaLink: '/entdecken',
    seoTitle: typeof gen.seoTitle === 'string' && gen.seoTitle.trim() ? gen.seoTitle.trim().slice(0, 70) : `${spec.title} ${new Date().getFullYear()}: Termine und Tipps`,
    seoDescription: typeof gen.seoDescription === 'string' && gen.seoDescription.trim() ? gen.seoDescription.trim().slice(0, 170) : String(gen.excerpt ?? '').slice(0, 160),
    keywords: Array.isArray(gen.keywords) && gen.keywords.length > 0 ? gen.keywords.map((k: unknown) => String(k)) : spec.searchKeywords,
    faqs: gen.faqs,
  };
  assertFestivalPostShape(post);
  const file = join(POSTS_DIR, `${spec.slug}.ts`);
  writeFileSync(
    file,
    `// Automatisch generierter Saison-Guide (generate-saison-guide.ts) — via PR reviewt.\n` +
    `import type { FestivalPost } from '../types';\n\n` +
    `export const post: FestivalPost = ${JSON.stringify(post, null, 2)};\n`,
    'utf8',
  );
  return file;
}

/**
 * Letzte Sperre vor dem Schreiben: alle Pflichtfelder von FestivalPost
 * (src/content/blog/types.ts) muessen gesetzt sein, sonst faellt `next build`
 * am Typfehler und der Deploy steht (Autopilot pusht direkt auf master).
 */
function assertFestivalPostShape(post: Record<string, unknown>): void {
  const required = [
    'slug', 'title', 'subtitle', 'heroImage', 'publishDate', 'updatedDate', 'readingTime', 'excerpt', 'category',
    'categoryColor', 'keyFacts', 'lineup', 'intro', 'historyTitle', 'history', 'whatToExpectTitle', 'whatToExpect',
    'whatToExpectList', 'practicalInfoTitle', 'practicalInfo', 'gallery', 'ctaText', 'ctaLink', 'seoTitle',
    'seoDescription', 'keywords',
  ];
  const missing = required.filter((k) => post[k] === undefined || post[k] === null || post[k] === '');
  if (missing.length > 0) throw new Error(`Saison-Guide unvollstaendig, fehlende FestivalPost-Felder: ${missing.join(', ')}`);
}

/** Import + ALL_POSTS-Eintrag in index.ts registrieren. */
function registerInIndex(spec: SaisonGuideSpec): void {
  const varName = spec.slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  let src = readFileSync(INDEX_PATH, 'utf8');
  if (src.includes(`posts/${spec.slug}'`)) return; // schon registriert
  src = src.replace(
    /(\nexport const ALL_POSTS)/,
    `import { post as ${varName} } from './posts/${spec.slug}';\n$1`,
  );
  src = src.replace(
    /(export const ALL_POSTS: FestivalPost\[\] = \[\n)/,
    `$1  ${varName},\n`,
  );
  writeFileSync(INDEX_PATH, src, 'utf8');
}

function setOutput(key: string, value: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${key}=${value}\n`);
}

/** Der fälligste offene Eintrag: kürzeste Restfrist zuerst. */
function pickDue(force: boolean): SaisonGuideSpec | undefined {
  return SAISON_KALENDER
    .filter((s) => isDue(s))
    .filter((s) => force || !existsSync(join(POSTS_DIR, `${s.slug}.ts`)))
    .sort((a, b) => daysUntilDeadline(a) - daysUntilDeadline(b))[0];
}

/**
 * Der naechste Guide, der nachgezogen werden muss: geschrieben, mit Thema,
 * in der Saison (Arbeitsfenster bis Fensterende) und mit deutlich mehr
 * Programm als beim letzten Stand. Eine Themenabfrage je Kandidat, hoechstens
 * eine Handvoll am Tag.
 */
async function pickRefresh(today: Date): Promise<{ spec: SaisonGuideSpec; topicCount: number } | undefined> {
  const state = readState();
  const sb = supabase();
  const candidates = SAISON_KALENDER
    .filter((s) => s.topic && existsSync(join(POSTS_DIR, `${s.slug}.ts`)))
    .filter((s) => isDue(s, today) && topicWindow(s.topic!.window, today).to >= today.toISOString().slice(0, 10))
    .sort((a, b) => daysUntilDeadline(a, today) - daysUntilDeadline(b, today));
  for (const spec of candidates) {
    const count = await topicCount(sb, spec, today);
    const prev = state[spec.slug];
    console.log(`Nachzieh-Check ${spec.slug}: ${count} Thementreffer (Stand ${prev ? `${prev.topicCount} am ${prev.writtenAt}` : 'keiner'})`);
    if (needsRefresh(prev, count, today)) return { spec, topicCount: count };
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const force = args.includes('--force');
  const refreshOnly = args.includes('--refresh');
  const dryRun = args.includes('--dry-run');
  // --check: nur die Event-Auswahl zeigen (keine Websuche, kein Modell).
  const checkOnly = args.includes('--check');
  const today = new Date();

  let spec: SaisonGuideSpec | undefined;
  if (slugIdx !== -1) {
    spec = SAISON_KALENDER.find((s) => s.slug === args[slugIdx + 1]);
    if (!spec) {
      console.error(`Unbekannter Kalender-Slug: ${args[slugIdx + 1]}`);
      process.exit(1);
    }
    if (existsSync(join(POSTS_DIR, `${spec.slug}.ts`)) && !force) {
      console.log(`${spec.slug} existiert bereits — nichts zu tun (--force schreibt die Seite neu).`);
      process.exit(78);
    }
  } else if (!refreshOnly) {
    spec = pickDue(force);
  }
  if (!spec) {
    const refresh = await pickRefresh(today);
    if (refresh) {
      spec = refresh.spec;
      console.log(`Nachziehen: ${spec.slug} (${refresh.topicCount} Thementreffer)`);
    }
  }

  if (!spec) {
    // Nur ungeschriebene Einträge zählen, sonst meldete das Log einen längst
    // publizierten Beitrag als "in -54 Tagen" fällig.
    const next = SAISON_KALENDER
      .filter((s) => !existsSync(join(POSTS_DIR, `${s.slug}.ts`)))
      .sort((a, b) => daysUntilDeadline(a) - daysUntilDeadline(b))[0];
    console.log(next
      ? `Kein Saison-Guide fällig oder nachzuziehen. Nächster: ${next.slug} startet in ${daysUntilDeadline(next) - next.leadDays} Tagen (liveBy ${next.liveBy}).`
      : 'Kein Saison-Guide fällig oder nachzuziehen. Alle Kalendereinträge sind geschrieben.');
    process.exit(78);
  }

  const existing = await readExistingPost(spec.slug);
  const mode = existing ? 'refresh' : 'new';
  const rest = daysUntilDeadline(spec, today);
  console.log(`${mode === 'refresh' ? 'Ziehe nach' : 'Generiere'}: ${spec.title} (Frist ${spec.liveBy}, noch ${rest} Tage)`);

  const pick = await researchEvents(spec, today);
  const events = pick.events;
  console.log(`${events.length} Events ausgewählt (${pick.topicCount} Thementreffer, Programm ${pick.programmeKnown ? 'bekannt' : 'unbekannt'}).`);
  if (checkOnly) {
    for (const e of events) console.log(`  ${e.start_date.slice(0, 10)} | ${e.bundesland ?? '?'} | ${e.title} | ${e.location_name ?? '?'}`);
    process.exit(0);
  }
  // Themen-Seiten tragen ihre Fakten im Kalender und funktionieren auch dann,
  // wenn die DB für das Thema noch wenig hergibt (Krampusläufe im September).
  // Reine Sammel-Guides leben dagegen ausschließlich von den Events.
  const minEvents = spec.facts?.length ? 0 : 5;
  if (events.length < minEvents) {
    console.error('Zu wenige Events für einen glaubwürdigen Guide — Abbruch.');
    process.exit(1);
  }

  const research = await groundedResearch(spec);
  if (research) console.log(`Grounding-Recherche: ${research.length} Zeichen`);

  const gen = await generateDraft(spec, pick, research);

  // Gate gegen erfundene Termine: jede Datumsangabe im Entwurf muss aus den
  // geprüften Fakten oder aus echten DB-Events stammen.
  const allowed = [
    ...(spec.facts ?? []).map((f) => `${f.label} ${f.value}`),
    ...events.map((e) => {
      const d = new Date(`${e.start_date.slice(0, 10)}T12:00:00Z`);
      const months = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
        'August', 'September', 'Oktober', 'November', 'Dezember'];
      return `${e.title} ${d.getUTCDate()}. ${months[d.getUTCMonth()]}`;
    }),
  ].join(' | ');
  const bogus = unsupportedDates(gen, allowed);
  if (bogus.length > 0) {
    console.error(`Entwurf verworfen — nicht belegte Datumsangaben: ${bogus.join(', ')}`);
    process.exit(1);
  }
  // Gate gegen den falschen Refrain: mit Programm in der DB darf der Guide
  // nicht behaupten, es sei nichts angekündigt.
  if (pick.programmeKnown && spec.topic) {
    const denial = deniesProgramme(gen);
    if (denial) {
      console.error(`Entwurf verworfen — behauptet trotz ${pick.topicCount} Thementreffern, das Programm sei unbekannt: „${denial}"`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log(`DRY-RUN ok (${mode}): ${spec.slug} — "${String(gen.excerpt).slice(0, 120)}…"`);
    process.exit(0);
  }

  const hero = existing?.hero ?? await resolveSaisonHero(spec);
  const file = writePostFile(spec, gen, hero, events, existing);
  registerInIndex(spec);
  writeState(spec.slug, { topicCount: pick.topicCount, writtenAt: today.toISOString().slice(0, 10) });

  // Alte Fakten => ein Mensch schaut drauf, statt dass Vorjahrestermine
  // stillschweigend live gehen.
  const review = factsAreStale(spec);
  setOutput('slug', spec.slug);
  setOutput('mode', mode);
  setOutput('review', review ? 'true' : 'false');
  console.log(`Geschrieben: ${file} + Registrierung in index.ts + Stand in saison-state.json`);
  if (review) {
    console.log(`::warning::Fakten für ${spec.slug} zuletzt am ${spec.factsVerified ?? 'nie'} geprüft — geht als PR zum Review statt live.`);
  }
  console.log(`::notice::Saison-Guide ${spec.slug} ${mode === 'refresh' ? 'nachgezogen' : 'generiert'} (${events.length} Events, ${pick.topicCount} zum Thema, Frist ${spec.liveBy})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Fehler:', err);
    // Exit 75 = Abo-Sitzungslimit, der Workflow versucht es im naechsten
    // Slot erneut (siehe saison-guide.yml).
    process.exit(err instanceof ClaudeRateLimitError ? 75 : 1);
  },
);
