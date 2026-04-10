import { describe, it, expect, vi } from 'vitest';
import { isRetryableError, withRetry } from '@/lib/pipeline/retry';

describe('isRetryableError', () => {
  it('returns true for ECONNREFUSED', () => {
    expect(isRetryableError(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isRetryableError(new Error('connect ETIMEDOUT 10.0.0.1:443'))).toBe(true);
  });

  it('returns true for 503 status', () => {
    expect(isRetryableError(new Error('Request failed with status 503'))).toBe(true);
  });

  it('returns true for socket hang up', () => {
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });

  it('returns false for parse errors', () => {
    expect(isRetryableError(new Error('Unexpected token < in JSON'))).toBe(false);
  });

  it('returns false for 404', () => {
    expect(isRetryableError(new Error('Request failed with status 404'))).toBe(false);
  });

  it('returns false for validation errors', () => {
    expect(isRetryableError(new Error('Invalid date format'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result.value).toBe('ok');
    expect(result.retryCount).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.value).toBe('ok');
    expect(result.retryCount).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Unexpected token <'));
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.error).toBe('Unexpected token <');
    expect(result.retryCount).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT'));
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.error).toContain('ETIMEDOUT');
    expect(result.retryCount).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
