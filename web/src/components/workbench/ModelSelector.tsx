// Borrowed from src/utils/model/providers.ts default config + the cc CLI's
// `/model` slash command UX — surfaced as inline pill-style dropdowns at the
// bottom-left of the composer so users can switch Provider + Model without
// leaving the chat (mirrors cc's inline model picker).
//
// State wiring:
// - Provider list + models come from ProvidersState (Task 16).
// - currentProviderId / currentModel live on WorkspaceState so useChat (Task 15)
//   reads them when building the streamChat request.
// - Changing provider resets currentModel to the new provider's first model
//   (otherwise the stream would send a model id that doesn't belong to the
//   active provider).

import { useProviders } from '../../state/ProvidersState.js'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'

export function ModelSelector() {
  const providers = useProviders(s => s.providers)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const setState = useSetWorkspaceState()

  // currentProviderId may be null on first load (getDefaultWorkspaceState) or
  // stale after a provider is removed — fall back to the first provider.
  // noUncheckedIndexedAccess makes providers[0] Provider | undefined, hence
  // the optional chaining below.
  const currentProvider = providers.find(p => p.id === currentProviderId) ?? providers[0]
  const effectiveProviderId = currentProvider?.id ?? ''
  const effectiveModel = currentModel || currentProvider?.models[0] || ''

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
      <select
        className="ds-select ds-select--sm"
        value={effectiveProviderId}
        onChange={(e) => {
          const newProviderId = e.target.value
          const newProvider = providers.find(p => p.id === newProviderId)
          setState(prev => ({
            ...prev,
            currentProviderId: newProviderId,
            // Reset model to the new provider's first entry so the next
            // request can't reference a model id that doesn't exist on the
            // newly-selected provider.
            currentModel: newProvider?.models[0] ?? '',
          }))
        }}
        style={{ minWidth: 120 }}
      >
        {providers.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <span style={{ color: 'var(--text-tertiary)' }}>·</span>
      <select
        className="ds-select ds-select--sm"
        value={effectiveModel}
        onChange={(e) => {
          setState(prev => ({ ...prev, currentModel: e.target.value }))
        }}
        style={{ minWidth: 160 }}
      >
        {currentProvider?.models.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  )
}
