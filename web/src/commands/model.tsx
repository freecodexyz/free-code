// Borrowed from src/commands/model/ — Web adaptation.
// cc renders an Ink model picker reading the configured providers. Here we
// render a DOM card: current provider's models first, then cross-provider
// models as buttons. Clicking sets currentModel on the workspace and calls
// onDone(modelName). useProviders is read inside the rendered component (not at
// command-creation time) so it picks up live provider config.

import type * as React from 'react'
import { useProviders } from '../state/ProvidersState.js'
import { useSetWorkspaceState, useWorkspaceState } from '../state/WorkspaceState.js'
import type { Provider } from '../types/index.js'
import type {
  LocalJSXCommand,
  LocalJSXCommandOnDone,
} from '../types/command.js'

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 'var(--spacer-24)',
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--body-sm-font-family)',
  fontSize: 'var(--body-xs-font-size)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 'var(--spacer-8)',
}

function ModelPicker({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const providers = useProviders(s => s.providers)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const setState = useSetWorkspaceState()

  const current =
    providers.find(p => p.id === currentProviderId) ?? providers[0]

  // Current provider's models first, then every other provider's models.
  const groups: Array<{ provider: Provider; models: string[] }> = []
  if (current) {
    groups.push({ provider: current, models: current.models })
  }
  for (const p of providers) {
    if (p.id === current?.id) continue
    groups.push({ provider: p, models: p.models })
  }

  const choose = (model: string) => {
    setState(prev => ({ ...prev, currentModel: model }))
    onDone(model)
  }
  const close = () => onDone()
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close()
  }

  return (
    <div onClick={handleBackdrop} style={backdropStyle}>
      <div className="ds-dialog" role="dialog" aria-label="选择模型" style={{ maxWidth: 420 }}>
        <div className="ds-dialog__head">
          <span className="ds-dialog__title">选择模型</span>
          <button className="ds-dialog__close" type="button" onClick={close}>
            <img src="/assets/icons/x.svg" alt="关闭" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div
          className="ds-dialog__body"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-4)' }}
        >
          {groups.map(g => (
            <div key={g.provider.id}>
              <div style={groups.length > 1 ? groupLabelStyle : { ...groupLabelStyle, marginTop: 0 }}>
                {g.provider.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-4)' }}>
                {g.models.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`ds-btn${m === currentModel ? ' ds-btn--brand' : ' ds-btn--secondary'}`}
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={() => choose(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="ds-dialog__foot">
          <button className="ds-btn ds-btn--secondary" type="button" onClick={close}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

export const modelCommand: LocalJSXCommand = {
  type: 'local-jsx',
  name: 'model',
  description: '设置 AI 模型',
  argumentHint: '[model]',
  userFacingName: () => '/model',
  call: (_args, _context, onDone) => <ModelPicker onDone={onDone} />,
}
