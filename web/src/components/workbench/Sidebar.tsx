import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'

export function Sidebar() {
  const sidebarOpen = useWorkspaceState(s => s.sidebarOpen)
  const setState = useSetWorkspaceState()

  if (!sidebarOpen) return null

  return (
    <div className="cc-sidebar" style={{ gridColumn: 2, gridRow: 2, display: 'flex', flexDirection: 'column', background: 'var(--bg-base-secondary)', borderRight: '1px solid var(--border-neutral-l1)', overflow: 'hidden' }}>
      <div className="cc-sidebar-section">
        <span>资源管理器</span>
        <button title="折叠侧栏" onClick={() => setState(prev => ({ ...prev, sidebarOpen: false }))}>
          <img src="/assets/icons/arrow-left.svg" width={14} height={14} alt="" />
        </button>
      </div>
      <div className="cc-sidebar-tree">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
          暂无文件
        </div>
      </div>
    </div>
  )
}
