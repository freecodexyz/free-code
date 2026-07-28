# Tasks

## 阶段一：类型与状态层（借鉴 cc state/ + types/）

- [x] Task 1: 定义 cc 借鉴的核心类型，移除硬编码
  - [ ] SubTask 1.1: 在 `web/src/types/index.ts` 新增借鉴 cc 的类型：`ApiType`、`Provider`、`ContentBlock`（text/tool_use/tool_result）、`Message`（user/assistant/tool_result/system，借鉴 cc `types/message.ts` 推断契约）、`ToolUseBlock`、`ToolResultBlock`、`ChatSession`、`Todo`
  - [ ] SubTask 1.2: 扩展 `WorkspaceState` 借鉴 cc `AppStateStore.ts`：新增 `messages: Message[]`、`todos: Record<string, Todo[]>`、`inProgressToolUseIDs: string[]`、`toolPermissionContext`、`fileHistory`、`notifications`、`elicitation`、`currentProviderId`、`currentModel`、`currentSessionId`
  - [ ] SubTask 1.3: 修改 `getDefaultWorkspaceState()` 借鉴 cc `getDefaultAppState()`：`messages: []`、`todos: {}`、`inProgressToolUseIDs: []`，移除 6 条硬编码假对话
  - [ ] SubTask 1.4: 删除 `SLASH_COMMANDS` 硬编码常量（改为从命令注册表动态加载）
  - [ ] SubTask 1.5: 新增 `DEFAULT_PROVIDERS` 常量（借鉴 cc 默认配置）：Anthropic（apiType: anthropic, baseURL: https://api.anthropic.com, models: ['claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022']）+ OpenAI（apiType: openai, baseURL: https://api.openai.com/v1, models: ['gpt-4o','gpt-4o-mini']），apiKey 空

- [x] Task 2: 创建 ProvidersState store（借鉴 cc AppState.tsx 模式）
  - [ ] SubTask 2.1: 创建 `web/src/state/ProvidersState.tsx`，借鉴 cc `AppStateProvider` 模式：导出 `ProvidersStateProvider`、`useProviders(selector)`、`useSetProviders`
  - [ ] SubTask 2.2: 初始化从 `localStorage.getItem('cc-webui-providers')` 读取，无数据用 `DEFAULT_PROVIDERS`
  - [ ] SubTask 2.3: store onChange 写回 localStorage（借鉴 cc `onChangeAppState` 模式）
  - [ ] SubTask 2.4: 提供 `addProvider`、`updateProvider`、`removeProvider` 操作方法

- [x] Task 3: 创建 SessionsState store（借鉴 cc sessionStorage.ts）
  - [ ] SubTask 3.1: 创建 `web/src/state/SessionsState.tsx`，导出 `SessionsStateProvider`、`useSessions(selector)`、`useSetSessions`
  - [ ] SubTask 3.2: 借鉴 cc `sessionStorage.ts` 的 JSONL 格式，每会话存为 `cc-webui-sessions-{id}` 的 JSONL 字符串
  - [ ] SubTask 3.3: 借鉴 cc `recordTranscript()` / `parseJSONL()`，实现 `appendMessage`、`updateMessage`、`getSession`、`createSession`
  - [ ] SubTask 3.4: 会话列表索引存 `cc-webui-sessions-index`（id/title/updatedAt）

## 阶段二：API 客户端（借鉴 cc services/api/）

- [x] Task 4: 实现流式 chatClient（借鉴 claude.ts）
  - [x] SubTask 4.1: 创建 `web/src/services/chatClient.ts`，借鉴 cc `services/api/claude.ts` 的 `queryModelWithStreaming()`，导出 `streamChat(options, callbacks)` 函数
  - [x] SubTask 4.2: 借鉴 cc `providers.ts` 的 `getApiBaseUrl()`，根据 provider.apiType 构造请求：anthropic → `POST {baseURL}/v1/messages` + headers（`x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`）；openai → `POST {baseURL}/chat/completions` + `Authorization: Bearer`
  - [x] SubTask 4.3: 借鉴 cc `userMessageToMessageParam()` / `assistantMessageToMessageParam()`，实现消息转换（含 cache_control 注入）
  - [x] SubTask 4.4: 使用 `fetch` + `response.body.getReader()` + `TextDecoder` 消费 SSE 流
  - [x] SubTask 4.5: 借鉴 cc 流式循环，解析事件：anthropic 的 `content_block_delta.delta.text` / `content_block_start`（tool_use）/ `message_stop`；openai 的 `delta.content` / `delta.tool_calls` / `[DONE]`
  - [x] SubTask 4.6: 通过 `onToken(text)`、`onToolUse(toolCall)`、`onDone()`、`onError(err)` 回调通知调用方
  - [x] SubTask 4.7: 返回 `AbortController` 支持取消
  - [x] SubTask 4.8: 借鉴 cc watchdog，90s 无数据时 abort 并提示超时

- [x] Task 5: 实现重试与错误处理（借鉴 withRetry.ts + errors.ts）
  - [x] SubTask 5.1: 创建 `web/src/services/withRetry.ts`，借鉴 cc `services/api/withRetry.ts`：429/500 指数退避最多 10 次，529 仅前台重试 3 次，连接错误重试
  - [x] SubTask 5.2: 创建 `web/src/services/apiErrors.ts`，借鉴 cc `services/api/errors.ts`：`isPromptTooLongMessage()`、`parsePromptTooLongTokenCounts()`、`PROMPT_TOO_LONG_ERROR_MESSAGE`、`REPEATED_529_ERROR_MESSAGE`
  - [x] SubTask 5.3: chatClient 集成 withRetry 包装

- [x] Task 6: 实现消息工具函数（借鉴 cc utils/messages.ts）
  - [x] SubTask 6.1: 创建 `web/src/services/messageUtils.ts`，借鉴 cc `utils/messages.ts`：`normalizeMessagesForAPI()`（剥离 system-only、合并同角色、补 tool_result 配对）、`ensureToolResultPairing()`、`createUserMessage()`、`createSystemMessage()`、`createAssistantAPIErrorMessage()`
  - [x] SubTask 6.2: 借鉴 cc `accumulateUsage()` / `updateUsage()`，实现 usage 累计到会话状态

## 阶段三：工具系统（借鉴 cc Tool.ts + tools/）

- [x] Task 7: 实现 Tool 接口与注册表（借鉴 Tool.ts + tools.ts）
  - [ ] SubTask 7.1: 创建 `web/src/Tool.ts`，借鉴 cc `src/Tool.ts`：`Tool<Input, Output, P>` 接口、`ToolDef`、`buildTool()`、`TOOL_DEFAULTS`、`findToolByName()`、`toolMatchesName()`、`ToolUseContext`（精简版：options/messages/setAppState/abortController/onProgress/toolUseId，去掉 fs/子进程字段）
  - [ ] SubTask 7.2: 创建 `web/src/tools.ts`，借鉴 cc `src/tools.ts` 的 `getAllBaseTools()` 注册表模式
  - [ ] SubTask 7.3: 借鉴 cc `services/tools/toolExecution.ts`，创建 `web/src/services/toolExecution.ts`：`findToolByName` → `validateInput` → `checkPermissions` → `canUseTool` → `tool.call()` → `mapToolResultToToolResultBlockParam`
  - [ ] SubTask 7.4: 借鉴 cc `StreamingToolExecutor.ts`，创建 `web/src/services/streamingToolExecutor.ts`：边收 tool_use 边执行

- [x] Task 8: 实现 Web 版工具（借鉴 cc 对应工具）
  - [ ] SubTask 8.1: 创建 `web/src/tools/TodoWriteTool.tsx`，**直接借鉴** cc `src/tools/TodoWriteTool/`：schema/prompt/call 全部复用，读写 AppState.todos
  - [ ] SubTask 8.2: 创建 `web/src/tools/AskUserQuestionTool.tsx`，借鉴 cc `src/tools/AskUserQuestionTool/`：schema/prompt 借鉴，UI 适配 DOM（渲染问题卡片，用户点击选项回填 tool_result）
  - [ ] SubTask 8.3: 创建 `web/src/tools/WebFetchTool.tsx`，借鉴 cc `src/tools/WebFetchTool/`：用浏览器 fetch 获取 URL，提取正文（CORS 失败时提示）
  - [ ] SubTask 8.4: 创建 `web/src/services/virtualFs.ts`，基于 IndexedDB 的虚拟文件系统：createFile/readFile/writeFile/editFile/glob/grep
  - [ ] SubTask 8.5: 创建 `web/src/tools/FileReadTool.tsx`，借鉴 cc schema/prompt/description，执行层调用 virtualFs.readFile
  - [ ] SubTask 8.6: 创建 `web/src/tools/FileWriteTool.tsx`，借鉴 cc，执行层调用 virtualFs.writeFile
  - [ ] SubTask 8.7: 创建 `web/src/tools/FileEditTool.tsx`，借鉴 cc，执行层调用 virtualFs.editFile
  - [ ] SubTask 8.8: 创建 `web/src/tools/GlobTool.tsx`，借鉴 cc schema/prompt，执行层调用 virtualFs.glob
  - [ ] SubTask 8.9: 创建 `web/src/tools/GrepTool.tsx`，借鉴 cc schema/prompt，执行层调用 virtualFs.grep
  - [ ] SubTask 8.10: 创建 `web/src/tools/BashTool.tsx`，借鉴 cc schema/prompt，Web 中返回"需后端代理执行"提示（或配置后端时通过 WebSocket 执行）
  - [ ] SubTask 8.11: 在 `web/src/tools.ts` 注册所有工具到 `getAllBaseTools()`

## 阶段四：Slash 命令系统（借鉴 cc command.ts + commands/）

- [x] Task 9: 实现命令类型与注册表（借鉴 command.ts + commands.ts）
  - [ ] SubTask 9.1: 创建 `web/src/types/command.ts`，借鉴 cc `src/types/command.ts`：`CommandBase`、`PromptCommand`、`LocalCommand`、`LocalJSXCommand`、`Command` 联合类型、`LocalJSXCommandContext`、`LocalJSXCommandOnDone`
  - [ ] SubTask 9.2: 创建 `web/src/commands.ts`，借鉴 cc `src/commands.ts` 的 `getCommands()` 注册表与懒加载模式
  - [ ] SubTask 9.3: 创建 `web/src/hooks/useSlashCommand.ts` 改造，从命令注册表动态加载（替换硬编码 SLASH_COMMANDS）

- [x] Task 10: 实现 Web 版命令（借鉴 cc 对应命令）
  - [ ] SubTask 10.1: 创建 `web/src/commands/help.tsx`，借鉴 cc `commands/help/help.tsx`：LocalJSXCommand，渲染帮助弹窗列出所有命令
  - [ ] SubTask 10.2: 创建 `web/src/commands/clear.ts`，借鉴 cc `commands/clear/`：LocalCommand，清空当前会话 messages
  - [ ] SubTask 10.3: 创建 `web/src/commands/compact.ts`，借鉴 cc `commands/compact/`：LocalCommand，触发压缩（模型 summarize 历史）
  - [ ] SubTask 10.4: 创建 `web/src/commands/model.tsx`，借鉴 cc `commands/model/`：LocalJSXCommand，渲染模型选择弹窗
  - [ ] SubTask 10.5: 创建 `web/src/commands/cost.tsx`，借鉴 cc `commands/cost/`：LocalJSXCommand，渲染用量统计
  - [ ] SubTask 10.6: 创建 `web/src/commands/status.tsx`，借鉴 cc `commands/status/`：LocalJSXCommand，渲染会话状态
  - [ ] SubTask 10.7: 创建 `web/src/commands/init.ts`，借鉴 cc `commands/init/`：PromptCommand，生成项目配置文件到虚拟文件系统
  - [ ] SubTask 10.8: 创建 `web/src/commands/review.ts`，借鉴 cc `commands/review/`：PromptCommand，展开为代码审查 prompt

## 阶段五：消息与 Markdown 渲染（借鉴 cc components/）

- [x] Task 11: 重写消息渲染（借鉴 Message.tsx + messages/）
  - [x] SubTask 11.1: 重写 `web/src/components/Message.tsx`，借鉴 cc `src/components/Message.tsx` 的 `switch (message.type)` 分发：user → UserTextMessage、assistant → AssistantMessageBlock、tool_result → UserToolResultMessage、system → SystemTextMessage
  - [x] SubTask 11.2: 创建 `web/src/components/messages/` 目录，借鉴 cc 子组件：`AssistantTextMessage.tsx`、`AssistantToolUseMessage.tsx`、`UserToolResultMessage.tsx`、`UserTextMessage.tsx`、`SystemTextMessage.tsx`
  - [x] SubTask 11.3: 借鉴 cc `Tool.renderToolUseMessage()` / `renderToolResultMessage()`，每个工具自定义渲染（TodoWrite 显示 todo 列表，FileRead 显示文件路径等）
  - [x] SubTask 11.4: 借鉴 cc `inProgressToolUseIDs`，显示工具执行中的 spinner

- [x] Task 12: 重写 Markdown 渲染（借鉴 Markdown.tsx）
  - [ ] SubTask 12.1: 重写 `web/src/components/Markdown.tsx`，借鉴 cc `src/components/Markdown.tsx`：token LRU 缓存（500 条 Map，按 hashContent key）
  - [ ] SubTask 12.2: 借鉴 cc `marked.lexer()` 分块解析
  - [ ] SubTask 12.3: 借鉴 cc `MarkdownTable` 组件，单独渲染表格支持横向滚动
  - [ ] SubTask 12.4: 借鉴 cc 异步语法高亮（`Suspense` + `highlight.js`）
  - [ ] SubTask 12.5: 导出 `Markdown`、`MarkdownBody`、`MarkdownWithHighlight`

## 阶段六：会话管理与压缩（借鉴 cc utils/sessionStorage.ts + compact/）

- [x] Task 13: 实现会话持久化（借鉴 sessionStorage.ts）
  - [ ] SubTask 13.1: 创建 `web/src/services/sessionStorage.ts`，借鉴 cc `utils/sessionStorage.ts`：`recordTranscript()`、`readTranscriptForLoad()`、`parseJSONL()`，localStorage 适配
  - [ ] SubTask 13.2: 借鉴 cc `sessionRestore.ts`，实现会话恢复：从 JSONL 重建 `Message[]`

- [x] Task 14: 实现上下文压缩（借鉴 compact/）
  - [ ] SubTask 14.1: 创建 `web/src/services/tokenEstimate.ts`，借鉴 cc `utils/tokens.ts` 的 `tokenCountWithEstimation()`（Web 用字符数/4 估算）
  - [ ] SubTask 14.2: 创建 `web/src/services/compact.ts`，借鉴 cc `services/compact/autoCompact.ts`：token 阈值触发模型 summarize
  - [ ] SubTask 14.3: 借鉴 cc `microCompact.ts`，裁剪 tool_result 内容
  - [ ] SubTask 14.4: 借鉴 cc `snipCompact.ts`，snip 压缩

## 阶段七：系统提示词（借鉴 cc prompts.ts + systemPrompt.ts）

- [x] Task 15: 实现系统提示词组装（借鉴 prompts.ts）
  - [ ] SubTask 15.1: 创建 `web/src/services/systemPrompt.ts`，借鉴 cc `utils/systemPrompt.ts` 的 `buildEffectiveSystemPrompt()` 优先级链：override > custom > default > append
  - [ ] SubTask 15.2: 借鉴 cc `constants/prompts.ts` 的 `getSystemPrompt()`，分段组装：工具说明（从 tools 注册表生成）+ Web 上下文说明（虚拟文件系统、CORS 约束）+ 用户自定义
  - [ ] SubTask 15.3: 借鉴 cc `systemPromptSections.ts` 的 `systemPromptSection()` / `resolveSystemPromptSections()`

## 阶段八：对话 Hook 与 ChatPanel 集成

- [x] Task 16: 实现 useChat hook（借鉴 QueryEngine）
  - [ ] SubTask 16.1: 创建 `web/src/hooks/useChat.ts`，借鉴 cc `src/QueryEngine.ts` 的对话循环：返回 `{ send, isLoading, error, abort }`
  - [ ] SubTask 16.2: `send(text)` 实现：追加 user 消息 → 组装 systemPrompt + tools + messages → 调用 `streamChat()`
  - [ ] SubTask 16.3: `onToken` 增量追加到 assistant 消息
  - [ ] SubTask 16.4: `onToolUse` 触发 `streamingToolExecutor` 执行工具，回填 tool_result，继续流式
  - [ ] SubTask 16.5: `onDone` 标记完成，`onError` 显示错误
  - [ ] SubTask 16.6: `abort()` 调用 AbortController.abort()
  - [ ] SubTask 16.7: 集成 autoCompact：token 超阈值时触发压缩

- [x] Task 17: 实现 useCanUseTool hook（借鉴 cc useCanUseTool）
  - [ ] SubTask 17.1: 创建 `web/src/hooks/useCanUseTool.tsx`，借鉴 cc `src/hooks/useCanUseTool.tsx`：权限确认 UI（DOM 适配），返回 `canUseTool(tool, input)` Promise

- [x] Task 18: 改造 ChatPanel（真实发送 + ModelSelector）
  - [ ] SubTask 18.1: ChatPanel 引入 `useChat` hook，textarea 双向绑定 useState
  - [ ] SubTask 18.2: send 按钮 onClick 调用 `send(text)`，发送后清空 textarea
  - [ ] SubTask 18.3: Enter 键发送（Shift+Enter 换行）
  - [ ] SubTask 18.4: isLoading 时禁用 send 按钮，显示 spinner
  - [ ] SubTask 18.5: error 时显示错误提示
  - [ ] SubTask 18.6: 创建 `web/src/components/workbench/ModelSelector.tsx`：Provider + Model 双下拉
  - [ ] SubTask 18.7: composer 底部集成 ModelSelector
  - [ ] SubTask 18.8: 当前会话 messages 从 SessionsState 读取

## 阶段九：Provider 配置 UI 与移除硬编码

- [x] Task 19: 实现 ProvidersSection 配置面板
  - [ ] SubTask 19.1: 创建 `web/src/components/settings/ProvidersSection.tsx`：Provider 列表（name、apiType、baseURL、model 数量、编辑/删除按钮）
  - [ ] SubTask 19.2: "Add Provider" 按钮弹出表单（name、apiType select、baseURL、apiKey、models 逗号分隔）
  - [ ] SubTask 19.3: 编辑表单预填字段，保存调用 updateProvider
  - [ ] SubTask 19.4: 删除带 confirm，删除当前选中 Provider 时自动切换 currentProviderId
  - [ ] SubTask 19.5: apiKey 用 `type="password"`，面板顶部显示安全提示

- [x] Task 20: 集成 ProvidersSection 到 Settings
  - [ ] SubTask 20.1: `web/src/components/settings/SettingsNav.tsx` 新增 `{ key: 'providers', icon: 'plug.svg', label: 'Providers' }`
  - [ ] SubTask 20.2: `web/src/components/settings/SettingsContent.tsx` 的 `SECTION_MAP` 新增 `providers: ProvidersSection`
  - [ ] SubTask 20.3: 修改 `ModelSection` 从 ProvidersState 读取当前 Provider 模型，显示 "Manage Providers →" 链接，移除硬编码 "Claude 4 Opus"

- [x] Task 21: 移除剩余硬编码假数据
  - [ ] SubTask 21.1: `web/src/pages/Sessions.tsx` 删除 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS`，改为从 `useSessions(s => s.sessions)` 读取，按 status 过滤
  - [ ] SubTask 21.2: `web/src/components/sessions/NewSessionModal.tsx` 删除 `MODELS`，改为从当前 Provider 的 models 读取
  - [ ] SubTask 21.3: NewSessionModal 的 Create 按钮调用 `createSession()`，跳转到 `/`
  - [ ] SubTask 21.4: `web/src/components/settings/SettingsContent.tsx` 的 GeneralSection 等所有硬编码模型值改为动态读取

## 阶段十：App 集成与构建验证

- [x] Task 22: App 集成所有 Provider
  - [ ] SubTask 22.1: `web/src/App.tsx` 在 `WorkspaceStateProvider` 内层包裹 `ProvidersStateProvider` 和 `SessionsStateProvider`
  - [ ] SubTask 22.2: WorkspaceState 的 currentProviderId/currentModel/currentSessionId 持久化到 localStorage（key: `cc-webui-workspace`）
  - [ ] SubTask 22.3: 启动时从 localStorage 恢复，currentProviderId 指向的 Provider 不存在时回退到第一个

- [x] Task 23: 构建验证
  - [ ] SubTask 23.1: 执行 `cd /workspace/web && bun run build` 确认 tsc + vite build 通过
  - [ ] SubTask 23.2: 启动 dev server，手动验证：添加 Provider → 发送消息 → 流式响应 → 工具调用 → 会话持久化
  - [ ] SubTask 23.3: 验证 slash 命令：/help、/clear、/model、/compact
  - [ ] SubTask 23.4: 验证多 Provider 切换、Model 切换
  - [ ] SubTask 23.5: 验证虚拟文件系统工具：FileRead/FileWrite/FileEdit/Glob/Grep
  - [ ] SubTask 23.6: 验证 TodoWriteTool、AskUserQuestionTool、WebFetchTool

# Task Dependencies

- Task 2 依赖 Task 1（Provider 类型）
- Task 3 依赖 Task 1（ChatSession 类型）
- Task 4 依赖 Task 1（Message 类型）+ Task 2（Provider）
- Task 5 独立（借鉴 withRetry/errors）
- Task 6 依赖 Task 1（Message 类型）
- Task 7 依赖 Task 1（ToolUseContext）+ Task 6（messageUtils）
- Task 8 依赖 Task 7（Tool 接口）
- Task 9 依赖 Task 1（Command 类型）
- Task 10 依赖 Task 9（命令注册表）
- Task 11 依赖 Task 7（Tool.renderToolUseMessage）+ Task 8（工具实例）
- Task 12 独立（Markdown 渲染）
- Task 13 依赖 Task 3（SessionsState）
- Task 14 依赖 Task 4（chatClient，压缩需调用模型）
- Task 15 依赖 Task 7（工具说明从 tools 生成）
- Task 16 依赖 Task 4 + Task 7 + Task 13 + Task 14 + Task 15
- Task 17 依赖 Task 7（ToolUseContext）
- Task 18 依赖 Task 16 + Task 17 + Task 2（ModelSelector）
- Task 19 依赖 Task 2（ProvidersState）
- Task 20 依赖 Task 19
- Task 21 依赖 Task 2 + Task 3
- Task 22 依赖 Task 1-21
- Task 23 依赖 Task 22
- 可并行：Task 5 + Task 12 + Task 15（无相互依赖）
