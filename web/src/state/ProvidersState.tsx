import React, { useContext, useState, useSyncExternalStore } from 'react'
import { createStore, type Store } from './store.js'
import type { Provider } from '../types/index.js'
import { DEFAULT_PROVIDERS } from '../types/index.js'

// Borrowed from src/state/AppState.tsx — Provider + useSyncExternalStore
// pattern (mirrors web/src/state/WorkspaceState.tsx). Provider config is
// persisted to localStorage under `cc-webui-providers`.

const STORAGE_KEY = 'cc-webui-providers'

type ProvidersState = {
  providers: Provider[]
}

type ProvidersStore = Store<ProvidersState> & {
  addProvider: (p: Omit<Provider, 'id'>) => string
  updateProvider: (id: string, patch: Partial<Provider>) => void
  removeProvider: (id: string) => void
}

export const ProvidersStoreContext = React.createContext<ProvidersStore | null>(null)

function loadInitialProviders(): Provider[] {
  if (typeof localStorage === 'undefined') return DEFAULT_PROVIDERS
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_PROVIDERS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as Provider[]
    return DEFAULT_PROVIDERS
  } catch {
    return DEFAULT_PROVIDERS
  }
}

function persist(providers: Provider[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers))
  } catch {
    // localStorage may be unavailable (private mode / quota); ignore.
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createProvidersStore(initial: Provider[]): ProvidersStore {
  const base = createStore<ProvidersState>(
    { providers: initial },
    ({ newState }) => persist(newState.providers),
  )

  const addProvider = (p: Omit<Provider, 'id'>): string => {
    const id = `${slugify(p.name) || 'provider'}-${Date.now()}`
    base.setState(prev => ({ providers: [...prev.providers, { ...p, id }] }))
    return id
  }

  const updateProvider = (id: string, patch: Partial<Provider>): void => {
    base.setState(prev => ({
      providers: prev.providers.map(prov =>
        prov.id === id ? { ...prov, ...patch } : prov,
      ),
    }))
  }

  const removeProvider = (id: string): void => {
    base.setState(prev => ({
      providers: prev.providers.filter(prov => prov.id !== id),
    }))
  }

  return { ...base, addProvider, updateProvider, removeProvider }
}

type Props = {
  children: React.ReactNode
  initialProviders?: Provider[]
}

export function ProvidersStateProvider({ children, initialProviders }: Props) {
  const [store] = useState(() =>
    createProvidersStore(initialProviders ?? loadInitialProviders()),
  )
  return (
    <ProvidersStoreContext.Provider value={store}>
      {children}
    </ProvidersStoreContext.Provider>
  )
}

function useProvidersStore(): ProvidersStore {
  const store = useContext(ProvidersStoreContext)
  if (!store) {
    throw new ReferenceError(
      'useProviders cannot be called outside of a <ProvidersStateProvider />',
    )
  }
  return store
}

/**
 * Subscribe to a slice of ProvidersState. Only re-renders when the selected
 * value changes (compared via Object.is).
 *
 * Borrowed from useAppState in src/state/AppState.tsx
 */
export function useProviders<T>(selector: (s: ProvidersState) => T): T {
  const store = useProvidersStore()
  const get = () => selector(store.getState())
  return useSyncExternalStore(store.subscribe, get, get)
}

/**
 * Get the providers store (setState + addProvider/updateProvider/removeProvider)
 * without subscribing to state. Returns a stable reference.
 */
export function useSetProviders(): ProvidersStore {
  return useProvidersStore()
}
