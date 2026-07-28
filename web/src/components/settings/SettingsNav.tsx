import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'

type NavGroup = {
  title: string
  items: { key: string; icon: string; label: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '通用',
    items: [
      { key: 'general', icon: 'layout.svg', label: '概览' },
    ],
  },
  {
    title: '提供商',
    items: [
      { key: 'providers', icon: 'plug.svg', label: '提供商' },
    ],
  },
  {
    title: '模型',
    items: [
      { key: 'model', icon: 'sparkles.svg', label: '模型选择' },
      { key: 'context', icon: 'arrow-expand.svg', label: '上下文窗口' },
    ],
  },
  {
    title: '权限',
    items: [
      { key: 'permissions', icon: 'shield.svg', label: '默认权限' },
      { key: 'tools', icon: 'wrench.svg', label: '工具权限' },
      { key: 'auto-approve', icon: 'check.svg', label: '自动批准' },
    ],
  },
  {
    title: '外观',
    items: [
      { key: 'theme', icon: 'eye.svg', label: '主题' },
      { key: 'font-size', icon: 'type.svg', label: '字体大小' },
      { key: 'highlight', icon: 'code.svg', label: '代码高亮' },
    ],
  },
  {
    title: '快捷键',
    items: [
      { key: 'keybindings', icon: 'cmd.svg', label: '键盘映射' },
      { key: 'custom-shortcuts', icon: 'key.svg', label: '自定义快捷键' },
    ],
  },
  {
    title: '数据',
    items: [
      { key: 'history', icon: 'clock.svg', label: '会话历史' },
      { key: 'export', icon: 'download.svg', label: '导出配置' },
    ],
  },
]

export function SettingsNav() {
  const activeNav = useWorkspaceState(s => s.settingsActiveNav)
  const setState = useSetWorkspaceState()

  return (
    <aside className="settings-nav">
      <nav className="ds-navlist">
        {NAV_GROUPS.map(group => (
          <div key={group.title} className="ds-navlist__group">
            <div className="ds-navlist__group-title">{group.title}</div>
            {group.items.map(item => (
              <a
                key={item.key}
                className={`ds-navlist__item${activeNav === item.key ? ' is-active' : ''}`}
                onClick={() => setState(prev => ({ ...prev, settingsActiveNav: item.key }))}
              >
                <img src={`/assets/icons/${item.icon}`} width={18} height={18} alt="" className="icon" />
                <span className="ds-navlist__label">{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
