/**
 * Schema validation for the v2 Claude-batch enrichment payload.
 *
 * Why a separate validator instead of `validateEnrichment` from
 * `enrichment-taxonomy.ts`?
 *   - `validateEnrichment` is the per-row coercer used by the OpenAI
 *     pipeline. It silently drops bad values to maximise yield.
 *   - `enrich-claude.ts` drives a 3-strikes poison-pill counter, so it
 *     needs to *fail loudly* (with a list of reasons) when the AI
 *     returns garbage. Loud failure → retry-with-feedback → poison-pill.
 *
 * The two validators share the same closed vocabularies (TAGS, VIBES,
 * etc. from `enrichment-taxonomy.ts`) so both pipelines validate against
 * an identical universe of allowed values. No second source of truth.
 *
 * Output shape mirrors the AI-side JSON schema. Suggested fields can
 * legally be `null` (= "leave the existing column alone").
 */
import {
  TAG_SET,
  AUDIENCE_SET,
  VIBE_SET,
  OCCASION_SET,
  SETTING_SET,
  PRICE_FLAG_SET,
  PRICE_TIER_SET,
  DURATION_TYPE_SET,
  LANGUAGE_SET,
  PRIMARY_CATEGORY_SET,
  type PrimaryCategory,
  type PriceTier,
  type DurationType,
  type Language,
} from './enrichment-taxonomy';

/**
 * Length envelope for AI-suggested descriptions (fn-14.3 Interview).
 * 400-1000 narrative chars. If the AI returns null, that means
 * "existing description is fine, leave it alone".
 */
export const DESC_MIN = 400;
export const DESC_MAX = 1000;

export interface ClaudeEnrichmentResult {
  primary_category: PrimaryCategory | null;
  tags: string[];                  // ≤ 5
  audience: string[];              // ≤ 3
  vibe: string[];                  // ≤ 3
  occasion: string[];              // ≤ 3
  setting: string[];               // ≤ 3
  price_tier: PriceTier | null;
  price_flags: string[];           // ≤ 6
  duration_type: DurationType | null;
  language: Language | null;
  is_student_friendly: boolean;
  is_family_friendly: boolean;
  is_dog_friendly: boolean;        // NEU v2 (fn-14.3)
  is_wheelchair_accessible: boolean;
  is_outdoor: boolean;
  suggested_description: string | null;        // 400-1000 chars or null
  suggested_price_text: string | null;
  suggested_price_min: number | null;          // EUR, ≥ 0, ≤ 10000
}

export interface ValidationOk {
  ok: true;
  value: ClaudeEnrichmentResult;
}
export interface ValidationFail {
  ok: false;
  errors: string[];
  /** Best-effort partial value. Caller decides whether to use it. */
  partial: ClaudeEnrichmentResult;
}
export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Pick the primary category. Spec defines this as "genau 1" — null is
 * NEVER an acceptable answer. We treat null/missing as a hard error so
 * the caller can route the item to the retry / poison-pill path.
 */
function pickCategory(value: unknown, errors: string[]): PrimaryCategory | null {
  if (value === null || value === undefined) {
    // Soft drop — caller commits other fields, category stays as old/null.
    // Better than poison-pilling entire event over a missing category.
    errors.push('primary_category: missing (dropped)');
    return null;
  }
  if (typeof value !== 'string') {
    errors.push('primary_category: not a string (dropped)');
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    errors.push('primary_category: empty string (dropped)');
    return null;
  }
  if (!PRIMARY_CATEGORY_SET.has(trimmed)) {
    // Soft drop — old rule-based category stays, all other fields commit.
    errors.push(`primary_category: "${trimmed}" not in vocabulary (dropped)`);
    return null;
  }
  return trimmed as PrimaryCategory;
}

/**
 * Pick an enum value. The `required` flag (true for `price_tier`,
 * `duration_type`, `language` — all spec'd as "genau 1") promotes
 * null/missing into a validation error. Optional enums (none right now,
 * but keep the flag for extensibility) tolerate null.
 */
function pickEnum<T extends string>(
  value: unknown,
  set: Set<string>,
  fieldName: string,
  errors: string[],
  required: boolean,
): T | null {
  if (value === null || value === undefined) {
    if (required) errors.push(`${fieldName}: missing (dropped)`);
    return null;
  }
  if (typeof value !== 'string') {
    errors.push(`${fieldName}: not a string (dropped)`);
    return null;
  }
  const norm = value.trim().toLowerCase();
  if (!norm) {
    if (required) errors.push(`${fieldName}: empty string (dropped)`);
    return null;
  }
  if (!set.has(norm)) {
    // Soft drop — caller skips writing this field, existing value stays.
    errors.push(`${fieldName}: "${norm}" not in vocabulary (dropped)`);
    return null;
  }
  return norm as T;
}

function pickArray(
  value: unknown,
  set: Set<string>,
  cap: number,
  fieldName: string,
  errors: string[],
): string[] {
  if (value === null || value === undefined) return [];
  // Narrow into a typed local. Re-assigning the `unknown` parameter doesn't
  // preserve narrowing across the branches in TS 5.x, so we use `arr: unknown[]`
  // as the load-bearing variable for the iteration below.
  let arr: unknown[];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    // Coerce common variant: comma-separated string.
    const parts = value.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      errors.push(`${fieldName}: not an array (got string, no values) (dropped)`);
      return [];
    }
    errors.push(`${fieldName}: not an array (coerced from comma-string) (dropped)`);
    arr = parts;
  } else {
    errors.push(`${fieldName}: not an array (got ${typeof value}) (dropped)`);
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const norm = v.trim().toLowerCase();
    if (!norm) continue;
    if (!set.has(norm)) {
      // Don't fail validation for unknown tags — they signal that the AI
      // tried to extend the vocabulary, but the rest of the payload may
      // still be perfectly usable. Just record + drop.
      errors.push(`${fieldName}: "${norm}" not in vocabulary (dropped)`);
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
    if (out.length >= cap) break;
  }
  return out;
}

function pickBool(value: unknown, fieldName: string, errors: string[]): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  // Coerce common claude variants: "true"/"false" strings, 0/1 numbers.
  // Anything else: soft drop with default false. Per spec "im Zweifel FALSE".
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    if (norm === 'true') return true;
    if (norm === 'false' || norm === '') return false;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  errors.push(`${fieldName}: not a boolean (got ${typeof value}, defaulted to false) (dropped)`);
  return false;
}

function pickPriceMin(value: unknown, errors: string[]): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`suggested_price_min: not a finite number (got ${typeof value})`);
    return null;
  }
  if (value < 0) {
    errors.push(`suggested_price_min: negative (${value})`);
    return null;
  }
  if (value > 10000) {
    errors.push(`suggested_price_min: above 10000 (${value})`);
    return null;
  }
  return value;
}

function pickSuggestedDescription(value: unknown, errors: string[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    // Soft drop — claude returned wrong type but rest of payload may
    // still be usable. Caller treats `(dropped)` as recoverable.
    errors.push('suggested_description: not a string or null (dropped)');
    return null;
  }
  const t = value.trim();
  if (!t || /^null$/i.test(t)) return null;
  // Reject anything with HTML — the prompt says "no HTML". Soft drop.
  if (/<[a-z][^>]*>/i.test(t)) {
    errors.push('suggested_description: contains HTML (dropped)');
    return null;
  }
  if (t.length < DESC_MIN) {
    // Soft drop — null'd description means "leave existing alone";
    // the row commits with all OTHER enrichment fields. Hard-learned
    // fn-14.4: poison-pilling 11 events for a 380-char description
    // (vs 400 minimum) is a worse outcome than committing partial.
    errors.push(`suggested_description: too short (${t.length} < ${DESC_MIN}) (dropped)`);
    return null;
  }
  if (t.length > DESC_MAX) {
    errors.push(`suggested_description: too long (${t.length} > ${DESC_MAX}) (dropped)`);
    // Tail-truncate is *not* applied — we'd rather drop and re-prompt
    // than ship a description that ends mid-sentence.
    return null;
  }
  return t;
}

function pickSuggestedPriceText(value: unknown, errors: string[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    errors.push('suggested_price_text: not a string or null');
    return null;
  }
  const t = value.trim();
  if (!t || /^null$/i.test(t)) return null;
  // Cap at a sane length so a chatty AI can't blow up the column.
  return t.slice(0, 200);
}

/**
 * Validate one event's worth of AI output.
 *
 * Failure modes
 *   - Wrong primary type (the AI didn't return an object) → fatal,
 *     `partial` returned with all defaults so the caller can still
 *     inspect what came back.
 *   - Out-of-vocab values per axis → recorded as errors, value dropped
 *     from the array but rest of payload still usable.
 *   - Too-short / too-long suggested_description → recorded, set to
 *     null. Caller still gets the rest of the enrichment.
 *
 * Caller (`enrich-claude.ts`) decides what counts as "this event
 * failed": a sane default is "errors.length > 0" → re-queue with
 * feedback prompt; "second pass also has errors" → bail batch + bump
 * `enrichment_failure_count`. After 3 strikes the row gets the
 * `enrichment_failed=TRUE` poison-pill in the DB.
 */
export function validateClaudeEnrichment(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: ['payload: not an object'],
      partial: emptyResult(),
    };
  }
  const r = raw as Record<string, unknown>;

  const value: ClaudeEnrichmentResult = {
    primary_category: pickCategory(r.primary_category, errors),
    tags: pickArray(r.tags, TAG_SET, 5, 'tags', errors),
    audience: pickArray(r.audience, AUDIENCE_SET, 3, 'audience', errors),
    vibe: pickArray(r.vibe, VIBE_SET, 3, 'vibe', errors),
    occasion: pickArray(r.occasion, OCCASION_SET, 3, 'occasion', errors),
    setting: pickArray(r.setting, SETTING_SET, 3, 'setting', errors),
    // Required singletons — null/missing → validation error so the
    // caller routes the row to the retry / 3-strikes path instead of
    // silently writing a partial record.
    price_tier: pickEnum<PriceTier>(r.price_tier, PRICE_TIER_SET, 'price_tier', errors, true),
    price_flags: pickArray(r.price_flags, PRICE_FLAG_SET, 6, 'price_flags', errors),
    duration_type: pickEnum<DurationType>(r.duration_type, DURATION_TYPE_SET, 'duration_type', errors, true),
    language: pickEnum<Language>(r.language, LANGUAGE_SET, 'language', errors, true),
    is_student_friendly: pickBool(r.is_student_friendly, 'is_student_friendly', errors),
    is_family_friendly: pickBool(r.is_family_friendly, 'is_family_friendly', errors),
    is_dog_friendly: pickBool(r.is_dog_friendly, 'is_dog_friendly', errors),
    is_wheelchair_accessible: pickBool(r.is_wheelchair_accessible, 'is_wheelchair_accessible', errors),
    is_outdoor: pickBool(r.is_outdoor, 'is_outdoor', errors),
    suggested_description: pickSuggestedDescription(r.suggested_description, errors),
    suggested_price_text: pickSuggestedPriceText(r.suggested_price_text, errors),
    suggested_price_min: pickPriceMin(r.suggested_price_min, errors),
  };

  // Out-of-vocab tags inside arrays already produced errors but are
  // recoverable — they get filtered out, the rest of the payload is
  // still usable. The only FATAL validation failures here are:
  //   - primary_category set but not in PRIMARY_CATEGORY_SET
  //   - structural type errors (not array, not boolean, not string)
  //   - missing required fields
  // Differentiate so the caller can commit partial-good rows instead
  // of poison-pilling the entire event over a stray "traditionell"
  // hallucinated as a vibe instead of an audience.
  // Hard-learned fn-14.4 (2026-05-10): haiku-mode produced 20%
  // "(dropped)" warnings → 20% events lost to false poison-pill.
  const fatalErrors = errors.filter(e => !e.endsWith('(dropped)'));
  if (fatalErrors.length > 0) {
    return { ok: false, errors, partial: value };
  }
  // No fatals — return the cleaned value. errors[] (dropped warnings)
  // is intentionally not surfaced; the value already reflects the drops.
  return { ok: true, value };
}

export function emptyResult(): ClaudeEnrichmentResult {
  return {
    primary_category: null,
    tags: [], audience: [], vibe: [], occasion: [], setting: [],
    price_tier: null, price_flags: [],
    duration_type: null, language: null,
    is_student_friendly: false,
    is_family_friendly: false,
    is_dog_friendly: false,
    is_wheelchair_accessible: false,
    is_outdoor: false,
    suggested_description: null,
    suggested_price_text: null,
    suggested_price_min: null,
  };
}

/**
 * Validate a top-level batch response: an array of N event-result objects.
 * The AI is supposed to emit `{"results": [...]}` or just a bare array.
 * We accept both — survival of the fittest.
 *
 * Per-item errors are collected so the caller can decide which items to
 * commit (errors.length === 0 → ok) vs. which to re-queue.
 */
export interface BatchItem {
  /**
   * 0-based index the AI ECHOED BACK from the request. Used to remap
   * the result onto the corresponding input event without trusting
   * array position. The validator demands this field on every item;
   * a missing/duplicate/out-of-range index is a top-level fatalError.
   */
  index: number;
  result: ValidationResult;
}

export interface BatchValidation {
  /** Top-level structural outcome. */
  ok: boolean;
  /** Why the batch as a whole failed (e.g. not an array, missing/duplicate index). */
  fatalError?: string;
  /**
   * One per RESULT in the AI response (NOT one per request item). If
   * `expectedSize` is provided to `validateClaudeBatch`, the validator
   * additionally enforces that every index in `[0, expectedSize)` is
   * present exactly once — gaps + duplicates are fatal.
   */
  items: BatchItem[];
}

/**
 * Validate the top-level batch envelope.
 *
 * Every result item MUST echo back a non-negative integer `index`
 * field — this is part of the validator contract regardless of whether
 * `expectedSize` is supplied. Missing / non-integer / negative indices
 * are top-level fatalErrors.
 *
 * @param raw          The parsed inner JSON from the `claude -p` envelope.
 * @param expectedSize If set, the validator additionally enforces:
 *                       - exactly `expectedSize` items
 *                       - every echoed `index` in [0, expectedSize)
 *                       - no duplicate indices
 *                       - no gaps
 *                     This is the only safe way to remap results onto
 *                     events — array position is NOT trustworthy because
 *                     the AI can reorder/drop/duplicate without notice.
 *                     `processBatch()` always passes `events.length`.
 */
export function validateClaudeBatch(raw: unknown, expectedSize?: number): BatchValidation {
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { results?: unknown }).results)) {
    arr = (raw as { results: unknown[] }).results;
  } else {
    return {
      ok: false,
      fatalError: 'top-level: expected array or {results: [...]}',
      items: [],
    };
  }

  // Per-item: extract echoed index, then validate the rest.
  // Track which items had a missing/invalid index so we can fail loudly
  // even when expectedSize isn't passed by the caller.
  const items: BatchItem[] = [];
  const indexErrors: string[] = [];
  arr.forEach((item, position) => {
    let echoedIndex = -1;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const v = (item as Record<string, unknown>).index;
      if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) {
        echoedIndex = v;
      } else if (v === undefined) {
        indexErrors.push(`result at position ${position}: missing required "index" field`);
      } else {
        indexErrors.push(`result at position ${position}: "index" must be a non-negative integer (got ${JSON.stringify(v)})`);
      }
    } else {
      indexErrors.push(`result at position ${position}: not an object`);
    }
    items.push({ index: echoedIndex, result: validateClaudeEnrichment(item) });
  });

  if (indexErrors.length > 0) {
    return {
      ok: false,
      fatalError: `top-level: ${indexErrors.slice(0, 3).join('; ')}${indexErrors.length > 3 ? `; +${indexErrors.length - 3} more` : ''}`,
      items,
    };
  }

  // Cross-item structural checks if we know the expected size.
  if (expectedSize !== undefined) {
    if (items.length !== expectedSize) {
      return {
        ok: false,
        fatalError: `top-level: expected ${expectedSize} results, got ${items.length}`,
        items,
      };
    }
    const seen = new Set<number>();
    for (const it of items) {
      if (it.index < 0 || it.index >= expectedSize) {
        return {
          ok: false,
          fatalError: `top-level: result index ${it.index} out of range [0, ${expectedSize})`,
          items,
        };
      }
      if (seen.has(it.index)) {
        return {
          ok: false,
          fatalError: `top-level: duplicate result index ${it.index}`,
          items,
        };
      }
      seen.add(it.index);
    }
    // Ensure every requested index is represented (no gaps).
    for (let i = 0; i < expectedSize; i++) {
      if (!seen.has(i)) {
        return {
          ok: false,
          fatalError: `top-level: missing result for input index ${i}`,
          items,
        };
      }
    }
  }

  return { ok: true, items };
}
