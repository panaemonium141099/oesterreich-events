import { describe, it, expect } from 'vitest';
import { isQuotaExhausted } from '@/lib/search/gemini-error';

describe('isQuotaExhausted', () => {
  it('erkennt den HTTP-Status 429 der SDK', () => {
    expect(isQuotaExhausted(Object.assign(new Error('x'), { status: 429 }))).toBe(true);
  });

  it('erkennt die echte Fehlermeldung aus dem Prod-Log vom 2026-09-07', () => {
    const err = new Error(JSON.stringify({
      error: {
        code: 429,
        message: 'You exceeded your current quota, please check your plan and billing details. '
          + '* Quota exceeded for metric: generativelanguage.googleapis.com/'
          + 'generate_requests_per_model_per_day, limit: 10000, model: gemini-2.5-flash',
        status: 'RESOURCE_EXHAUSTED',
      },
    }));
    expect(isQuotaExhausted(err)).toBe(true);
  });

  it('hält einen Netzwerkfehler NICHT für ein Kontingentproblem', () => {
    expect(isQuotaExhausted(new Error('fetch failed'))).toBe(false);
  });

  it('hält einen 500er NICHT für ein Kontingentproblem', () => {
    expect(isQuotaExhausted(Object.assign(new Error('boom'), { status: 500 }))).toBe(false);
  });

  it('kommt mit null, undefined und Strings klar', () => {
    expect(isQuotaExhausted(null)).toBe(false);
    expect(isQuotaExhausted(undefined)).toBe(false);
    expect(isQuotaExhausted('RESOURCE_EXHAUSTED')).toBe(false);
  });
});
