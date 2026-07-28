# 借鉴 CC 源码实现 Web 全功能 Spec

## Why

当前 Web UI（`/workspace/web/`）所有数据硬编码、对话框无真实功能：`types/index.ts` 写死 6 条假对话，`Sessions.tsx` 写死会话列表，`NewSessionModal.tsx` 写死 3 个模型名，`SettingsContent.tsx` 写死 "Claude 4 Opus"，`ChatPanel.tsx` 的 send 按钮无 onClick、textarea 不更新 state。

而 `/workspace/` 仓库本身就是 Claude Code CLI 源码（`free-code` 分叉），已包含完整的对话核心、Provider 路由、工具系统、Slash 命令、会话管理、状态管理、Markdown 渲染等子系统。其中大量代码是纯 TS/TSX（不依赖 Node/Bun/Ink），可直接借鉴；少数依赖 fs/子进程的代码可适配为 Web 版本（虚拟文件系统或浏览器 API）。

本变更以 **借鉴 cc 源码** 为核心原则，将 cc 的对话与全部功能移植到 Web，而非从零重写。每处改动都标注对应的 cc 源码文件路径，确保实现符合 cc 的编码标准与架构模式。

## What Changes

### 1. 对话核心（借鉴 `src/services/api/claude.ts` + `withRetry.ts` + `errors.ts`）
- 借鉴 `claude.ts` 的 `queryModelWithStreaming()` 流式循环模式，实现 Web 版 `streamChat()`：消费 `fetch` + `ReadableStream` 的 SSE 事件，处理 `text_delta` / `tool_use` / `message_stop` 等事件
- 借鉴 `claude.ts` 的 `userMessageToMessageParam()` / `assistantMessageToMessageParam()` 消息转换函数，处理 prompt caching 注入（`cache_control` 标记）
- 借鉴 `withRetry.ts` 的重试策略：429/500/529 指数退避，最多 10 次，529 仅前台重试 3 次
- 借鉴 `errors.ts` 的错误分类：`isPromptTooLongMessage()` / `parsePromptTooLongTokenCounts()` / `PROMPT_TOO_LONG_ERROR_MESSAGE`
- 借鉴 `claude.ts` 的流式 stall 检测与 watchdog 超时（90s）
- 借鉴 `claude.ts` 的 `accumulateUsage()` / `updateUsage()` 累计 token 用量与成本

### 2. Provider 路由（借鉴 `src/utils/model/providers.ts`）
- 借鉴 `providers.ts` 的 `APIProvider` 类型和 `getAPIProvider()` 路由逻辑
- Web 简化为两种 apiType：`'anthropic'`（firstParty，含 `anthropic-dangerous-direct-browser-access` header）和 `'openai'`（OpenAI 兼容端点，Bearer auth）
- 借鉴 `getApiBaseUrl()` 优先级：env > settings > 默认
- 借鉴 `isFirstPartyAnthropicBaseUrl()` 判定
- 预置默认 Provider 模板（Anthropic 官方 + OpenAI 官方），用户可增删改查

### 3. 工具系统（借鉴 `src/Tool.ts` + `tools.ts` + `services/tools/`）
- 借鉴 `Tool.ts` 的 `Tool<Input, Output, P>` 接口、`ToolDef`、`buildTool()` 构造器、`TOOL_DEFAULTS`、`findToolByName()`、`toolMatchesName()`
- 借鉴 `Tool.ts` 的 `ToolUseContext`（精简版：去掉 fs/子进程相关字段，保留 options/messages/setAppState/abortController/onProgress/toolUseId）
- 借鉴 `tools.ts` 的 `getAllBaseTools()` 注册表模式
- 借鉴 `services/tools/toolExecution.ts` 的工具执行流程：`findToolByName` → `validateInput` → `checkPermissions` → `canUseTool` → `tool.call()` → `mapToolResultToToolResultBlockParam`
- 借鉴 `services/tools/StreamingToolExecutor.ts` 的边收边执行模式
- 实现 Web 版工具（每个工具借鉴 cc 对应工具的 schema/prompt/description，执行后端适配为 Web）：
  - **TodoWriteTool**（直接借鉴 `src/tools/TodoWriteTool/`，无 fs 依赖，读写 AppState.todos）
  - **AskUserQuestionTool**（借鉴 `src/tools/AskUserQuestionTool/`，UI 从 Ink 改 DOM，渲染问题卡片供用户点击）
  - **WebFetchTool**（借鉴 `src/tools/WebFetchTool/`，用浏览器 fetch + Readability 提取正文）
  - **WebSearchTool**（借鉴 `src/tools/WebSearchTool/`，需配置搜索 API 或降级为 WebFetch）
  - **FileReadTool / FileWriteTool / FileEditTool / GlobTool / GrepTool**（借鉴 cc 的 schema/prompt，执行层基于 **Web 虚拟文件系统**，存 localStorage/IndexedDB）
  - **BashTool**（借鉴 schema/prompt，Web 中降级为"虚拟终端"或禁用并提示需后端）
- 借鉴 `Tool.ts` 的 `renderToolUseMessage` / `renderToolResultMessage` / `renderToolUseProgressMessage` 渲染钩子（UI 适配 DOM）

### 4. Slash 命令系统（借鉴 `src/types/command.ts` + `src/commands.ts`）
- 借鉴 `command.ts` 的 `Command` 联合类型（`PromptCommand | LocalCommand | LocalJSXCommand`）
- 借鉴 `command.ts` 的 `CommandBase` 元数据、`LocalJSXCommandContext`、`LocalJSXCommandOnDone`
- 借鉴 `commands.ts` 的 `getCommands()` 注册表与懒加载模式
- 实现 Web 版命令（借鉴 cc 对应命令的元数据与逻辑）：
  - **prompt 命令**（展开为对话 prompt）：`/compact`（借鉴 `src/commands/compact/`）、`/init`（借鉴 `src/commands/init/`）、`/review`（借鉴 `src/commands/review/`）
  - **local-jsx 命令**（渲染 React 组件）：`/help`（借鉴 `src/commands/help/help.tsx`，渲染帮助弹窗）、`/clear`（借鉴 `src/commands/clear/`，清空当前会话）、`/model`（借鉴 `src/commands/model/`，渲染模型选择弹窗）、`/cost`（借鉴 `src/commands/cost/`，渲染用量统计）、`/status`（借鉴 `src/commands/status/`，渲染会话状态）
- 借鉴 `commands.ts` 的 `builtInCommandNames` 与 `isSlashCommand` 判定
- 替换 `web/src/types/index.ts` 中硬编码的 `SLASH_COMMANDS`（14 条假数据）为从命令注册表动态加载

### 5. 消息渲染（借鉴 `src/components/Message.tsx` + `messages/`）
- 借鉴 `Message.tsx` 的 `switch (message.type)` 分发架构：`user` → `UserTextMessage`、`assistant` → `AssistantMessageBlock`（每个 content block 一个子组件）、`tool_result` → `UserToolResultMessage`、`system` → `SystemTextMessage`
- 借鉴 `messages/` 子组件目录结构：`AssistantTextMessage`、`AssistantToolUseMessage`、`UserToolResultMessage`、`UserTextMessage`、`SystemTextMessage`
- 借鉴 `Message.tsx` 的 `Props`（message/lookups/containerWidth/tools/commands/verbose/inProgressToolUseIDs/progressMessagesForMessage/shouldAnimate/shouldShowDot）
- 借鉴 `Tool.ts` 的 `renderToolUseMessage` / `renderToolResultMessage` 钩子，让每个工具自定义渲染
- 替换 `web/src/components/Message.tsx`（当前是极简 stub）

### 6. Markdown 渲染（借鉴 `src/components/Markdown.tsx`）
- 借鉴 `Markdown.tsx` 的 token LRU 缓存（500 条，按 hashContent key）—— 替换当前 `dangerouslySetInnerHTML` 的 stub
- 借鉴 `Markdown.tsx` 的 `marked.lexer()` 分块解析
- 借鉴 `Markdown.tsx` 的表格分离渲染（`MarkdownTable` 组件）
- 借鉴 `Markdown.tsx` 的异步语法高亮（`Suspense` + `highlight.js`，Web 已有依赖）
- 借鉴 `Markdown.tsx` 的 `MarkdownBody` / `MarkdownWithHighlight` 导出

### 7. 会话管理（借鉴 `src/utils/sessionStorage.ts` + `sessionRestore.ts`）
- 借鉴 `sessionStorage.ts` 的 JSONL transcript 格式（每行一条消息 JSON）
- 借鉴 `sessionStorage.ts` 的 `recordTranscript()` / `readTranscriptForLoad()` / `parseJSONL()` 序列化逻辑
- Web 适配：用 `localStorage`（key: `cc-webui-sessions`）代替磁盘 fs，每会话一个 JSONL 字符串
- 借鉴 `sessionRestore.ts` 的会话恢复逻辑：从 JSONL 重建 `Message[]`
- 借鉴 `services/compact/` 的压缩算法：`autoCompact`（token 阈值触发模型 summarize）、`microCompact`（裁剪 tool_result）、`snipCompact`
- 借鉴 `utils/tokens.ts` 的 `tokenCountWithEstimation()`（Web 用本地估算或 `messages.countTokens` API）

### 8. 状态管理（借鉴 `src/state/AppState.tsx` + `AppStateStore.ts`）
- 借鉴 `AppState.tsx` 的 `AppStateProvider` + `useAppState(selector)` + `useSyncExternalStore` 模式（当前 `WorkspaceState.tsx` 已部分借鉴，需完善）
- 借鉴 `AppStateStore.ts` 的 `getDefaultAppState()` 工厂模式
- 借鉴 `AppStateStore.ts` 的 `DeepImmutable` 类型包装
- 扩展 Web 的 AppState 字段（借鉴 cc 对应字段，去掉 CLI 专属如 replBridge/tungsten/bagel）：
  - `messages: Message[]`（借鉴 cc 的完整消息类型，含 tool_use/tool_result/content blocks）
  - `todos: Record<string, Todo[]>`（借鉴 cc 的 TodoWrite 状态）
  - `inProgressToolUseIDs: Set<string>`
  - `toolPermissionContext`
  - `fileHistory`（虚拟文件系统的历史快照）
  - `mcpClients`（Web 中可空或通过 SSE transport）
  - `notifications`
  - `elicitation`（AskUserQuestion 的待答问题）

### 9. 系统提示词（借鉴 `src/constants/prompts.ts` + `utils/systemPrompt.ts`）
- 借鉴 `prompts.ts` 的 `getSystemPrompt()` 分段组装模式
- 借鉴 `systemPrompt.ts` 的 `buildEffectiveSystemPrompt()` 优先级链：override > coordinator > agent > custom > default > append
- 借鉴 `systemPromptSections.ts` 的 `systemPromptSection()` / `resolveSystemPromptSections()` 分段组装器
- Web 版系统提示词需为 Web 上下文重写（去掉 CLI 专属的工具说明如 BashTool 的沙箱、文件系统的绝对路径，改为虚拟文件系统说明）

### 10. 移除硬编码假数据
- 删除 `types/index.ts` 中 `getDefaultWorkspaceState().messages` 的 6 条硬编码假对话
- 删除 `Sessions.tsx` 中 `ACTIVE_SESSIONS` / `HISTORY_SESSIONS` 假数据，改为从 SessionsState 读取
- 删除 `NewSessionModal.tsx` 中 `MODELS` 硬编码常量，改为从当前 Provider 的 models 读取
- 删除 `SettingsContent.tsx` 中 `value="Claude 4 Opus"` 等硬编码值
- 替换 `types/index.ts` 中 `SLASH_COMMANDS`（14 条假数据）为从命令注册表动态加载

### 11. ChatPanel 真实对话集成
- ChatPanel textarea 双向绑定 state，send 按钮 onClick 触发 `useChat.send()`
- Enter 键发送（Shift+Enter 换行）
- 流式渲染：assistant 消息逐 token 追加，工具调用实时显示 progress
- composer 底部新增 ModelSelector（Provider + Model 双下拉）
- 错误处理：API 错误、权限拒绝、工具执行错误均在 ChatPanel 显示

### 12. Provider 配置 UI
- Settings 新增 "Providers" 配置面板（SettingsNav + SettingsContent 新增项）
- Provider 增删改查表单（name、apiType、baseURL、apiKey、models）
- apiKey 用 `type="password"`，面板顶部显示安全提示
- 持久化到 localStorage（key: `cc-webui-providers`）

## Impact

### 借鉴的 cc 源码文件
- `src/state/store.ts`（已借鉴）
- `src/state/AppState.tsx` + `AppStateStore.ts`（Provider 模式与类型组织）
- `src/services/api/claude.ts`（流式循环、消息转换、usage 累计）
- `src/services/api/withRetry.ts`（重试策略）
- `src/services/api/errors.ts`（错误分类）
- `src/services/api/client.ts`（getCustomHeaders、buildFetch 可剥离部分）
- `src/utils/model/providers.ts`（Provider 路由）
- `src/Tool.ts`（Tool 接口、buildTool、ToolUseContext）
- `src/tools.ts`（工具注册表）
- `src/tools/TodoWriteTool/`（直接借鉴）
- `src/tools/AskUserQuestionTool/`（借鉴 + UI 适配）
- `src/tools/WebFetchTool/`（借鉴 + 浏览器 fetch）
- `src/tools/FileReadTool/` 等（借鉴 schema/prompt，执行层适配虚拟文件系统）
- `src/services/tools/toolExecution.ts`（工具执行流程）
- `src/services/tools/StreamingToolExecutor.ts`（边收边执行）
- `src/types/command.ts`（Command 类型系统）
- `src/commands.ts`（命令注册表）
- `src/commands/help/help.tsx`（local-jsx 命令样例）
- `src/commands/clear/`、`compact/`、`model/`、`cost/`、`status/`、`init/`、`review/`（各命令实现）
- `src/components/Message.tsx` + `messages/`（消息渲染分发）
- `src/components/Markdown.tsx`（token 缓存与分块渲染）
- `src/utils/messages.ts`（normalizeMessagesForAPI 等纯函数）
- `src/utils/sessionStorage.ts`（JSONL 序列化）
- `src/utils/sessionRestore.ts`（会话恢复）
- `src/services/compact/`（压缩算法）
- `src/constants/prompts.ts` + `src/utils/systemPrompt.ts`（系统提示词组装）
- `src/utils/tokens.ts`（token 估算）

### 受影响的 Web 代码
- `web/src/types/index.ts` — 新增 cc 借鉴的类型（Message/Provider/Command/Tool 等），移除硬编码
- `web/src/state/store.ts`（已借鉴，无需改）
- `web/src/state/WorkspaceState.tsx` — 扩展为完整 AppState（借鉴 AppState.tsx）
- `web/src/state/ProvidersState.tsx`（新增）— Provider store
- `web/src/state/SessionsState.tsx`（新增）— 会话 store
- `web/src/services/chatClient.ts`（新增）— 借鉴 claude.ts 的流式客户端
- `web/src/services/withRetry.ts`（新增）— 借鉴 withRetry.ts
- `web/src/services/apiErrors.ts`（新增）— 借鉴 errors.ts
- `web/src/services/messageUtils.ts`（新增）— 借鉴 messages.ts 的纯函数
- `web/src/services/systemPrompt.ts`（新增）— 借鉴 systemPrompt.ts
- `web/src/services/compact.ts`（新增）— 借鉴 compact 算法
- `web/src/services/tokenEstimate.ts`（新增）— 借鉴 tokens.ts
- `web/src/services/sessionStorage.ts`（新增）— 借鉴 sessionStorage.ts（localStorage 适配）
- `web/src/Tool.ts`（新增）— 借鉴 cc Tool.ts
- `web/src/tools.ts`（新增）— 工具注册表
- `web/src/tools/TodoWriteTool.tsx`（新增）— 直接借鉴
- `web/src/tools/AskUserQuestionTool.tsx`（新增）— 借鉴 + DOM UI
- `web/src/tools/WebFetchTool.tsx`（新增）— 借鉴 + 浏览器 fetch
- `web/src/tools/FileReadTool.tsx` 等（新增）— 借鉴 schema，虚拟文件系统执行
- `web/src/services/virtualFs.ts`（新增）— 虚拟文件系统（IndexedDB）
- `web/src/commands.ts`（新增）— 命令注册表
- `web/src/commands/help.tsx`、`clear.ts`、`compact.ts`、`model.tsx`、`cost.tsx`、`status.tsx`（新增）
- `web/src/components/Message.tsx`（重写）— 借鉴 cc 分发架构
- `web/src/components/messages/`（新增目录）— 子组件
- `web/src/components/Markdown.tsx`（重写）— token 缓存
- `web/src/hooks/useChat.ts`（新增）— 借鉴 QueryEngine 的对话循环
- `web/src/hooks/useCanUseTool.tsx`（新增）— 借鉴权限确认
- `web/src/components/workbench/ChatPanel.tsx` — 真实发送集成
- `web/src/components/workbench/ModelSelector.tsx`（新增）
- `web/src/components/settings/ProvidersSection.tsx`（新增）
- `web/src/components/settings/SettingsContent.tsx` — 新增 providers 路由 + 移除硬编码
- `web/src/components/settings/SettingsNav.tsx` — 新增 Providers 导航
- `web/src/components/sessions/NewSessionModal.tsx` — MODELS 改为从 Provider 读取
- `web/src/pages/Sessions.tsx` — 从 SessionsState 读取
- `web/src/App.tsx` — 包裹新 Provider

## ADDED Requirements

### Requirement: 流式对话核心（借鉴 claude.ts）
系统 SHALL 提供 `streamChat()` 函数，借鉴 cc `services/api/claude.ts` 的 `queryModelWithStreaming()` 模式，消费 SSE 流并处理 text_delta/tool_use/message_stop 事件。

#### Scenario: 流式文本响应
- **WHEN** 调用 `streamChat({ provider, model, messages, systemPrompt, tools, signal })`
- **THEN** 根据 provider.apiType 构造请求（anthropic: `/v1/messages` + `x-api-key` + `anthropic-dangerous-direct-browser-access: true`；openai: `/chat/completions` + Bearer）
- **AND** 使用 `fetch` + `response.body.getReader()` + `TextDecoder` 消费 SSE 流
- **AND** 每收到 text_delta 事件，通过 `onToken(text)` 回调追加到 assistant 消息
- **AND** 收到 message_stop 事件时调用 `onDone()`，遇到 tool_use 事件时调用 `onToolUse(toolCall)` 回调

#### Scenario: 消息转换（借鉴 userMessageToMessageParam）
- **WHEN** 发送请求前需将内部 Message[] 转为 API 格式
- **THEN** 借鉴 cc `userMessageToMessageParam()` / `assistantMessageToMessageParam()`，正确处理 content blocks（text/tool_use/tool_result）、prompt caching `cache_control` 标记

#### Scenario: 重试策略（借鉴 withRetry）
- **WHEN** API 返回 429/500/529 或网络错误
- **THEN** 借鉴 cc `withRetry.ts` 的分类重试：429/500 指数退避最多 10 次，529 仅前台重试 3 次，连接错误重试
- **AND** 401 时提示 API Key 无效，不重试

#### Scenario: 错误分类（借鉴 errors.ts）
- **WHEN** API 返回 prompt-too-long 错误
- **THEN** 借鉴 cc `errors.ts` 的 `isPromptTooLongMessage()` / `parsePromptTooLongTokenCounts()` 解析，显示具体超出 token 数

#### Scenario: 流式 stall 检测（借鉴 claude.ts）
- **WHEN** 流式响应超过 90s 无新数据
- **THEN** 借鉴 cc 的 watchdog，abort 请求并提示超时

#### Scenario: Usage 累计（借鉴 claude.ts）
- **WHEN** 流式响应包含 usage 信息
- **THEN** 借鉴 cc `accumulateUsage()` / `updateUsage()`，累计 input/output/cache token 到会话状态

### Requirement: Provider 路由（借鉴 providers.ts）
系统 SHALL 借鉴 cc `utils/model/providers.ts` 的 `APIProvider` 类型与路由逻辑，支持配置多个 Provider。

#### Scenario: Provider 类型
- **WHEN** 定义 Provider
- **THEN** 借鉴 cc `APIProvider` 类型，Web 简化为 `{ id, name, apiType: 'anthropic'|'openai', baseURL, apiKey, models[] }`

#### Scenario: API 端点优先级（借鉴 getApiBaseUrl）
- **WHEN** 构造请求 URL
- **THEN** 借鉴 cc `getApiBaseUrl()` 优先级：runtime config > settings > 默认（anthropic: https://api.anthropic.com；openai: https://api.openai.com/v1）

#### Scenario: 默认预置 Provider
- **WHEN** 首次启动（localStorage 无数据）
- **THEN** 预置两个 Provider 模板（借鉴 cc 默认配置）：Anthropic 官方 + OpenAI 官方，apiKey 为空待用户填写

### Requirement: 工具系统（借鉴 Tool.ts + tools.ts）
系统 SHALL 借鉴 cc `Tool.ts` 的 `Tool` 接口、`buildTool()` 构造器、`ToolUseContext`，以及 `tools.ts` 的注册表模式。

#### Scenario: Tool 接口（借鉴 Tool.ts）
- **WHEN** 定义工具
- **THEN** 借鉴 cc `Tool<Input, Output, P>` 接口，包含 `name`、`inputSchema`、`inputJSONSchema`、`call()`、`description()`、`prompt()`、`isEnabled()`、`isReadOnly()`、`isDestructive()`、`checkPermissions()`、`renderToolUseMessage()`、`renderToolResultMessage()`、`mapToolResultToToolResultBlockParam()`

#### Scenario: buildTool 构造器（借鉴 Tool.ts）
- **WHEN** 创建工具实例
- **THEN** 借鉴 cc `buildTool(def)` 填充 `TOOL_DEFAULTS`（`isEnabled=true`、`isConcurrencySafe=false`、`isReadOnly=false`、`checkPermissions=allow`）

#### Scenario: 工具执行流程（借鉴 toolExecution.ts）
- **WHEN** 模型返回 tool_use 事件
- **THEN** 借鉴 cc `toolExecution.ts`：`findToolByName` → `validateInput` → `checkPermissions` → `canUseTool`（UI 确认）→ `tool.call()` → `mapToolResultToToolResultBlockParam` → 回填 tool_result 消息

#### Scenario: 边收边执行（借鉴 StreamingToolExecutor）
- **WHEN** 流式响应中收到完整 tool_use 块（input_json_delta 结束）
- **THEN** 借鉴 cc `StreamingToolExecutor`，立即执行工具而非等待 stop_reason

#### Scenario: TodoWriteTool（直接借鉴）
- **WHEN** 模型调用 TodoWrite
- **THEN** 借鉴 cc `src/tools/TodoWriteTool/`，直接读写 AppState.todos（无 fs 依赖）

#### Scenario: AskUserQuestionTool（借鉴 + DOM 适配）
- **WHEN** 模型调用 AskUserQuestion
- **THEN** 借鉴 cc `src/tools/AskUserQuestionTool/`，在 ChatPanel 渲染问题卡片（DOM 适配），用户点击选项后回填 tool_result

#### Scenario: WebFetchTool（借鉴 + 浏览器 fetch）
- **WHEN** 模型调用 WebFetch
- **THEN** 借鉴 cc `src/tools/WebFetchTool/`，用浏览器 fetch 获取 URL，提取正文（受 CORS 限制时提示）

#### Scenario: 虚拟文件系统工具（借鉴 schema，执行适配）
- **WHEN** 模型调用 FileRead/FileWrite/FileEdit/Glob/Grep
- **THEN** 借鉴 cc 对应工具的 schema/prompt/description
- **AND** 执行层基于 Web 虚拟文件系统（IndexedDB），而非真实 fs
- **AND** 虚拟文件系统支持创建/读取/编辑/搜索文件，持久化到 IndexedDB

#### Scenario: BashTool 降级
- **WHEN** 模型调用 Bash
- **THEN** 借鉴 cc schema/prompt，但 Web 中返回"需后端代理执行，当前不可用"提示
- **OR** 配置了后端代理时，通过 WebSocket 发送到后端执行

### Requirement: Slash 命令系统（借鉴 command.ts + commands.ts）
系统 SHALL 借鉴 cc `types/command.ts` 的 `Command` 联合类型与 `commands.ts` 的注册表模式。

#### Scenario: Command 类型（借鉴 command.ts）
- **WHEN** 定义命令
- **THEN** 借鉴 cc `Command = CommandBase & (PromptCommand | LocalCommand | LocalJSXCommand)`
- **AND** `PromptCommand` 展开为对话 prompt（如 `/compact`、`/init`、`/review`）
- **AND** `LocalJSXCommand` 返回 React 组件（如 `/help`、`/model`、`/cost`、`/status`）

#### Scenario: 命令注册表（借鉴 commands.ts）
- **WHEN** 系统启动
- **THEN** 借鉴 cc `getCommands()`，注册 Web 版命令：help、clear、compact、model、cost、status、init、review
- **AND** 替换 `web/src/types/index.ts` 中硬编码的 `SLASH_COMMANDS` 为从注册表动态加载

#### Scenario: /help 命令（借鉴 help.tsx）
- **WHEN** 用户输入 `/help`
- **THEN** 借鉴 cc `commands/help/help.tsx`，渲染帮助弹窗列出所有可用命令

#### Scenario: /clear 命令（借鉴 clear/）
- **WHEN** 用户输入 `/clear`
- **THEN** 借鉴 cc `commands/clear/`，清空当前会话的 messages

#### Scenario: /compact 命令（借鉴 compact/）
- **WHEN** 用户输入 `/compact`
- **THEN** 借鉴 cc `commands/compact/`，触发压缩：让模型 summarize 历史 → 替换 messages

#### Scenario: /model 命令（借鉴 model/）
- **WHEN** 用户输入 `/model`
- **THEN** 借鉴 cc `commands/model/`，渲染模型选择弹窗

### Requirement: 消息渲染（借鉴 Message.tsx + messages/）
系统 SHALL 借鉴 cc `components/Message.tsx` 的 type 分发架构与 `messages/` 子组件目录。

#### Scenario: 消息类型分发（借鉴 Message.tsx）
- **WHEN** 渲染消息列表
- **THEN** 借鉴 cc `switch (message.type)` 分发：`user` → UserTextMessage、`assistant` → AssistantMessageBlock（按 content block 分子组件）、`tool_result` → UserToolResultMessage、`system` → SystemTextMessage

#### Scenario: 工具调用渲染（借鉴 renderToolUseMessage）
- **WHEN** 渲染 assistant 的 tool_use content block
- **THEN** 借鉴 cc `Tool.renderToolUseMessage()`，每个工具自定义渲染（如 TodoWrite 显示 todo 列表，FileRead 显示文件路径）

#### Scenario: 工具结果渲染（借鉴 renderToolResultMessage）
- **WHEN** 渲染 tool_result 消息
- **THEN** 借鉴 cc `Tool.renderToolResultMessage()`，每个工具自定义结果渲染

### Requirement: Markdown 渲染（借鉴 Markdown.tsx）
系统 SHALL 借鉴 cc `components/Markdown.tsx` 的 token LRU 缓存与分块解析，替换当前 `dangerouslySetInnerHTML` stub。

#### Scenario: token 缓存（借鉴 Markdown.tsx）
- **WHEN** 渲染 markdown 文本
- **THEN** 借鉴 cc 的 LRU Map（500 条，按 hashContent key），缓存 `marked.lexer()` 解析结果
- **AND** 命中缓存时直接渲染，未命中时解析并缓存

#### Scenario: 表格分离渲染（借鉴 MarkdownTable）
- **WHEN** markdown 含表格
- **THEN** 借鉴 cc `MarkdownTable` 组件单独渲染表格，支持横向滚动

#### Scenario: 语法高亮（借鉴 MarkdownWithHighlight）
- **WHEN** markdown 含代码块
- **THEN** 借鉴 cc 的异步高亮（`Suspense` + `highlight.js`，Web 已有依赖）

### Requirement: 会话管理（借鉴 sessionStorage.ts + sessionRestore.ts）
系统 SHALL 借鉴 cc `utils/sessionStorage.ts` 的 JSONL 格式与 `sessionRestore.ts` 的恢复逻辑。

#### Scenario: JSONL 持久化（借鉴 sessionStorage.ts）
- **WHEN** 会话 messages 变化
- **THEN** 借鉴 cc `recordTranscript()`，每条消息追加为一行 JSON，存储到 localStorage（key: `cc-webui-sessions-{sessionId}`）
- **AND** 借鉴 cc `parseJSONL()` 反序列化

#### Scenario: 会话恢复（借鉴 sessionRestore.ts）
- **WHEN** 加载已有会话
- **THEN** 借鉴 cc `sessionRestore.ts`，从 JSONL 重建 `Message[]`

#### Scenario: 上下文压缩（借鉴 compact/）
- **WHEN** 会话 token 数超过阈值
- **THEN** 借鉴 cc `services/compact/autoCompact.ts`，触发模型 summarize 历史
- **AND** 借鉴 cc `microCompact.ts`，裁剪 tool_result 内容
- **AND** 借鉴 cc `snipCompact.ts`，snip 压缩

#### Scenario: Token 估算（借鉴 tokens.ts）
- **WHEN** 需计算 token 数
- **THEN** 借鉴 cc `utils/tokens.ts` 的 `tokenCountWithEstimation()`，Web 用本地估算（字符数/4）

### Requirement: 状态管理（借鉴 AppState.tsx）
系统 SHALL 借鉴 cc `state/AppState.tsx` 的 Provider + useSyncExternalStore 模式，扩展 Web 的 AppState。

#### Scenario: AppState 字段（借鉴 AppStateStore.ts）
- **WHEN** 定义 AppState
- **THEN** 借鉴 cc `AppStateStore.ts`，Web 包含：`messages`、`todos`、`inProgressToolUseIDs`、`toolPermissionContext`、`fileHistory`、`notifications`、`elicitation`、`currentProviderId`、`currentModel`、`currentSessionId`
- **AND** 借鉴 cc `DeepImmutable` 类型包装

#### Scenario: AppStateProvider（借鉴 AppState.tsx）
- **WHEN** 应用启动
- **THEN** 借鉴 cc `AppStateProvider`，用 `createStore()` + `useSyncExternalStore` 提供全局 state
- **AND** 借鉴 cc `getDefaultAppState()` 工厂模式

### Requirement: 系统提示词（借鉴 prompts.ts + systemPrompt.ts）
系统 SHALL 借鉴 cc `constants/prompts.ts` 的分段组装与 `utils/systemPrompt.ts` 的优先级链。

#### Scenario: 系统提示词组装（借鉴 prompts.ts）
- **WHEN** 发送请求前
- **THEN** 借鉴 cc `getSystemPrompt()`，分段组装：工具说明 + Web 上下文说明 + 用户自定义（CLAUDE.md 等效）

#### Scenario: 优先级链（借鉴 systemPrompt.ts）
- **WHEN** 存在多个提示词来源
- **THEN** 借鉴 cc `buildEffectiveSystemPrompt()` 优先级：override > custom > default > append

### Requirement: 真实对话发送
系统 SHALL 在用户点击发送或按 Enter 时，触发完整的对话循环（借鉴 QueryEngine）。

#### Scenario: 发送消息
- **WHEN** 用户输入文本并点击发送（或按 Enter，非 Shift+Enter）
- **THEN** 追加 user 消息到 AppState.messages
- **AND** 调用 `streamChat()`，流式追加 assistant 消息
- **AND** 收到 tool_use 时执行工具，回填 tool_result，继续流式

#### Scenario: 发送中禁用
- **WHEN** isLoading === true
- **THEN** 发送按钮禁用，显示 spinner

### Requirement: Provider/Model 选择器
系统 SHALL 在 ChatPanel composer 显示当前 Provider/Model，支持切换。

#### Scenario: 切换 Provider
- **WHEN** 用户选择不同 Provider
- **THEN** 更新 currentProviderId，重置 currentModel 为新 Provider 的第一个模型

#### Scenario: 切换 Model
- **WHEN** 用户选择不同 Model
- **THEN** 更新 currentModel

### Requirement: Provider 配置 UI
系统 SHALL 在 Settings 提供 Provider 配置面板，支持增删改查。

#### Scenario: 添加 Provider
- **WHEN** 用户点击 "Add Provider"
- **THEN** 弹出表单填写 name、apiType、baseURL、apiKey、models
- **AND** 保存后持久化到 localStorage

#### Scenario: 安全提示
- **WHEN** 显示 Provider 配置
- **THEN** apiKey 用 `type="password"`，面板顶部显示"API Key 仅存储在浏览器 localStorage，请勿在公共设备使用"

## MODIFIED Requirements

### Requirement: WorkspaceState 默认值
`getDefaultWorkspaceState()` SHALL：
- `messages: []`（空数组，不再硬编码）
- `currentProviderId: null`
- `currentModel: ''`
- `todos: {}`（借鉴 cc 初始值）
- `inProgressToolUseIDs: []`

### Requirement: NewSessionModal 模型来源
`NewSessionModal` 的模型下拉 SHALL 从当前 Provider 的 models 读取，不再使用硬编码 `MODELS`。

### Requirement: SettingsContent ModelSection
`ModelSection` SHALL 从 ProvidersState 读取当前 Provider 的模型列表，显示 "Manage Providers →" 链接，不再硬编码。

### Requirement: Sessions 页面数据源
`Sessions.tsx` SHALL 从 SessionsState 读取会话列表，不再使用 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 假数据。

### Requirement: SlashCommandPanel 命令来源
`SlashCommandPanel` SHALL 从命令注册表动态加载命令列表，不再使用硬编码 `SLASH_COMMANDS`。

## REMOVED Requirements

### Requirement: 硬编码假对话
**Reason**: `getDefaultWorkspaceState().messages` 的 6 条假对话无实际功能
**Migration**: 改为空数组，真实对话由用户发送消息后填充

### Requirement: 硬编码会话列表
**Reason**: `Sessions.tsx` 的 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 假数据
**Migration**: 改为从 SessionsState 读取

### Requirement: 硬编码模型常量
**Reason**: `NewSessionModal.tsx` 的 `MODELS` 无法适配多 Provider
**Migration**: 改为从 Provider.models 动态读取

### Requirement: 硬编码 Slash 命令列表
**Reason**: `types/index.ts` 的 `SLASH_COMMANDS`（14 条假数据）与真实命令实现脱节
**Migration**: 改为从命令注册表动态加载

## 技术约束与说明

### CC 源码借鉴原则
- 每处改动在代码注释中标注 `// Borrowed from src/...` 与原文件路径
- 借鉴时保留 cc 的函数名、类型名、架构模式，便于对照
- 不照搬 cc 中依赖 Node/Bun/Ink 的代码，只借鉴纯 TS/TSX 部分
- UI 从 Ink `<Box>`/`<Ansi>` 适配为 DOM React 元素，但保留组件结构与 props 命名

### CORS 约束
- Anthropic API 需设置 `anthropic-dangerous-direct-browser-access: true` header 才能从浏览器调用
- OpenAI 官方 API 默认支持 CORS
- 第三方 OpenAI 兼容端点需自身支持 CORS，否则失败（错误处理中提示用户）

### apiKey 存储
- 纯前端 SPA 无安全后端，apiKey 仅存 localStorage（明文）
- UI 明确提示风险，用户自行承担
- 未来可加后端代理提升安全性

### 虚拟文件系统
- Web 无本地 fs 访问权限，FileRead/FileWrite/FileEdit/Glob/Grep 基于虚拟文件系统
- 虚拟文件系统用 IndexedDB 持久化（容量大、支持结构化数据）
- 用户可上传文件到虚拟文件系统，或直接在对话中让模型创建/编辑虚拟文件
- BashTool 在无后端时降级为禁用并提示

### 流式实现
- 使用 `fetch` + `ReadableStream` + `TextDecoder` 解析 SSE（不引入 EventSource，因不支持 POST）
- 借鉴 cc `claude.ts` 的 SDK Stream 消费模式，但 Web 不依赖 `@anthropic-ai/sdk`（直接 fetch）

### 不可移植的 cc 功能（本 spec 范围外）
- Bedrock/Vertex/Foundry provider（依赖 AWS/Google/Azure SDK）
- MCP stdio transport（依赖子进程）
- IDE 桥接（依赖 WebSocket + IDE 扩展）
- keychain 凭据存储（依赖系统 keychain）
- ripgrep 子进程（Web 用虚拟文件系统搜索替代）
- 真实 BashTool 执行（需后端代理）
- Voice 语音输入（依赖 audio-capture-napi）
- 图像处理（依赖 image-processor-napi）
- Tmux 集成、远程会话、SSH 直连

这些功能在 spec 中标注为"Web 上下文不可实现，跳过"或"需后端代理，本 spec 不涵盖"。
