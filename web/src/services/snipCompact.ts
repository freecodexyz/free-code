// Borrowed from src/services/compact/snipCompact.ts — snip older messages
// when the message count grows past a cap, keeping only the most recent
// turns plus a synthetic "snipped" marker. cc's snipCompact tracks
// tokensFreed and emits a boundary message; the Web port uses a simpler
// count-based trigger (MAX_MESSAGES_BEFORE_SNIP) since it has no server-side
// snip projection to coordinate with.

import type { Message } from '../types/index.js'

// If the conversation has more messages than this, snip older ones. cc's
// snip is token-driven; the Web port uses a message-count cap as a coarse
// fallback when token estimation is imprecise.
const MAX_MESSAGES_BEFORE_SNIP = 30

export function snipCompact(messages: Message[]): Message[] {
  if (messages.length <= MAX_MESSAGES_BEFORE_SNIP) return messages
  // Keep the most recent messages + a synthetic "snipped" marker at the
  // head. Reserve 2 slots (-keepRecent+2) so the marker + kept slice stays
  // within the cap.
  const kept = messages.slice(-MAX_MESSAGES_BEFORE_SNIP + 2)
  const snippedCount = messages.length - kept.length
  const snippedMarker: Message = {
    id: crypto.randomUUID(),
    role: 'system',
    type: 'text',
    content: `[${snippedCount} earlier messages snipped to save context]`,
    createdAt: messages[0]?.createdAt ?? Date.now(),
  }
  return [snippedMarker, ...kept]
}
