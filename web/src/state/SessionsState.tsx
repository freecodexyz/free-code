import React, { useContext, useState, useSyncExternalStore } from 'react'
import { createStore, type Store } from './store.js'
import type { ChatSession, Message } from '../types/index.js'

// Borrowed from src/utils/sessionStorage.ts (JSONL transcript format) +
// src/state/AppState.tsx (Provider + useSyncExternalStore pattern).
// Web adaptation: localStorage holds a session index under
// `cc-webui-sessions-index` and one JSONL message body per session under
// `cc-webui-sessions-{id}` (one Message per line).

const INDEX_KEY = 'cc-webui-sessions-index'

const sessionBodyKey = (id: string): string => `cc-webui-sessions-${id}`

type SessionsState = {
  sessions: ChatSession[]
  currentIndex: string | null
}

type SessionsStore = Store<SessionsState> & {
  createSession: (input: {
    title: string
    projectPath: string
    providerId: string
    model: string
    permissionMode: ChatSession['permissionMode']
  }) => string
  updateSession: (id: string, patch: Partial<ChatSession>) => void
  removeSession: (id: string) => void
  getSession: (id: string) => ChatSession | undefined
  getSessionMessages: (sessionId: string) => Message[]
  appendMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, patch: Partial<Message>) => void
}

export const SessionsStoreContext = React.createContext<SessionsStore | null>(null)

function loadIndex(): ChatSession[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as ChatSession[]
    return []
  } catch {
    return []
  }
}

function persistIndex(sessions: ChatSession[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(sessions))
  } catch {
    // ignore persistence errors
  }
}

function readBody(sessionId: string): string {
  try {
    return localStorage.getItem(sessionBodyKey(sessionId)) ?? ''
  } catch {
    return ''
  }
}

function writeBody(sessionId: string, body: string): void {
  try {
    localStorage.setItem(sessionBodyKey(sessionId), body)
  } catch {
    // ignore
  }
}

function removeBody(sessionId: string): void {
  try {
    localStorage.removeItem(sessionBodyKey(sessionId))
  } catch {
    // ignore
  }
}

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createSessionsStore(initialSessions: ChatSession[]): SessionsStore {
  const base = createStore<SessionsState>(
    { sessions: initialSessions, currentIndex: null },
    ({ newState }) => persistIndex(newState.sessions),
  )

  const createSession: SessionsStore['createSession'] = input => {
    const id = generateSessionId()
    const now = Date.now()
    const session: ChatSession = {
      id,
      title: input.title,
      projectPath: input.projectPath,
      model: input.model,
      providerId: input.providerId,
      permissionMode: input.permissionMode,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      status: 'active',
    }
    base.setState(prev => ({
      sessions: [...prev.sessions, session],
      currentIndex: id,
    }))
    return id
  }

  const updateSession: SessionsStore['updateSession'] = (id, patch) => {
    base.setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
      ),
    }))
  }

  const removeSession: SessionsStore['removeSession'] = id => {
    removeBody(id)
    base.setState(prev => ({
      sessions: prev.sessions.filter(s => s.id !== id),
      currentIndex: prev.currentIndex === id ? null : prev.currentIndex,
    }))
  }

  const getSession: SessionsStore['getSession'] = id =>
    base.getState().sessions.find(s => s.id === id)

  // Borrowed from src/utils/sessionStorage.ts parseJSONL()
  const getSessionMessages: SessionsStore['getSessionMessages'] = sessionId => {
    const body = readBody(sessionId)
    const messages: Message[] = []
    for (const line of body.split('\n')) {
      if (!line) continue
      try {
        messages.push(JSON.parse(line) as Message)
      } catch {
        // skip malformed line
      }
    }
    return messages
  }

  // Borrowed from src/utils/sessionStorage.ts recordTranscript() — append one
  // JSON line per message.
  const appendMessage: SessionsStore['appendMessage'] = (sessionId, message) => {
    const body = readBody(sessionId)
    writeBody(sessionId, body + JSON.stringify(message) + '\n')
    base.setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId
          ? { ...s, messageCount: s.messageCount + 1, updatedAt: Date.now() }
          : s,
      ),
    }))
  }

  // Borrowed from src/utils/sessionStorage.ts patchMessage() — rewrite the
  // JSONL body with the patched message, leaving other lines untouched.
  const updateMessage: SessionsStore['updateMessage'] = (sessionId, messageId, patch) => {
    const body = readBody(sessionId)
    const lines = body.split('\n')
    let found = false
    const nextLines: string[] = []
    for (const line of lines) {
      if (!line) continue
      try {
        const message = JSON.parse(line) as Message
        if (message.id === messageId) {
          nextLines.push(JSON.stringify({ ...message, ...patch }))
          found = true
        } else {
          nextLines.push(JSON.stringify(message))
        }
      } catch {
        // skip malformed line
      }
    }
    if (!found) return
    writeBody(sessionId, nextLines.join('\n') + '\n')
    base.setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === sessionId ? { ...s, updatedAt: Date.now() } : s,
      ),
    }))
  }

  return {
    ...base,
    createSession,
    updateSession,
    removeSession,
    getSession,
    getSessionMessages,
    appendMessage,
    updateMessage,
  }
}

type Props = {
  children: React.ReactNode
  initialSessions?: ChatSession[]
}

export function SessionsStateProvider({ children, initialSessions }: Props) {
  const [store] = useState(() =>
    createSessionsStore(initialSessions ?? loadIndex()),
  )
  return (
    <SessionsStoreContext.Provider value={store}>
      {children}
    </SessionsStoreContext.Provider>
  )
}

function useSessionsStore(): SessionsStore {
  const store = useContext(SessionsStoreContext)
  if (!store) {
    throw new ReferenceError(
      'useSessions cannot be called outside of a <SessionsStateProvider />',
    )
  }
  return store
}

/**
 * Subscribe to a slice of SessionsState. Only re-renders when the selected
 * value changes (compared via Object.is).
 *
 * Borrowed from useAppState in src/state/AppState.tsx
 */
export function useSessions<T>(selector: (s: SessionsState) => T): T {
  const store = useSessionsStore()
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}

/**
 * Get the sessions store (setState + createSession/updateSession/removeSession/
 * getSession/getSessionMessages/appendMessage) without subscribing to state.
 * Returns a stable reference.
 */
export function useSetSessions(): SessionsStore {
  return useSessionsStore()
}
