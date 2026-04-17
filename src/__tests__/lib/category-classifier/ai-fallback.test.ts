import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyWithAiFallback, type AiClient } from '@/lib/category-classifier';

function makeAi(response: unknown): AiClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(response) } }],
        }),
      },
    },
  };
}

function makeFailingAi(): AiClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(new Error('boom')),
      },
    },
  };
}

describe('classifyWithAiFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits on deterministic accept (no AI call)', async () => {
    const ai = makeAi({
      primaryCategory: 'Musik',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'should not be called',
      shouldReview: false,
    });

    const outcome = await classifyWithAiFallback(
      { title: 'Weihnachtsmarkt in Eisenstadt' },
      { ai, bypassCache: true },
    );

    expect(outcome.category).toBe('Märkte');
    expect(outcome.usedAi).toBe(false);
    expect(outcome.source).toBe('rules');
    expect(ai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('invokes AI for hard cases and accepts high-confidence result', async () => {
    const ai = makeAi({
      primaryCategory: 'Nightlife',
      secondaryCategories: ['Musik'],
      confidence: 'high',
      shortReason: 'dj set at club',
      shouldReview: false,
    });

    const outcome = await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai, bypassCache: true },
    );

    expect(outcome.category).toBe('Nightlife');
    expect(outcome.confidence).toBe('ai');
    expect(outcome.source).toBe('ai');
    expect(outcome.tags).toContain('Nightlife');
    expect(outcome.usedAi).toBe(true);
    expect(ai.chat.completions.create).toHaveBeenCalledOnce();
  });

  it('low-confidence AI keeps deterministic candidate and flags review', async () => {
    const ai = makeAi({
      primaryCategory: 'Kultur',
      secondaryCategories: [],
      confidence: 'low',
      shortReason: 'unclear',
      shouldReview: true,
    });

    const outcome = await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai, bypassCache: true },
    );

    expect(outcome.confidence).toBe('ai_low');
    expect(outcome.needsReview).toBe(true);
    // Deterministic candidate was Nightlife (single title_token hit)
    expect(outcome.category).toBe('Nightlife');
  });

  it('low-confidence AI with no deterministic candidate → Sonstiges + review', async () => {
    const ai = makeAi({
      primaryCategory: 'Sonstiges',
      secondaryCategories: [],
      confidence: 'low',
      shortReason: 'no signal',
      shouldReview: true,
    });

    const outcome = await classifyWithAiFallback(
      { title: 'Aperiodic undefined event zzz' },
      { ai, bypassCache: true },
    );

    expect(outcome.category).toBe('Sonstiges');
    expect(outcome.confidence).toBe('ai_low');
    expect(outcome.needsReview).toBe(true);
  });

  it('AI error falls back to deterministic provisional + needsReview', async () => {
    const ai = makeFailingAi();

    const outcome = await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai, bypassCache: true },
    );

    expect(outcome.needsReview).toBe(true);
    expect(outcome.reason.startsWith('ai_error') || outcome.reason.startsWith('needs_ai')).toBe(true);
  });

  it('rejects invented categories from the AI output', async () => {
    const ai = makeAi({
      primaryCategory: 'NotARealCategory',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'garbage',
      shouldReview: false,
    });

    const outcome = await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai, bypassCache: true },
    );

    // Invalid AI response → treated like AI error → deterministic provisional.
    expect(outcome.category).toBe('Nightlife');
    expect(outcome.needsReview).toBe(true);
  });
});
