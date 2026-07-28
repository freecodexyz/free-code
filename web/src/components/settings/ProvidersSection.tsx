import { useState } from 'react'
import type { ReactNode } from 'react'
import { useProviders, useSetProviders } from '../../state/ProvidersState.js'
import { useWorkspaceState, useSetWorkspaceState } from '../../state/WorkspaceState.js'
import type { ApiType, Provider } from '../../types/index.js'
import { fetchModels } from '../../services/chatClient.js'

// Phase 9 / Task 19 — Providers configuration panel.
//
// Web-specific config UI (no direct cc source to borrow from); follows the
// existing SettingsContent.tsx styling patterns (`ds-settingrow__group`,
// `GroupLabel`, `Panel`). Provider state is read/written via ProvidersState
// (borrowed from cc AppState.tsx), persisted to localStorage by the store.

function emptyProvider(): Omit<Provider, 'id'> {
  return {
    name: '',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    apiKey: '',
    models: [],
  }
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <span className="ds-settingrow__grouplabel">{children}</span>
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="ds-settingrow__panel">{children}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-6)' }}>
      <label
        style={{
          fontFamily: 'var(--body-sm-font-family)',
          fontSize: 'var(--body-sm-font-size)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function ProviderRow({
  provider,
  onEdit,
  onDelete,
}: {
  provider: Provider
  onEdit: () => void
  onDelete: () => void
}) {
  const apiKeyPreview = provider.apiKey
    ? '••••••••' + provider.apiKey.slice(-4)
    : '（未设置）'

  return (
    <div
      className="ds-settingrow"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacer-12)',
        padding: 'var(--spacer-12) var(--spacer-16)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacer-8)' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-default)' }}>{provider.name}</span>
          <span className={`ds-tag ds-tag--brand`}>{provider.apiType}</span>
        </div>
        <div
          style={{
            fontSize: 'var(--body-sm-font-size)',
            color: 'var(--text-secondary)',
            marginTop: 'var(--spacer-2)',
          }}
        >
          {provider.baseURL} · {provider.models.length} 个模型
        </div>
        <div
          style={{
            fontSize: 'var(--body-xs-font-size)',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--spacer-2)',
          }}
        >
          API Key: {apiKeyPreview}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacer-8)', flexShrink: 0 }}>
        <button className="ds-btn ds-btn--secondary ds-btn--sm" type="button" onClick={onEdit}>
          编辑
        </button>
        <button className="ds-btn ds-btn--danger-subtle ds-btn--sm" type="button" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  )
}

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<Provider, 'id'>
  onSave: (data: Omit<Provider, 'id'>) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<Omit<Provider, 'id'>>(initial)
  const [modelsText, setModelsText] = useState(initial.models.join(', '))
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchSuccess, setFetchSuccess] = useState<string | null>(null)

  const save = () => {
    const models = modelsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    onSave({ ...data, models })
  }

  const title = initial.name ? '编辑提供商' : '添加提供商'

  const handleFetchModels = async () => {
    if (!data.apiKey || !data.baseURL) return
    setFetching(true)
    setFetchError(null)
    setFetchSuccess(null)
    try {
      const provider: Provider = {
        id: '',
        name: data.name,
        apiType: data.apiType,
        baseURL: data.baseURL,
        apiKey: data.apiKey,
        models: [],
      }
      const fetched = await fetchModels(provider)
      const existing = modelsText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const merged = Array.from(new Set([...existing, ...fetched]))
      setModelsText(merged.join(', '))
      setFetchSuccess(`已拉取 ${fetched.length} 个模型`)
      setFetchError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFetchError(`拉取失败：${message}`)
      setFetchSuccess(null)
    } finally {
      setFetching(false)
    }
  }

  const canFetch = !!data.apiKey && !!data.baseURL && !fetching

  return (
    <div className="ds-dialog" role="dialog" aria-label={title} style={{ marginTop: 'var(--spacer-16)' }}>
      <div className="ds-dialog__head">
        <span className="ds-dialog__title">{title}</span>
      </div>
      <div
        className="ds-dialog__body"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-12)' }}
      >
        <Field label="名称">
          <div className="ds-input">
            <input
              type="text"
              value={data.name}
              onChange={e => setData({ ...data, name: e.target.value })}
              placeholder="我的 Anthropic"
            />
          </div>
        </Field>
        <Field label="API 类型">
          <select
            className="ds-select"
            value={data.apiType}
            onChange={e => {
              const apiType = e.target.value as ApiType
              const baseURL =
                apiType === 'anthropic'
                  ? 'https://api.anthropic.com'
                  : 'https://api.openai.com/v1'
              setData({ ...data, apiType, baseURL })
            }}
          >
            <option value="anthropic">anthropic</option>
            <option value="openai">openai</option>
          </select>
        </Field>
        <Field label="Base URL">
          <div className="ds-input">
            <input
              type="text"
              value={data.baseURL}
              onChange={e => setData({ ...data, baseURL: e.target.value })}
            />
          </div>
        </Field>
        <Field label="API Key">
          <div className="ds-input">
            <input
              type="password"
              value={data.apiKey}
              onChange={e => setData({ ...data, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
        </Field>
        <Field label="模型（逗号分隔）">
          <div className="ds-input">
            <input
              type="text"
              value={modelsText}
              onChange={e => setModelsText(e.target.value)}
              placeholder="claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022"
            />
          </div>
          <button
            className="ds-btn ds-btn--secondary ds-btn--sm"
            type="button"
            onClick={handleFetchModels}
            disabled={!canFetch}
            title={!data.apiKey || !data.baseURL ? '请先填写 Base URL 和 API Key' : undefined}
            style={{ alignSelf: 'flex-start', marginTop: 'var(--spacer-6)' }}
          >
            {fetching ? '拉取中…' : '获取模型列表'}
          </button>
          {fetchError && (
            <div style={{ color: 'var(--text-danger, #d33)', fontSize: 'var(--body-sm-font-size)' }}>
              {fetchError}
            </div>
          )}
          {fetchSuccess && !fetchError && (
            <div style={{ color: 'var(--text-success, #2c8a3e)', fontSize: 'var(--body-sm-font-size)' }}>
              {fetchSuccess}
            </div>
          )}
        </Field>
      </div>
      <div className="ds-dialog__foot">
        <button className="ds-btn ds-btn--secondary" type="button" onClick={onCancel}>
          取消
        </button>
        <button
          className="ds-btn ds-btn--brand"
          type="button"
          onClick={save}
          disabled={!data.name}
        >
          保存
        </button>
      </div>
    </div>
  )
}

export function ProvidersSection() {
  const providers = useProviders(s => s.providers)
  const { addProvider, updateProvider, removeProvider } = useSetProviders()
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const setWorkspaceState = useSetWorkspaceState()
  const [editing, setEditing] = useState<{ id: string | null; data: Omit<Provider, 'id'> } | null>(
    null,
  )

  const handleDelete = (provider: Provider) => {
    if (!window.confirm(`确定删除提供商 "${provider.name}" ？`)) return
    removeProvider(provider.id)
    // Task 19.4 — if the deleted provider was the currently selected one,
    // auto-switch currentProviderId to the first remaining provider.
    if (currentProviderId === provider.id) {
      const remaining = providers.filter(p => p.id !== provider.id)
      const next = remaining[0]
      setWorkspaceState(prev => ({
        ...prev,
        currentProviderId: next ? next.id : null,
        currentModel: next && next.models[0] ? next.models[0] : prev.currentModel,
      }))
    }
  }

  return (
    <div className="ds-settingrow__group">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <GroupLabel>模型提供商</GroupLabel>
        <button
          className="ds-btn ds-btn--brand ds-btn--sm"
          type="button"
          onClick={() => setEditing({ id: null, data: emptyProvider() })}
        >
          <img src="/assets/icons/plus.svg" alt="" width={14} height={14} style={{ marginRight: 4 }} />
          添加提供商
        </button>
      </div>

      {/* Security notice (Task 19.5) */}
      <div className="ds-alert ds-alert--warning">
        <span className="ds-alert__icon">⚠️</span>
        <div>
          <div className="ds-alert__title">安全提示</div>
          <div className="ds-alert__desc">
            API Key 以明文存储在浏览器 localStorage 中，请勿在公共/共享设备上使用。
          </div>
        </div>
      </div>

      {/* Provider list */}
      <Panel>
        {providers.map(p => (
          <ProviderRow
            key={p.id}
            provider={p}
            onEdit={() => setEditing({ id: p.id, data: { ...p } })}
            onDelete={() => handleDelete(p)}
          />
        ))}
        {providers.length === 0 && (
          <div
            style={{
              padding: 'var(--spacer-12) var(--spacer-16)',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--body-sm-font-size)',
            }}
          >
            暂无已配置的提供商。
          </div>
        )}
      </Panel>

      {/* Edit / Add form */}
      {editing && (
        <ProviderForm
          initial={editing.data}
          onSave={data => {
            if (editing.id) updateProvider(editing.id, data)
            else addProvider(data)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
