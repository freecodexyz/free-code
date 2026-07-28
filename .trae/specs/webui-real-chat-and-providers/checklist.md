# Checklist

## 移除硬编码假数据
- [ ] `src/types/index.ts` 中 `getDefaultWorkspaceState().messages` 为空数组 `[]`，不再包含 6 条假对话
- [ ] `src/pages/Sessions.tsx` 中不再有 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 硬编码常量
- [ ] `src/components/sessions/NewSessionModal.tsx` 中不再有 `MODELS` 硬编码常量
- [ ] `src/components/settings/SettingsContent.tsx` 中不再有 `value="Claude 4 Opus"` 等硬编码模型值
- [ ] 全局搜索 `Claude Sonnet 4` / `Claude Opus 4` / `Claude 3.5 Haiku` 在 src 中无硬编码残留（仅 DEFAULT_PROVIDERS 模板中可保留作为示例模型名）

## Provider 类型与状态
- [ ] `src/types/index.ts` 导出 `ApiType`、`Provider`、`ChatSession` 类型
- [ ] `WorkspaceState` 包含 `currentProviderId: string | null` 和 `currentModel: string` 字段
- [ ] `src/state/ProvidersState.tsx` 存在并导出 `ProvidersStateProvider`、`useProviders`、`useSetProviders`
- [ ] ProvidersState 初始化时从 `localStorage.getItem('cc-webui-providers')` 读取
- [ ] ProvidersState 无 localStorage 数据时使用 `DEFAULT_PROVIDERS`（Anthropic + OpenAI 两个模版）
- [ ] ProvidersState 的 store onChange 写回 localStorage
- [ ] 预置 Provider 模版：Anthropic（apiType: anthropic, baseURL: https://api.anthropic.com）和 OpenAI（apiType: openai, baseURL: https://api.openai.com/v1）

## SessionsState
- [ ] `src/state/SessionsState.tsx` 存在并导出 `SessionsStateProvider`、`useSessions`、`useSetSessions`
- [ ] SessionsState 初始化时从 `localStorage.getItem('cc-webui-sessions')` 读取
- [ ] SessionsState 的 store onChange 写回 localStorage
- [ ] 提供 `createSession`、`appendMessage`、`updateMessage`、`getSession` 操作方法

## chatClient API 调用
- [ ] `src/services/chatClient.ts` 存在并导出 `streamChat` 函数
- [ ] `apiType === 'anthropic'` 时发送 `POST {baseURL}/v1/messages`
- [ ] anthropic 请求头包含 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`
- [ ] `apiType === 'openai'` 时发送 `POST {baseURL}/chat/completions`
- [ ] openai 请求头包含 `Authorization: Bearer {apiKey}`
- [ ] 使用 `fetch` + `response.body.getReader()` + `TextDecoder` 解析 SSE 流
- [ ] 正确解析 anthropic 的 `content_block_delta.delta.text` 和 openai 的 `delta.content` 提取 token
- [ ] 检测 `[DONE]`（openai）或 `message_stop`（anthropic）事件结束流
- [ ] 非 2xx 响应时调用 `onError`，错误信息含状态码
- [ ] 返回 `AbortController` 支持取消请求

## Provider 配置 UI
- [ ] `src/components/settings/ProvidersSection.tsx` 存在
- [ ] ProvidersSection 渲染 Provider 列表，每项显示 name、apiType、baseURL、model 数量
- [ ] "Add Provider" 按钮弹出表单（name、apiType select、baseURL、apiKey、models 逗号分隔）
- [ ] 编辑按钮预填字段，保存调用 updateProvider
- [ ] 删除按钮带 confirm 确认，删除当前选中 Provider 时自动切换 currentProviderId
- [ ] apiKey 输入框使用 `type="password"`
- [ ] 面板顶部显示安全提示："API Key 仅存储在浏览器 localStorage"

## Settings 集成
- [ ] `src/components/settings/SettingsNav.tsx` 包含 `{ key: 'providers', icon: 'plug.svg', label: 'Providers' }` 导航项
- [ ] `src/components/settings/SettingsContent.tsx` 的 `SECTION_MAP` 包含 `providers: ProvidersSection`
- [ ] `ModelSection` 从 ProvidersState 读取当前 Provider 的模型列表，不再硬编码
- [ ] `ModelSection` 显示 "Manage Providers →" 链接跳转到 providers section

## 真实对话发送
- [ ] `src/hooks/useChat.ts` 存在并导出 `useChat` hook，返回 `{ send, isLoading, error, abort }`
- [ ] `send(text)` 追加 user 消息到 SessionsState，然后追加空 assistant 消息（loading）
- [ ] `onToken` 回调增量追加到 assistant 消息 content
- [ ] `onDone` 回调标记 assistant 消息完成，isLoading = false
- [ ] `onError` 回调设置 error，assistant 消息显示错误文本
- [ ] `abort()` 调用 AbortController.abort()

## ChatPanel 改造
- [ ] ChatPanel 引入 `useChat` hook
- [ ] textarea 绑定本地 state（`useState`），不再只是 onChange 处理 slash 命令
- [ ] send 按钮 onClick 调用 `send(text)`，发送后清空 textarea
- [ ] Enter 键发送（Shift+Enter 换行）
- [ ] isLoading 时禁用 send 按钮，显示 spinner
- [ ] error 时在 messages 末尾显示错误提示
- [ ] `src/components/workbench/ModelSelector.tsx` 存在，渲染 Provider + Model 两个下拉
- [ ] ModelSelector 集成到 composer 底部工具栏
- [ ] 切换 Provider 时更新 currentProviderId 并重置 currentModel
- [ ] 切换 Model 时更新 currentModel
- [ ] 当前会话 messages 从 SessionsState 读取（通过 currentSessionId）

## Sessions 页面与 NewSessionModal
- [ ] `Sessions.tsx` 从 `useSessions(s => s.sessions)` 读取会话列表
- [ ] Active 标签按 status 过滤活跃会话，按 updatedAt 降序
- [ ] History 标签显示已完成/错误会话
- [ ] 无会话时显示空状态提示
- [ ] `NewSessionModal.tsx` 的模型下拉从当前 Provider 的 models 读取
- [ ] Create 按钮调用 `createSession()` 生成新会话并跳转到 `/`

## App 集成与持久化
- [ ] `App.tsx` 在 `WorkspaceStateProvider` 内层包裹 `ProvidersStateProvider` 和 `SessionsStateProvider`
- [ ] WorkspaceState 的 currentProviderId/currentModel 持久化到 localStorage（key: `cc-webui-workspace`）
- [ ] 启动时从 localStorage 恢复 currentProviderId/currentModel
- [ ] currentProviderId 指向的 Provider 不存在时，回退到第一个可用 Provider

## 构建验证
- [ ] `cd /workspace/web && bun run build` 通过（tsc --noEmit + vite build 无错误）
- [ ] 构建产物 `dist/` 正常生成
- [ ] 启动 dev server 后无运行时错误
