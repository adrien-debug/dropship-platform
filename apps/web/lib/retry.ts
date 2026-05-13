/**
 * Generic retry wrapper with exponential backoff and jitter.
 *
 * Used for external API calls (Medusa, AliExpress, etc.) where transient
 * failures (network blips, 502/503, cold starts) are common and retries
 * are safe (idempotent reads, or writes with idempotency keys).
 */

export interface RetryOptions {
  /** Max number of attempts (including the first). Default 3. */
  maxAttempts?: number;
  /** Initial delay in ms. Default 500. */
  baseDelayMs?: number;
  /** Max delay in ms. Default 8000. */
  maxDelayMs?: number;
  /** Multiplier between attempts. Default 2. */
  backoffMultiplier?: number;
  /** Add random jitter (0-30%) to avoid thundering herd. Default true. */
  jitter?: boolean;
  /** Optional predicate to decide whether an error is retryable. */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_IS_RETRYABLE = (error: unknown): boolean => {
  if (error instanceof Response) {
    // Retry on server errors and rate limits
    return error.status >= 500 || error.status === 429 || error.status === 408;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed') ||
      msg.includes('abort')
    );
  }
  return false;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
  jitter: boolean,
): number {
  const exponential = baseDelayMs * Math.pow(multiplier, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  if (!jitter) return capped;
  // Add 0-30% jitter
  const jitterFactor = 0.7 + Math.random() * 0.3;
  return Math.round(capped * jitterFactor);
}

/**
 * Retry an async function with exponential backoff.
 *
 * @example
 *   const result = await retry(() => medusa.getProducts({ limit: 10 }), {
 *     maxAttempts: 3,
 *     baseDelayMs: 500,
 *   });
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = DEFAULT_IS_RETRYABLE,
  } = opts;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, backoffMultiplier, jitter);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Retry wrapper specifically for fetch() calls.
 * Wraps non-ok Responses in an error so the retry logic can inspect status codes.
 */
export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  return retry(async () => {
    const res = await fetch(input, init);
    if (!res.ok) {
      // Clone so the caller can still read the body
      throw res.clone();
    }
    return res;
  }, opts);
}
