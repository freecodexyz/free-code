export type SessionStatus = 'active' | 'idle' | 'completed' | 'error' | 'archived'

export type SessionCardProps = {
  name: string
  projectPath: string
  model: string
  lastActive: string
  messageCount: number
  status: SessionStatus
  isCurrent?: boolean
  onContinue?: () => void
  onTerminate?: () => void
  onView?: () => void
  onDelete?: () => void
  onRetry?: () => void
}

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'ds-tag--brand' },
  idle: { label: 'Idle', className: 'ds-tag--warning' },
  completed: { label: 'Completed', className: 'ds-tag--success' },
  error: { label: 'Error', className: 'ds-tag--danger' },
  archived: { label: 'Archived', className: 'ds-tag--neutral-strong' },
}

export function SessionCard({
  name,
  projectPath,
  model,
  lastActive,
  messageCount,
  status,
  isCurrent = false,
  onContinue,
  onTerminate,
  onView,
  onDelete,
  onRetry,
}: SessionCardProps) {
  const cfg = statusConfig[status]

  return (
    <article
      className="ds-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isCurrent ? '3px solid var(--bg-brand)' : undefined,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Header row: project + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacer-12)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--body-xs-font-family)',
            fontSize: 'var(--body-xs-font-size)',
            fontWeight: 'var(--font-weight-strong)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          {projectPath}
        </span>
        <span className={`ds-tag ${cfg.className}`}>{cfg.label}</span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'var(--heading-sm-font-family)',
          fontSize: 'var(--heading-sm-font-size)',
          fontWeight: 'var(--heading-sm-font-weight)',
          lineHeight: 'var(--heading-sm-line-height)',
          color: 'var(--text-default)',
          marginBottom: 'var(--spacer-8)',
        }}
      >
        {name}
      </h3>

      {/* Meta: model + last active + message count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacer-12)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--body-sm-font-family)',
          fontSize: 'var(--body-sm-font-size)',
          lineHeight: 'var(--body-sm-line-height)',
          marginBottom: 'var(--spacer-16)',
          flex: 1,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacer-4)' }}>
          <img src="/assets/icons/sparkles.svg" alt="" style={{ width: 12, height: 12 }} />
          {model}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacer-4)' }}>
          <img src="/assets/icons/clock.svg" alt="" style={{ width: 12, height: 12 }} />
          {lastActive}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacer-4)' }}>
          <img src="/assets/icons/message-square.svg" alt="" style={{ width: 12, height: 12 }} />
          {messageCount} messages
        </span>
      </div>

      {/* Footer: actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacer-8)',
          paddingTop: 'var(--spacer-12)',
          borderTop: '1px solid var(--border-neutral-l1)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--body-sm-font-family)',
            fontSize: 'var(--body-sm-font-size)',
            color: 'var(--text-tertiary)',
          }}
        >
          {model} &middot; {lastActive}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacer-6)' }}>
          {status === 'active' || status === 'idle' ? (
            <>
              <button className="ds-btn ds-btn--brand ds-btn--sm" type="button" onClick={onContinue}>
                Continue
              </button>
              <button className="ds-btn ds-btn--ghost ds-btn--sm" type="button" onClick={onTerminate}>
                Terminate
              </button>
            </>
          ) : status === 'completed' ? (
            <>
              <button className="ds-btn ds-btn--secondary ds-btn--sm" type="button" onClick={onView}>
                View
              </button>
              <button className="ds-btn ds-btn--ghost ds-btn--sm" type="button" onClick={onDelete}>
                Delete
              </button>
            </>
          ) : status === 'error' ? (
            <>
              <button className="ds-btn ds-btn--secondary ds-btn--sm" type="button" onClick={onRetry}>
                Retry
              </button>
              <button className="ds-btn ds-btn--ghost ds-btn--sm" type="button" onClick={onDelete}>
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
