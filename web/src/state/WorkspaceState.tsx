import React, { useContext, useState, useSyncExternalStore } from 'react'
import { createStore, type Store } from './store.js'
import type { WorkspaceState } from '../types/index.js'
import { getDefaultWorkspaceState } from '../types/index.js'

// Borrowed from src/state/AppState.tsx — simplified for Web workspace.
// Persists the user-configurable selection fields to localStorage under
// `cc-webui-workspace` (mirrors ProvidersState.tsx / SessionsState.tsx).
// `messages` and `todos` are intentionally NOT persisted here (too large /
// session-scoped) — only the four selection fields below survive a reload.
const STORAGE_KEY = 'cc-webui-workspace'

type PersistedWorkspace = Pick<
  WorkspaceState,
  'currentProviderId' | 'currentModel' | 'currentSessionId' | 'permissionMode'
>

// Borrowed from ProvidersState.loadInitialProviders — defensive JSON parse
// with shape validation so a corrupted entry can't crash the provider init.
function loadPersistedWorkspace(): Partial<PersistedWorkspace> {
  if (typeof localStorage === 'undefined') return {}
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as Record<string, unknown>
    const out: Partial<PersistedWorkspace> = {}
    if (obj.currentProviderId === null || typeof obj.currentProviderId === 'string') {
      out.currentProviderId = obj.currentProviderId as PersistedWorkspace['currentProviderId']
    }
    if (typeof obj.currentModel === 'string') {
      out.currentModel = obj.currentModel
    }
    if (obj.currentSessionId === null || typeof obj.currentSessionId === 'string') {
      out.currentSessionId = obj.currentSessionId as PersistedWorkspace['currentSessionId']
    }
    if (
      obj.permissionMode === 'default' ||
      obj.permissionMode === 'plan' ||
      obj.permissionMode === 'auto-accept' ||
      obj.permissionMode === 'bypass'
    ) {
      out.permissionMode = obj.permissionMode
    }
    return out
  } catch {
    return {}
  }
}

function persistWorkspace(state: WorkspaceState): void {
  if (typeof localStorage === 'undefined') return
  try {
    const toStore: PersistedWorkspace = {
      currentProviderId: state.currentProviderId,
      currentModel: state.currentModel,
      currentSessionId: state.currentSessionId,
      permissionMode: state.permissionMode,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch {
    // localStorage may be unavailable (private mode / quota); ignore.
  }
}

export const WorkspaceStoreContext = React.createContext<Store<WorkspaceState> | null>(null)

type Props = {
  children: React.ReactNode
  initialState?: WorkspaceState
}

export function WorkspaceStateProvider({ children, initialState }: Props) {
  const [store] = useState(() => {
    // An explicit initialState prop wins outright (test injection); otherwise
    // merge persisted selection fields over the defaults so a reload restores
    // the user's last provider/model/session/permissionMode.
    const base =
      initialState ?? { ...getDefaultWorkspaceState(), ...loadPersistedWorkspace() }
    return createStore(base, ({ newState }) => persistWorkspace(newState))
  })
  return (
    <WorkspaceStoreContext.Provider value={store}>
      {children}
    </WorkspaceStoreContext.Provider>
  )
}

function useWorkspaceStore(): Store<WorkspaceState> {
  const store = useContext(WorkspaceStoreContext)
  if (!store) {
    throw new ReferenceError('useWorkspaceState cannot be called outside of a <WorkspaceStateProvider />')
  }
  return store
}

/**
 * Subscribe to a slice of WorkspaceState. Only re-renders when the selected value
 * changes (compared via Object.is).
 *
 * Borrowed from useAppState in src/state/AppState.tsx
 */
export function useWorkspaceState<T>(selector: (s: WorkspaceState) => T): T {
  const store = useWorkspaceStore()
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}

/**
 * Get the setState updater without subscribing to any state.
 * Returns a stable reference that never changes.
 */
export function useSetWorkspaceState() {
  return useWorkspaceStore().setState
}
