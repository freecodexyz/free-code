// Borrowed from src/services/compact/autoCompact.ts — auto-compaction for
// the Web port. cc's autoCompact checks a per-model token threshold
// (getAutoCompactThreshold) and, when exceeded, runs microCompact +
// snipCompact to shrink tool_result bloat, then asks the model to summarize
// the surviving conversation via compactConversation(). The Web port
// mirrors that flow: threshold check → microCompact + snipCompact → if still
// over, streamChat a summary prompt and replace the history with the
// summarized assistant turn.
//
// streamChat() returns an AbortController immediately and dispatches events
// via callbacks (onToken/onDone/onError). To await completion we wrap a
// single streamChat call in a Promise that resolves on onDone and rejects on
// onError — the returned AbortController is discarded (the caller's external
// `signal` is already linked to the internal controller by streamChat).

import type { Message, Provider } from '../types/index.js'
import { streamChat } from './chatClient.js'
import { estimateConversationTokens, AUTO_COMPACT_THRESHOLD } from './tokenEstimate.js'
import { microCompact } from './microCompact.js'
import { snipCompact } from './snipCompact.js'

export interface CompactOptions {
  provider: Provider
  model: string
  messages: Message[]
  maxTokens?: number
  signal?: AbortSignal
  /** Streaming callback — fired per summary token chunk (borrowed from cc's
   * compactSummary streaming display). */
  onSummary?: (text: string) => void
}

export interface CompactResult {
  compactedMessages: Message[]
  originalTokenCount: number
  compactedTokenCount: number
  /** false if no compaction was needed (under threshold). */
  triggered: boolean
}

// Borrowed from cc's compactConversation summary prompt. cc assembles a
// detailed compact prompt (src/services/compact/prompt.ts) instructing the
// model to preserve code/decisions/todos; the Web port uses a concise
// equivalent since there's no cc prompt-template layer to pull from.
const COMPACT_SUMMARY_PROMPT =
  'Please summarize our conversation so far, preserving key context, decisions, code snippets, and any pending todos. Be concise.'

const DEFAULT_SUMMARY_MAX_TOKENS = 4096

// Borrowed from cc autoCompact — checks threshold, then summarizes via the
// model. Returns triggered=false (messages unchanged) when under threshold.
export async function autoCompact(options: CompactOptions): Promise<CompactResult> {
  const originalTokens = estimateConversationTokens(options.messages)
  if (originalTokens < AUTO_COMPACT_THRESHOLD) {
    return {
      compactedMessages: options.messages,
      originalTokenCount: originalTokens,
      compactedTokenCount: originalTokens,
      triggered: false,
    }
  }

  // Apply microCompact + snipCompact first to reduce tool_result bloat
  // (mirrors cc's pre-summarize microcompact pass).
  let messages = microCompact(options.messages)
  messages = snipCompact(messages)

  // If after micro/snip we're under threshold, return without a model
  // summarize call (mirrors cc's short-circuit when snip frees enough).
  const afterSnipTokens = estimateConversationTokens(messages)
  if (afterSnipTokens < AUTO_COMPACT_THRESHOLD) {
    return {
      compactedMessages: messages,
      originalTokenCount: originalTokens,
      compactedTokenCount: afterSnipTokens,
      triggered: true,
    }
  }

  // Model summarize: send the surviving conversation + a summary prompt and
  // stream the model's summary. Wrap the single streamChat call in a Promise
  // that resolves on onDone / rejects on onError.
  const summaryPrompt: Message = {
    id: crypto.randomUUID(),
    role: 'user',
    type: 'text',
    content: COMPACT_SUMMARY_PROMPT,
    createdAt: Date.now(),
  }

  const summaryText = await new Promise<string>((resolve, reject) => {
    let accumulated = ''
    streamChat(
      {
        provider: options.provider,
        model: options.model,
        messages: [...messages, summaryPrompt],
        maxTokens: options.maxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS,
        signal: options.signal,
      },
      {
        onToken: text => {
          accumulated += text
          options.onSummary?.(text)
        },
        onDone: () => resolve(accumulated),
        onError: err => reject(err),
      },
    )
  })

  const summaryMessage: Message = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'text',
    content: `[Conversation compacted]\n\n${summaryText}`,
    createdAt: Date.now(),
  }

  const compactedMessages = [summaryMessage]
  const compactedTokenCount = estimateConversationTokens(compactedMessages)
  return {
    compactedMessages,
    originalTokenCount: originalTokens,
    compactedTokenCount,
    triggered: true,
  }
}
