import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'
import { usePanelToggle } from '../../hooks/usePanelToggle.js'
import type { ViewMode } from '../../types/index.js'

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'verbose', label: '详细' },
  { key: 'normal', label: '普通' },
  { key: 'summary', label: '摘要' },
]

export function Titlebar() {
  const activeViewMode = useWorkspaceState(s => s.activeViewMode)
  const setState = useSetWorkspaceState()
  const { toggleSidebar, toggleChatPanel } = usePanelToggle()

  return (
    <div className="cc-titlebar ds-wbtitlebar" style={{ gridColumn: '1 / -1', gridRow: 1 }}>
      <div className="ds-wbtitlebar__left">
        <div className="ds-wbtitlebar__lights">
          <span className="ds-wbtitlebar__light ds-wbtitlebar__light--close" />
          <span className="ds-wbtitlebar__light ds-wbtitlebar__light--min" />
          <span className="ds-wbtitlebar__light ds-wbtitlebar__light--max" />
        </div>
        <img src="/assets/icons/sparkles.svg" width={16} height={16} alt="" style={{ color: 'var(--text-brand)' }} />
        <span style={{ fontSize: 'var(--body-sm-strong-font-size)', fontWeight: 'var(--body-sm-strong-font-weight)', color: 'var(--text-default)' }}>
          Claude Code
        </span>
      </div>

      <div className="ds-wbtitlebar__project-selector">
        <img src="/assets/icons/folder.svg" width={14} height={14} alt="" style={{ color: 'var(--icon-secondary)' }} />
        <span style={{ color: 'var(--text-tertiary)' }}>未选择项目</span>
        <img src="/assets/icons/chevron-down.svg" width={12} height={12} alt="" style={{ color: 'var(--icon-tertiary)' }} />
      </div>

      <div className="ds-wbtitlebar__right">
        <div className="ds-tabs--filled" style={{ display: 'inline-flex', gap: 'var(--spacer-2)' }}>
          {VIEW_MODES.map(mode => (
            <button
              key={mode.key}
              className={`ds-tab${activeViewMode === mode.key ? ' is-active' : ''}`}
              style={{
                padding: 'var(--spacer-4) var(--spacer-8)',
                fontSize: 'var(--body-xs-font-size)',
                borderRadius: 'var(--radius-4)',
                background: activeViewMode === mode.key ? 'var(--bg-overlay-l3)' : 'transparent',
                border: 'none',
                color: activeViewMode === mode.key ? 'var(--text-default)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
              onClick={() => setState(prev => ({ ...prev, activeViewMode: mode.key }))}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button className="ds-wbtitlebar__iconbtn" title="切换侧栏" onClick={toggleSidebar}>
          <img src="/assets/icons/sidebar-left.svg" width={16} height={16} alt="" style={{ color: 'var(--icon-secondary)' }} />
        </button>
        <button className="ds-wbtitlebar__iconbtn" title="切换面板" onClick={toggleChatPanel}>
          <img src="/assets/icons/sidebar-right.svg" width={16} height={16} alt="" style={{ color: 'var(--icon-secondary)' }} />
        </button>
        <div
          className="ds-avatar ds-avatar--sm"
          style={{ background: 'var(--bg-brand)', color: 'var(--text-onbrand)', fontSize: 'var(--body-xs-font-size)', fontWeight: 'var(--font-weight-strong)' }}
        >
          U
        </div>
      </div>
    </div>
  )
}
