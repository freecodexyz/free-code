import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WorkspaceStateProvider, useWorkspaceState, useSetWorkspaceState } from './state/WorkspaceState.js'
import { ProvidersStateProvider, useProviders } from './state/ProvidersState.js'
import { SessionsStateProvider } from './state/SessionsState.js'
import { Workspace } from './pages/Workspace.js'
import { Sessions } from './pages/Sessions.js'
import { Settings } from './pages/Settings.js'

// Bridges two sibling stores that can't see each other: WorkspaceState
// (currentProviderId / currentModel) and ProvidersState (providers list).
// On mount and whenever providers change, validates the persisted selection:
// - if currentProviderId is missing/null or points to a deleted provider,
//   fall back to providers[0] and reset currentModel to its first model;
// - if the provider is valid but currentModel is empty or no longer in the
//   provider's model list, reset to the first available model.
//
// This is the Web equivalent of cc's AppStateStore startup reconciliation
// (src/state/AppStateStore.ts) — placed inside BOTH WorkspaceStateProvider
// and ProvidersStateProvider so it can read/write both. Renders null.
function WorkspaceStateSync() {
  const providers = useProviders(s => s.providers)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const setState = useSetWorkspaceState()

  useEffect(() => {
    const validProvider = providers.find(p => p.id === currentProviderId)
    if (!validProvider) {
      const first = providers[0]
      if (first) {
        setState(prev => ({
          ...prev,
          currentProviderId: first.id,
          currentModel: first.models[0] ?? '',
        }))
      }
    } else if (!currentModel || !validProvider.models.includes(currentModel)) {
      setState(prev => ({
        ...prev,
        currentModel: validProvider.models[0] ?? '',
      }))
    }
  }, [providers, currentProviderId, currentModel, setState])

  return null
}

export default function App() {
  return (
    <WorkspaceStateProvider>
      <ProvidersStateProvider>
        <SessionsStateProvider>
          <WorkspaceStateSync />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Workspace />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </BrowserRouter>
        </SessionsStateProvider>
      </ProvidersStateProvider>
    </WorkspaceStateProvider>
  )
}
