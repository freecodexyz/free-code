// Borrowed from src/utils/sessionRestore.ts — restore messages from JSONL.
//
// cc's sessionRestore.ts rebuilds AppState (file history, attribution,
// todos, worktree) from a loaded transcript. The Web port has no such
// server-side state, so restore here is just: parse the JSONL blob into a
// Message[] and report the count. validateTranscript() gives the UI a way
// to detect corruption before offering a session for resume.

import type { Message } from '../types/index.js'
import { readTranscriptForLoad } from './sessionStorage.js'

export interface RestoredSession {
  messages: Message[]
  messageCount: number
}

/**
 * Borrowed from cc restoreMessagesFromJSONL() — parse the session's JSONL
 * transcript into Message[] and return it with a count. Returns an empty
 * list (count 0) for missing/empty transcripts.
 */
export function restoreMessagesFromJSONL(sessionId: string): RestoredSession {
  const messages = readTranscriptForLoad(sessionId)
  return {
    messages,
    messageCount: messages.length,
  }
}

/**
 * Validate that a session transcript is loadable without corrupt lines.
 * Reads the raw blob (not the parsed Message[]) so we can count lines that
 * fail JSON.parse separately from parseJSONL's silent skip behavior.
 */
export function validateTranscript(sessionId: string): {
  valid: boolean
  corruptCount: number
  totalCount: number
} {
  const key = `cc-webui-sessions-${sessionId}`
  const text = localStorage.getItem(key) ?? ''
  if (!text) return { valid: true, corruptCount: 0, totalCount: 0 }
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  let corruptCount = 0
  for (const line of lines) {
    try {
      JSON.parse(line)
    } catch {
      corruptCount++
    }
  }
  return { valid: corruptCount === 0, corruptCount, totalCount: lines.length }
}
