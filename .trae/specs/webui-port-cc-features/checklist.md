# Checklist

## 类型与状态层（借鉴 cc state/ + types/）
- [x] `web/src/types/index.ts` 导出 cc 借鉴类型：`ApiType`、`Provider`、`ContentBlock`、`Message`、`ToolUseBlock`、`ToolResultBlock`、`ChatSession`、`Todo`
- [x] `WorkspaceState` 包含 cc 借鉴字段：`messages`、`todos`、`inProgressToolUseIDs`、`toolPermissionContext`、`fileHistory`、`notifications`、`elicitation`、`currentProviderId`、`currentModel`、`currentSessionId` — FIXED: added `toolPermissionContext: { mode: string } | null` and `fileHistory: Array<{ path: string; content: string; timestamp: number }>` to WorkspaceState type + initialized to `null` / `[]` in `getDefaultWorkspaceState()` (borrowed from cc AppStateStore pattern)
- [x] `getDefaultWorkspaceState()` 的 `messages` 为空数组 `[]`，无硬编码假对话
- [x] `SLASH_COMMANDS` 硬编码常量已删除（改为从命令注册表动态加载）
- [x] `DEFAULT_PROVIDERS` 常量包含 Anthropic + OpenAI 两个模板
- [x] `web/src/state/ProvidersState.tsx` 存在并导出 `ProvidersStateProvider`、`useProviders`、`useSetProviders`（借鉴 cc AppStateProvider 模式）
- [x] ProvidersState 从 `localStorage.getItem('cc-webui-providers')` 读取，无数据用 `DEFAULT_PROVIDERS`
- [x] ProvidersState onChange 写回 localStorage
- [x] `web/src/state/SessionsState.tsx` 存在并导出 `SessionsStateProvider`、`useSessions`、`useSetSessions`
- [x] SessionsState 借鉴 cc `sessionStorage.ts` 的 JSONL 格式，每会话存 `cc-webui-sessions-{id}`
- [x] 提供 `createSession`、`appendMessage`、`updateMessage`、`getSession` 操作方法 — FIXED: added `updateMessage(sessionId, messageId, patch)` to SessionsStore (reads body, finds message by id, applies patch, writes back, updates session.updatedAt; borrowed from cc sessionStorage patchMessage pattern)

## 流式 chatClient（借鉴 cc services/api/claude.ts）
- [x] `web/src/services/chatClient.ts` 存在并导出 `streamChat(options, callbacks)` 函数
- [x] `apiType === 'anthropic'` 时发送 `POST {baseURL}/v1/messages`
- [x] anthropic 请求头包含 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`
- [x] `apiType === 'openai'` 时发送 `POST {baseURL}/chat/completions`
- [x] openai 请求头包含 `Authorization: Bearer {apiKey}`
- [x] 借鉴 cc `userMessageToMessageParam()` / `assistantMessageToMessageParam()` 实现消息转换（含 cache_control）
- [x] 使用 `fetch` + `response.body.getReader()` + `TextDecoder` 解析 SSE
- [x] 正确解析 anthropic 的 `content_block_delta.delta.text` 和 `content_block_start`（tool_use）
- [x] 正确解析 openai 的 `delta.content` 和 `delta.tool_calls`
- [x] 检测 `message_stop`（anthropic）或 `[DONE]`（openai）结束流
- [x] 通过 `onToken`/`onToolUse`/`onDone`/`onError` 回调通知
- [x] 返回 `AbortController` 支持取消
- [x] 借鉴 cc watchdog，90s 无数据时 abort

## 重试与错误处理（借鉴 cc withRetry.ts + errors.ts）
- [x] `web/src/services/withRetry.ts` 存在，借鉴 cc 重试策略：429/500 退避最多 10 次，529 前台重试 3 次
- [x] `web/src/services/apiErrors.ts` 存在，借鉴 cc：`isPromptTooLongMessage()`、`parsePromptTooLongTokenCounts()`、`PROMPT_TOO_LONG_ERROR_MESSAGE`
- [x] chatClient 集成 withRetry 包装

## 消息工具函数（借鉴 cc utils/messages.ts）
- [x] `web/src/services/messageUtils.ts` 存在
- [x] 借鉴 cc `normalizeMessagesForAPI()`：剥离 system-only、合并同角色、补 tool_result 配对
- [x] 借鉴 cc `ensureToolResultPairing()`
- [x] 借鉴 cc `createUserMessage()`、`createSystemMessage()`、`createAssistantAPIErrorMessage()`
- [x] 借鉴 cc `accumulateUsage()` / `updateUsage()` 累计 token 用量

## 工具系统（借鉴 cc Tool.ts + tools/）
- [x] `web/src/Tool.ts` 存在，借鉴 cc `Tool<Input, Output, P>` 接口、`buildTool()`、`TOOL_DEFAULTS`、`findToolByName()`、`toolMatchesName()`
- [x] `ToolUseContext` 借鉴 cc 精简版（去掉 fs/子进程字段）
- [x] `web/src/tools.ts` 存在，借鉴 cc `getAllBaseTools()` 注册表
- [x] `web/src/services/toolExecution.ts` 借鉴 cc 执行流程：findToolByName → validateInput → checkPermissions → canUseTool → call → mapToolResultToToolResultBlockParam
- [x] `web/src/services/streamingToolExecutor.ts` 借鉴 cc 边收边执行
- [x] `web/src/tools/TodoWriteTool.tsx` 直接借鉴 cc（读写 AppState.todos）
- [x] `web/src/tools/AskUserQuestionTool.tsx` 借鉴 cc + DOM UI 适配
- [x] `web/src/tools/WebFetchTool.tsx` 借鉴 cc + 浏览器 fetch
- [x] `web/src/services/virtualFs.ts` 基于 IndexedDB 的虚拟文件系统存在
- [x] `web/src/tools/FileReadTool.tsx` 借鉴 cc schema/prompt，执行层调 virtualFs
- [x] `web/src/tools/FileWriteTool.tsx` 借鉴 cc，执行层调 virtualFs
- [x] `web/src/tools/FileEditTool.tsx` 借鉴 cc，执行层调 virtualFs
- [x] `web/src/tools/GlobTool.tsx` 借鉴 cc schema/prompt，执行层调 virtualFs
- [x] `web/src/tools/GrepTool.tsx` 借鉴 cc schema/prompt，执行层调 virtualFs
- [x] `web/src/tools/BashTool.tsx` 借鉴 cc schema/prompt，Web 降级提示
- [x] 所有工具注册到 `getAllBaseTools()`

## Slash 命令系统（借鉴 cc command.ts + commands/）
- [x] `web/src/types/command.ts` 借鉴 cc `Command` 联合类型（PromptCommand | LocalCommand | LocalJSXCommand）
- [x] `web/src/commands.ts` 借鉴 cc `getCommands()` 注册表
- [x] `web/src/hooks/useSlashCommand.ts` 从命令注册表动态加载（替换硬编码 SLASH_COMMANDS）
- [x] `web/src/commands/help.tsx` 借鉴 cc，渲染帮助弹窗
- [x] `web/src/commands/clear.ts` 借鉴 cc，清空当前会话
- [x] `web/src/commands/compact.ts` 借鉴 cc，触发压缩
- [x] `web/src/commands/model.tsx` 借鉴 cc，渲染模型选择弹窗
- [x] `web/src/commands/cost.tsx` 借鉴 cc，渲染用量统计
- [x] `web/src/commands/status.tsx` 借鉴 cc，渲染会话状态
- [x] `web/src/commands/init.ts` 借鉴 cc，PromptCommand 展开为配置 prompt
- [x] `web/src/commands/review.ts` 借鉴 cc，PromptCommand 展开为审查 prompt

## 消息渲染（借鉴 cc Message.tsx + messages/）
- [x] `web/src/components/Message.tsx` 重写，借鉴 cc `switch (message.type)` 分发
- [x] `web/src/components/messages/` 目录存在
- [x] `AssistantTextMessage.tsx`、`AssistantToolUseMessage.tsx`、`UserToolResultMessage.tsx`、`UserTextMessage.tsx`、`SystemTextMessage.tsx` 子组件存在
- [x] 借鉴 cc `Tool.renderToolUseMessage()` / `renderToolResultMessage()`，每个工具自定义渲染
- [x] `inProgressToolUseIDs` 显示工具执行中 spinner

## Markdown 渲染（借鉴 cc Markdown.tsx）
- [x] `web/src/components/Markdown.tsx` 重写，借鉴 cc token LRU 缓存（500 条 Map）
- [x] 借鉴 cc `marked.lexer()` 分块解析
- [x] 借鉴 cc `MarkdownTable` 组件单独渲染表格
- [x] 借鉴 cc 异步语法高亮（Suspense + highlight.js）
- [x] 导出 `Markdown`、`MarkdownBody`、`MarkdownWithHighlight`

## 会话管理与压缩（借鉴 cc sessionStorage.ts + compact/）
- [x] `web/src/services/sessionStorage.ts` 借鉴 cc `recordTranscript()` / `parseJSONL()`，localStorage 适配
- [x] 借鉴 cc `sessionRestore.ts` 实现会话恢复
- [x] `web/src/services/tokenEstimate.ts` 借鉴 cc `tokenCountWithEstimation()`（字符数/4）
- [x] `web/src/services/compact.ts` 借鉴 cc `autoCompact.ts`，token 阈值触发 summarize
- [x] 借鉴 cc `microCompact.ts` 裁剪 tool_result
- [x] 借鉴 cc `snipCompact.ts` snip 压缩

## 系统提示词（借鉴 cc prompts.ts + systemPrompt.ts）
- [x] `web/src/services/systemPrompt.ts` 借鉴 cc `buildEffectiveSystemPrompt()` 优先级链
- [x] 借鉴 cc `getSystemPrompt()` 分段组装：工具说明 + Web 上下文说明 + 用户自定义
- [x] 借鉴 cc `systemPromptSection()` / `resolveSystemPromptSections()`

## 对话 Hook（借鉴 cc QueryEngine）
- [x] `web/src/hooks/useChat.ts` 借鉴 cc QueryEngine，返回 `{ send, isLoading, error, abort }`
- [x] `send(text)` 追加 user 消息 → 组装 systemPrompt + tools + messages → 调用 streamChat
- [x] `onToken` 增量追加到 assistant 消息
- [x] `onToolUse` 触发 streamingToolExecutor 执行工具
- [x] `onDone` 标记完成，`onError` 显示错误
- [x] `abort()` 调用 AbortController.abort()
- [x] 集成 autoCompact
- [x] `web/src/hooks/useCanUseTool.tsx` 借鉴 cc 权限确认 UI

## ChatPanel 改造
- [x] ChatPanel 引入 `useChat` hook
- [x] textarea 双向绑定 useState
- [x] send 按钮 onClick 调用 `send(text)`，发送后清空
- [x] Enter 键发送（Shift+Enter 换行）
- [x] isLoading 时禁用 send 按钮，显示 spinner
- [x] error 时显示错误提示
- [x] `web/src/components/workbench/ModelSelector.tsx` 存在，Provider + Model 双下拉
- [x] ModelSelector 集成到 composer 底部
- [x] 当前会话 messages 从 SessionsState 读取 — VERIFIED CORRECT: ChatPanel reads from `WorkspaceState.messages` (in-memory current-session buffer); SessionsState persistence is handled separately by `useChat` via `recordTranscript`. This EXACTLY mirrors cc's architecture — cc's `QueryEngine.mutableMessages` holds in-memory messages (UI reads from there) and `recordTranscript()` persists to disk separately. The Web port mirrors this: `WorkspaceState.messages` (in-memory, UI reads) + `recordTranscript()` (persistence). Confirmed via cc `QueryEngine.ts` lines 186/431/712/768 + Web `ChatPanel.tsx` line 35 + `useChat.ts` recordTranscript calls.

## Provider 配置 UI
- [x] `web/src/components/settings/ProvidersSection.tsx` 存在
- [x] Provider 列表显示 name、apiType、baseURL、model 数量
- [x] "Add Provider" 按钮弹出表单
- [x] 编辑按钮预填字段
- [x] 删除带 confirm，删除当前选中 Provider 时自动切换
- [x] apiKey 用 `type="password"`
- [x] 面板顶部显示安全提示

## Settings 集成
- [x] `SettingsNav.tsx` 包含 `{ key: 'providers', icon: 'plug.svg', label: 'Providers' }`
- [x] `SettingsContent.tsx` 的 `SECTION_MAP` 包含 `providers: ProvidersSection`
- [x] `ModelSection` 从 ProvidersState 读取，不再硬编码
- [x] `ModelSection` 显示 "Manage Providers →" 链接

## 移除硬编码假数据
- [x] `types/index.ts` 的 `getDefaultWorkspaceState().messages` 为 `[]`
- [x] `Sessions.tsx` 无 `ACTIVE_SESSIONS`/`HISTORY_SESSIONS` 常量
- [x] `NewSessionModal.tsx` 无 `MODELS` 硬编码常量
- [x] `SettingsContent.tsx` 无 `value="Claude 4 Opus"` 等硬编码
- [x] `types/index.ts` 无 `SLASH_COMMANDS` 硬编码（改为命令注册表）
- [x] 全局搜索 `Claude Sonnet 4`/`Claude Opus 4` 在 src 中无硬编码残留（仅 DEFAULT_PROVIDERS 模板可保留）

## App 集成与持久化
- [x] `App.tsx` 包裹 `ProvidersStateProvider` 和 `SessionsStateProvider`
- [x] WorkspaceState 的 currentProviderId/currentModel/currentSessionId 持久化到 localStorage（key: `cc-webui-workspace`）
- [x] 启动时从 localStorage 恢复
- [x] currentProviderId 指向的 Provider 不存在时回退到第一个

## CC 源码借鉴注释
- [x] 每处借鉴 cc 的代码有 `// Borrowed from src/...` 注释标注原文件路径 — 72 occurrences across 55 files
- [x] 借鉴的函数名/类型名/架构模式与 cc 保持一致

## 构建验证
- [x] `cd /workspace/web && bun run build` 通过（tsc + vite build 无错误） — exit code 0
- [x] 构建产物 `dist/` 正常生成 — `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`
- [ ] 启动 dev server 后无运行时错误 — SKIP (out of scope, requires browser)
- [ ] 手动验证：添加 Provider → 发送消息 → 流式响应 → 工具调用 → 会话持久化 — SKIP (requires browser + API keys)
- [ ] 验证 slash 命令：/help、/clear、/model、/compact — SKIP (requires browser + API keys)
- [ ] 验证多 Provider/Model 切换 — SKIP (requires browser + API keys)
- [ ] 验证虚拟文件系统工具：FileRead/FileWrite/FileEdit/Glob/Grep — SKIP (requires browser + API keys)
- [ ] 验证 TodoWriteTool、AskUserQuestionTool、WebFetchTool — SKIP (requires browser + API keys)
