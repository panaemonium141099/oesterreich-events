import {
  RETRYABLE_PATTERNS,
  RETRY_DELAYS_MS,
  MAX_RETRIES,
} from './scrape-pipeline-types';

export function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return RETRYABLE_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

export interface RetryResult<T> {
  value?: T;
  error?: string;
  retryCount: number;
}

export interface RetryOptions {
  maxRetries?: number;
  delaysMs?: readonly number[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { value, retryCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (!isRetryableError(err) || attempt === maxRetries) {
        return { error: message, retryCount };
      }

      retryCount++;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.log(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed (${message}), ` +
        `retrying in ${delay / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { error: 'Max retries exceeded', retryCount };
}
