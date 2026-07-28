import { Link } from 'react-router-dom'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'
import type { RailItem } from '../../types/index.js'

const RAIL_ITEMS: { key: RailItem; icon: string; label: string }[] = [
  { key: 'files', icon: 'files.svg', label: '文件' },
  { key: 'search', icon: 'search.svg', label: '搜索' },
  { key: 'git', icon: 'git.svg', label: 'Git' },
  { key: 'terminal', icon: 'terminal.svg', label: '终端' },
]

export function ActivityRail() {
  const activeRailItem = useWorkspaceState(s => s.activeRailItem)
  const setState = useSetWorkspaceState()

  return (
    <div className="cc-activity-rail ds-activityrail" style={{ gridColumn: 1, gridRow: 2 }}>
      {RAIL_ITEMS.map(item => (
        <button
          key={item.key}
          className={`ds-activityrail__btn${activeRailItem === item.key ? ' is-active' : ''}`}
          title={item.label}
          onClick={() => setState(prev => ({ ...prev, activeRailItem: item.key }))}
        >
          <img
            src={`/assets/icons/${item.icon}`}
            width={18}
            height={18}
            alt=""
            style={{ color: activeRailItem === item.key ? 'var(--icon-default)' : 'var(--icon-secondary)' }}
          />
        </button>
      ))}
      <div className="ds-activityrail__spacer" />
      <div className="ds-activityrail__divider" />
      <Link to="/sessions" className="ds-activityrail__btn" title="会话" style={{ textDecoration: 'none' }}>
        <img src="/assets/icons/message-circle.svg" width={18} height={18} alt="" style={{ color: 'var(--icon-secondary)' }} />
      </Link>
      <Link to="/settings" className="ds-activityrail__btn" title="设置" style={{ textDecoration: 'none' }}>
        <img src="/assets/icons/gear.svg" width={18} height={18} alt="" style={{ color: 'var(--icon-secondary)' }} />
      </Link>
    </div>
  )
}
