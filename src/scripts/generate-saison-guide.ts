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
 *     aus `facts` und werden woertlich uebernommen. Gemini schreibt nur die
 *     Prosa darum herum und recherchiert mit Google-Search-Grounding.
 *     Ein Gate verwirft Entwuerfe, die eigene Jahreszahlen erfinden.
 *
 * Bewusst KEIN Event-Daten-Enrichment (Grundsatz MASTERPLAN §6).
 *
 * Aufruf: npx tsx src/scripts/generate-saison-guide.ts [--slug <s>] [--force] [--dry-run]
 *   ohne --slug: der faellige Kalender-Eintrag mit der naechsten Frist.
 *   Existiert die Post-Datei schon, wird uebersprungen (ausser --force).
 * Exit 0 + Datei geschrieben = Workflow publiziert bzw. macht einen PR;
 * Exit 78 = nichts zu tun.
 *
 * Ausgaben fuer den Workflow (GITHUB_OUTPUT): slug, review ("true" wenn die
 * Fakten zu alt sind und ein Mensch draufschauen muss).
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { findCommonsPhoto, fetchImage, layoutFor } from '../lib/blog/hero-image';
import {
  SAISON_KALENDER, daysUntilDeadline, isDue, factsAreStale,
  type SaisonGuideSpec,
} from '../content/blog/saison-kalender';

const POSTS_DIR = join(process.cwd(), 'src', 'content', 'blog', 'posts');
const INDEX_PATH = join(process.cwd(), 'src', 'content', 'blog', 'index.ts');

interface ResearchEvent {
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  price_text: string | null;
}

async function researchEvents(spec: SaisonGuideSpec): Promise<ResearchEvent[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / Key fehlen');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const from = new Date();
  from.setMonth(from.getMonth() + spec.monthsAhead[0]);
  const to = new Date();
  to.setMonth(to.getMonth() + spec.monthsAhead[1]);

  const { data, error } = await sb
    .from('events')
    .select('title,start_date,location_name,bundesland,price_text,event_score,category')
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString())
    .eq('publish_status', 'published')
    .in('category', spec.categories)
    .order('event_score', { ascending: false })
    .limit(120);
  if (error) throw new Error(`Event-Recherche fehlgeschlagen: ${error.message}`);

  // Regional streuen: max. 5 pro Bundesland, damit der Guide ganz
  // Österreich abdeckt statt nur Wien.
  const perBl = new Map<string, number>();
  const picked: ResearchEvent[] = [];
  for (const e of data ?? []) {
    const bl = e.bundesland ?? 'unbekannt';
    const n = perBl.get(bl) ?? 0;
    if (n >= 5) continue;
    perBl.set(bl, n + 1);
    picked.push(e);
    if (picked.length >= 36) break;
  }
  return picked;
}

/**
 * Google-Search-Grounding: laesst Gemini den aktuellen Stand zum Thema
 * zusammentragen. Das Ergebnis ist RECHERCHE-MATERIAL fuer die Prosa, keine
 * Faktenquelle — verbindlich sind allein die geprueften `facts` aus dem
 * Kalender. Faellt der Call aus, laeuft der Guide ohne Aussenrecherche
 * weiter (die Fakten stehen ja im Kalender).
 */
async function groundedResearch(spec: SaisonGuideSpec): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !spec.brief) return '';
  const prompt = `Recherchiere den aktuellen Stand zu "${spec.title}" in Oesterreich fuer die kommende Saison.
${spec.brief}
${spec.sources?.length ? `Bevorzugte Primaerquellen: ${spec.sources.join(', ')}` : ''}
Antworte in Stichpunkten auf Deutsch. Schreibe zu jeder Angabe dazu, woher sie stammt.
Wenn etwas fuer die kommende Saison noch nicht offiziell angekuendigt ist, schreibe das ausdruecklich hin, statt eine Vermutung zu formulieren.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) {
      console.warn(`Grounding-Recherche HTTP ${res.status} — weiter ohne.`);
      return '';
    }
    const body = await res.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((x: { text?: string }) => x.text ?? '').join('\n').trim();
  } catch (err) {
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

async function generateWithGemini(
  spec: SaisonGuideSpec,
  events: ResearchEvent[],
  research: string,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY fehlt');

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
HINTERGRUND-RECHERCHE (Material für die Prosa, NICHT Faktenquelle für Termine oder Preise; im Zweifel gelten die geprüften Fakten oben):
${research.slice(0, 6000)}
`
    : '';

  const prompt = `Du schreibst für LassTreffen.at (österreichische Event-Plattform, Du-Form, warm, konkret, keine Superlative-Floskeln) einen saisonalen Sammel-Guide als Blog-Post.

Thema: ${spec.title} — ${spec.subtitle}
Such-Intentionen der Leser: ${spec.searchKeywords.join(', ')}
${spec.brief ? `
AUFTRAG: ${spec.brief}
` : ''}${factsBlock}
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
    },
    required: ['excerpt', 'readingTime', 'keyFacts', 'intro', 'historyTitle', 'history', 'whatToExpectTitle', 'whatToExpect', 'whatToExpectList', 'practicalInfoTitle', 'practicalInfo', 'faqs'],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.6 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini lieferte keinen Text');
  return JSON.parse(text);
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

function writePostFile(
  spec: SaisonGuideSpec,
  gen: Record<string, unknown>,
  hero: SaisonHero,
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
    publishDate: today,
    updatedDate: today,
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
    faqs: gen.faqs,
  };
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

async function main() {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const spec = slugIdx !== -1
    ? SAISON_KALENDER.find((s) => s.slug === args[slugIdx + 1])
    : pickDue(force);

  if (!spec) {
    const next = [...SAISON_KALENDER].sort((a, b) => daysUntilDeadline(a) - daysUntilDeadline(b))[0];
    console.log(`Kein Saison-Guide fällig. Nächste Frist: ${next.slug} in ${daysUntilDeadline(next)} Tagen (liveBy ${next.liveBy}).`);
    process.exit(78);
  }
  if (existsSync(join(POSTS_DIR, `${spec.slug}.ts`)) && !force) {
    console.log(`${spec.slug} existiert bereits — nichts zu tun.`);
    process.exit(78);
  }

  const rest = daysUntilDeadline(spec);
  console.log(`Generiere Saison-Guide: ${spec.title} (Frist ${spec.liveBy}, noch ${rest} Tage)`);

  const events = await researchEvents(spec);
  console.log(`${events.length} Events recherchiert (regional gestreut).`);
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

  const gen = await generateWithGemini(spec, events, research);

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

  if (dryRun) {
    console.log(`DRY-RUN ok: ${spec.slug} — "${String(gen.excerpt).slice(0, 120)}…"`);
    process.exit(0);
  }

  const hero = await resolveSaisonHero(spec);
  const file = writePostFile(spec, gen, hero);
  registerInIndex(spec);

  // Alte Fakten => ein Mensch schaut drauf, statt dass Vorjahrestermine
  // stillschweigend live gehen.
  const review = factsAreStale(spec);
  setOutput('slug', spec.slug);
  setOutput('review', review ? 'true' : 'false');
  console.log(`Geschrieben: ${file} + Registrierung in index.ts`);
  if (review) {
    console.log(`::warning::Fakten für ${spec.slug} zuletzt am ${spec.factsVerified ?? 'nie'} geprüft — geht als PR zum Review statt live.`);
  }
  console.log(`::notice::Saison-Guide ${spec.slug} generiert (${events.length} Events, Frist ${spec.liveBy})`);
}

main().then(
  () => process.exit(0),
  (err) => { console.error('Fehler:', err); process.exit(1); },
);
