// Borrowed from src/services/compact/microCompact.ts — trim tool_result
// content to keep large tool outputs from dominating the context window.
// cc's microCompact clears old tool_result content via cache_edits or a
// TIME_BASED_MC_CLEARED_MESSAGE marker; the Web port has no cache-edit API,
// so it truncates oversized tool_result text in place to MAX_TOOL_RESULT_CHARS
// with a trailing truncation notice (the simplest content-preserving strategy
// that still leaves the model with a usable summary of the output).

import type { Message } from '../types/index.js'

// tool_result content longer than this gets truncated. cc's microcompact
// clears content entirely once a tool_result is "old"; the Web port keeps a
// head slice so recent-but-large outputs (e.g. a big file read) still carry
// useful signal after compaction.
const MAX_TOOL_RESULT_CHARS = 5000

export function microCompact(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') return msg
    if (!Array.isArray(msg.content)) return msg
    let mutated = false
    const newContent = msg.content.map(block => {
      if (block.type !== 'tool_result') return block
      const text =
        typeof block.content === 'string'
          ? block.content
          : block.content.map(c => c.text).join('\n')
      if (text.length <= MAX_TOOL_RESULT_CHARS) return block
      mutated = true
      const truncated =
        text.slice(0, MAX_TOOL_RESULT_CHARS) +
        `\n\n[...truncated ${text.length - MAX_TOOL_RESULT_CHARS} chars...]`
      return { ...block, content: truncated }
    })
    return mutated ? { ...msg, content: newContent } : msg
  })
}
