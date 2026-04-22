/**
 * Live smoke test for gpt-5-mini via Chat Completions.
 *
 * Verifies the three gotchas we patched in src/scripts/enrich-openai.ts:
 *   1. `max_completion_tokens` (not `max_tokens`) is accepted.
 *   2. `temperature` omitted (reasoning models reject anything != 1).
 *   3. `reasoning_effort: 'minimal'` leaves room for actual JSON output.
 *
 * Pass criteria: request returns 200, `content` is non-empty, JSON parses,
 * and validates against the strict schema we send.
 *
 * Run: node scripts/test-gpt5-mini.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local (same pattern as enrich-openai.ts)
try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* absent */ }

const { default: OpenAI } = await import('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120_000,
  maxRetries: 1,
});

const SYSTEM_PROMPT = `Du bist ein Klassifikator. Gib GENAU EIN JSON-Objekt zurück.
ERLAUBTE TAGS: konzert, open-air, festival, club-night, techno, rock, pop, jazz, klassik, metal
ERLAUBTE AUDIENCE: erwachsene-allgemein, junge-erwachsene, familien-mit-kindern, senioren
ERLAUBTE VIBE: energetisch, gemütlich, traditionell, psychedelic
ERLAUBTE SETTING: open-air, indoor, club, kirche
ERLAUBTE LANGUAGE: de, en, mixed
ERLAUBTE PRICE_TIER: gratis, günstig, mittel, premium, unbekannt
ERLAUBTE DURATION_TYPE: kurz, abend, ganztag, mehrtägig`;

const OUTPUT_JSON_SCHEMA = {
  name: 'event_enrichment',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      audience: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      vibe: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      setting: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      language: { type: 'string' },
      price_tier: { type: 'string' },
      duration_type: { type: 'string' },
      is_student_friendly: { type: 'boolean' },
      is_family_friendly: { type: 'boolean' },
      suggested_description: { type: ['string', 'null'] },
      suggested_price_text: { type: ['string', 'null'] },
    },
    required: [
      'tags', 'audience', 'vibe', 'setting',
      'language', 'price_tier', 'duration_type',
      'is_student_friendly', 'is_family_friendly',
      'suggested_description', 'suggested_price_text',
    ],
    additionalProperties: false,
  },
};

const USER_MSG = `TITEL: Nova Rock 2026 Open-Air
BESCHREIBUNG: Das größte Rockfestival Österreichs mit internationalen Acts auf drei Bühnen. Tickets ab 189€.
BISHERIGE KATEGORIE: Festival
ORT: Nickelsdorf, Burgenland
VERANSTALTER: Nova Music Festival GmbH
ZEIT: Do 17:00 Uhr
PREIS: ab 189€`;

const MODEL = 'gpt-5-mini';

console.log(`\n› Testing ${MODEL} with reasoning_effort=minimal + max_completion_tokens=3000`);
console.log('› Request body shape:\n');

const body = {
  model: MODEL,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_MSG },
  ],
  response_format: { type: 'json_schema', json_schema: OUTPUT_JSON_SCHEMA },
  max_completion_tokens: 3000,
  reasoning_effort: 'minimal',
};
console.log(JSON.stringify({
  model: body.model,
  max_completion_tokens: body.max_completion_tokens,
  reasoning_effort: body.reasoning_effort,
  has_temperature: 'temperature' in body,
  has_max_tokens: 'max_tokens' in body,
}, null, 2));

const t0 = Date.now();
let res;
try {
  res = await openai.chat.completions.create(body);
} catch (e) {
  console.error(`\n✗ REQUEST FAILED after ${Date.now() - t0}ms:`);
  console.error(`  status: ${e.status ?? 'n/a'}`);
  console.error(`  type:   ${e.type ?? e.constructor?.name ?? 'n/a'}`);
  console.error(`  code:   ${e.code ?? 'n/a'}`);
  console.error(`  param:  ${e.param ?? 'n/a'}`);
  console.error(`  message: ${e.message}`);
  process.exit(1);
}
const elapsed = Date.now() - t0;

const choice = res.choices[0];
const content = choice?.message?.content;
const usage = res.usage;
const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;

console.log(`\n› Response (${elapsed}ms):`);
console.log(`  finish_reason:     ${choice?.finish_reason}`);
console.log(`  prompt_tokens:     ${usage?.prompt_tokens}`);
console.log(`  completion_tokens: ${usage?.completion_tokens}`);
console.log(`  reasoning_tokens:  ${reasoningTokens}`);
console.log(`  content_length:    ${content?.length ?? 0} chars`);

if (!content) {
  console.error(`\n✗ FAIL: content is empty/null. finish_reason=${choice?.finish_reason}`);
  console.error(`   Reasoning burned ${reasoningTokens}/${usage?.completion_tokens} tokens before producing output.`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(content);
} catch (e) {
  console.error(`\n✗ FAIL: content is not valid JSON:`);
  console.error(content);
  process.exit(1);
}

console.log(`\n› Parsed JSON:`);
console.log(JSON.stringify(parsed, null, 2));

const required = ['tags', 'audience', 'vibe', 'setting', 'language', 'price_tier', 'duration_type',
  'is_student_friendly', 'is_family_friendly', 'suggested_description', 'suggested_price_text'];
const missing = required.filter(k => !(k in parsed));
if (missing.length > 0) {
  console.error(`\n✗ FAIL: missing required keys: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`\n✓ PASS — gpt-5-mini integration is working.`);
console.log(`  All ${required.length} required schema keys present.`);
console.log(`  Total: ${elapsed}ms, ${usage?.prompt_tokens}+${usage?.completion_tokens} tokens (${reasoningTokens} reasoning).`);
