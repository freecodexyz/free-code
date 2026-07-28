// Borrowed from src/utils/messages.ts — pure message helpers for the Web
// port. cc's messages.ts owns the Message lifecycle (create / normalize /
// repair tool_use↔tool_result pairing) and the per-turn usage accumulators
// that mirror the API's BetaUsage shape. The Web port reuses the same
// contracts so transcript JSON and usage tallies are directly comparable
// across CLI and Web, but drops the cc-specific envelope fields (uuid /
// timestamp ISO strings / isVirtual / isMeta) that the cc UI relies on —
// the Web Message type uses `id` (crypto.randomUUID) and `createdAt`
// (Date.now()) instead.
//
// Functions kept aligned with cc for cross-reference:
//   normalizeMessagesForAPI(), ensureToolResultPairing(),
//   createUserMessage(), createAssistantMessage(), createSystemMessage(),
//   createAssistantAPIErrorMessage(), accumulateUsage(), updateUsage().

import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from '../types/index.js'

type Usage = NonNullable<Message['usage']>

const NO_CONTENT_FALLBACK = '(no content)'

/**
 * Borrowed from cc's createUserMessage(). cc accepts a large options
 * object (attachments / toolUseResult / origin / permissionMode / etc.); the
 * Web port only needs the text + optional content-block form, since the
 * chatClient produces tool_result blocks directly. `type: 'text'` mirrors
 * cc's dispatch key for user text turns.
 */
export function createUserMessage(text: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    type: 'text',
    content: text,
    createdAt: Date.now(),
  }
}

/**
 * Borrowed from cc's createAssistantMessage(). cc wraps the content in a
 * text block and falls back to NO_CONTENT_MESSAGE when empty; the Web port
 * keeps the same fallback so an assistant turn with no emitted text still
 * serializes a visible placeholder.
 */
export function createAssistantMessage(text: string): Message {
  const safeText = text === '' ? NO_CONTENT_FALLBACK : text
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'text',
    content: safeText,
    createdAt: Date.now(),
  }
}

/**
 * Borrowed from cc's createSystemMessage(). cc's system messages carry a
 * subtype / level / toolUseID — the Web UI just needs a system role turn
 * with a text body (used for in-transcript notices like compaction
 * boundaries). `type: 'text'` mirrors cc's dispatch key for system text.
 */
export function createSystemMessage(text: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'system',
    type: 'text',
    content: text,
    createdAt: Date.now(),
  }
}

/**
 * Borrowed from cc's createAssistantAPIErrorMessage(). cc prefixes the
 * content with API_ERROR_MESSAGE_PREFIX; the Web port surfaces a ⚠️ prefix
 * so the error is visually distinct from normal assistant output without
 * a separate component. The message is an assistant-role turn so it renders
 * inline with the conversation flow.
 */
export function createAssistantAPIErrorMessage(errorText: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'text',
    content: `⚠️ API Error: ${errorText}`,
    createdAt: Date.now(),
  }
}

/**
 * Borrowed from cc's ensureToolResultPairing(). cc walks the message list
 * and, for every assistant tool_use block, guarantees a paired tool_result
 * in the next user message — synthesizing an empty `is_error: true`
 * tool_result if the pair is missing (the API rejects unpaired tool_use
 * with "tool_use ids must be unique" or "unexpected tool_use_id"). The
 * Web port implements the same repair so a resumed / mid-stream transcript
 * never 400s on the next request.
 *
 * It also strips orphaned tool_result blocks from a leading user message
 * (resume-after-compaction case) — mirroring cc's "Orphaned tool result
 * removed" branch — replacing with a placeholder if the message would
 * otherwise be empty, so the payload still starts with a user turn.
 */
export function ensureToolResultPairing(messages: Message[]): Message[] {
  const result: Message[] = []
  // Track tool_use IDs that still need a tool_result. Cleared when the
  // next user message provides the result (cc's per-message walk).
  const pendingToolUseIds: string[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!

    // Strip orphan tool_result from a leading user message (no preceding
    // assistant). Borrowed from cc's messages[0]-orphan branch.
    if (
      msg.role === 'user' &&
      Array.isArray(msg.content) &&
      result.length === 0
    ) {
      const hasToolResult = msg.content.some(
        b => typeof b === 'object' && b.type === 'tool_result',
      )
      if (hasToolResult) {
        const stripped = msg.content.filter(
          b => !(typeof b === 'object' && b.type === 'tool_result'),
        )
        const content: ContentBlock[] =
          stripped.length > 0
            ? stripped
            : [
                {
                  type: 'text',
                  text: '[Orphaned tool result removed due to conversation resume]',
                },
              ]
        result.push({ ...msg, content })
        continue
      }
    }

    if (msg.role === 'assistant') {
      // Collect tool_use IDs declared by this assistant. cc walks the
      // content array directly; the Web Message also carries a parallel
      // `toolUses` array (populated by chatClient from the same blocks),
      // but we read from content blocks so the source of truth is single.
      const toolUses: ToolUseBlock[] = []
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (typeof block === 'object' && block.type === 'tool_use') {
            toolUses.push(block)
          }
        }
      }
      // Also honor the convenience `toolUses` field if content is a string
      // (streaming assistant turn before content blocks are finalized).
      if (msg.toolUses) {
        for (const tu of msg.toolUses) {
          if (!toolUses.some(existing => existing.id === tu.id)) {
            toolUses.push(tu)
          }
        }
      }
      for (const tu of toolUses) {
        if (!pendingToolUseIds.includes(tu.id)) {
          pendingToolUseIds.push(tu.id)
        }
      }
      result.push(msg)
      continue
    }

    if (msg.role === 'user') {
      // Resolve pending tool_use IDs against any tool_result blocks here.
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (
            typeof block === 'object' &&
            block.type === 'tool_result'
          ) {
            const idx = pendingToolUseIds.indexOf(block.tool_use_id)
            if (idx !== -1) pendingToolUseIds.splice(idx, 1)
          }
        }
      }
      result.push(msg)
      continue
    }

    // system messages pass through unchanged.
    result.push(msg)
  }

  // After the walk, synthesize empty tool_result blocks for any tool_use
  // IDs that were never answered. cc injects these into the trailing user
  // message (or appends a new user turn); the Web port appends a new user
  // turn so the final payload always ends with a user message ready for
  // the next assistant response.
  if (pendingToolUseIds.length > 0) {
    const synthesized: ToolResultBlock[] = pendingToolUseIds.map(id => ({
      type: 'tool_result',
      tool_use_id: id,
      content: '[Tool execution interrupted — no result]',
      is_error: true,
    }))
    result.push({
      id: crypto.randomUUID(),
      role: 'user',
      type: 'tool_result',
      content: synthesized,
      createdAt: Date.now(),
    })
  }

  return result
}

/**
 * Borrowed from cc's normalizeMessagesForAPI(). cc's pipeline is large
 * (reorder attachments, strip virtual messages, strip tool_reference
 * blocks, merge consecutive same-role messages, route local_command
 * system messages to user, etc.). The Web port implements the subset that
 * matters for browser fetch:
 *   1. Strip pure system-only messages — the API takes `system` as a
 *      top-level field, not a message in the array.
 *   2. Merge consecutive same-role messages (Bedrock rejects multiple
 *      user turns in a row).
 *   3. Run ensureToolResultPairing() so every tool_use has a tool_result.
 *
 * System messages that carry tool_result context (cc's local_command
 * system messages) are not a Web concept yet, so they're stripped here.
 */
export function normalizeMessagesForAPI(messages: Message[]): Message[] {
  // 1. Drop system-only messages — they're sent as the top-level `system`
  // parameter by the chatClient, not as entries in `messages`.
  const nonSystem = messages.filter(m => m.role !== 'system')

  // 2. Merge consecutive same-role messages. cc merges user+user and
  // assistant+assistant; the Web port does the same by concatenating
  // string contents and merging content-block arrays. tool_use /
  // tool_result blocks are preserved as-is.
  const merged: Message[] = []
  for (const msg of nonSystem) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) {
      merged[merged.length - 1] = mergeMessages(last, msg)
    } else {
      merged.push(msg)
    }
  }

  // 3. Ensure every tool_use has a paired tool_result.
  return ensureToolResultPairing(merged)
}

/**
 * Merge two same-role messages into one. Borrowed from cc's
 * mergeUserMessages() / assistant merge branch. Concatenates string
 * contents with a newline, and unions content-block arrays (preserving
 * order). toolUses / toolResults arrays are concatenated when present.
 */
function mergeMessages(a: Message, b: Message): Message {
  const content =
    typeof a.content === 'string' && typeof b.content === 'string'
      ? a.content + '\n' + b.content
      : mergeContentBlocks(
          toArrayContent(a.content),
          toArrayContent(b.content),
        )

  const toolUses =
    a.toolUses || b.toolUses
      ? [
          ...(a.toolUses ?? []),
          ...(b.toolUses ?? []),
        ]
      : undefined
  const toolResults =
    a.toolResults || b.toolResults
      ? [
          ...(a.toolResults ?? []),
          ...(b.toolResults ?? []),
        ]
      : undefined

  // Keep the earlier message's id/createdAt so callers that reference the
  // id (e.g. streaming patches keyed by message id) keep working.
  return {
    ...a,
    content,
    toolUses,
    toolResults,
    // Merge usage if both halves carry one (rare; mainly compaction).
    usage:
      a.usage && b.usage
        ? accumulateUsage(a.usage, b.usage)
        : a.usage ?? b.usage,
  }
}

function toArrayContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return content.length > 0 ? [{ type: 'text', text: content }] : []
  }
  return content
}

function mergeContentBlocks(a: ContentBlock[], b: ContentBlock[]): ContentBlock[] {
  // Drop trailing empty text block from `a` if `b` starts with text, to
  // avoid emitting two adjacent text blocks that the API would concatenate
  // anyway. This mirrors cc's mergeUserMessages text-coalescing.
  const trimmedA = a.slice()
  const lastA = trimmedA[trimmedA.length - 1]
  const firstB = b[0]
  if (
    lastA &&
    typeof lastA === 'object' &&
    lastA.type === 'text' &&
    firstB &&
    typeof firstB === 'object' &&
    firstB.type === 'text'
  ) {
    trimmedA[trimmedA.length - 1] = {
      type: 'text',
      text: lastA.text + '\n' + firstB.text,
    }
    return [...trimmedA, ...b.slice(1)]
  }
  return [...trimmedA, ...b]
}

/**
 * Borrowed from cc's accumulateUsage(). cc accumulates a per-session
 * NonNullableUsage total across assistant turns; the Web port accumulates
 * the same fields (input / output / cache_read / cache_creation). Each
 * field is summed. The Web Usage type is a subset of cc's NonNullableUsage
 * (no server_tool_use / service_tier / cache_creation sub-objects), so
 * the implementation is correspondingly simpler.
 */
export function accumulateUsage(
  prev: Usage | undefined,
  delta: Usage,
): Usage {
  const base = prev ?? emptyUsage()
  return {
    input_tokens: base.input_tokens + (delta.input_tokens ?? 0),
    output_tokens: base.output_tokens + (delta.output_tokens ?? 0),
    cache_read_input_tokens:
      (base.cache_read_input_tokens ?? 0) +
      (delta.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens:
      (base.cache_creation_input_tokens ?? 0) +
      (delta.cache_creation_input_tokens ?? 0),
  }
}

/**
 * Borrowed from cc's updateUsage(). cc merges a streaming message_delta
 * usage chunk into the running usage for the current assistant turn,
 * keeping the latest non-zero value for input/cache fields (the API sends
 * 0 in intermediate deltas and the real value once in message_delta) and
 * the latest value for output_tokens. The Web port follows the same rule.
 */
export function updateUsage(
  prev: Usage | undefined,
  delta: Partial<Usage> | undefined,
): Usage {
  if (!delta) return prev ?? emptyUsage()
  const base = prev ?? emptyUsage()
  return {
    input_tokens:
      delta.input_tokens != null && delta.input_tokens > 0
        ? delta.input_tokens
        : base.input_tokens,
    output_tokens: delta.output_tokens ?? base.output_tokens,
    cache_read_input_tokens:
      delta.cache_read_input_tokens != null &&
      delta.cache_read_input_tokens > 0
        ? delta.cache_read_input_tokens
        : base.cache_read_input_tokens,
    cache_creation_input_tokens:
      delta.cache_creation_input_tokens != null &&
      delta.cache_creation_input_tokens > 0
        ? delta.cache_creation_input_tokens
        : base.cache_creation_input_tokens,
  }
}

/** Borrowed from cc's EMPTY_USAGE — zero-filled usage for turn start. */
export function emptyUsage(): Usage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }
}
