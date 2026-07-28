// Borrowed from src/commands/help/help.tsx — Web adaptation.
// cc renders an Ink <HelpV2> component fed commands via context.options.commands.
// Here we render a DOM modal card listing every command pulled from the
// registry (getSlashCommandsForUI). Closing the card calls onDone().

import type * as React from 'react'
import { getSlashCommandsForUI } from '../commands.js'
import type {
  LocalJSXCommand,
  LocalJSXCommandOnDone,
} from '../types/command.js'

const cardStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 'var(--spacer-24)',
}

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--body-sm-font-size)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--text-default)',
  minWidth: 92,
}

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--body-xs-font-size)',
  color: 'var(--text-tertiary)',
}

const descStyle: React.CSSProperties = {
  fontSize: 'var(--body-sm-font-size)',
  color: 'var(--text-secondary)',
}

function HelpCard({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const commands = getSlashCommandsForUI()
  const close = () => onDone()
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close()
  }
  return (
    <div onClick={handleBackdrop} style={cardStyle}>
      <div className="ds-dialog" role="dialog" aria-label="帮助" style={{ maxWidth: 560 }}>
        <div className="ds-dialog__head">
          <span className="ds-dialog__title">可用命令</span>
          <button className="ds-dialog__close" type="button" onClick={close}>
            <img src="/assets/icons/x.svg" alt="关闭" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div
          className="ds-dialog__body"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-8)' }}
        >
          {commands.map(c => (
            <div
              key={c.name}
              style={{ display: 'flex', gap: 'var(--spacer-12)', alignItems: 'baseline' }}
            >
              <code style={nameStyle}>/{c.name}</code>
              {c.argumentHint ? <code style={hintStyle}>{c.argumentHint}</code> : null}
              <span style={descStyle}>{c.description}</span>
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

export const helpCommand: LocalJSXCommand = {
  type: 'local-jsx',
  name: 'help',
  description: '显示可用命令和用法',
  userFacingName: () => '/help',
  call: (_args, _context, onDone) => <HelpCard onDone={onDone} />,
}
