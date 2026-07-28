// Borrowed from src/utils/tokens.ts — token count estimation for the Web
// port. cc's tokens.ts owns tokenCountWithEstimation(), which anchors on the
// last API response's BetaUsage (input + cache + output) and estimates any
// messages added since via roughTokenCountEstimationForMessages(). The Web
// port can't import cc's tokenizer (browser-only), so it uses a blended
// char-count estimate (1 token ≈ 3 chars) as a middle ground between the
// ~4 chars/token English average and the ~2 chars/token CJK average.
//
// Functions kept aligned with cc for cross-reference:
//   estimateTokens() ↔ roughTokenCountEstimation()
//   estimateMessageTokens() ↔ roughTokenCountEstimationForMessages() per-message
//   estimateConversationTokens() ↔ tokenCountWithEstimation() total

import type { Message } from '../types/index.js'

// Borrowed from cc roughTokenCountEstimation — char/3 blended estimate.
// (cc uses char/4 for English; the Web port blends to /3 to cover CJK text.)
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 3)
}

// Borrowed from cc's roughTokenCountEstimationForMessages per-message slice —
// walks content blocks (text / tool_use input / tool_result content) and sums
// estimates. When an assistant message carries explicit API usage, prefers
// output_tokens as the more accurate floor (mirrors cc's usage-anchoring).
export function estimateMessageTokens(message: Message): number {
  let total = 0
  if (typeof message.content === 'string') {
    total += estimateTokens(message.content)
  } else if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === 'text') {
        total += estimateTokens(block.text)
      } else if (block.type === 'tool_use') {
        total += estimateTokens(JSON.stringify(block.input))
      } else if (block.type === 'tool_result') {
        const text =
          typeof block.content === 'string'
            ? block.content
            : block.content.map(c => c.text).join('\n')
        total += estimateTokens(text)
      }
    }
  }
  if (message.usage) {
    // If we have explicit usage, prefer output_tokens as a more accurate
    // estimate floor — mirrors cc's usage-anchoring in tokenCountWithEstimation.
    total = Math.max(total, message.usage.output_tokens)
  }
  return total
}

export function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

// Auto-compact threshold — borrowed from cc's getAutoCompactThreshold()
// (~effective context window minus AUTOCOMPACT_BUFFER_TOKENS). cc derives
// this per-model from getContextWindowForModel(); the Web port assumes a 200k
// context window and a ~92% trigger point (180k).
export const AUTO_COMPACT_THRESHOLD = 180_000 // tokens; assumes 200k context window
export const WARNING_THRESHOLD = 100_000 // tokens
