import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AiClient } from '@/lib/category-classifier';

// Mock the cache module so we can observe get/set without touching SQLite.
vi.mock('@/lib/category-classifier/cache', () => {
  const store = new Map<
    string,
    {
      inputHash: string;
      classifierVersion: string;
      category: string;
      tags: string[];
      confidence: string;
      source: string;
      reason: string | null;
      candidates: null;
    }
  >();
  return {
    getCached: vi.fn((hash: string) => store.get(hash) ?? null),
    setCached: vi.fn((row: { inputHash: string; category: string; tags: string[]; confidence: string; source: string; reason?: string | null }) => {
      store.set(row.inputHash, {
        inputHash: row.inputHash,
        classifierVersion: 'cat-v1',
        category: row.category,
        tags: row.tags,
        confidence: row.confidence,
        source: row.source,
        reason: row.reason ?? null,
        candidates: null,
      });
    }),
    purgeStaleVersions: vi.fn(() => 0),
    __store: store,
  };
});

import { classifyWithAiFallback } from '@/lib/category-classifier';
import * as cacheModule from '@/lib/category-classifier/cache';

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

describe('AI cache behavior', () => {
  beforeEach(() => {
    // Reset mock store
    const store = (cacheModule as unknown as { __store: Map<string, unknown> }).__store;
    store.clear();
    vi.clearAllMocks();
  });

  it('writes to cache after a successful AI call', async () => {
    const ai = makeAi({
      primaryCategory: 'Nightlife',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'club',
      shouldReview: false,
    });

    await classifyWithAiFallback({ title: 'Forest Rave 2026' }, { ai });

    expect(cacheModule.setCached).toHaveBeenCalledOnce();
    const store = (cacheModule as unknown as { __store: Map<string, unknown> }).__store;
    expect(store.size).toBe(1);
  });

  it('second call hits the cache and does not invoke AI again', async () => {
    const firstAi = makeAi({
      primaryCategory: 'Nightlife',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'club',
      shouldReview: false,
    });
    await classifyWithAiFallback({ title: 'Forest Rave 2026' }, { ai: firstAi });
    expect(firstAi.chat.completions.create).toHaveBeenCalledOnce();

    const secondAi = makeAi({
      primaryCategory: 'Musik',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'should not reach',
      shouldReview: false,
    });
    const outcome = await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai: secondAi },
    );

    expect(secondAi.chat.completions.create).not.toHaveBeenCalled();
    // Cache hit returns the category stored under the earlier call
    expect(outcome.category).toBe('Nightlife');
    expect(outcome.usedAi).toBe(true);
  });

  it('bypassCache skips both read and write', async () => {
    const ai = makeAi({
      primaryCategory: 'Nightlife',
      secondaryCategories: [],
      confidence: 'high',
      shortReason: 'club',
      shouldReview: false,
    });

    await classifyWithAiFallback(
      { title: 'Forest Rave 2026' },
      { ai, bypassCache: true },
    );

    expect(cacheModule.getCached).not.toHaveBeenCalled();
    expect(cacheModule.setCached).not.toHaveBeenCalled();
  });
});
