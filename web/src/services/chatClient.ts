// Borrowed from src/services/api/claude.ts — streaming SSE chat client for
// the Web port. cc's claude.ts owns queryModelWithStreaming(), which
// consumes an Anthropic SDK Stream, runs a watchdog idle timer
// (STREAM_IDLE_TIMEOUT_MS = 90_000), and dispatches text_delta /
// tool_use / message_stop events. The Web port can't use the SDK
// (browser fetch only), so this module reimplements the same event
// contract on top of `fetch` + `response.body.getReader()` + a
// line-by-line SSE parser. It also supports OpenAI Chat Completions
// (cc's Codex path) via the same callback surface.
//
// withRetry integration (SubTask 5.3): only the *initial* fetch is
// wrapped in withRetry. Once the response body starts streaming,
// mid-stream errors propagate directly to onError without retry —
// retrying a partially-consumed stream would double-emit tokens.

import type { Message, ContentBlock, Provider } from '../types/index.js'
import { HttpError } from './apiErrors.js'
import { withRetry } from './withRetry.js'
import { emptyUsage, normalizeMessagesForAPI } from './messageUtils.js'

type Usage = NonNullable<Message['usage']>

/**
 * Borrowed from cc's toolToAPISchema() output shape — the Anthropic
 * tools array element. The Web Tool interface (Task 7) will produce
 * these directly; chatClient accepts them as-is so Phase 3 can plug in
 * without changes.
 */
export type ToolSchema = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type ChatCallbacks = {
  /** Borrowed from cc's text_delta accumulation — fired per text chunk. */
  onToken: (text: string) => void
  /** Borrowed from cc's content_block_stop for tool_use — fired when a tool_use block completes. */
  onToolUse?: (toolCall: {
    id: string
    name: string
    input: Record<string, unknown>
  }) => void
  /** Borrowed from cc's message_start — fired once when the stream begins. */
  onMessageStart?: () => void
  /** Borrowed from cc's message_delta usage — fired with accumulated usage. */
  onUsage?: (usage: Usage) => void
  /** Borrowed from cc's message_stop — fired when the stream completes. */
  onDone?: (stopReason?: string) => void
  /** Fired on any error except clean AbortController cancellation. */
  onError: (error: Error) => void
}

export type StreamChatOptions = {
  provider: Provider
  model: string
  messages: Message[]
  systemPrompt?: string
  tools?: ToolSchema[]
  maxTokens?: number
  /** External cancel signal. Aborting it aborts the internal controller. */
  signal?: AbortSignal
}

// Borrowed from cc's STREAM_IDLE_TIMEOUT_MS = 90_000. cc makes this env-
// overrideable; the Web port uses a fixed constant since there's no env.
const STREAM_IDLE_TIMEOUT_MS = 90_000

const DEFAULT_MAX_TOKENS = 8192

/**
 * Borrowed from cc's queryModelWithStreaming() entry point. Returns an
 * AbortController immediately and runs the stream in the background,
 * dispatching events to `callbacks`. The controller can be aborted to
 * cancel cleanly (AbortError is swallowed, onError is NOT called).
 */
export function streamChat(
  options: StreamChatOptions,
  callbacks: ChatCallbacks,
): AbortController {
  const controller = new AbortController()

  // Link an external signal (if any) to the internal controller so a
  // caller-supplied AbortController cancels the fetch.
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      options.signal.addEventListener(
        'abort',
        () => controller.abort(),
        { once: true },
      )
    }
  }

  void runStream(options, callbacks, controller).catch(err => {
    // runStream is expected to handle its own errors via callbacks.onError.
    // This is a last-resort guard so an unexpected throw never becomes an
    // unhandled rejection.
    if (!controller.signal.aborted) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  })

  return controller
}

async function runStream(
  options: StreamChatOptions,
  callbacks: ChatCallbacks,
  controller: AbortController,
): Promise<void> {
  // watchdogFired distinguishes a watchdog-driven abort (we already called
  // onError with the stall message) from a user-driven abort (clean
  // cancel — onError must NOT fire).
  let watchdogFired = false

  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const clearWatchdog = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }
  const scheduleWatchdog = () => {
    clearWatchdog()
    idleTimer = setTimeout(() => {
      watchdogFired = true
      clearWatchdog()
      callbacks.onError(
        new Error(
          `Stream stalled (no data for ${STREAM_IDLE_TIMEOUT_MS / 1000}s)`,
        ),
      )
      controller.abort()
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  try {
    callbacks.onMessageStart?.()
    scheduleWatchdog()

    if (options.provider.apiType === 'openai') {
      await streamOpenAI(options, callbacks, controller, scheduleWatchdog)
    } else {
      await streamAnthropic(options, callbacks, controller, scheduleWatchdog)
    }

    callbacks.onDone?.()
  } catch (err) {
    // Clean cancellation (user abort) — do NOT surface as error.
    // Watchdog abort already surfaced via onError above.
    if (watchdogFired) return
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || controller.signal.aborted)
    ) {
      return
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  } finally {
    clearWatchdog()
  }
}

// ── Anthropic ──────────────────────────────────────────────────────────

type AnthropicTextBlock = {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}
type AnthropicToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
  cache_control?: { type: 'ephemeral' }
}
type AnthropicToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string }>
  is_error?: boolean
  cache_control?: { type: 'ephemeral' }
}
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

async function streamAnthropic(
  options: StreamChatOptions,
  callbacks: ChatCallbacks,
  controller: AbortController,
  scheduleWatchdog: () => void,
): Promise<void> {
  const { provider, model, messages, systemPrompt, tools, maxTokens } = options
  const url = `${provider.baseURL.replace(/\/$/, '')}/v1/messages`

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': provider.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }

  const normalized = normalizeMessagesForAPI(messages)
  const apiMessages = injectCacheControl(toAnthropicMessages(normalized))

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    messages: apiMessages,
  }
  if (systemPrompt) body['system'] = systemPrompt
  if (tools && tools.length > 0) body['tools'] = tools

  // Borrowed from cc's withRetry() wrapping the initial fetch — only the
  // fetch (and non-2xx → HttpError throw) is retried. Once the body
  // streams, errors go straight to onError.
  const response = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new HttpError(res.status, `HTTP ${res.status}`, text)
    }
    return res
  })

  if (!response.body) {
    throw new Error('No response body from Anthropic API')
  }

  // Borrowed from cc's contentBlocks[index] accumulation.
  const contentBlocks = new Map<
    number,
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: string }
  >()
  let usage: Usage = emptyUsage()

  await readSSE(response.body, (data) => {
    // Reset watchdog on every event — borrowed from cc's resetStreamIdleTimer().
    scheduleWatchdog()
    const evt = parseJSON(data)
    if (!evt || typeof evt !== 'object') return
    const type = (evt as { type?: string }).type

    if (type === 'message_start') {
      const message = (evt as { message?: { usage?: unknown } }).message
      if (message && typeof message === 'object') {
        const u = (message as { usage?: Partial<Usage> }).usage
        if (u) usage = mergeUsage(usage, u)
      }
      callbacks.onUsage?.(usage)
      return
    }

    if (type === 'content_block_start') {
      const index = (evt as { index?: number }).index
      const cb = (evt as { content_block?: { type?: string; id?: string; name?: string } }).content_block
      if (typeof index !== 'number' || !cb) return
      if (cb.type === 'tool_use') {
        contentBlocks.set(index, {
          type: 'tool_use',
          id: cb.id ?? '',
          name: cb.name ?? '',
          input: '',
        })
      } else if (cb.type === 'text') {
        contentBlocks.set(index, { type: 'text', text: '' })
      }
      return
    }

    if (type === 'content_block_delta') {
      const index = (evt as { index?: number }).index
      const delta = (evt as { delta?: { type?: string; text?: string; partial_json?: string } }).delta
      if (typeof index !== 'number' || !delta) return
      const block = contentBlocks.get(index)
      if (!block) return
      if (delta.type === 'text_delta' && typeof delta.text === 'string' && block.type === 'text') {
        block.text += delta.text
        callbacks.onToken(delta.text)
      } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string' && block.type === 'tool_use') {
        block.input += delta.partial_json
      }
      return
    }

    if (type === 'content_block_stop') {
      const index = (evt as { index?: number }).index
      if (typeof index !== 'number') return
      const block = contentBlocks.get(index)
      if (!block) return
      if (block.type === 'tool_use') {
        let parsed: Record<string, unknown> = {}
        try {
          parsed = block.input.length > 0 ? JSON.parse(block.input) as Record<string, unknown> : {}
        } catch {
          parsed = {}
        }
        callbacks.onToolUse?.({ id: block.id, name: block.name, input: parsed })
      }
      contentBlocks.delete(index)
      return
    }

    if (type === 'message_delta') {
      const deltaUsage = (evt as { usage?: Partial<Usage> }).usage
      if (deltaUsage) usage = mergeUsage(usage, deltaUsage)
      callbacks.onUsage?.(usage)
      return
    }

    if (type === 'message_stop') {
      return
    }
  })
}

function toAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    const role = msg.role === 'user' ? 'user' : 'assistant'
    if (typeof msg.content === 'string') {
      out.push({ role, content: msg.content })
      continue
    }
    const blocks: AnthropicContentBlock[] = []
    for (const b of msg.content) {
      const mapped = toAnthropicBlock(b)
      if (mapped) blocks.push(mapped)
    }
    out.push({ role, content: blocks.length > 0 ? blocks : [{ type: 'text', text: '' }] })
  }
  return out
}

function toAnthropicBlock(
  block: ContentBlock,
): AnthropicContentBlock | null {
  if (block.type === 'text') {
    return { type: 'text', text: block.text }
  }
  if (block.type === 'tool_use') {
    return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
  }
  if (block.type === 'tool_result') {
    return {
      type: 'tool_result',
      tool_use_id: block.tool_use_id,
      content: block.content,
      ...(block.is_error ? { is_error: true } : {}),
    }
  }
  return null
}

/**
 * Borrowed from cc's addCacheBreakpoints() — inject cache_control on the
 * last content block of the last 2 user messages and on the last
 * tool_result block anywhere. cc's userMessageToMessageParam(addCache=true)
 * marks the last block of a user message; the Web port does the same in a
 * single pass over the converted API messages.
 */
function injectCacheControl(messages: AnthropicMessage[]): AnthropicMessage[] {
  const result = messages.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? m.content : m.content.map(b => ({ ...b })),
  }))

  // Last 2 user messages: tag their last content block.
  const userIdxs: number[] = []
  for (let i = 0; i < result.length; i++) {
    if (result[i]!.role === 'user') userIdxs.push(i)
  }
  const lastTwoUser = userIdxs.slice(-2)
  for (const idx of lastTwoUser) {
    const msg = result[idx]!
    if (Array.isArray(msg.content) && msg.content.length > 0) {
      const last = msg.content[msg.content.length - 1]!
      last.cache_control = { type: 'ephemeral' }
    }
  }

  // Last tool_result block anywhere: tag it.
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i]!
    if (!Array.isArray(msg.content)) continue
    for (let j = msg.content.length - 1; j >= 0; j--) {
      if (msg.content[j]!.type === 'tool_result') {
        msg.content[j]!.cache_control = { type: 'ephemeral' }
        return result
      }
    }
  }
  return result
}

// ── OpenAI ────────────────────────────────────────────────────────────

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
  | { role: 'tool'; tool_call_id: string; content: string }

async function streamOpenAI(
  options: StreamChatOptions,
  callbacks: ChatCallbacks,
  controller: AbortController,
  scheduleWatchdog: () => void,
): Promise<void> {
  const { provider, model, messages, systemPrompt, tools, maxTokens } = options
  const url = `${provider.baseURL.replace(/\/$/, '')}/chat/completions`

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${provider.apiKey}`,
  }

  const apiMessages: OpenAIMessage[] = []
  if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt })
  for (const msg of normalizeMessagesForAPI(messages)) {
    if (msg.role === 'system') continue
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : extractText(msg.content)
      apiMessages.push({ role: 'user', content: text })
      continue
    }
    // assistant
    if (typeof msg.content === 'string') {
      apiMessages.push({ role: 'assistant', content: msg.content })
    } else {
      const text = extractText(msg.content)
      const toolCalls = extractToolUses(msg.content)
      apiMessages.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })
      // tool_results become separate role: 'tool' messages.
      for (const tr of extractToolResults(msg.content)) {
        apiMessages.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        })
      }
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    messages: apiMessages,
    stream_options: { include_usage: true },
  }
  if (tools && tools.length > 0) {
    body['tools'] = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  const response = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new HttpError(res.status, `HTTP ${res.status}`, text)
    }
    return res
  })

  if (!response.body) {
    throw new Error('No response body from OpenAI API')
  }

  // tool_calls[index] → accumulated arguments string. Borrowed from cc's
  // contentBlocks Map for tool_use input_json accumulation.
  const toolCallState = new Map<number, { id: string; name: string; args: string }>()
  let usage: Usage = emptyUsage()

  await readSSE(response.body, (data) => {
    scheduleWatchdog()
    if (data === '[DONE]') return
    const evt = parseJSON(data)
    if (!evt || typeof evt !== 'object') return

    const choices = (evt as { choices?: Array<Record<string, unknown>> }).choices
    if (Array.isArray(choices) && choices.length > 0) {
      const choice = choices[0]!
      const delta = choice['delta'] as
        | {
            content?: string
            tool_calls?: Array<{
              index: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>
          }
        | undefined
      if (delta) {
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          callbacks.onToken(delta.content)
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallState.get(tc.index)
            if (!existing) {
              toolCallState.set(tc.index, {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                args: tc.function?.arguments ?? '',
              })
            } else {
              if (tc.function?.arguments) existing.args += tc.function.arguments
            }
          }
        }
      }
    }
    const usageChunk = (evt as { usage?: Partial<Usage> }).usage
    if (usageChunk) {
      usage = mergeUsage(usage, usageChunk)
      callbacks.onUsage?.(usage)
    }
  })

  // Fire onToolUse for any tool calls that completed during the stream.
  for (const [, tc] of toolCallState) {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = tc.args.length > 0 ? JSON.parse(tc.args) as Record<string, unknown> : {}
    } catch {
      parsed = {}
    }
    callbacks.onToolUse?.({ id: tc.id, name: tc.name, input: parsed })
  }
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
}

function extractToolUses(
  blocks: ContentBlock[],
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  const out: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = []
  for (const b of blocks) {
    if (b.type === 'tool_use') {
      out.push({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      })
    }
  }
  return out
}

function extractToolResults(
  blocks: ContentBlock[],
): Array<{ tool_use_id: string; content: string }> {
  const out: Array<{ tool_use_id: string; content: string }> = []
  for (const b of blocks) {
    if (b.type === 'tool_result') {
      out.push({
        tool_use_id: b.tool_use_id,
        content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
      })
    }
  }
  return out
}

// ── SSE reader ─────────────────────────────────────────────────────────

/**
 * Read an SSE stream from a ReadableStream<Uint8Array> and invoke `onData`
 * with the payload of each `data:` line. Borrowed from cc's SDK-driven
 * stream loop, reimplemented with fetch's getReader() + TextDecoder since
 * the browser has no for-await over Response.body in all targets.
 *
 * Handles both Anthropic's `event: foo\ndata: {...}` framing and OpenAI's
 * bare `data: {...}` framing — only the `data:` lines carry JSON, so we
 * skip `event:`/`id:`/`retry:` lines and blank lines.
 */
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (possibly partial) line in the buffer.
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trimEnd()
        if (trimmed === '') continue
        if (trimmed.startsWith(':')) continue // SSE comment
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trimStart()
          onData(payload)
        }
        // Skip event:/id:/retry: lines.
      }
    }
    // Flush any trailing buffered line.
    const tail = buffer.trimEnd()
    if (tail.startsWith('data:')) {
      onData(tail.slice(5).trimStart())
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Release can throw if the stream is already closed; ignore.
    }
  }
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Borrowed from cc's updateUsage() — merge a streaming usage delta into
 * the running usage, keeping the latest non-zero value for input/cache
 * fields (the API sends 0 in intermediate deltas). Reuses
 * messageUtils.updateUsage but is duplicated here to avoid a circular
 * import concern (chatClient → messageUtils is already imported above;
 * this local copy keeps the SSE handler self-contained).
 */
function mergeUsage(prev: Usage, delta: Partial<Usage>): Usage {
  const next: Usage = { ...prev }
  if (delta.input_tokens != null && delta.input_tokens > 0) {
    next.input_tokens = delta.input_tokens
  }
  if (delta.output_tokens != null) {
    next.output_tokens = delta.output_tokens
  }
  if (delta.cache_read_input_tokens != null && delta.cache_read_input_tokens > 0) {
    next.cache_read_input_tokens = delta.cache_read_input_tokens
  }
  if (
    delta.cache_creation_input_tokens != null &&
    delta.cache_creation_input_tokens > 0
  ) {
    next.cache_creation_input_tokens = delta.cache_creation_input_tokens
  }
  return next
}

// ── Models list ───────────────────────────────────────────────────────

/**
 * Fetch the list of model IDs available for a given provider. GETs the
 * provider's /v1/models endpoint (Anthropic) or /models endpoint (OpenAI,
 * whose baseURL already includes /v1) and returns the `id` of each entry
 * in the `data` array. Mirrors the header construction used by
 * streamAnthropic / streamOpenAI.
 */
export async function fetchModels(provider: Provider): Promise<string[]> {
  const isAnthropic = provider.apiType === 'anthropic'
  const url = isAnthropic
    ? `${provider.baseURL.replace(/\/$/, '')}/v1/models`
    : `${provider.baseURL.replace(/\/$/, '')}/models`

  const headers: Record<string, string> = isAnthropic
    ? {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    : {
        authorization: `Bearer ${provider.apiKey}`,
      }

  let response: Response
  try {
    response = await fetch(url, { method: 'GET', headers })
  } catch (err) {
    throw new Error(
      `Network error fetching models: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${text}`)
  }

  const parsed = JSON.parse(text) as { data?: Array<{ id?: string }> }
  const data = Array.isArray(parsed.data) ? parsed.data : []
  const ids: string[] = []
  for (const entry of data) {
    if (entry && typeof entry.id === 'string') ids.push(entry.id)
  }
  return ids
}
