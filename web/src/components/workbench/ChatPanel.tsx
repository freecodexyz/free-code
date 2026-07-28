// Borrowed from src/components/ChatPanel.tsx — Web port of cc's chat composer.
//
// cc's ChatPanel (Ink) reads keypresses, calls the SDK directly, and renders
// messages via <Transcript>. The Web port mirrors the composer behavior:
// textarea bound to local state, Enter to send (Shift+Enter for newline),
// isLoading disables send + shows spinner, error renders a dismissable
// banner, and messages are rendered by the new <Message> dispatch component
// (Phase 5). The actual streaming + tool execution lives in useChat (Task 15)
// so this component stays a thin view layer.
//
// Slash command UX (open on "/", navigate with arrows, Enter to insert) is
// preserved from the original stub; the only change is that the textarea is
// now controlled (`value={inputText}`) so command insertion writes into the
// same React state as user typing.

import React, { useCallback, useRef, useState } from 'react'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'
import { usePanelToggle } from '../../hooks/usePanelToggle.js'
import { useSlashCommand } from '../../hooks/useSlashCommand.js'
import { useChat } from '../../hooks/useChat.js'
import { useCanUseTool } from '../../hooks/useCanUseTool.jsx'
import { SlashCommandPanel } from './SlashCommandPanel.js'
import { ModelSelector } from './ModelSelector.js'
import { Spinner } from '../Spinner.js'
import { Message as MessageItem } from '../Message.js'
import type { Message } from '../../types/index.js'
import type { ChatTab } from '../../types/index.js'

const CHAT_TABS: { key: ChatTab; label: string }[] = [
  { key: 'chat', label: '对话' },
  { key: 'plan', label: '计划' },
]

export function ChatPanel() {
  const legacyMessages = useWorkspaceState(s => s.messages)
  const inProgressToolUseIDs = useWorkspaceState(s => s.inProgressToolUseIDs)
  const activeChatTab = useWorkspaceState(s => s.activeChatTab)
  const setState = useSetWorkspaceState()
  const { toggleChatPanel } = usePanelToggle()
  const { send, isLoading, error } = useChat()
  const { ElicitationCard } = useCanUseTool()
  const {
    slashCommandOpen,
    filteredCommands,
    openSlashPanel,
    closeSlashPanel,
    updateFilter,
    navigateUp,
    navigateDown,
    slashCommandIndex,
  } = useSlashCommand()

  const [inputText, setInputText] = useState('')
  // useChat owns `error`; we can't call its setError here. Track a dismissed
  // reference locally so the user can clear the banner without waiting for the
  // next send (which resets error to null inside useChat). When a NEW error
  // instance arrives, error !== dismissedError → banner reappears.
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // WorkspaceState.messages is typed ChatMessage[] (legacy, Phase 1); useChat
  // (Task 15) writes Message-shaped objects into the same field. Cast through
  // `unknown` so the new <Message> dispatch component (Phase 5) can render
  // them. Full migration of the field type is Phase 5+8 work — intentionally
  // not changed here.
  const messages = legacyMessages as unknown as Message[]

  const showError = error !== null && error !== dismissedError

  const sendMessage = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed || isLoading) return
    void send(trimmed)
    setInputText('')
  }, [inputText, isLoading, send])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)
    if (value === '/') {
      openSlashPanel()
    } else if (!value.startsWith('/')) {
      closeSlashPanel()
    } else {
      updateFilter(value.slice(1))
    }
  }, [openSlashPanel, closeSlashPanel, updateFilter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash command navigation takes precedence while the panel is open.
    if (slashCommandOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        navigateDown()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        navigateUp()
        return
      }
      if (e.key === 'Enter' && slashCommandIndex >= 0) {
        const cmd = filteredCommands[slashCommandIndex]
        if (cmd) {
          e.preventDefault()
          setInputText(cmd.name + ' ')
          closeSlashPanel()
          // Re-focus after the controlled value update flushes to the DOM.
          requestAnimationFrame(() => textareaRef.current?.focus())
          return
        }
      }
      if (e.key === 'Escape') {
        closeSlashPanel()
        return
      }
    }

    // Enter sends, Shift+Enter inserts a newline (mirrors cc + most chat UXs).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [
    slashCommandOpen,
    slashCommandIndex,
    filteredCommands,
    navigateUp,
    navigateDown,
    closeSlashPanel,
    sendMessage,
  ])

  const sendDisabled = isLoading || !inputText.trim()

  return (
    <div className="cc-chat-panel" style={{ gridColumn: 4, gridRow: 2, display: 'flex', flexDirection: 'column', background: 'var(--bg-base-secondary)', borderLeft: '1px solid var(--border-neutral-l1)', overflow: 'hidden' }}>
      <div className="cc-chat-header">
        <div className="cc-chat-header-left">
          <img src="/assets/icons/sparkles.32f08c.svg" width={16} height={16} alt="" />
          <span className="cc-chat-header-title">Claude</span>
        </div>
        <div className="cc-chat-header-right">
          <div className="ds-tabs--filled" style={{ display: 'inline-flex', gap: 'var(--spacer-2)' }}>
            {CHAT_TABS.map(tab => (
              <button
                key={tab.key}
                className={`ds-tab${activeChatTab === tab.key ? ' is-active' : ''}`}
                style={{
                  padding: 'var(--spacer-2) var(--spacer-8)',
                  fontSize: 'var(--body-xs-font-size)',
                  borderRadius: 'var(--radius-4)',
                  background: activeChatTab === tab.key ? 'var(--bg-overlay-l3)' : 'transparent',
                  border: 'none',
                  color: activeChatTab === tab.key ? 'var(--text-default)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
                onClick={() => setState(prev => ({ ...prev, activeChatTab: tab.key }))}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="ds-wbtitlebar__iconbtn" title="折叠面板" style={{ width: 24, height: 24 }} onClick={toggleChatPanel}>
            <img src="/assets/icons/chevron-right.svg" width={14} height={14} alt="" style={{ color: 'var(--icon-tertiary)' }} />
          </button>
        </div>
      </div>

      <div className="cc-chat-messages">
        {messages.map(msg => (
          <MessageItem key={msg.id} message={msg} inProgressToolUseIDs={inProgressToolUseIDs} />
        ))}
      </div>

      <div className="cc-chat-composer">
        {showError && error && (
          <div
            onClick={() => setDismissedError(error)}
            title="点击关闭"
            style={{
              background: 'var(--status-error-surface-l1, #fde8e8)',
              border: '1px solid var(--status-error-default, #e5484d)',
              color: 'var(--status-error-default, #e5484d)',
              borderRadius: 'var(--radius-4)',
              padding: 'var(--spacer-8) var(--spacer-12)',
              marginBottom: 'var(--spacer-8)',
              fontSize: 'var(--body-xs-font-size)',
              cursor: 'pointer',
            }}
          >
            {error.message}
          </div>
        )}
        <ElicitationCard />
        <div className="ds-composer" style={{ maxWidth: '100%', borderRadius: 'var(--radius-8)' }}>
          <textarea
            ref={textareaRef}
            className="ds-composer__input"
            rows={2}
            placeholder="输入消息，输入 / 查看可用命令..."
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          {slashCommandOpen && (
            <SlashCommandPanel
              filteredCommands={filteredCommands}
              highlightedIndex={slashCommandIndex}
              onSelect={(cmd) => {
                setInputText(cmd.name + ' ')
                closeSlashPanel()
                requestAnimationFrame(() => textareaRef.current?.focus())
              }}
            />
          )}
          <div className="ds-composer__toolbar">
            <div className="ds-composer__tools">
              <ModelSelector />
            </div>
            <div className="ds-composer__actions">
              <button
                className="ds-composer__send"
                title={isLoading ? '发送中…' : '发送消息'}
                disabled={sendDisabled}
                onClick={sendMessage}
                style={{
                  opacity: sendDisabled ? 0.5 : 1,
                  cursor: sendDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading
                  ? <Spinner />
                  : <img src="/assets/icons/send.0c0c0d.svg" width={16} height={16} alt="" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
