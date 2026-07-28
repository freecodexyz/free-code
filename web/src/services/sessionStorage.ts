// Borrowed from src/utils/sessionStorage.ts — localStorage adaptation.
//
// cc's sessionStorage.ts appends JSONL entries to a per-session transcript
// file via recordTranscript() and reads them back via readTranscriptForLoad()
// / parseJSONL(). The Web port stores the same JSONL payload under
// `cc-webui-sessions-{id}` in localStorage (one Message per line). This
// module is a lower-level service: SessionsState.tsx owns the React store
// and may delegate to these helpers, but the helpers are also safe to call
// directly from non-React code (tests, migrations, etc.).

import type { Message } from '../types/index.js'

/**
 * Serialize a single Message to one JSONL line (no trailing newline).
 * Borrowed from cc's per-line JSON.stringify contract in sessionStorage.ts.
 */
export function serializeMessage(message: Message): string {
  return JSON.stringify(message)
}

/**
 * Parse a JSONL blob into Message[]. Malformed lines are skipped with a
 * warning instead of throwing — mirrors cc parseJSONL()'s tolerant behavior
 * so a single bad line never blocks session restore.
 */
export function parseJSONL(text: string): Message[] {
  if (!text) return []
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  const messages: Message[] = []
  for (const line of lines) {
    try {
      messages.push(JSON.parse(line) as Message)
    } catch (e) {
      console.warn('Failed to parse JSONL line:', line, e)
    }
  }
  return messages
}

/**
 * Borrowed from cc recordTranscript() — append a single Message as one JSON
 * line to the session's transcript. Reads the existing blob and rewrites it
 * because localStorage has no append primitive.
 */
export function recordTranscript(sessionId: string, message: Message): void {
  const key = `cc-webui-sessions-${sessionId}`
  const existing = localStorage.getItem(key) ?? ''
  const line = serializeMessage(message) + '\n'
  localStorage.setItem(key, existing + line)
}

/**
 * Borrowed from cc readTranscriptForLoad() — load the entire transcript for
 * a session and return it as Message[] for restore.
 */
export function readTranscriptForLoad(sessionId: string): Message[] {
  const key = `cc-webui-sessions-${sessionId}`
  const text = localStorage.getItem(key) ?? ''
  return parseJSONL(text)
}

/**
 * Write the entire transcript at once. Used for compaction/replace flows
 * where the whole blob is recomputed (e.g. updateMessageInTranscript,
 * replaceLastMessage).
 */
export function writeTranscript(sessionId: string, messages: Message[]): void {
  const key = `cc-webui-sessions-${sessionId}`
  const text =
    messages.map(serializeMessage).join('\n') +
    (messages.length > 0 ? '\n' : '')
  localStorage.setItem(key, text)
}

/** Append multiple messages at once (batched convenience wrapper). */
export function appendMessages(sessionId: string, messages: Message[]): void {
  for (const msg of messages) recordTranscript(sessionId, msg)
}

/** Delete the entire transcript blob for a session. */
export function deleteTranscript(sessionId: string): void {
  localStorage.removeItem(`cc-webui-sessions-${sessionId}`)
}

/**
 * Update a single message in-place (matched by id). Used for streaming
 * updates where an existing assistant turn is mutated as tokens arrive.
 * No-op if the id is not found.
 */
export function updateMessageInTranscript(
  sessionId: string,
  messageId: string,
  patch: Partial<Message>,
): void {
  const messages = readTranscriptForLoad(sessionId)
  const idx = messages.findIndex(m => m.id === messageId)
  const target = idx !== -1 ? messages[idx] : undefined
  if (!target) return
  messages[idx] = { ...target, ...patch }
  writeTranscript(sessionId, messages)
}

/**
 * Replace the last message in the transcript. Commonly used for streaming
 * assistant tokens where the in-flight assistant turn is rewritten on each
 * chunk. If the transcript is empty, the message is appended instead.
 */
export function replaceLastMessage(
  sessionId: string,
  message: Message,
): void {
  const messages = readTranscriptForLoad(sessionId)
  if (messages.length === 0) {
    recordTranscript(sessionId, message)
  } else {
    messages[messages.length - 1] = message
    writeTranscript(sessionId, messages)
  }
}
