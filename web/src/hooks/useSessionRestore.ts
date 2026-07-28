// Borrowed from src/utils/sessionRestore.ts — React hook for restoring a
// session on demand.
//
// Components call useSessionRestore().restore(sessionId) to lazily load a
// session's Message[] from localStorage when the user opens it. This mirrors
// cc's "load transcript on resume" pattern, wrapped in React state so the
// caller can render a loading indicator and surface parse errors.

import { useState, useCallback } from 'react'
import type { Message } from '../types/index.js'
import { restoreMessagesFromJSONL } from '../services/sessionRestore.js'

export function useSessionRestore() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const restore = useCallback((sessionId: string): Message[] => {
    setIsLoading(true)
    setError(null)
    try {
      const { messages } = restoreMessagesFromJSONL(sessionId)
      return messages
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { restore, isLoading, error }
}
