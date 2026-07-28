// Borrowed from src/services/api/errors.ts — error classification for the
// Web port. cc's errors.ts classifies Anthropic SDK errors (APIError
// instances with status + message) and surfaces user-friendly messages.
// The Web port can't use the SDK (browser fetch only), so this module
// classifies plain strings / HTTP status codes instead. Function names are
// kept aligned with cc for easy cross-reference.

export const PROMPT_TOO_LONG_ERROR_MESSAGE = 'Prompt is too long'

// Borrowed from cc's REPEATED_529_ERROR_MESSAGE — shown when the foreground
// 529 retry budget (MAX_529_RETRIES = 3) is exhausted. cc uses
// 'Repeated 529 Overloaded errors'; the Web UI surfaces a more actionable
// string since there's no CLI recovery path.
export const REPEATED_529_ERROR_MESSAGE =
  'The API is overloaded. Please try again in a few minutes.'

/**
 * Borrowed from cc's isPromptTooLongMessage() — detects prompt-too-long
 * error text. cc checks an AssistantMessage's content blocks; the Web port
 * takes the raw error text (the body of a 400/413 response) and does a
 * case-insensitive match for the "prompt is too long" phrase, mirroring
 * cc's case-insensitive check in getAssistantMessageFromError().
 */
export function isPromptTooLongMessage(errorText: string): boolean {
  if (!errorText) return false
  return /prompt is too long/i.test(errorText)
}

/**
 * Borrowed from cc's parsePromptTooLongTokenCounts() — extracts the
 * actual/limit token counts from a raw prompt-too-long API error like
 * "prompt is too long: 137500 tokens > 135000 maximum". The raw string may
 * be wrapped in SDK prefixes or JSON envelopes, so the match is intentionally
 * lenient (matches cc's regex).
 *
 * Returns the prompt's actual token count as `inputTokens`. The limit is
 * not an output-token count, so `outputTokens` is left undefined (the basic
 * PTL format carries no output budget). Returns null if the counts can't be
 * parsed.
 */
export function parsePromptTooLongTokenCounts(
  errorText: string,
): { inputTokens: number; outputTokens?: number } | null {
  if (!errorText) return null
  const match = errorText.match(
    /prompt is too long[^0-9]*(\d+)\s*tokens?\s*>\s*(\d+)/i,
  )
  if (!match || match.length < 3 || !match[1] || !match[2]) return null
  const inputTokens = parseInt(match[1], 10)
  const limitTokens = parseInt(match[2], 10)
  if (Number.isNaN(inputTokens) || Number.isNaN(limitTokens)) return null
  return { inputTokens, outputTokens: undefined }
}

/** Borrowed from cc's is529Error() status check — HTTP 529 = overloaded. */
export function isOverloadedError(status: number): boolean {
  return status === 529
}

/** Borrowed from cc's 401/403 auth-error branches — never retried. */
export function isAuthError(status: number): boolean {
  return status === 401 || status === 403
}

/**
 * Borrowed from cc's shouldRetry() status-code branches — statuses that are
 * safe to retry with exponential backoff. 529 is included here but is gated
 * separately by the 529-foreground-only budget in withRetry.
 */
export function isRetryableStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  )
}

/**
 * Borrowed from cc's APIError shape — the Web chatClient throws HttpError
 * for non-2xx responses so withRetry can classify by status. Carries the
 * raw response body text so callers (e.g. isPromptTooLongMessage) can
 * inspect the API's error message.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
    public readonly bodyText?: string,
  ) {
    super(message ?? `HTTP ${status}`)
    this.name = 'HttpError'
  }
}

/**
 * Extract an HTTP status code from an error. Borrowed from cc's pattern of
 * reading `error.status` off APIError — the Web port checks HttpError first,
 * then a generic `status`/`response.status` property for errors thrown by
 * other callers. Returns undefined for network errors (no response).
 */
export function getStatusFromError(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status
  if (error && typeof error === 'object') {
    const maybeStatus = (error as { status?: unknown }).status
    if (typeof maybeStatus === 'number') return maybeStatus
  }
  return undefined
}
