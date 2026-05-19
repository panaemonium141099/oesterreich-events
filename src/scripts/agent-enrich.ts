/**
 * AI-Agent based event enrichment with review queue.
 *
 * Selects upcoming events where at least one of {image_url, description, price_text,
 * tags} is missing or thin, and spawns a Claude agent (Agent SDK) with web access
 * (WebFetch + WebSearch) to find the missing data. Proposals are written to
 * `event_enrichment_proposals` for human review — never directly to events.
 *
 * The agent has no DB access; this script handles all reads/writes. The agent
 * receives a structured prompt with known fields + the list of missing fields,
 * uses WebFetch/WebSearch to research, and returns a JSON block at the end of
 * its response which we parse and persist.
 *
 * Usage:
 *   tsx --env-file=.env.local src/scripts/agent-enrich.ts --limit 5 --dry-run
 *   tsx --env-file=.env.local src/scripts/agent-enrich.ts --limit 20 --verbose
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// ── Config ───────────────────────────────────────────────────────────────────
const DESCRIPTION_MIN_LENGTH = 80;
const TAGS_MIN_COUNT = 2;

// Allowed tag vocabulary the agent must pick from. Subset of enrichment-taxonomy.ts
// chosen for what's reasonable to derive from web sources without the full Claude
// classifier context. Final tag validation can still go through the v2 validator
// at approve-time if we want strict conformance.
const TAG_VOCABULARY = [
  "konzert", "festival", "theater", "kino", "museum", "ausstellung",
  "sport", "kulinarik", "markt", "wein", "bier", "party", "club", "dj",
  "traditionell", "familie", "kinder", "outdoor", "indoor",
  "gratis", "kostenpflichtig", "jugend", "senioren",
];

// ── CLI args ─────────────────────────────────────────────────────────────────
// Supports both `--name=value` and `--name value`. Boolean flags (no value)
// return "true". The next argv is treated as a value only if it doesn't start
// with `--`, so `--dry-run --verbose` correctly parses both as boolean flags.
function arg(name: string): string | undefined {
  const idx = process.argv.findIndex(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`),
  );
  if (idx < 0) return undefined;
  const found = process.argv[idx];
  if (found.includes("=")) return found.split("=").slice(1).join("=");
  const next = process.argv[idx + 1];
  if (next === undefined || next.startsWith("--")) return "true";
  return next;
}
const LIMIT = parseInt(arg("limit") ?? "5", 10);
const DRY_RUN = !!arg("dry-run");
const VERBOSE = !!arg("verbose");
// Optional: restrict candidate selection to events missing this specific field.
// Without --field we keep the broad OR filter (any of the 5 fields missing).
// "category" is special: it selects events where category='Sonstiges' (not NULL).
const FIELD = arg("field") as
  | "image_url"
  | "description"
  | "price_text"
  | "tags"
  | "category"
  | "address"
  | undefined;
const VALID_FIELDS = ["image_url", "description", "price_text", "tags", "category", "address"] as const;
if (FIELD && !VALID_FIELDS.includes(FIELD)) {
  console.error(`--field must be one of: ${VALID_FIELDS.join(", ")}`);
  process.exit(1);
}

const log = (...a: unknown[]) => console.log(...a);
const vlog = (...a: unknown[]) => VERBOSE && console.log(...a);

// ── Types ────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  title: string;
  source_url: string | null;
  source_name: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  start_date: string;
  category: string | null;
  organizer: string | null;
  image_url: string | null;
  description: string | null;
  price_text: string | null;
  price_min: number | null;
  price_max: number | null;
  tags: string[] | null;
}

interface AgentProposal {
  category?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  image_url?: string;
  image_source?: string;
  description?: string;
  price_text?: string;
  price_min?: number;
  price_max?: number;
  tags?: string[];
  reasoning?: string;
}

// Allowed primary categories. Must match enrichment-taxonomy.ts PRIMARY_CATEGORIES
// exactly so the frontend filter buttons keep working. "Sonstiges" is in the
// taxonomy but we never *propose* it — the whole point is to move events out.
const PRIMARY_CATEGORIES = [
  "Musik",
  "Kultur & Bühne",
  "Nightlife & Party",
  "Essen & Trinken",
  "Märkte & Feste",
  "Sport & Bewegung",
  "Natur & Abenteuer",
  "Wissen & Karriere",
  "Familie & Kinder",
  "Community & Freizeit",
  "Wellness & Spiritualität",
] as const;

// ── Field deficiency detection ───────────────────────────────────────────────
function missingFields(e: EventRow): Array<keyof AgentProposal> {
  const missing: Array<keyof AgentProposal> = [];
  // category='Sonstiges' counts as missing — we want the agent to re-classify
  // these into one of the 11 real categories where it can find a good fit.
  if (!e.category || e.category === "Sonstiges") missing.push("category");
  // Address-missing is the primary location signal. When address is null the
  // event almost certainly sits on a town-center fallback coord (post-PR #46
  // these events show "Ortsangabe ungefähr" instead of a Route link). The
  // agent gets all three location fields to fill — venue name, street,
  // postal code — and the approve route then nulls lat/lng so the existing
  // geocoding pipeline rebuilds accurate coords.
  if (!e.address) {
    missing.push("address");
    missing.push("location_name");
    missing.push("postal_code");
  }
  if (!e.image_url) missing.push("image_url");
  if (!e.description || e.description.length < DESCRIPTION_MIN_LENGTH) missing.push("description");
  if (!e.price_text) missing.push("price_text");
  if (!e.tags || e.tags.length < TAGS_MIN_COUNT) missing.push("tags");
  return missing;
}

// ── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(e: EventRow, missing: Array<keyof AgentProposal>): string {
  const known = [
    `Titel: ${e.title}`,
    e.location_name && `Ort: ${e.location_name}`,
    e.address && `Adresse: ${e.address}`,
    e.bundesland && `Bundesland: ${e.bundesland}`,
    `Datum: ${e.start_date.slice(0, 10)}`,
    e.category && `Kategorie: ${e.category}`,
    e.organizer && `Veranstalter: ${e.organizer}`,
    e.source_url && `Quelle: ${e.source_url}`,
    e.description && `Aktuelle Beschreibung (möglicherweise zu kurz): ${e.description.slice(0, 300)}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `Du enrichst ein Event für eine österreichische Event-Plattform.

EVENT-INFO:
${known}

FEHLENDE FELDER — bitte NUR diese suchen, andere nicht anrühren:
${missing.map((f) => `- ${f}`).join("\n")}

WIE VORGEHEN:
1. Falls source_url existiert: Hol die Seite mit WebFetch und suche dort die fehlenden Infos.
   - image_url: <meta property="og:image"> oder das prominenteste <img>, das eindeutig zum Event gehört.
   - description: 2-4 Sätze, sachlich, deutsch. NICHT halluzinieren.
   - price_text: konkrete Zahl oder Formulierung ("Eintritt frei", "VVK €15 / AK €18").
2. Wenn source_url leer ist ODER die fehlenden Felder dort nicht stehen: Nutze WebSearch mit
   Query "${e.title} ${e.location_name ?? ""}" und checke die Top-Ergebnisse.
3. Validierung — sei streng, lieber weglassen als raten:
   - image_url: HTTPS-URL, Endung .jpg/.jpeg/.png/.webp/.gif (GIFs sind ok — Browser zeigt
     erstes Frame, Konvertierung passiert später). Bild-Priorität (höchste zuerst):
       1. og:image / event-spezifisches <img> der source_url
       2. Bild vom verlinkten Veranstalter (z.B. brucknerhaus.at, ak-tirol.com)
       3. Bild aus Google-Image-Suche das eindeutig zum Event passt
       4. FALLBACK: Stockfoto oder Veranstalter-Logo, NUR wenn 1-3 nichts liefern.
          image_source dann 'stock' bzw. 'logo-fallback'.
     ABLEHNEN: Platzhalter-URLs ('placeholder', 'default', 'no-image', 'sujet-neutral',
     'sujet-sm-neutral' im Pfad), data: URIs, SVG-Platzhalter.
   - description: nur wenn du sie wörtlich oder fast wörtlich aus einer Quelle hast.
   - price_text: nur bei klarer Quellen-Angabe.
4. tags (falls gefragt): NUR aus diesem Vokabular wählen, max. 4 Tags:
   ${TAG_VOCABULARY.join(", ")}
5. category (falls gefragt — aktueller Wert ist "Sonstiges" oder leer): Wähle EXAKT EINE
   aus dieser Liste, mit IDENTISCHER Schreibweise inkl. & und Umlauten:
${PRIMARY_CATEGORIES.map((c) => `   - ${c}`).join("\n")}
   "Sonstiges" NIE vorschlagen — der ganze Zweck ist diese Events aus "Sonstiges" raus zu
   bekommen. Wenn du keine der 11 Kategorien sicher passt: category einfach weglassen.
6. location_name + address + postal_code (falls gefragt): Suche den konkreten Veranstaltungsort.
   - location_name: spezifischer Venue-Name (z.B. "Theater Phönix", "Brucknerhaus / Mittlerer Saal",
     "Restaurant zum Goldenen Hirschen"). NIE nur die Stadt ("Eisenstadt" allein ist KEIN
     location_name — das hatten wir vorher schon).
   - address: Straße + Hausnummer (z.B. "Wiener Straße 25", "Untere Donaulände 7"). NIE raten —
     nur wenn wörtlich auf der Quellseite oder Veranstalter-Website angegeben.
   - postal_code: 4-stellige österreichische PLZ.
   WICHTIG: KEINE lat/lng erfinden — die Koordinaten werden später aus address+postal_code
   automatisch berechnet (Geocoding-Pipeline). Du lieferst nur den Text.

ANTWORT-FORMAT — am ENDE deiner Antwort, exakt so (Felder die du nicht sicher belegen kannst:
einfach weglassen, nicht null setzen):

ENRICHMENT_RESULT:
\`\`\`json
{
  "category": "Musik",
  "location_name": "Theater Phönix",
  "address": "Wiener Straße 25",
  "postal_code": "4020",
  "image_url": "https://...",
  "image_source": "source-og",
  "description": "...",
  "price_text": "Eintritt frei",
  "price_min": 0,
  "price_max": 0,
  "tags": ["wein", "traditionell"],
  "reasoning": "Bild aus og:image der source_url, Beschreibung aus Hero-Section, Preis nicht auffindbar."
}
\`\`\`

image_source-Werte: 'source-og' | 'source-img' | 'organizer' | 'google-search' | 'wikipedia' | 'stock' | 'logo-fallback' | 'other'.

WICHTIG: Lieber WENIG aber RICHTIG als VIEL und FALSCH. Wenn du gar nichts Valides findest:
gib trotzdem den ENRICHMENT_RESULT-Block zurück, aber nur mit "reasoning" gefüllt.`;
}

// ── Agent invocation ─────────────────────────────────────────────────────────
async function runAgentForEvent(
  e: EventRow,
  missing: Array<keyof AgentProposal>,
): Promise<AgentProposal | null> {
  const prompt = buildPrompt(e, missing);
  let finalText = "";

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ["WebFetch", "WebSearch"],
        permissionMode: "bypassPermissions",
      },
    })) {
      // The final ResultMessage carries the agent's last assistant text in `result`.
      // See: https://code.claude.com/docs/en/agent-sdk
      if (message.type === "result" && "result" in message) {
        finalText = (message as { result: string }).result ?? "";
      }
    }
  } catch (err) {
    log(`    ✗ Agent error: ${(err as Error).message}`);
    return null;
  }

  return parseEnrichmentResult(finalText);
}

function parseEnrichmentResult(text: string): AgentProposal | null {
  const match = text.match(/ENRICHMENT_RESULT:\s*```json\s*([\s\S]+?)```/);
  if (!match) {
    vlog("    [no ENRICHMENT_RESULT block — last 400 chars of agent output:]");
    vlog("    " + text.slice(-400).replaceAll("\n", "\n    "));
    return null;
  }
  try {
    return JSON.parse(match[1]) as AgentProposal;
  } catch (err) {
    log(`    ✗ JSON parse error: ${(err as Error).message}`);
    return null;
  }
}

// ── Supabase helpers ─────────────────────────────────────────────────────────
function makeSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Run with: tsx --env-file=.env.local src/scripts/agent-enrich.ts",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchCandidateEvents(supabase: SupabaseClient): Promise<EventRow[]> {
  const today = new Date().toISOString();

  // SQL OR cannot express "description shorter than N chars" or "tags array
  // smaller than N" cleanly, so overfetch on NULL-checks and filter client-side.
  let qb = supabase
    .from("events")
    .select(
      [
        "id",
        "title",
        "source_url",
        "source_name",
        "location_name",
        "address",
        "postal_code",
        "bundesland",
        "start_date",
        "category",
        "organizer",
        "image_url",
        "description",
        "price_text",
        "price_min",
        "price_max",
        "tags",
      ].join(", "),
    )
    .gte("start_date", today)
    .in("publish_status", ["published", "published_low_confidence", "draft"]);

  if (FIELD === "category") {
    qb = qb.eq("category", "Sonstiges");
  } else if (FIELD) {
    qb = qb.is(FIELD, null);
  } else {
    qb = qb.or(
      "image_url.is.null,description.is.null,price_text.is.null,tags.is.null,address.is.null,category.eq.Sonstiges",
    );
  }

  const { data, error } = await qb
    .order("event_score", { ascending: false, nullsFirst: false })
    .limit(LIMIT * 4);

  if (error) throw new Error(`fetchCandidateEvents: ${error.message}`);
  if (!data) return [];

  const filtered = (data as unknown as EventRow[])
    .filter((e) => missingFields(e).length > 0)
    .slice(0, LIMIT);

  return filtered;
}

async function upsertProposal(
  supabase: SupabaseClient,
  event: EventRow,
  proposal: AgentProposal,
  runId: string,
): Promise<void> {
  // Guard: reject category proposals not in the allowed list. Belt-and-braces
  // alongside the prompt instruction so a hallucinated value can never persist.
  let proposedCategory: string | null = null;
  if (proposal.category && proposal.category !== "Sonstiges") {
    if ((PRIMARY_CATEGORIES as readonly string[]).includes(proposal.category)) {
      proposedCategory = proposal.category;
    }
  }

  const row = {
    event_id: event.id,
    status: "pending" as const,
    proposed_category: proposedCategory,
    proposed_location_name: proposal.location_name ?? null,
    proposed_address: proposal.address ?? null,
    proposed_postal_code: proposal.postal_code ?? null,
    proposed_image_url: proposal.image_url ?? null,
    proposed_description: proposal.description ?? null,
    proposed_price_text: proposal.price_text ?? null,
    proposed_price_min: proposal.price_min ?? null,
    proposed_price_max: proposal.price_max ?? null,
    proposed_tags: proposal.tags ?? null,
    image_source: proposal.image_source ?? null,
    agent_model: "claude-agent-sdk",
    agent_reasoning: proposal.reasoning ?? null,
    agent_run_id: runId,
  };

  // Supabase JS upsert can't target our partial unique index (only pending rows),
  // so we delete-then-insert. Safe under our single-threaded loop; would need a
  // transaction if we ever parallelize.
  const { error: delErr } = await supabase
    .from("event_enrichment_proposals")
    .delete()
    .eq("event_id", event.id)
    .eq("status", "pending");
  if (delErr) throw new Error(`upsertProposal delete: ${delErr.message}`);

  const { error: insErr } = await supabase
    .from("event_enrichment_proposals")
    .insert(row);
  if (insErr) throw new Error(`upsertProposal insert: ${insErr.message}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log(`Agent-Enrich — limit=${LIMIT} dry-run=${DRY_RUN} verbose=${VERBOSE}\n`);
  const supabase = makeSupabase();
  const runId = randomUUID();

  const events = await fetchCandidateEvents(supabase);
  if (events.length === 0) {
    log("Keine Events mit fehlenden Feldern gefunden.");
    return;
  }
  log(`${events.length} Kandidat(en) gefunden.\n`);

  let proposed = 0;
  let empty = 0;
  let failed = 0;

  for (const event of events) {
    const missing = missingFields(event);
    log(`→ ${event.title}`);
    log(`  id=${event.id}  source=${event.source_name ?? "—"}`);
    log(`  fehlt: ${missing.join(", ")}`);

    const proposal = await runAgentForEvent(event, missing);
    if (!proposal) {
      log(`  ✗ Agent lieferte keinen parsebaren Output\n`);
      failed++;
      continue;
    }

    const filledFields = Object.entries(proposal)
      .filter(
        ([k, v]) =>
          k !== "reasoning" && k !== "image_source" && v !== null && v !== undefined,
      )
      .map(([k]) => k);

    if (filledFields.length === 0) {
      log(`  ○ Agent fand nichts. Reasoning: ${proposal.reasoning ?? "—"}\n`);
      empty++;
      continue;
    }

    log(`  ✓ Vorschlag: ${filledFields.join(", ")}`);
    if (VERBOSE) {
      const shorten = (s: string | null, n = 140) =>
        s ? (s.length > n ? s.slice(0, n) + "…" : s) : "(leer)";
      const tagStr = (t: string[] | null) =>
        t && t.length > 0 ? t.join(", ") : "(leer)";

      if (proposal.category !== undefined) {
        log(`    category:`);
        log(`      vorher:  ${event.category ?? "(leer)"}`);
        log(`      nachher: ${proposal.category}`);
      }
      if (proposal.location_name !== undefined || proposal.address !== undefined || proposal.postal_code !== undefined) {
        log(`    location:`);
        log(`      vorher:  ${event.location_name ?? "(leer)"} | ${event.address ?? "(keine Adresse)"} | PLZ ${event.postal_code ?? "?"}`);
        log(`      nachher: ${proposal.location_name ?? event.location_name ?? "—"} | ${proposal.address ?? "—"} | PLZ ${proposal.postal_code ?? "—"}`);
      }
      if (proposal.image_url !== undefined) {
        log(`    image_url:`);
        log(`      vorher:  ${event.image_url ?? "(leer)"}`);
        log(`      nachher: ${proposal.image_url}  [${proposal.image_source ?? "?"}]`);
      }
      if (proposal.description !== undefined) {
        log(`    description:`);
        log(`      vorher:  ${shorten(event.description)}`);
        log(`      nachher: ${shorten(proposal.description)}`);
      }
      if (proposal.price_text !== undefined) {
        log(`    price_text:`);
        log(`      vorher:  ${event.price_text ?? "(leer)"}`);
        log(`      nachher: ${proposal.price_text}`);
        if (proposal.price_min !== undefined || proposal.price_max !== undefined) {
          log(
            `      preis-range vorher:  ${event.price_min ?? "?"} – ${event.price_max ?? "?"}`,
          );
          log(
            `      preis-range nachher: ${proposal.price_min ?? "?"} – ${proposal.price_max ?? "?"}`,
          );
        }
      }
      if (proposal.tags !== undefined) {
        log(`    tags:`);
        log(`      vorher:  ${tagStr(event.tags)}`);
        log(`      nachher: ${tagStr(proposal.tags ?? null)}`);
      }
      log(`    reasoning:   ${proposal.reasoning ?? "—"}`);
    }

    if (DRY_RUN) {
      log(`  → DRY-RUN: nicht in DB geschrieben\n`);
    } else {
      try {
        await upsertProposal(supabase, event, proposal, runId);
        log(`  → Proposal gespeichert\n`);
        proposed++;
      } catch (err) {
        log(`  ✗ DB-Write fehlgeschlagen: ${(err as Error).message}\n`);
        failed++;
      }
    }
  }

  log(`Fertig.  proposed=${proposed}  leer=${empty}  failed=${failed}  run_id=${runId}`);
  if (DRY_RUN) log(`(DRY-RUN — keine Proposals in DB.)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
