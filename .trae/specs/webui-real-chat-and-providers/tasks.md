# Tasks

## 阶段一：类型与状态层

- [ ] Task 1: 定义 Provider 与 ChatSession 类型，扩展 WorkspaceState
  - [ ] SubTask 1.1: 在 `src/types/index.ts` 新增 `ApiType = 'anthropic' | 'openai'`、`Provider`、`ChatSession` 类型
  - [ ] SubTask 1.2: 在 `WorkspaceState` 中新增 `currentProviderId: string | null` 和 `currentModel: string` 字段
  - [ ] SubTask 1.3: 修改 `getDefaultWorkspaceState()` 的 `messages` 为空数组 `[]`，移除 6 条硬编码假对话
  - [ ] SubTask 1.4: 新增 `DEFAULT_PROVIDERS` 常量（Anthropic + OpenAI 两个模版，apiKey 为空）

- [ ] Task 2: 创建 ProvidersState store（带 localStorage 持久化）
  - [ ] SubTask 2.1: 创建 `src/state/ProvidersState.tsx`，导出 `ProvidersStateProvider`、`useProviders(selector)`、`useSetProviders`
  - [ ] SubTask 2.2: 初始化时从 `localStorage.getItem('cc-webui-providers')` 读取，无数据时使用 `DEFAULT_PROVIDERS`
  - [ ] SubTask 2.3: 在 store 的 `onChange` 回调中写回 localStorage（JSON.stringify）
  - [ ] SubTask 2.4: 提供 `addProvider`、`updateProvider`、`removeProvider` 操作方法（在 store 上挂载或 hook 内实现）

- [ ] Task 3: 创建 SessionsState store（带 localStorage 持久化）
  - [ ] SubTask 3.1: 创建 `src/state/SessionsState.tsx`，导出 `SessionsStateProvider`、`useSessions(selector)`、`useSetSessions`
  - [ ] SubTask 3.2: 初始化时从 `localStorage.getItem('cc-webui-sessions')` 读取，无数据时为空数组
  - [ ] SubTask 3.3: 在 store 的 `onChange` 回调中写回 localStorage
  - [ ] SubTask 3.4: 提供 `createSession`、`appendMessage`、`updateMessage`、`getSession` 操作方法
  - [ ] SubTask 3.5: 新增 `currentSessionId` 字段到 WorkspaceState，用于追踪当前活跃会话

## 阶段二：API 客户端

- [ ] Task 4: 实现统一 chatClient（支持 anthropic + openai + SSE 流式）
  - [ ] SubTask 4.1: 创建 `src/services/chatClient.ts`，导出 `streamChat(options, onToken, onDone, onError)` 函数
  - [ ] SubTask 4.2: 根据 `provider.apiType` 构造请求 URL、headers、body（anthropic: `/v1/messages` + `x-api-key` + dangerous-browser-access；openai: `/chat/completions` + Bearer）
  - [ ] SubTask 4.3: 使用 `fetch` + `response.body.getReader()` + `TextDecoder` 读取流
  - [ ] SubTask 4.4: 按行解析 SSE（`data: {...}`），区分 anthropic 的 `content_block_delta` 和 openai 的 `delta.content`，提取 token 调用 `onToken`
  - [ ] SubTask 4.5: 检测 `[DONE]`（openai）或 `message_stop` 事件（anthropic）调用 `onDone`
  - [ ] SubTask 4.6: 非 2xx 响应或网络错误时调用 `onError`，错误信息含状态码和响应文本
  - [ ] SubTask 4.7: 返回 `AbortController` 以支持取消请求

## 阶段三：UI — Provider 配置

- [ ] Task 5: 实现 ProvidersSection 配置面板
  - [ ] SubTask 5.1: 创建 `src/components/settings/ProvidersSection.tsx`，渲染 Provider 列表（每项显示 name、apiType、baseURL、model 数量、编辑/删除按钮）
  - [ ] SubTask 5.2: 实现 "Add Provider" 按钮，弹出表单（name、apiType select、baseURL、apiKey、models 逗号分隔文本）
  - [ ] SubTask 5.3: 实现编辑表单（预填字段），保存调用 `updateProvider`
  - [ ] SubTask 5.4: 实现删除确认（window.confirm），调用 `removeProvider`；若删除的是当前选中 Provider，自动切换 currentProviderId 到第一个剩余 Provider
  - [ ] SubTask 5.5: apiKey 输入框使用 `type="password"`，并在面板顶部显示安全提示："API Key 仅存储在浏览器 localStorage，请勿在公共设备使用"

- [ ] Task 6: 集成 ProvidersSection 到 Settings
  - [ ] SubTask 6.1: 在 `SettingsNav.tsx` 新增 `{ key: 'providers', icon: 'plug.svg', label: 'Providers' }` 导航项
  - [ ] SubTask 6.2: 在 `SettingsContent.tsx` 的 `SECTION_MAP` 中新增 `providers: ProvidersSection`
  - [ ] SubTask 6.3: 修改 `ModelSection` 中的硬编码值，改为从 ProvidersState 读取当前 Provider 的模型，并显示 "Manage Providers →" 链接跳转到 providers section

## 阶段四：UI — 真实对话

- [ ] Task 7: 实现 useChat hook
  - [ ] SubTask 7.1: 创建 `src/hooks/useChat.ts`，返回 `{ send, isLoading, error, abort }`
  - [ ] SubTask 7.2: `send(text)` 实现：追加 user 消息到 SessionsState → 追加空 assistant 消息（loading）→ 调用 `chatClient.streamChat()`
  - [ ] SubTask 7.3: `onToken` 回调：增量追加到当前 assistant 消息的 content（通过 `updateMessage`）
  - [ ] SubTask 7.4: `onDone` 回调：标记 assistant 消息为完成状态，isLoading = false
  - [ ] SubTask 7.5: `onError` 回调：设置 error 状态，isLoading = false，assistant 消息内容显示错误文本
  - [ ] SubTask 7.6: `abort()` 调用 AbortController.abort()，并清理 isLoading

- [ ] Task 8: 改造 ChatPanel（真实发送 + ModelSelector）
  - [ ] SubTask 8.1: 在 ChatPanel 引入 `useChat` hook，textarea 绑定本地 state（`useState`）
  - [ ] SubTask 8.2: send 按钮 onClick 调用 `send(text)`，发送后清空 textarea
  - [ ] SubTask 8.3: Enter 键发送（Shift+Enter 换行），通过 onKeyDown 处理
  - [ ] SubTask 8.4: isLoading 时禁用 send 按钮，显示 spinner
  - [ ] SubTask 8.5: error 时在 messages 末尾显示错误提示卡片
  - [ ] SubTask 8.6: 创建 `src/components/workbench/ModelSelector.tsx`，渲染两个下拉：Provider 选择（来自 ProvidersState）+ Model 选择（当前 Provider 的 models）
  - [ ] SubTask 8.7: 在 composer 底部工具栏集成 ModelSelector，切换时更新 WorkspaceState.currentProviderId/currentModel
  - [ ] SubTask 8.8: 当前会话的 messages 改为从 SessionsState 读取（通过 currentSessionId）

- [ ] Task 9: 移除剩余硬编码假数据
  - [ ] SubTask 9.1: `Sessions.tsx` 删除 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 常量，改为从 `useSessions(s => s.sessions)` 读取，按 status 过滤 active/history
  - [ ] SubTask 9.2: `NewSessionModal.tsx` 删除 `MODELS` 常量，改为从当前 Provider 的 `models` 读取（`useWorkspaceState(s => s.currentProviderId)` → `useProviders` 查找）
  - [ ] SubTask 9.3: NewSessionModal 的 Create 按钮调用 `createSession()`，生成新会话（含 providerId/model），跳转到 `/`
  - [ ] SubTask 9.4: `SettingsContent.tsx` 的 GeneralSection/ModelSection 中所有硬编码模型值改为动态读取

## 阶段五：集成与验证

- [ ] Task 10: App 集成 Provider 与构建验证
  - [ ] SubTask 10.1: 在 `App.tsx` 中包裹 `ProvidersStateProvider` 和 `SessionsStateProvider`（在 `WorkspaceStateProvider` 内层）
  - [ ] SubTask 10.2: 在 `WorkspaceStateProvider` 的 store onChange 中持久化 `currentProviderId`/`currentModel` 到 localStorage（key: `cc-webui-workspace`）
  - [ ] SubTask 10.3: 启动时从 localStorage 恢复 currentProviderId/currentModel，若 Provider 不存在则回退到第一个 Provider
  - [ ] SubTask 10.4: 执行 `cd /workspace/web && bun run build` 确认 TypeScript 编译通过、Vite 构建成功
  - [ ] SubTask 10.5: 启动 dev server，手动验证：添加 Provider → 发送消息 → 流式响应 → 会话持久化

# Task Dependencies

- Task 2 依赖 Task 1（Provider 类型）
- Task 3 依赖 Task 1（ChatSession 类型）
- Task 4 独立（不依赖 store，只依赖类型）
- Task 5 依赖 Task 2（ProvidersState）
- Task 6 依赖 Task 5
- Task 7 依赖 Task 3 + Task 4（SessionsState + chatClient）
- Task 8 依赖 Task 7（useChat）+ Task 2（ModelSelector 用 ProvidersState）
- Task 9 依赖 Task 2 + Task 3
- Task 10 依赖 Task 1-9（最终集成）
- 可并行：Task 2 + Task 3 + Task 4（无相互依赖）
