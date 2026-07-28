import { Link } from 'react-router-dom'
import { useWorkspaceState, useSetWorkspaceState } from '../state/WorkspaceState.js'
import { useSessions } from '../state/SessionsState.js'
import { SessionCard, type SessionStatus } from '../components/sessions/SessionCard.js'
import { NewSessionModal } from '../components/sessions/NewSessionModal.js'
import type { ChatSession } from '../types/index.js'

type TabKey = 'active' | 'history' | 'archived'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: '活跃' },
  { key: 'history', label: '历史' },
  { key: 'archived', label: '已归档' },
]

/* ── Helpers ─────────────────────────────────────────────────── */

// Borrowed from src/utils/formatRelativeTime.ts (simplified for Web).
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = Math.max(0, now - timestamp)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return new Date(timestamp).toLocaleDateString()
}

// Task 21.1 — filter real sessions by tab. `active` = anything not archived,
// `history` = completed or errored, `archived` = archived.
function filterByTab(sessions: ChatSession[], tab: TabKey): ChatSession[] {
  switch (tab) {
    case 'active':
      return sessions.filter(s => s.status !== 'archived')
    case 'history':
      return sessions.filter(s => s.status === 'completed' || s.status === 'error')
    case 'archived':
      return sessions.filter(s => s.status === 'archived')
  }
}

/* ── Page Component ───────────────────────────────────────────── */

export function Sessions() {
  const activeTab = useWorkspaceState(s => s.sessionsActiveTab)
  const currentSessionId = useWorkspaceState(s => s.currentSessionId)
  const setState = useSetWorkspaceState()
  const allSessions = useSessions(s => s.sessions)

  const setTab = (key: TabKey) => {
    setState(prev => ({ ...prev, sessionsActiveTab: key }))
  }

  const openNewSessionModal = () => {
    setState(prev => ({ ...prev, newSessionModalOpen: true }))
  }

  const sessions = filterByTab(allSessions, activeTab)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base-default)',
        color: 'var(--text-default)',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: 'var(--spacer-40) var(--spacer-24)',
        }}
      >
        {/* ── Page Header ──────────────────────────────────────── */}
        <header className="ds-pagehead">
          <div className="ds-pagehead__main">
            <h1 className="ds-pagehead__title">会话</h1>
            <p className="ds-pagehead__subtitle">
              管理您的 Claude Code 并发会话
            </p>
          </div>
          <div className="ds-pagehead__actions">
            <Link
              to="/"
              className="ds-btn ds-btn--ghost"
              style={{ textDecoration: 'none' }}
            >
              <img src="/assets/icons/arrow-left.svg" alt="" style={{ width: 14, height: 14 }} />
              工作区
            </Link>
            <button className="ds-btn ds-btn--brand" type="button" onClick={openNewSessionModal}>
              <img src="/assets/icons/plus.svg" alt="" style={{ width: 14, height: 14 }} />
              新建会话
            </button>
          </div>
        </header>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <nav className="ds-tabs" aria-label="Session tabs" style={{ marginTop: 'var(--spacer-24)' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`ds-tab${activeTab === tab.key ? ' is-active' : ''}`}
              type="button"
              onClick={() => setTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Session Cards Grid ───────────────────────────────── */}
        <section
          aria-label={`${activeTab} sessions`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--spacer-16)',
            marginTop: 'var(--spacer-24)',
          }}
        >
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              name={session.title}
              projectPath={session.projectPath}
              model={session.model}
              lastActive={formatRelativeTime(session.updatedAt)}
              messageCount={session.messageCount}
              status={session.status as SessionStatus}
              isCurrent={session.id === currentSessionId}
            />
          ))}
        </section>

        {sessions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacer-40) 0',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--body-base-font-family)',
              fontSize: 'var(--body-base-font-size)',
            }}
          >
            未找到{TABS.find(t => t.key === activeTab)?.label}会话。
          </div>
        )}
      </div>

      {/* ── New Session Modal ──────────────────────────────────── */}
      <NewSessionModal />
    </div>
  )
}
