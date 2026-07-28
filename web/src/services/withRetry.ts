// Borrowed from src/services/api/withRetry.ts — retry strategy for the Web
// port. cc's withRetry wraps an Anthropic SDK operation and retries on
// 429/5xx with exponential backoff, treats 529 as foreground-only with a
// MAX_529_RETRIES = 3 budget, and never retries auth (401/403). The Web
// port simplifies this to a generic `withRetry<T>(fn, options)` wrapper
// (no SDK client, no generators) but keeps the same classification rules
// and exponential-backoff formula so behavior is directly comparable.

import {
  HttpError,
  isAuthError,
  isOverloadedError,
  isRetryableStatus,
  REPEATED_529_ERROR_MESSAGE,
} from './apiErrors.js'

export type RetryOptions = {
  /** Max retry attempts (not counting the initial try). Borrowed from cc DEFAULT_MAX_RETRIES. */
  maxRetries?: number // default 10
  /** Base delay for the first retry; doubles each attempt. */
  initialDelayMs?: number // default 1000
  /** Upper bound for the computed backoff delay. */
  maxDelayMs?: number // default 60000
  /**
   * When true, 529 (overloaded) errors are NOT retried — mirrors cc's
   * FOREGROUND_529_RETRY_SOURCES gate (background sources bail on 529 to
   * avoid amplifying capacity cascades).
   */
  isInBackground?: boolean // 529 only retries in foreground
  /** Override the built-in retry classification. */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /** Notified before each retry sleep with the error, attempt, and delay. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const DEFAULT_MAX_RETRIES = 10
const DEFAULT_INITIAL_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 60_000
const MAX_529_RETRIES = 3
// Borrowed from cc's jitter — Math.random() * 0.25 * baseDelay. The spec
// fixes jitter at Math.random() * 500, so we use that constant magnitude
// (keeps delays bounded and avoids thundering-herd on shared rate limits).
const JITTER_MAX_MS = 500

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      // DOMException names vary by browser; both signal an aborted fetch.
      error.name === 'TimeoutError')
  )
}

function getStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status
  if (error && typeof error === 'object') {
    const maybeStatus = (error as { status?: unknown }).status
    if (typeof maybeStatus === 'number') return maybeStatus
  }
  return undefined
}

/**
 * Borrowed from cc's getRetryDelay() — exponential backoff with jitter.
 * cc uses `BASE_DELAY_MS * 2^(attempt-1)` capped at maxDelayMs, plus a
 * 0.25*base jitter. The spec prescribes `initialDelayMs * 2^attempt + jitter`
 * with jitter = Math.random() * 500, capped at maxDelayMs.
 */
function computeDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
): number {
  const base = initialDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * JITTER_MAX_MS
  return Math.min(base + jitter, maxDelayMs)
}

/**
 * Borrowed from cc's withRetry(). Retries `fn` on retryable errors using
 * exponential backoff. Classification:
 *   - AbortError → never retry, rethrow (clean cancellation).
 *   - HTTP 401/403 → never retry (auth).
 *   - HTTP 529 → retry only when !isInBackground, up to MAX_529_RETRIES (3)
 *     consecutive 529s; after the budget, rethrow REPEATED_529_ERROR_MESSAGE.
 *   - HTTP 429/500/502/503/504 → retry up to maxRetries.
 *   - Network error (no status, e.g. fetch TypeError) → retry up to maxRetries.
 *   - Any other status → never retry, rethrow.
 * If `shouldRetry` is provided it overrides the default classification
 * (AbortError still never retries; the maxRetries ceiling still applies).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const isInBackground = options?.isInBackground ?? false
  const shouldRetryOverride = options?.shouldRetry
  const onRetry = options?.onRetry

  let consecutive529 = 0
  let lastError: unknown

  // maxRetries+1 total attempts (1 initial + maxRetries retries).
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Clean cancellation — never retry, never wrap.
      if (isAbortError(error)) {
        throw error
      }

      const status = getStatus(error)

      // Default classification (overridable).
      let retryable: boolean
      if (shouldRetryOverride) {
        retryable = shouldRetryOverride(error, attempt)
      } else {
        if (status === undefined) {
          // Network error (fetch threw before a response arrived).
          retryable = true
        } else if (isAuthError(status)) {
          retryable = false
        } else if (isOverloadedError(status)) {
          // 529: foreground-only, with a hard 3-retry budget.
          if (isInBackground) {
            retryable = false
          } else {
            consecutive529++
            if (consecutive529 >= MAX_529_RETRIES) {
              // Borrowed from cc's CannotRetryError(REPEATED_529_ERROR_MESSAGE)
              // path — surface a friendly overloaded message instead of the
              // raw 529 body.
              throw new Error(REPEATED_529_ERROR_MESSAGE)
            }
            retryable = true
          }
        } else if (isRetryableStatus(status)) {
          retryable = true
        } else {
          retryable = false
        }
      }

      if (!retryable) {
        throw error
      }

      // Exhausted all retries — rethrow the last error (borrowed from cc's
      // CannotRetryError path, without the wrapper class).
      if (attempt >= maxRetries) {
        throw error
      }

      const delayMs = computeDelay(attempt, initialDelayMs, maxDelayMs)
      onRetry?.(error, attempt + 1, delayMs)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  // Unreachable: the loop either returns or throws. Kept for exhaustiveness.
  throw lastError
}
