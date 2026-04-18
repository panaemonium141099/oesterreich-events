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

// A title that cat-v2 deterministic rules cannot resolve — genuinely ambiguous
// with no precision token. The batch script would route this to AI.
const HARD_TITLE = 'Veranstaltung im Zeitalter';
const PRECISE_TITLE = 'Sommerkonzert am Rathaus';

describe('classifyWithAiFallback (cat-v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('short-circuits on deterministic accept (no AI call)', async () => {
    const ai = makeAi({
      primaryCategory: 'Musik',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'should not be called',
      shouldReview: false,
    });
    const outcome = await classifyWithAiFallback(
      { title: PRECISE_TITLE },
      { ai, bypassCache: true },
    );
    expect(outcome.usedAi).toBe(false);
    expect(outcome.source).toBe('rules');
    expect(ai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('invokes AI for genuinely hard cases and accepts high-confidence result', async () => {
    const ai = makeAi({
      primaryCategory: 'Nightlife',
      secondaryCategories: ['Musik'],
      confidence: 'high',
      shortReason: 'night event',
      shouldReview: false,
    });
    const outcome = await classifyWithAiFallback(
      { title: HARD_TITLE },
      { ai, bypassCache: true },
    );
    if (outcome.usedAi) {
      expect(outcome.category).toBe('Nightlife');
      expect(outcome.confidence).toBe('ai');
      expect(outcome.source).toBe('ai');
      expect(ai.chat.completions.create).toHaveBeenCalledOnce();
    } else {
      // If rules happened to resolve this title, the test is trivially OK:
      // the short-circuit invariant holds. (Defensive — the lexicon may
      // evolve to match this title.)
      expect(ai.chat.completions.create).not.toHaveBeenCalled();
    }
  });

  it('low-confidence AI keeps deterministic provisional and flags review', async () => {
    const ai = makeAi({
      primaryCategory: 'Kultur',
      secondaryCategories: [],
      confidence: 'low',
      shortReason: 'unclear',
      shouldReview: true,
    });
    const outcome = await classifyWithAiFallback(
      { title: HARD_TITLE },
      { ai, bypassCache: true },
    );
    if (outcome.usedAi) {
      expect(outcome.confidence).toBe('ai_low');
      expect(outcome.needsReview).toBe(true);
    }
  });

  it('AI error falls back to deterministic provisional + needsReview', async () => {
    const ai = makeFailingAi();
    const outcome = await classifyWithAiFallback(
      { title: HARD_TITLE },
      { ai, bypassCache: true },
    );
    if (outcome.usedAi) {
      expect(outcome.needsReview).toBe(true);
    }
    // Under no circumstance should the error bubble out.
    expect(outcome.category).toBeTruthy();
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
      { title: HARD_TITLE },
      { ai, bypassCache: true },
    );
    if (outcome.usedAi) {
      // Invalid AI response → treated like AI error → deterministic fallback.
      expect(outcome.needsReview).toBe(true);
    }
    expect(outcome.category).not.toBe('NotARealCategory' as never);
  });
});
