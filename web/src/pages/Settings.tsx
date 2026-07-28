import { Link } from 'react-router-dom'
import { SettingsNav } from '../components/settings/SettingsNav.js'
import { SettingsContent } from '../components/settings/SettingsContent.js'

export function Settings() {
  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="ds-pagehead">
        <div className="ds-pagehead__main">
          <span className="ds-pagehead__title">设置</span>
          <span className="ds-pagehead__subtitle">配置 Claude Code 的行为和偏好设置</span>
        </div>
        <div className="ds-pagehead__actions">
          <Link to="/" className="ds-pagehead__btn" style={{ textDecoration: 'none' }}>
            <img src="/assets/icons/arrow-left.svg" width={16} height={16} alt="" className="icon" />
            返回工作区
          </Link>
          <Link to="/sessions" className="ds-pagehead__btn" style={{ textDecoration: 'none' }}>
            <img src="/assets/icons/message-circle.svg" width={16} height={16} alt="" className="icon" />
            会话
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="settings-layout">
        <SettingsNav />
        <SettingsContent />
      </div>
    </div>
  )
}
