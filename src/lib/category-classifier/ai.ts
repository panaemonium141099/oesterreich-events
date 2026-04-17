/**
 * AI fallback classifier backed by OpenAI structured JSON output.
 *
 * The OpenAI client is passed in as a dependency so tests can supply a mock
 * without any real API calls. The only string literal that matters for tests
 * is the prompt itself (so they can assert intent) — the response schema is
 * enumerated against our canonical Category list.
 */

import type { Category } from '@/types/events';
import { CATEGORIES, CATEGORY_DEFINITIONS } from './taxonomy';

export interface AiCategorizationRequest {
  title: string;
  description: string | null;
  sourceTagsRaw: string[];
  sourceCategoryRaw: string | null;
  sourceName: string | null;
  organizer: string | null;
  locationName: string | null;
  /** Top deterministic candidates — seed the prompt so AI can agree/disagree. */
  candidateHint: Array<{ category: string; score: number }>;
  /** Why we fell back to AI — lets the prompt know what disambiguation to do. */
  reason: string;
}

export interface AiCategorizationResult {
  primaryCategory: Category;
  secondaryCategories: Category[];
  confidence: 'high' | 'medium' | 'low';
  shortReason: string;
  shouldReview: boolean;
}

/**
 * Abstract AI client. `chat.completions.create` mirrors the `openai` SDK
 * signature closely enough that the real `OpenAI` instance satisfies it.
 */
export interface AiClient {
  chat: {
    completions: {
      create(args: AiCompletionsCreateArgs): Promise<AiCompletionsResponse>;
    };
  };
}

export interface AiCompletionsCreateArgs {
  model: string;
  temperature?: number;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format?: unknown;
}

export interface AiCompletionsResponse {
  choices: Array<{ message: { content: string | null } }>;
}

export const AI_DEFAULT_MODEL = 'gpt-4o-mini';
export const AI_STRONG_MODEL = 'gpt-4o';

function buildSystemPrompt(): string {
  const defs = CATEGORIES.map(cat => {
    const d = CATEGORY_DEFINITIONS[cat];
    const notes = d.notes.length > 0 ? `\n   Notes: ${d.notes.join(' | ')}` : '';
    return `- ${cat}: ${d.summary}${notes}`;
  }).join('\n');

  return `You classify Austrian events into one primary category and up to 3 secondary tags.

Canonical categories (use these exact strings — do not invent):
${defs}

Rules:
- Pick the best primary category for the event.
- Up to 3 secondary tags (may be empty). Do not repeat the primary category in secondaries.
- "confidence": "high" when you are certain from title and/or tags; "medium" when reasoning from description or source prior; "low" when genuinely unsure.
- "shouldReview": true only when you are at low confidence OR when Sonstiges was the only sane answer.
- Never invent categories. Sonstiges is an explicit fallback, never the first pick.
- For opera / operetta / musical / ballet pick Kultur (staged theatre).
- For DJ-centric / club-night events pick Nightlife even when "Konzert" appears.
- For Kindertheater / Puppentheater pick Familie.
- For Heurigenfest/Weinfest with multiple vendors pick Märkte only if it's primarily a market; tasting-focus is Wein & Kulinarik.`;
}

function buildUserPrompt(req: AiCategorizationRequest): string {
  const lines: string[] = [];
  lines.push(`Title: ${req.title}`);
  if (req.description) lines.push(`Description: ${req.description.slice(0, 1200)}`);
  if (req.sourceCategoryRaw) lines.push(`Source category (raw): ${req.sourceCategoryRaw}`);
  if (req.sourceTagsRaw.length > 0) {
    lines.push(`Source tags (raw): ${req.sourceTagsRaw.join(' | ')}`);
  }
  if (req.sourceName) lines.push(`Source: ${req.sourceName}`);
  if (req.organizer) lines.push(`Organizer: ${req.organizer}`);
  if (req.locationName) lines.push(`Venue: ${req.locationName}`);
  if (req.candidateHint.length > 0) {
    lines.push(
      `Deterministic candidates: ${req.candidateHint
        .map(c => `${c.category}@${c.score}`)
        .join(', ')}`,
    );
  }
  lines.push(`Why AI was invoked: ${req.reason}`);
  return lines.join('\n');
}

function buildResponseSchema() {
  const categoryEnum = [...CATEGORIES];
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'category_classification',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          primaryCategory: {
            type: 'string',
            enum: categoryEnum,
            description: 'The single best category for this event.',
          },
          secondaryCategories: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string', enum: categoryEnum },
            description: 'Up to 3 additional tags (must not repeat primary).',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          shortReason: {
            type: 'string',
            description: 'One short sentence explaining the choice.',
          },
          shouldReview: { type: 'boolean' },
        },
        required: [
          'primaryCategory',
          'secondaryCategories',
          'confidence',
          'shortReason',
          'shouldReview',
        ],
        additionalProperties: false,
      },
    },
  };
}

const CATEGORY_SET = new Set<Category>(CATEGORIES);

function coerceCategory(value: unknown): Category | null {
  if (typeof value !== 'string') return null;
  return CATEGORY_SET.has(value as Category) ? (value as Category) : null;
}

/** Run the AI classifier. Returns null on API error so the caller can decide. */
export async function classifyWithAi(
  client: AiClient,
  req: AiCategorizationRequest,
  opts: { useStrongModel?: boolean } = {},
): Promise<AiCategorizationResult | null> {
  const model = opts.useStrongModel ? AI_STRONG_MODEL : AI_DEFAULT_MODEL;
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: buildResponseSchema(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const primary = coerceCategory(obj.primaryCategory);
    if (!primary) return null;
    const rawSecondaries = Array.isArray(obj.secondaryCategories)
      ? obj.secondaryCategories
      : [];
    const secondaries: Category[] = [];
    for (const s of rawSecondaries) {
      const cat = coerceCategory(s);
      if (cat && cat !== primary && !secondaries.includes(cat)) {
        secondaries.push(cat);
      }
      if (secondaries.length >= 3) break;
    }
    const confidence =
      obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low'
        ? obj.confidence
        : 'low';
    const shortReason =
      typeof obj.shortReason === 'string' && obj.shortReason.trim().length > 0
        ? obj.shortReason.trim().slice(0, 240)
        : 'ai fallback result';
    const shouldReview = obj.shouldReview === true;

    return {
      primaryCategory: primary,
      secondaryCategories: secondaries,
      confidence,
      shortReason,
      shouldReview: shouldReview || confidence === 'low' || primary === 'Sonstiges',
    };
  } catch {
    return null;
  }
}
