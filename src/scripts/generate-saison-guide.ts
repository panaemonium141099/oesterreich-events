/**
 * Saison-Guide-Autopilot (MASTERPLAN P3, User-Go 2026-07-15: PR-Modus).
 *
 * Läuft monatlich als GitHub Action (saison-guide.yml): prüft den
 * SAISON_KALENDER, recherchiert echte Events aus der DB fürs anstehende
 * Saison-Fenster und lässt Gemini 2.5 Flash daraus einen Guide-Entwurf
 * im FestivalPost-Format generieren. Der Workflow öffnet daraus einen
 * PR — publiziert wird NIE automatisch (Review-Pflicht, Markenstimme).
 *
 * Bewusst KEIN Event-Daten-Enrichment (Grundsatz MASTERPLAN §6) — die KI
 * schreibt Editorial-Text über deterministisch recherchierte Events.
 *
 * Aufruf: npx tsx src/scripts/generate-saison-guide.ts [--slug <slug>] [--force]
 *   ohne --slug: der Kalender-Eintrag mit publishMonth == aktueller Monat.
 *   Existiert die Post-Datei schon, wird übersprungen (außer --force).
 * Exit 0 + Datei geschrieben = Workflow macht einen PR; Exit 78 = nichts zu tun.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SAISON_KALENDER, type SaisonGuideSpec } from '../content/blog/saison-kalender';

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

async function generateWithGemini(spec: SaisonGuideSpec, events: ResearchEvent[]): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY fehlt');

  const prompt = `Du schreibst für LassTreffen.at (österreichische Event-Plattform, Du-Form, warm, konkret, keine Superlative-Floskeln) einen saisonalen Sammel-Guide als Blog-Post.

Thema: ${spec.title} — ${spec.subtitle}
Such-Intentionen der Leser: ${spec.searchKeywords.join(', ')}

ECHTE Events aus unserer Datenbank für diese Saison (nutze sie als konkrete Beispiele im Text, korrekt nach Bundesland; erfinde KEINE zusätzlichen Events oder Preise):
${events.map((e) => `- ${e.title} | ${e.start_date.slice(0, 10)} | ${e.location_name ?? '?'} | ${e.bundesland ?? '?'}${e.price_text ? ` | ${e.price_text}` : ''}`).join('\n')}

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

function writePostFile(spec: SaisonGuideSpec, gen: Record<string, unknown>): string {
  const today = new Date().toISOString().slice(0, 10);
  const post = {
    slug: spec.slug,
    title: spec.title,
    subtitle: spec.subtitle,
    heroImage: spec.heroImage,
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
    practicalInfo: gen.practicalInfo,
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

async function main() {
  const args = process.argv.slice(2);
  const slugIdx = args.indexOf('--slug');
  const force = args.includes('--force');
  const month = new Date().getUTCMonth() + 1;

  const spec = slugIdx !== -1
    ? SAISON_KALENDER.find((s) => s.slug === args[slugIdx + 1])
    : SAISON_KALENDER.find((s) => s.publishMonth === month);

  if (!spec) {
    console.log(`Kein Saison-Guide für Monat ${month} fällig — nichts zu tun.`);
    process.exit(78);
  }
  if (existsSync(join(POSTS_DIR, `${spec.slug}.ts`)) && !force) {
    console.log(`${spec.slug} existiert bereits — nichts zu tun.`);
    process.exit(78);
  }

  console.log(`Generiere Saison-Guide: ${spec.title}`);
  const events = await researchEvents(spec);
  console.log(`${events.length} Events recherchiert (regional gestreut).`);
  if (events.length < 5) {
    console.error('Zu wenige Events für einen glaubwürdigen Guide — Abbruch.');
    process.exit(1);
  }

  const gen = await generateWithGemini(spec, events);
  const file = writePostFile(spec, gen);
  registerInIndex(spec);
  console.log(`Geschrieben: ${file} + Registrierung in index.ts`);
  console.log(`::notice::Saison-Guide ${spec.slug} generiert (${events.length} Events als Basis)`);
}

main().then(
  () => process.exit(0),
  (err) => { console.error('Fehler:', err); process.exit(1); },
);
