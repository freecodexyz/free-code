# 真实对话与可配置模型提供商 Spec

## Why

当前 Web UI（`/workspace/web/`）所有数据都是硬编码假数据：`types/index.ts` 写死 6 条 user/assistant/tool-use 假对话，`Sessions.tsx` 写死会话列表，`NewSessionModal.tsx` 写死 3 个模型名，`SettingsContent.tsx` 写死 "Claude 4 Opus"。ChatPanel 的发送按钮无 onClick，textarea 输入不更新 state，不调用任何 API。同时完全无法配置模型提供商（OpenAI / Anthropic / DeepSeek 等第三方 OpenAI 兼容端点）。本变更移除所有硬编码假数据，实现可配置的 Provider 管理与真实的流式对话。

## What Changes

### 移除硬编码假数据
- 删除 `types/index.ts` 中 `getDefaultWorkspaceState().messages` 的 6 条硬编码消息，改为空数组 `[]`
- 删除 `Sessions.tsx` 中 `ACTIVE_SESSIONS` / `HISTORY_SESSIONS` 假数据常量，改为从 SessionsState 读取真实会话
- 删除 `NewSessionModal.tsx` 中 `MODELS` 硬编码常量，改为从当前选中 Provider 的 `models` 读取
- 删除 `SettingsContent.tsx` 中 `SettingSelect value="Claude 4 Opus"` 等硬编码值

### 新增模型提供商（Provider）配置
- 新增 `Provider` 类型：`{ id, name, apiType: 'anthropic'|'openai', baseURL, apiKey, models[] }`
- 新增 `ProvidersState` store（与 WorkspaceState 并列），支持增删改查 Provider
- Provider 配置持久化到 `localStorage`（key: `cc-webui-providers`）
- 预置默认 Provider 模板：Anthropic 官方、OpenAI 官方（用户填 apiKey 启用）
- Settings 新增 "Providers" 配置面板（在 SettingsNav 和 SettingsContent 中新增对应项）

### 真实对话发送
- 新增 `chatClient.ts` 统一 API 调用层，支持两种协议：
  - `apiType: 'anthropic'` → `POST {baseURL}/v1/messages`，header `x-api-key` + `anthropic-version: 2023-06-01` + `anthropic-dangerous-direct-browser-access: true`
  - `apiType: 'openai'` → `POST {baseURL}/chat/completions`，header `Authorization: Bearer {apiKey}`
- SSE 流式响应解析（`text/event-stream`），逐 token 追加到 assistant 消息
- 新增 `SessionsState` store 持久化会话列表到 `localStorage`（key: `cc-webui-sessions`）
- 新增 `useChat` hook：发送消息 → 追加 user 消息 → 调用 API → 流式追加 assistant 消息 → 错误处理
- ChatPanel 改造：textarea 双向绑定、send 按钮 onClick 触发 `useChat.send()`、流式渲染
- composer 底部新增 ModelSelector（当前 Provider 的模型下拉 + Provider 切换）

### 配置项与持久化
- `currentProviderId`、`currentModel` 存入 WorkspaceState 并持久化到 localStorage
- 新建会话时从 `currentProviderId`/`currentModel` 继承
- apiKey 仅存 localStorage，不进 React state 序列化（避免被无关组件订阅到）

## Impact

- Affected specs: 无（首个 web 项目 spec，区别于 `support-windows7-custom-models` CLI spec）
- Affected code:
  - `src/types/index.ts` — 移除硬编码 messages，新增 Provider/ChatSession 类型导出
  - `src/state/WorkspaceState.tsx` — 新增 currentProviderId/currentModel 字段 + localStorage 持久化
  - `src/state/ProvidersState.tsx`（新增）— Provider store + localStorage
  - `src/state/SessionsState.tsx`（新增）— 会话 store + localStorage
  - `src/services/chatClient.ts`（新增）— 统一 API 调用层（anthropic + openai + SSE）
  - `src/hooks/useChat.ts`（新增）— 发送消息 hook
  - `src/components/settings/ProvidersSection.tsx`（新增）— Provider 配置面板
  - `src/components/workbench/ModelSelector.tsx`（新增）— 模型/Provider 选择器
  - `src/components/workbench/ChatPanel.tsx` — 真实发送 + ModelSelector 集成
  - `src/components/settings/SettingsContent.tsx` — 新增 providers 路由 + 移除硬编码值
  - `src/components/settings/SettingsNav.tsx` — 新增 Providers 导航项
  - `src/components/sessions/NewSessionModal.tsx` — MODELS 改为从 Provider 读取
  - `src/pages/Sessions.tsx` — 从 SessionsState 读取真实会话
  - `src/App.tsx` — 包裹 ProvidersStateProvider + SessionsStateProvider

## ADDED Requirements

### Requirement: Provider 配置管理
系统 SHALL 支持用户配置多个模型提供商（Provider），每个 Provider 包含名称、API 类型、baseURL、apiKey 和可用模型列表。

#### Scenario: 添加新 Provider
- **WHEN** 用户在 Settings → Providers 面板点击 "Add Provider"
- **THEN** 弹出表单，用户填写名称、apiType（anthropic/openai）、baseURL、apiKey、模型列表（逗号分隔）
- **AND** 保存后 Provider 出现在列表中，持久化到 localStorage

#### Scenario: 编辑 Provider
- **WHEN** 用户点击已有 Provider 的编辑按钮
- **THEN** 表单预填该 Provider 的所有字段，修改后保存生效

#### Scenario: 删除 Provider
- **WHEN** 用户点击 Provider 的删除按钮并确认
- **THEN** Provider 从列表移除，localStorage 同步更新；若删除的是当前选中 Provider，自动切换到第一个可用 Provider

#### Scenario: 默认预置 Provider
- **WHEN** 用户首次打开应用（localStorage 无数据）
- **THEN** 系统预置两个默认 Provider 模板：
  - Anthropic（apiType: anthropic, baseURL: https://api.anthropic.com, models: ['claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022'], apiKey: 空）
  - OpenAI（apiType: openai, baseURL: https://api.openai.com/v1, models: ['gpt-4o','gpt-4o-mini'], apiKey: 空）

### Requirement: 统一 Chat API 客户端
系统 SHALL 提供统一的 `chatClient` 模块，根据 Provider 的 `apiType` 选择对应的请求格式，并支持 SSE 流式响应。

#### Scenario: 调用 Anthropic 兼容端点
- **WHEN** Provider.apiType === 'anthropic'
- **THEN** 发送 `POST {baseURL}/v1/messages`，请求头包含 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`、`content-type: application/json`
- **AND** 请求体为 `{ model, messages: [{role, content}], max_tokens: 4096, stream: true }`

#### Scenario: 调用 OpenAI 兼容端点
- **WHEN** Provider.apiType === 'openai'
- **THEN** 发送 `POST {baseURL}/chat/completions`，请求头包含 `Authorization: Bearer {apiKey}`、`content-type: application/json`
- **AND** 请求体为 `{ model, messages: [{role, content}], stream: true }`

#### Scenario: 流式响应解析
- **WHEN** API 返回 `text/event-stream` 响应
- **THEN** 系统逐行解析 SSE 事件，提取 token 增量，通过回调实时追加到 assistant 消息内容
- **AND** 遇到 `[DONE]`（OpenAI）或 `message_stop`（Anthropic）事件时结束流

#### Scenario: API 错误处理
- **WHEN** API 返回非 2xx 状态码或网络错误
- **THEN** 在 ChatPanel 显示错误消息（含状态码和错误文本），不崩溃

### Requirement: 真实对话发送
系统 SHALL 在用户点击发送按钮或按 Enter（无 Shift）时，将用户输入作为新消息追加到当前会话，并调用 chatClient 获取流式响应。

#### Scenario: 发送消息
- **WHEN** 用户在 composer 输入文本并点击发送按钮（或按 Enter）
- **THEN** textarea 内容清空，user 消息追加到当前会话 messages
- **AND** 立即追加一条空的 assistant 消息（loading 状态）
- **AND** 调用 chatClient.streamChat()，流式 token 逐个追加到该 assistant 消息

#### Scenario: 发送中禁用
- **WHEN** 上一次请求仍在进行中（isLoading === true）
- **THEN** 发送按钮禁用，textarea 仍可输入但不触发新请求

#### Scenario: 会话持久化
- **WHEN** 会话 messages 发生变化
- **THEN** SessionsState 自动同步到 localStorage（key: `cc-webui-sessions`）

### Requirement: Provider/Model 选择器
系统 SHALL 在 ChatPanel composer 区域显示当前选中的 Provider 和 Model，支持快速切换。

#### Scenario: 切换 Provider
- **WHEN** 用户在 ModelSelector 中选择不同的 Provider
- **THEN** currentProviderId 更新，模型列表切换为新 Provider 的 models，currentModel 重置为新 Provider 的第一个模型

#### Scenario: 切换 Model
- **WHEN** 用户在 ModelSelector 中选择不同的 Model
- **THEN** currentModel 更新，后续请求使用新模型

### Requirement: 真实会话列表
系统 SHALL 从 SessionsState 读取会话列表，替代硬编码假数据。

#### Scenario: 显示会话列表
- **WHEN** 用户进入 /sessions 页面
- **THEN** Active 标签显示 SessionsState 中所有会话，按 updatedAt 降序
- **AND** History 标签显示已完成/错误的会话
- **AND** 无会话时显示空状态提示

#### Scenario: 新建会话
- **WHEN** 用户在 NewSessionModal 填写项目路径、选择 Provider/Model、点击 Create
- **THEN** 新会话追加到 SessionsState，跳转到 Workspace 并加载该会话

## MODIFIED Requirements

### Requirement: WorkspaceState 默认值
`getDefaultWorkspaceState()` SHALL 返回：
- `messages: []`（空数组，不再硬编码假对话）
- `currentProviderId: null`（首次加载时由 ProvidersState 初始化后注入）
- `currentModel: ''`

### Requirement: NewSessionModal 模型来源
`NewSessionModal` 的模型下拉 SHALL 从当前选中 Provider 的 `models` 字段读取，不再使用硬编码 `MODELS` 常量。

### Requirement: Settings ModelSection
`SettingsContent.tsx` 的 ModelSection SHALL 显示当前 Provider 的模型列表，并链接到 Providers 配置面板，不再硬编码 "Claude 4 Opus"。

## REMOVED Requirements

### Requirement: 硬编码假对话
**Reason**: `getDefaultWorkspaceState().messages` 中的 6 条假对话（user/assistant/tool-use）是占位演示数据，无实际功能价值
**Migration**: 改为空数组 `[]`，真实对话由用户发送消息后填充

### Requirement: 硬编码会话列表
**Reason**: `Sessions.tsx` 的 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 是写死的假数据
**Migration**: 改为从 SessionsState 读取，首次使用为空列表

### Requirement: 硬编码模型常量
**Reason**: `NewSessionModal.tsx` 的 `MODELS = ['Claude Sonnet 4', ...]` 无法适配多 Provider 场景
**Migration**: 改为从 Provider.models 动态读取

## 技术约束与说明

- **CORS**: 浏览器直接调用 LLM API 受 CORS 限制。Anthropic 需设置 `anthropic-dangerous-direct-browser-access: true` header；OpenAI 官方 API 默认支持 CORS。第三方 OpenAI 兼容端点需自身支持 CORS，否则会失败（在错误处理中提示用户）。
- **apiKey 存储**: 纯前端 SPA 无安全后端，apiKey 仅存 localStorage（明文）。spec 在 UI 中明确提示风险，用户自行承担。未来如需安全存储可加后端代理。
- **流式实现**: 使用 `fetch` + `ReadableStream` + `TextDecoder` 解析 SSE，不引入 EventSource（不支持 POST）。
- **无后端依赖**: 所有改动在 `/workspace/web/` 内，不新增后端服务。
