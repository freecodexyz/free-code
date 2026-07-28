import { Fragment } from 'react'
import type { ReactNode, FC } from 'react'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'
import { useProviders } from '../../state/ProvidersState.js'
import { ProvidersSection } from './ProvidersSection.js'

/* ── Shared sub-components ─────────────────────────────────── */

function SettingRow({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: ReactNode
}) {
  return (
    <div className="ds-settingrow">
      <div className="ds-settingrow__main">
        <span className="ds-settingrow__title">{title}</span>
        <span className="ds-settingrow__desc">{desc}</span>
      </div>
      <div className="ds-settingrow__control">{children}</div>
    </div>
  )
}

function SettingSelect({
  value,
  options: _options,
}: {
  value: string
  options: string[]
}) {
  return (
    <button className="ds-settingrow__select">
      {value}
      <img src="/assets/icons/chevron-down.svg" width={16} height={16} alt="" className="icon" />
    </button>
  )
}

function SettingSwitch({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="ds-switch">
      <input type="checkbox" defaultChecked={defaultChecked} />
      <span className="ds-switch__thumb" />
    </label>
  )
}

function SettingButton({
  children,
  variant,
}: {
  children: ReactNode
  variant?: 'default' | 'danger'
}) {
  const cls = variant === 'danger' ? 'ds-settingrow__btn ds-settingrow__btn--danger' : 'ds-settingrow__btn'
  return <button className={cls}>{children}</button>
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <span className="ds-settingrow__grouplabel">{children}</span>
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="ds-settingrow__panel">{children}</div>
}

function KbdCombo({ keys }: { keys: string[] }) {
  return (
    <span className="ds-kbd__combo">
      {keys.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="ds-kbd__plus">+</span>}
          <span className="ds-kbd">{k}</span>
        </Fragment>
      ))}
    </span>
  )
}

/* ── Section panels ────────────────────────────────────────── */

function GeneralSection() {
  // Task 21.4 — read default model dynamically from ProvidersState instead
  // of the removed hardcoded "Claude 4 Opus".
  const providers = useProviders(s => s.providers)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const provider = providers.find(p => p.id === currentProviderId) ?? providers[0]
  const defaultModel = currentModel || provider?.models[0] || '(无模型)'

  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>基础设置</GroupLabel>
        <Panel>
          <SettingRow title="默认模型" desc="选择 Claude Code 的默认模型">
            <SettingSelect value={defaultModel} options={provider?.models ?? []} />
          </SettingRow>
          {/* Static label — not wired to a runtime value yet. */}
          <SettingRow title="上下文窗口" desc="设置上下文窗口大小">
            <SettingSelect value="200K tokens" options={['200K tokens', '128K tokens', '100K tokens']} />
          </SettingRow>
          <SettingRow title="自动保存" desc="自动保存会话进度">
            <SettingSwitch defaultChecked />
          </SettingRow>
          <SettingRow title="通知" desc="任务完成时发送通知">
            <SettingSwitch />
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

function ModelSection() {
  // Task 20.3 — read current provider's models dynamically from ProvidersState
  // and provide a "Manage Providers →" link to the providers settings tab.
  const providers = useProviders(s => s.providers)
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const setWorkspaceState = useSetWorkspaceState()
  const provider = providers.find(p => p.id === currentProviderId) ?? providers[0]
  const models = provider?.models ?? []
  const selectedModel = currentModel && models.includes(currentModel)
    ? currentModel
    : models[0] ?? '(无模型)'

  const goToProviders = () => {
    setWorkspaceState(prev => ({ ...prev, settingsActiveNav: 'providers' }))
  }

  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>模型选择</GroupLabel>
        <Panel>
          <SettingRow title="默认模型" desc="选择 Claude Code 的默认模型">
            <SettingSelect value={selectedModel} options={models} />
          </SettingRow>
          <SettingRow
            title="管理提供商"
            desc="添加、编辑或删除模型提供商及其 API Key"
          >
            <button
              type="button"
              className="ds-settingrow__btn"
              onClick={goToProviders}
            >
              管理提供商 →
            </button>
          </SettingRow>
          {/* Static label — not wired to a runtime value yet. */}
          <SettingRow title="上下文窗口" desc="设置上下文窗口大小">
            <SettingSelect value="200K tokens" options={['200K tokens', '128K tokens', '100K tokens']} />
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

function PermissionsSection() {
  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>权限管理</GroupLabel>
        <Panel>
          <SettingRow title="文件读写" desc="允许 Claude Code 读写文件">
            <SettingSelect value="执行前询问" options={['执行前询问', '始终允许', '从不允许']} />
          </SettingRow>
          <SettingRow title="命令执行" desc="允许执行终端命令">
            <SettingSelect value="执行前询问" options={['执行前询问', '始终允许', '从不允许']} />
          </SettingRow>
          <SettingRow title="MCP 工具" desc="允许使用外部 MCP 工具">
            <SettingSelect value="始终允许" options={['始终允许', '执行前询问', '从不允许']} />
          </SettingRow>
          <SettingRow title="网络访问" desc="允许 Claude Code 访问网络">
            <SettingSwitch />
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

function AppearanceSection() {
  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>外观设置</GroupLabel>
        <Panel>
          <SettingRow title="主题" desc="选择界面主题">
            <SettingSelect value="深色" options={['深色', '浅色']} />
          </SettingRow>
          <SettingRow title="字体大小" desc="编辑器字体大小">
            <SettingButton>14px</SettingButton>
          </SettingRow>
          <SettingRow title="终端字体大小" desc="终端输出字体大小">
            <SettingButton>12px</SettingButton>
          </SettingRow>
          <SettingRow title="行号" desc="在编辑器中显示行号">
            <SettingSwitch defaultChecked />
          </SettingRow>
          <SettingRow title="缩略图" desc="显示代码缩略图">
            <SettingSwitch />
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

function ShortcutsSection() {
  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>键盘快捷键</GroupLabel>
        <Panel>
          <SettingRow title="新建会话" desc="开始新的聊天会话">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', 'N']} />
            </div>
          </SettingRow>
          <SettingRow title="切换侧栏" desc="显示或隐藏文件侧栏">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', 'B']} />
            </div>
          </SettingRow>
          <SettingRow title="切换对话" desc="显示或隐藏对话面板">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', 'J']} />
            </div>
          </SettingRow>
          <SettingRow title="命令面板" desc="打开命令面板">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', 'Shift', 'P']} />
            </div>
          </SettingRow>
          <SettingRow title="搜索文件" desc="跨项目文件搜索">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', 'P']} />
            </div>
          </SettingRow>
          <SettingRow title="设置" desc="打开设置页面">
            <div className="ds-kbd__row">
              <KbdCombo keys={['Ctrl', ',']} />
            </div>
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

function DataSection() {
  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>数据管理</GroupLabel>
        <Panel>
          <SettingRow title="会话历史" desc="保留最近的会话记录">
            <SettingSelect value="30 天" options={['7 天', '14 天', '30 天', '90 天', '永久']} />
          </SettingRow>
          <SettingRow title="导出配置" desc="将当前配置导出为 JSON">
            <SettingButton>
              <img src="/assets/icons/download.svg" width={16} height={16} alt="" className="icon" />
              导出
            </SettingButton>
          </SettingRow>
          <SettingRow title="清除历史" desc="清除所有会话历史记录">
            <SettingButton variant="danger">
              <img src="/assets/icons/trash.svg" width={16} height={16} alt="" className="icon" />
              清除历史
            </SettingButton>
          </SettingRow>
        </Panel>
      </div>

      <div className="danger-zone">
        <div className="ds-alert ds-alert--danger">
          <span className="ds-alert__icon">
            <img src="/assets/icons/alert-circle.svg" width={16} height={16} alt="" className="icon" />
          </span>
          <div>
            <div className="ds-alert__title">危险区域</div>
            <div className="ds-alert__desc">以下操作不可逆，请谨慎操作。</div>
            <div className="ds-alert__actions">
              <button className="ds-btn ds-btn--danger">重置所有设置</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function AboutSection() {
  return (
    <>
      <div className="ds-settingrow__group">
        <GroupLabel>关于</GroupLabel>
        <Panel>
          <SettingRow title="版本" desc="Claude Code Web UI 版本">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--body-sm-font-size)' }}>0.1.0</span>
          </SettingRow>
          <SettingRow title="API 版本" desc="Claude API 版本">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--body-sm-font-size)' }}>2024-01-01</span>
          </SettingRow>
          <SettingRow title="发布渠道" desc="当前更新渠道">
            <SettingSelect value="稳定版" options={['稳定版', '测试版', '金丝雀版']} />
          </SettingRow>
          <SettingRow title="检查更新" desc="检查是否有新版本可用">
            <SettingButton>
              <img src="/assets/icons/refresh.svg" width={16} height={16} alt="" className="icon" />
              立即检查
            </SettingButton>
          </SettingRow>
        </Panel>
      </div>

      <div className="ds-settingrow__group">
        <GroupLabel>链接</GroupLabel>
        <Panel>
          <SettingRow title="文档" desc="阅读官方文档">
            <a
              href="https://docs.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ds-settingrow__btn"
              style={{ textDecoration: 'none' }}
            >
              <img src="/assets/icons/external.svg" width={16} height={16} alt="" className="icon" />
              打开
            </a>
          </SettingRow>
          <SettingRow title="报告问题" desc="提交 bug 报告或功能请求">
            <a
              href="https://github.com/anthropics/claude-code/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="ds-settingrow__btn"
              style={{ textDecoration: 'none' }}
            >
              <img src="/assets/icons/bug.svg" width={16} height={16} alt="" className="icon" />
              打开
            </a>
          </SettingRow>
        </Panel>
      </div>
    </>
  )
}

/* ── Main content router ───────────────────────────────────── */

const SECTION_MAP: Record<string, FC> = {
  general: GeneralSection,
  providers: ProvidersSection,
  model: ModelSection,
  context: ModelSection,
  permissions: PermissionsSection,
  tools: PermissionsSection,
  'auto-approve': PermissionsSection,
  theme: AppearanceSection,
  'font-size': AppearanceSection,
  highlight: AppearanceSection,
  keybindings: ShortcutsSection,
  'custom-shortcuts': ShortcutsSection,
  history: DataSection,
  export: DataSection,
  about: AboutSection,
}

export function SettingsContent() {
  const activeNav = useWorkspaceState(s => s.settingsActiveNav)
  const Section = SECTION_MAP[activeNav] ?? GeneralSection

  return (
    <main className="settings-content">
      <Section />
    </main>
  )
}
