// Borrowed from src/commands/status/ — Web adaptation.
// cc shows version/model/account/API connectivity/tool statuses. The Web
// project has no version probe or API connectivity check; here we render a
// status card with the current session id, provider, model, message count, last
// activity time, and in-progress tool count, read from the workspace/providers/
// sessions stores.

import type * as React from 'react'
import { useProviders } from '../state/ProvidersState.js'
import { useSessions } from '../state/SessionsState.js'
import { useWorkspaceState } from '../state/WorkspaceState.js'
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 'var(--spacer-12)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--body-sm-font-size)',
  color: 'var(--text-secondary)',
}

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--body-sm-font-size)',
  color: 'var(--text-default)',
  textAlign: 'right',
  wordBreak: 'break-all',
}

function StatusCard({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const currentSessionId = useWorkspaceState(s => s.currentSessionId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const messages = useWorkspaceState(s => s.messages)
  const inProgressToolUseIDs = useWorkspaceState(s => s.inProgressToolUseIDs)
  const providers = useProviders(s => s.providers)
  const sessions = useSessions(s => s.sessions)

  const provider = providers.find(p => p.id === currentProviderId)
  const session = sessions.find(s => s.id === currentSessionId)
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined
  const lastActivity = lastMessage
    ? new Date(lastMessage.timestamp).toLocaleString()
    : '—'

  const rows: Array<{ label: string; value: string }> = [
    { label: '会话 ID', value: currentSessionId ?? '—' },
    { label: '会话', value: session?.title ?? '—' },
    { label: '提供商', value: provider?.name ?? '—' },
    { label: '模型', value: currentModel || '—' },
    { label: '消息', value: String(messages.length) },
    { label: '最近活动', value: lastActivity },
    { label: '进行中的工具', value: String(inProgressToolUseIDs.length) },
  ]

  const close = () => onDone()
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close()
  }

  return (
    <div onClick={handleBackdrop} style={backdropStyle}>
      <div className="ds-dialog" role="dialog" aria-label="状态" style={{ maxWidth: 420 }}>
        <div className="ds-dialog__head">
          <span className="ds-dialog__title">状态</span>
          <button className="ds-dialog__close" type="button" onClick={close}>
            <img src="/assets/icons/x.svg" alt="关闭" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div
          className="ds-dialog__body"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-8)' }}
        >
          {rows.map(r => (
            <div key={r.label} style={rowStyle}>
              <span style={labelStyle}>{r.label}</span>
              <span style={valueStyle}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="ds-dialog__foot">
          <button className="ds-btn ds-btn--secondary" type="button" onClick={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export const statusCommand: LocalJSXCommand = {
  type: 'local-jsx',
  name: 'status',
  description: '显示会话状态：模型、提供商、消息和工具活动',
  userFacingName: () => '/status',
  call: (_args, _context, onDone) => <StatusCard onDone={onDone} />,
}
