# free-code 架构总览

> 本文档基于对 `/workspace` 源码的实际阅读与 Glob 校验撰写，覆盖四个层面：**入口与主循环**、**命令与工具体系**、**服务与子系统**、**构建与运行时**。
>
> 项目身份：`free-code` —— Anthropic **Claude Code** CLI 的可构建重构分叉（`package.json` 名 `claude-code-source-snapshot`，版本 `2.1.87`）。上游源码于 2026-03-31 经 npm source map 暴露后公开，本分叉在其基础上做了三类改动：**移除遥测**、**移除安全提示护栏**、**解锁实验特性开关**。

---

## 1. 项目概览

### 1.1 定位
一个终端原生的 AI 编码 Agent（TypeScript + Bun + React/Ink）。一个二进制，零回传。支持 5 个模型 Provider，88 个编译期特性开关（54 个可干净打包）。

### 1.2 技术栈

| 维度 | 选型 |
|---|---|
| 运行时 | [Bun](https://bun.sh) ≥ 1.3.11 |
| 语言 | TypeScript（`type: module`） |
| 终端 UI | React 19 + [Ink](https://github.com/vadimdemedes/ink) 6，**自带定制实现** [src/ink/](file:///workspace/src/ink) |
| CLI 解析 | `@commander-js/extra-typings` |
| Schema | Zod v4 |
| 代码搜索 | ripgrep（bundled） |
| 协议 | MCP（`@modelcontextprotocol/sdk`）、LSP（`vscode-languageserver-*`） |
| 多 Provider SDK | `@anthropic-ai/sdk`、`@anthropic-ai/bedrock-sdk`、`@anthropic-ai/vertex-sdk`、`@anthropic-ai/foundry-sdk`、`@anthropic-ai/claude-agent-sdk`、`@anthropic-ai/sandbox-runtime` |
| 遥测 | OpenTelemetry 全家桶（本分叉已 stub，不外发）、GrowthBook（本地评估保留） |

### 1.3 Provider 矩阵
路由逻辑在 [providers.ts](file:///workspace/src/utils/model/providers.ts) 的 `getAPIProvider()`，按 env 优先级判定：`CLAUDE_CODE_USE_BEDROCK` > `..._VERTEX` > `..._FOUNDRY` > `..._OPENAI` > 默认 `firstParty`。详细 env 变量与模型 ID 映射见 [README.md](file:///workspace/README.md) 的 Model Providers 章节。

### 1.4 ⚠️ 重要 caveat：快照不完整
本仓库是**部分重构快照**，并非所有被引用的源文件都存在。已确认缺失的**核心工具入口文件**（被 [tools.ts](file:///workspace/src/tools.ts) 导入但文件不存在）：

- [src/tools/BashTool/BashTool.ts](file:///workspace/src/tools/BashTool/BashTool.ts) —— 缺失（仅存辅助文件 `bashSecurity.ts`/`bashPermissions.ts`/`commandSemantics.ts` 等）
- [src/tools/AgentTool/AgentTool.ts](file:///workspace/src/tools/AgentTool/AgentTool.ts) —— 缺失（仅存 `runAgent.ts`/`builtInAgents.ts`/`loadAgentsDir.ts` 等辅助文件）
- [src/tools/AskUserQuestionTool/AskUserQuestionTool.ts](file:///workspace/src/tools/AskUserQuestionTool/AskUserQuestionTool.ts) —— 缺失（仅存 `prompt.ts`）

**结论：项目当前无法直接 `bun build` 通过**，需先重建上述入口文件（与 [FEATURES.md](file:///workspace/FEATURES.md) 中「Broken Flags With Easy Reconstruction Paths」同类问题）。下文架构描述以「设计意图 + 已存在代码」为准。

---

## 2. 顶层目录结构

```
/workspace
├── scripts/build.ts          # 构建脚本 + 特性开关打包器
├── assets/screenshot.png
├── src/
│   ├── entrypoints/          # CLI/MCP/SDK 入口（cli.tsx 是主入口）
│   ├── main.tsx              # Commander 解析 + 启动预热 + launchRepl
│   ├── replLauncher.tsx      # 渲染 <App><REPL/></App>
│   ├── screens/              # 顶层屏幕：REPL.tsx / Doctor.tsx / ResumeConversation.tsx
│   ├── QueryEngine.ts        # 消息流/工具调用/模型调用协调器
│   ├── query.ts              # 核心流式查询循环
│   ├── Tool.ts               # Tool/Tools/ToolUseContext 类型契约
│   ├── commands.ts           # 斜杠命令注册表
│   ├── tools.ts              # Agent 工具注册表
│   ├── tasks.ts / Task.ts    # 后台任务注册与类型
│   ├── cost-tracker.ts       # 成本累计
│   ├── history.ts            # 提示历史
│   ├── context.ts            # 系统/用户上下文组装
│   ├── bootstrap/state.ts    # 全局可变状态（cwd/cost/session/turn 计时…）
│   ├── state/                # React AppState 层（AppStateStore/selectors）
│   ├── components/           # 150+ Ink/React 终端组件
│   ├── hooks/                # 90+ React hooks
│   ├── ink/                  # 定制 Ink 渲染器（reconciler/dom/selection/hit-test）
│   ├── commands/             # 60+ 斜杠命令实现（每命令一目录 + index.ts）
│   ├── tools/                # Agent 工具实现（每工具一目录）
│   ├── services/             # API/MCP/compact/analytics/oauth 等服务层
│   ├── constants/            # prompts/system/xml/keys/messages 等常量
│   ├── utils/                # 200+ 工具模块（含 model/ permissions/ settings/ swarm/）
│   ├── bridge/               # IDE 远控桥（VS Code/JetBrains）
│   ├── remote/               # RemoteSessionManager / WebSocket
│   ├── server/               # directConnect 会话
│   ├── skills/  plugins/     # 技能 / 插件扩展系统
│   ├── memdir/               # 记忆目录（CLAUDE.md / 团队记忆）
│   ├── tasks/                # 后台任务实现（LocalAgent/InProcessTeammate…）
│   ├── keybindings/  vim/    # 键绑定 / vim 模式
│   ├── voice/                # 语音输入
│   ├── coordinator/ assistant/ buddy/  # feature 门控的实验栈
│   ├── upstreamproxy/        # 上游代理中继
│   ├── migrations/           # 设置/模型迁移
│   ├── query/                # 查询配置/依赖/stopHooks/tokenBudget
│   ├── context/              # React Context（notifications/modal/stats/voice…）
│   ├── types/                # 共享类型（command/permissions/hooks/ids…）
│   └── schemas/              # hooks schema
└── package.json  tsconfig.json  CLAUDE.md  FEATURES.md  README.md
```

---

## 3. 入口与主循环

### 3.1 启动链路

```
src/entrypoints/cli.tsx  ──(快路径分流)──▶  src/main.tsx  ──▶  replLauncher.tsx  ──▶  screens/REPL.tsx
                                                              │
                              Commander 解析 + 并行预热          ▼
                              init() → launchRepl()        QueryEngine.ts ──▶ query.ts（流式循环）
```

**[cli.tsx](file:///workspace/src/entrypoints/cli.tsx)** —— bootstrap 入口，所有重导入都是动态的，以最小化快路径模块加载：
- `--version`/`-v`：零导入，直接打印 `MACRO.VERSION`。
- `feature('DUMP_SYSTEM_PROMPT')` + `--dump-system-prompt`：渲染系统提示并退出。
- `--claude-in-chrome-mcp` / `--chrome-native-host`：Chrome 集成 MCP server。
- `feature('CHICAGO_MCP')` + `--computer-use-mcp`：computer-use MCP server。
- `feature('ABLATION_BASELINE')`：注入简化开关 env。
- 其余：`import('../main.tsx')`。

**[main.tsx](file:///workspace/src/main.tsx)** —— Commander.js 解析 CLI 参数；**并行预热**（在 ~135ms 的 import 窗口内并发跑）：
- `startMdmRawRead()`（MDM 子进程 plutil/reg query）
- `startKeychainPrefetch()`（macOS keychain OAuth + legacy API key）
- `fetchBootstrapData()`、`prefetchOfficialMcpUrls()`、`prefetchAwsCredentialsAndBedRockInfoIfSafe()`、`prefetchGcpCredentialsIfSafe()`
- `initializeGrowthBook()`、`loadPolicyLimits()`、`loadRemoteManagedSettings()`
- 之后 `init()` → `launchRepl()`。

**[replLauncher.tsx](file:///workspace/src/replLauncher.tsx)** —— 动态 `import('./components/App.js')` 与 `./screens/REPL.js`，`renderAndRun(root, <App><REPL/></App>)`。

### 3.2 主 UI：[REPL.tsx](file:///workspace/src/screens/REPL.tsx)
Ink/React 主交互屏幕，职责极重：
- **系统提示组装**：`getSystemPrompt()`（[constants/prompts.ts](file:///workspace/src/constants/prompts.ts)）+ `buildEffectiveSystemPrompt()`（[utils/systemPrompt.ts](file:///workspace/src/utils/systemPrompt.ts)）+ `getMemoryFiles()`（[utils/claudemd.ts](file:///workspace/src/utils/claudemd.ts)）+ `loadMemoryPrompt()`（[memdir/](file:///workspace/src/memdir)）。
- 消息列表渲染（`VirtualMessageList`）、`MessageSelector` 过滤。
- 权限请求 UI（`PermissionRequest`、`WorkerPendingPermission`）、工具确认队列（`useCanUseTool`）。
- 远程/SSH/直连会话（`useRemoteSession`/`useSSHSession`/`useDirectConnect`）。
- teammate/swarm 协作（`injectUserMessageToTeammate`、`registerLeaderToolUseConfirmQueue`）。
- cost 阈值对话框、空闲返回、teleport/resume、IDE 集成日志。

### 3.3 查询引擎：[QueryEngine.ts](file:///workspace/src/QueryEngine.ts) → [query.ts](file:///workspace/src/query.ts)
- `QueryEngine` 协调消息流、工具调用、模型调用；消费 `query()`；处理 SDK 消息映射、compact 边界、文件历史快照（`fileHistoryMakeSnapshot`）、scratchpad、usage 累计（`accumulateUsage`/`updateUsage`）。
- `query.ts` 是**核心流式循环**：处理 `StreamEvent`、回填工具结果、判定 auto-compact（[services/compact/autoCompact.ts](file:///workspace/src/services/compact/autoCompact.ts)）、microcompact、`feature('REACTIVE_COMPACT')`/`feature('CONTEXT_COLLAPSE')` 门控路径、生成 toolUseSummary（[services/toolUseSummary/](file:///workspace/src/services/toolUseSummary)）、错误分类与重试（[services/api/errors.ts](file:///workspace/src/services/api/errors.ts) + [withRetry.ts](file:///workspace/src/services/api/withRetry.ts)）。

### 3.4 一次对话的数据流
1. 用户在 `PromptInput` 输入 → `processUserInput()`（[utils/processUserInput/](file:///workspace/src/utils/processUserInput)）解析 `@文件`/`#记忆`/斜杠命令。
2. `QueryEngine` 组装 messages + system prompt + tools（来自 [tools.ts](file:///workspace/src/tools.ts) `getTools()`）。
3. 调 `query()` → [services/api/claude.ts](file:///workspace/src/services/api/claude.ts) 按 `getAPIProvider()` 路由到对应 SDK，流式返回。
4. 模型产出 `tool_use` 块 → [services/tools/toolExecution.ts](file:///workspace/src/services/tools/toolExecution.ts) 经 `useCanUseTool` 权限校验后执行 → 结果作为 `tool_result` 回填 → 继续流式循环，直到 `stop_reason` 非 `tool_use`。
5. 全程 `bootstrap/state.ts` 累计 cost/usage/turn 计时；`cost-tracker.ts` 汇总。

### 3.5 全局状态
- **[bootstrap/state.ts](file:///workspace/src/bootstrap/state.ts)**：模块级可变全局状态（`originalCwd`/`projectRoot`/`totalCostUSD`/turn 计时/session id/hooks/channels…）。文件顶部明确注释 **「DO NOT ADD MORE STATE HERE」**——新增全局状态需极审慎。
- **[state/AppState.tsx](file:///workspace/src/state/AppState.tsx)** + **[AppStateStore.ts](file:///workspace/src/state/AppStateStore.ts)**：React 层状态，供 UI 订阅。

---

## 4. 命令与工具体系

### 4.1 注册机制（DCE 模式）
[commands.ts](file:///workspace/src/commands.ts) 与 [tools.ts](file:///workspace/src/tools.ts) 大量使用两种条件 `require` 做**死代码消除**：

```ts
// 1) 编译期 feature flag（bun:bundle 的 feature()）
const bridge = feature('BRIDGE_MODE') ? require('./commands/bridge/index.js').default : null
const cronTools = feature('AGENT_TRIGGERS') ? [/* CronCreate/Delete/List */] : []

// 2) 运行时 USER_TYPE（ant 内部 vs external）
const REPLTool = process.env.USER_TYPE === 'ant' ? require('./tools/REPLTool/REPLTool.js').REPLTool : null
```

`feature('FLAG')` 由 `bun build --feature=FLAG` 注入，未启用的分支在打包时被 DCE 移除；`USER_TYPE` 经 build.ts 的 `defines` 固化为 `'external'`。

### 4.2 斜杠命令清单（[src/commands/](file:///workspace/src/commands)）
60+ 命令，每命令一目录带 `index.ts`。按类别：

| 类别 | 代表命令 |
|---|---|
| 会话/历史 | `clear` `resume` `session` `rename` `rewind` `export` `compact` |
| 模型/成本 | `model` `cost` `usage` `stats` `extra-usage` `effort` `fast` |
| 上下文/记忆 | `context` `memory` `add-dir` `files` `ctx_viz` `diff` |
| MCP/IDE | `mcp` `ide` `install-github-app` `install-slack-app` |
| 配置/诊断 | `config` `doctor` `login` `logout` `permissions` `privacy-settings` `hooks` `keybindings` `vim` `theme` `color` `terminalSetup` |
| 集成 | `desktop` `mobile` `chrome` `teleport` `branch` `pr_comments` `agents` `tasks` `skills` `passes` `remote-env` `remote-setup` `sandbox-toggle` `upgrade` `release-notes` |
| 实验/feature 门控 | `bridge` `voice` `plan` `tags` `stickers` `thinkback` `heapdump` `btw` `feedback` `help` `exit` `reload-plugins` |

### 4.3 Agent 工具清单（[src/tools/](file:///workspace/src/tools)）
**核心工具**（入口文件已存在）：

| 工具 | 入口 | 说明 |
|---|---|---|
| FileRead | [FileReadTool.ts](file:///workspace/src/tools/FileReadTool/FileReadTool.ts) | 读文件/图片/PDF |
| FileEdit | [FileEditTool.ts](file:///workspace/src/tools/FileEditTool/FileEditTool.ts) | 精确字符串替换 |
| FileWrite | [FileWriteTool.ts](file:///workspace/src/tools/FileWriteTool/FileWriteTool.ts) | 写文件 |
| Glob | [GlobTool.ts](file:///workspace/src/tools/GlobTool/GlobTool.ts) | 文件名匹配 |
| Grep | [GrepTool.ts](file:///workspace/src/tools/GrepTool/GrepTool.ts) | 内容搜索（ripgrep） |
| NotebookEdit | [NotebookEditTool.ts](file:///workspace/src/tools/NotebookEditTool/NotebookEditTool.ts) | Jupyter notebook 编辑 |
| WebFetch | [WebFetchTool.ts](file:///workspace/src/tools/WebFetchTool/WebFetchTool.ts) | 抓取 URL |
| WebSearch | [WebSearchTool.ts](file:///workspace/src/tools/WebSearchTool/WebSearchTool.ts) | 网络搜索 |
| TodoWrite | [TodoWriteTool.ts](file:///workspace/src/tools/TodoWriteTool/TodoWriteTool.ts) | 任务清单 |
| MCP | [MCPTool.ts](file:///workspace/src/tools/MCPTool/MCPTool.ts) | 调用 MCP server 工具 |
| LSP | [LSPTool.ts](file:///workspace/src/tools/LSPTool/LSPTool.ts) | LSP 诊断/符号 |
| Skill | [SkillTool.ts](file:///workspace/src/tools/SkillTool/SkillTool.ts) | 调用技能 |
| EnterPlanMode / ExitPlanModeV2 | [EnterPlanModeTool.ts](file:///workspace/src/tools/EnterPlanModeTool/EnterPlanModeTool.ts) / [ExitPlanModeV2Tool.ts](file:///workspace/src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts) | 计划模式 |
| EnterWorktree / ExitWorktree | [EnterWorktreeTool.ts](file:///workspace/src/tools/EnterWorktreeTool/EnterWorktreeTool.ts) / [ExitWorktreeTool.ts](file:///workspace/src/tools/ExitWorktreeTool/ExitWorktreeTool.ts) | git worktree |
| Config | [ConfigTool.ts](file:///workspace/src/tools/ConfigTool/ConfigTool.ts) | 读写设置 |
| TaskCreate / TaskUpdate / TaskGet | [TaskCreateTool.ts](file:///workspace/src/tools/TaskCreateTool/TaskCreateTool.ts) 等 | 后台任务管理 |
| TeamCreate / TeamDelete / SendMessage | [TeamCreateTool.ts](file:///workspace/src/tools/TeamCreateTool/TeamCreateTool.ts) 等 | teammate/swarm |
| ListMcpResources / ReadMcpResource | [ListMcpResourcesTool.ts](file:///workspace/src/tools/ListMcpResourcesTool/ListMcpResourcesTool.ts) / [ReadMcpResourceTool.ts](file:///workspace/src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts) | MCP 资源 |
| ToolSearch / Tungsten / Brief / TaskStop / TaskOutput / VerifyPlanExecution / SyntheticOutput | 各自目录 | 辅助/实验工具 |

**feature 门控工具**（入口缺失，需重建，见 [FEATURES.md](file:///workspace/FEATURES.md)）：`ScheduleCron`（`AGENT_TRIGGERS`）、`RemoteTrigger`（`AGENT_TRIGGERS_REMOTE`，[RemoteTriggerTool.ts](file:///workspace/src/tools/RemoteTriggerTool/RemoteTriggerTool.ts) 已存在）、`Monitor`、`PushNotification`、`SubscribePR`、`Sleep`、`REPL`、`SuggestBackgroundPR`。

**⚠️ 缺失入口文件**（被导入但不存在，见 §1.4）：`BashTool.ts`、`AgentTool.ts`、`AskUserQuestionTool.ts`。

### 4.4 Tool 类型契约：[Tool.ts](file:///workspace/src/Tool.ts)
定义 `Tool`/`Tools`/`ToolUseContext`/`ToolInputJSONSchema`。**权限类型集中化**在此（`PermissionMode`/`PermissionResult`/`AdditionalWorkingDirectory` 从 [types/permissions.ts](file:///workspace/src/types/permissions.ts) 重导出），目的是**打破循环依赖**——多个工具与权限模块互相引用，集中到一处避免环。

### 4.5 工具执行编排：[services/tools/](file:///workspace/src/services/tools)
- [toolExecution.ts](file:///workspace/src/services/tools/toolExecution.ts)：单次工具执行入口，含 telemetry 元数据提取、bash 投机性 classifier 检查（`startSpeculativeClassifierCheck`）、code-edit 工具权限属性构建。
- [toolOrchestration.ts](file:///workspace/src/services/tools/toolOrchestration.ts)：多工具编排。
- [StreamingToolExecutor.ts](file:///workspace/src/services/tools/StreamingToolExecutor.ts)：流式执行器。

### 4.6 AgentTool 子系统：[src/tools/AgentTool/](file:///workspace/src/tools/AgentTool)
入口 `AgentTool.ts` 缺失，但子系统辅助齐全：
- [builtInAgents.ts](file:///workspace/src/tools/AgentTool/builtInAgents.ts) + [built-in/](file:///workspace/src/tools/AgentTool/built-in)：内置 agent —— `exploreAgent`、`planAgent`、`generalPurposeAgent`、`verificationAgent`、`claudeCodeGuideAgent`、`statuslineSetup`。
- [runAgent.ts](file:///workspace/src/tools/AgentTool/runAgent.ts)：agent 执行。
- [loadAgentsDir.ts](file:///workspace/src/tools/AgentTool/loadAgentsDir.ts)：从目录加载 agent 定义。
- [forkSubagent.ts](file:///workspace/src/tools/AgentTool/forkSubagent.ts)：fork 子 agent。
- [agentMemory.ts](file:///workspace/src/tools/AgentTool/agentMemory.ts) / [agentMemorySnapshot.ts](file:///workspace/src/tools/AgentTool/agentMemorySnapshot.ts)：agent 记忆。
- [agentColorManager.ts](file:///workspace/src/tools/AgentTool/agentColorManager.ts)：多 agent 颜色区分。

---

## 5. 服务与子系统

### 5.1 [services/api/](file:///workspace/src/services/api) —— 多 Provider 客户端
- [claude.ts](file:///workspace/src/services/api/claude.ts)：主消息 API 封装，基于 `@anthropic-ai/sdk` 的 Beta 流式接口；按 `getAPIProvider()` 路由。
- [client.ts](file:///workspace/src/services/api/client.ts)：SDK client 构造（Bedrock/Vertex/Foundry 各自 SDK）。
- [codex-fetch-adapter.ts](file:///workspace/src/services/api/codex-fetch-adapter.ts)：OpenAI Codex 适配。
- [withRetry.ts](file:///workspace/src/services/api/withRetry.ts) + [errors.ts](file:///workspace/src/services/api/errors.ts)：重试与错误分类（`categorizeRetryableAPIError`、`PROMPT_TOO_LONG_ERROR_MESSAGE`）。
- [logging.ts](file:///workspace/src/services/api/logging.ts) / [usage.ts](file:///workspace/src/services/api/usage.ts)：usage/cost 统计。
- [bootstrap.ts](file:///workspace/src/services/api/bootstrap.ts) / [filesApi.ts](file:///workspace/src/services/api/filesApi.ts) / [referral.ts](file:///workspace/src/services/api/referral.ts)：启动数据/文件/推荐。
- Provider 路由与模型 ID 映射：[utils/model/](file:///workspace/src/utils/model)（`providers.ts`/`bedrock.ts`/`model.ts`/`aliases.ts`/`configs.ts`/`validateModel.ts`）。

### 5.2 [services/mcp/](file:///workspace/src/services/mcp) —— MCP 集成
- [client.ts](file:///workspace/src/services/mcp/client.ts)：基于 `@modelcontextprotocol/sdk` 的 Client，支持 Stdio/SSE/StreamableHTTP transport。
- [config.ts](file:///workspace/src/services/mcp/config.ts)：MCP server 配置加载。
- [auth.ts](file:///workspace/src/services/mcp/auth.ts) / [oauthPort.ts](file:///workspace/src/services/mcp/oauthPort.ts)：MCP OAuth。
- [officialRegistry.ts](file:///workspace/src/services/mcp/officialRegistry.ts)：官方 MCP 注册表预取。
- [elicitationHandler.ts](file:///workspace/src/services/mcp/elicitationHandler.ts)：elicitation 流。
- [channelPermissions.ts](file:///workspace/src/services/mcp/channelPermissions.ts) / [channelAllowlist.ts](file:///workspace/src/services/mcp/channelAllowlist.ts)：channel 权限。
- [InProcessTransport.ts](file:///workspace/src/services/mcp/InProcessTransport.ts) / [SdkControlTransport.ts](file:///workspace/src/services/mcp/SdkControlTransport.ts)：进程内/SDK 控制 transport。

### 5.3 [services/compact/](file:///workspace/src/services/compact) —— 上下文压缩
- [autoCompact.ts](file:///workspace/src/services/compact/autoCompact.ts)：自动压缩判定（`calculateTokenWarningState`/`isAutoCompactEnabled`）。
- [compact.ts](file:///workspace/src/services/compact/compact.ts)：`buildPostCompactMessages` 主压缩。
- [microCompact.ts](file:///workspace/src/services/compact/microCompact.ts) / [cachedMicrocompact.ts](file:///workspace/src/services/compact/cachedMicrocompact.ts) / [apiMicrocompact.ts](file:///workspace/src/services/compact/apiMicrocompact.ts)：微压缩（`feature('CACHED_MICROCOMPACT')`）。
- [snipCompact.ts](file:///workspace/src/services/compact/snipCompact.ts) / [snipProjection.ts](file:///workspace/src/services/compact/snipProjection.ts)：snip 压缩。
- 与 [query.ts](file:///workspace/src/query.ts) 衔接：流式循环中按 token 阈值触发。

### 5.4 [services/analytics/](file:///workspace/src/services/analytics) —— 分析（本分叉已 stub）
- [growthbook.ts](file:///workspace/src/services/analytics/growthbook.ts)：GrowthBook **本地评估**保留（运行时 feature gate 依赖），但不回传。
- [index.ts](file:///workspace/src/services/analytics/index.ts) / [sink.ts](file:///workspace/src/services/analytics/sink.ts) / [datadog.ts](file:///workspace/src/services/analytics/datadog.ts) / [firstPartyEventLogger.ts](file:///workspace/src/services/analytics/firstPartyEventLogger.ts)：事件日志，外发端点已 DCE/stub。

### 5.5 [services/oauth/](file:///workspace/src/services/oauth) —— OAuth
[index.ts](file:///workspace/src/services/oauth/index.ts) / [client.ts](file:///workspace/src/services/oauth/client.ts)（Anthropic）/ [codex-client.ts](file:///workspace/src/services/oauth/codex-client.ts)（OpenAI Codex）/ [auth-code-listener.ts](file:///workspace/src/services/oauth/auth-code-listener.ts)。

### 5.6 其它 services 子系统
- [policyLimits/](file:///workspace/src/services/policyLimits)：策略限额（`isPolicyAllowed`/`loadPolicyLimits`）。
- [remoteManagedSettings/](file:///workspace/src/services/remoteManagedSettings)：远端托管设置同步。
- [teamMemorySync/](file:///workspace/src/services/teamMemorySync)：团队记忆同步 + secret 扫描。
- [SessionMemory/](file:///workspace/src/services/SessionMemory)：会话记忆。
- [MagicDocs/](file:///workspace/src/services/MagicDocs)：Magic Docs。
- [tips/](file:///workspace/src/services/tips)：提示小贴士调度。
- [tools/](file:///workspace/src/services/tools)：工具执行编排（见 §4.5）。
- [plugins/](file:///workspace/src/services/plugins)：插件操作。
- [settingsSync/](file:///workspace/src/services/settingsSync)：设置同步。

### 5.7 顶层其它子系统
- [bridge/](file:///workspace/src/bridge)：IDE 远控桥（VS Code/JetBrains），`feature('BRIDGE_MODE')` 门控，含 `replBridge.ts`/`bridgeApi.ts`/`sessionRunner.ts`/`jwtUtils.ts` 等 30+ 文件。
- [remote/](file:///workspace/src/remote)：`RemoteSessionManager.ts` + `SessionsWebSocket.ts` + `remotePermissionBridge.ts`。
- [server/](file:///workspace/src/server)：`directConnectManager.ts` + `createDirectConnectSession.ts`。
- [skills/](file:///workspace/src/skills) + [plugins/](file:///workspace/src/plugins)：扩展系统（`bundledSkills.ts`/`loadSkillsDir.ts`/`mcpSkillBuilders.ts`/`builtinPlugins.ts`）。
- [memdir/](file:///workspace/src/memdir)：记忆目录（`memdir.ts`/`memoryScan.ts`/`findRelevantMemories.ts`/`teamMemPaths.ts`）。
- [tasks/](file:///workspace/src/tasks)：后台任务实现（`LocalMainSessionTask.ts`/`InProcessTeammateTask`/`LocalAgentTask` 等，配合 [Task.ts](file:///workspace/src/Task.ts) 的 `TaskType`：`local_bash`/`local_agent`/`remote_agent`/`in_process_teammate`/`local_workflow`/`monitor_mcp`/`dream`）。
- [keybindings/](file:///workspace/src/keybindings) + [vim/](file:///workspace/src/vim)：键绑定系统 + vim 模式（motions/operators/textObjects）。
- [voice/](file:///workspace/src/voice)：语音输入（`feature('VOICE_MODE')`）。
- [coordinator/](file:///workspace/src/coordinator) + [assistant/](file:///workspace/src/assistant) + [buddy/](file:///workspace/src/buddy)：feature 门控的实验栈（`COORDINATOR_MODE`/`KAIROS`/`BUDDY`）。
- [upstreamproxy/](file:///workspace/src/upstreamproxy)：上游代理中继。
- [migrations/](file:///workspace/src/migrations)：设置/模型迁移（如 `migrateSonnet45ToSonnet46.ts`、`migrateFennecToOpus.ts`）。

---

## 6. 构建与运行时

### 6.1 构建脚本：[scripts/build.ts](file:///workspace/scripts/build.ts)
拼装并执行 `bun build` 命令：

```
bun build ./src/entrypoints/cli.tsx \
  --compile --target bun --format esm --minify --bytecode \
  --packages bundle --conditions bun \
  --external '@ant/*' --external audio-capture-napi ... \
  --feature=VOICE_MODE [--feature=ULTRAPLAN ...] \
  --define process.env.USER_TYPE="external" \
  --define MACRO.VERSION="..." ...
```

- **externals**（不打包）：`@ant/*`（Anthropic 内部包）、`audio-capture-napi`、`image-processor-napi`、`modifiers-napi`、`url-handler-napi`。
- **defines**：`process.env.USER_TYPE='external'`、`MACRO.VERSION/BUILD_TIME/PACKAGE_URL/FEEDBACK_CHANNEL/...`；dev 构建额外注入 `CLAUDE_CODE_EXPERIMENTAL_BUILD`。
- **特性开关**：默认 `['VOICE_MODE']`；`--feature-set=dev-full` 注入 `fullExperimentalFeatures` 数组（36 个 flag）；`--feature=NAME` 单独追加。每个 flag 经 `--feature=NAME` 传给 bun，由 `bun:bundle` 的 `feature()` 在打包时做 DCE。
- **产物**：`./cli`（prod）/`./cli-dev`（dev）/`./dist/cli`（`--compile`）。

### 6.2 构建变体

| 命令 | 产物 | 特性 |
|---|---|---|
| `bun run build` | `./cli` | 仅 `VOICE_MODE` |
| `bun run build:dev` | `./cli-dev` | 仅 `VOICE_MODE`，dev 版本戳 |
| `bun run build:dev:full` | `./cli-dev` | 全部 36 个实验 flag |
| `bun run compile` | `./dist/cli` | 仅 `VOICE_MODE`，备用输出路径 |
| `bun run dev` | — | 直接 `bun run src/entrypoints/cli.tsx`，不编译 |

### 6.3 特性开关体系
共 88 个 `feature('FLAG')` 编译期开关（详见 [FEATURES.md](file:///workspace/FEATURES.md)）：
- **54 个可干净打包**：含 `ULTRAPLAN`/`ULTRATHINK`/`VOICE_MODE`/`TOKEN_BUDGET`/`BUILTIN_EXPLORE_PLAN_AGENTS`/`VERIFICATION_AGENT`/`AGENT_TRIGGERS`/`BRIDGE_MODE`/`BASH_CLASSIFIER`/`TEAMMEM` 等。
- **34 个损坏**：分「易重建」「中等缺口」「大缺失子系统」三档，附重建笔记（如 `AUTO_THEME` 缺 `systemThemeWatcher.js`、`KAIROS` 缺整个 assistant 栈）。
- **运行时 caveat**：`VOICE_MODE` 需 claude.ai OAuth + 录音后端；`BRIDGE_MODE`/`CCR_*` 需 OAuth + GrowthBook entitlement；`CHICAGO_MCP` 运行时仍触达外部 `@ant/computer-use-*`；`TEAMMEM` 需团队记忆配置。
- `build:dev:full` 显式排除 `CHICAGO_MCP`（虽可编译但启动崩溃）。

### 6.4 多 Provider 运行时切换
- 路由：[utils/model/providers.ts](file:///workspace/src/utils/model/providers.ts) `getAPIProvider()` 按 env 判定。
- 模型 ID 映射：[utils/model/bedrock.ts](file:///workspace/src/utils/model/bedrock.ts)（Bedrock ARN 如 `us.anthropic.claude-opus-4-6-v1`）、Vertex 格式（`claude-opus-4-6@latest`）。
- 模型管理：[model.ts](file:///workspace/src/utils/model/model.ts)（`getMainLoopModel`/`parseUserSpecifiedModel`/`getCanonicalName`）、[aliases.ts](file:///workspace/src/utils/model/aliases.ts)、[configs.ts](file:///workspace/src/utils/model/configs.ts)、[validateModel.ts](file:///workspace/src/utils/model/validateModel.ts)、[modelAllowlist.ts](file:///workspace/src/utils/model/modelAllowlist.ts)。
- 完整 env 变量矩阵见 [README.md](file:///workspace/README.md) 的 Environment Variables Reference。

### 6.5 终端 UI 运行时
- **定制 Ink**：[src/ink/](file:///workspace/src/ink) 自带完整渲染器（`reconciler.ts`/`renderer.ts`/`dom.ts`/`render-to-screen.ts`/`render-border.ts`/`selection.ts`/`hit-test.ts`/`measure-text.ts`/`wrapAnsi.ts`/`parse-keypress.ts` 等），非上游 Ink 原样。
- React 19 + Ink 6，`components/`（150+ 组件）与 `hooks/`（90+ hooks）协作：组件纯展示 + hooks 拆逻辑（如 `useCanUseTool`/`useReplBridge`/`useRemoteSession`/`useIDEIntegration`/`useTasksV2`/`useVirtualScroll`）。
- 键绑定：[keybindings/](file:///workspace/src/keybindings)（`KeybindingContext`/`defaultBindings`/`parser`/`resolver`/`validate`）。

### 6.6 启动性能
- [utils/startupProfiler.ts](file:///workspace/src/utils/startupProfiler.ts)：`profileCheckpoint()` 标记各阶段。
- [main.tsx](file:///workspace/src/main.tsx) 顶部**并行预热**（见 §3.1）：MDM/keychain/bootstrap/mcp/policy 在 import 窗口并发，避免串行 spawn 阻塞。
- [utils/headlessProfiler.ts](file:///workspace/src/utils/headlessProfiler.ts)：headless 模式 profiling。

---

## 7. 关键约定与陷阱

1. **DCE 模式**：`feature('FLAG')` 与 `process.env.USER_TYPE === 'ant'` 的条件 `require` 是打包期/运行期死代码消除手段。新增 feature 门控代码须遵循此模式，否则会被打入 external 构建。
2. **`@ant/*` externals 缺失**：`@ant/*` 包不打包也不在 `dependencies` 中，任何运行时触达 `@ant/*` 的 flag（如 `CHICAGO_MCP`→`@ant/computer-use-*`）在 external 构建中会运行时崩溃。
3. **循环依赖处理**：[tools.ts](file:///workspace/src/tools.ts) 用 lazy `require` 工厂函数打断环（`getTeamCreateTool`/`getSendMessageTool` 等）；[Tool.ts](file:///workspace/src/Tool.ts) 集中权限/进度类型到一处避免多模块互引成环。
4. **全局状态约束**：[bootstrap/state.ts](file:///workspace/src/bootstrap/state.ts) 顶部「DO NOT ADD MORE STATE HERE」——新增全局状态需极审慎，优先用 React `AppState` 层。
5. **快照不完整**（见 §1.4）：`BashTool.ts`/`AgentTool.ts`/`AskUserQuestionTool.ts` 等入口文件缺失，项目当前不可直接构建；重建这些入口是首要前置工作。
6. **本分叉三类改动落点**：
   - **遥测 stub**：[services/analytics/](file:///workspace/src/services/analytics) 外发端点 DCE/stub，OpenTelemetry exporter 不外发。
   - **安全提示移除**：[constants/cyberRiskInstruction.ts](file:///workspace/src/constants/cyberRiskInstruction.ts) 与 system prompt 注入路径被剥离（模型自身安全训练仍生效）。
   - **flag 解锁**：[scripts/build.ts](file:///workspace/scripts/build.ts) 的 `fullExperimentalFeatures` 数组解锁 36 个实验 flag。

---

## 8. 快速导航

| 我想… | 看这里 |
|---|---|
| 改 CLI 入口/启动流程 | [entrypoints/cli.tsx](file:///workspace/src/entrypoints/cli.tsx) → [main.tsx](file:///workspace/src/main.tsx) → [replLauncher.tsx](file:///workspace/src/replLauncher.tsx) |
| 改主交互 UI | [screens/REPL.tsx](file:///workspace/src/screens/REPL.tsx) + [components/](file:///workspace/src/components) + [hooks/](file:///workspace/src/hooks) |
| 改一次对话/流式循环 | [QueryEngine.ts](file:///workspace/src/QueryEngine.ts) + [query.ts](file:///workspace/src/query.ts) |
| 加/改斜杠命令 | [commands.ts](file:///workspace/src/commands.ts) + [commands/<name>/index.ts](file:///workspace/src/commands) |
| 加/改 Agent 工具 | [tools.ts](file:///workspace/src/tools.ts) + [tools/<Name>/](file:///workspace/src/tools) + [Tool.ts](file:///workspace/src/Tool.ts) |
| 改工具执行/权限 | [services/tools/](file:///workspace/src/services/tools) + [hooks/useCanUseTool.tsx](file:///workspace/src/hooks/useCanUseTool.tsx) |
| 改 API/Provider | [services/api/](file:///workspace/src/services/api) + [utils/model/](file:///workspace/src/utils/model) |
| 改 MCP | [services/mcp/](file:///workspace/src/services/mcp) + [tools/MCPTool/](file:///workspace/src/tools/MCPTool) |
| 改上下文压缩 | [services/compact/](file:///workspace/src/services/compact) |
| 改系统提示 | [constants/prompts.ts](file:///workspace/src/constants/prompts.ts) + [utils/systemPrompt.ts](file:///workspace/src/utils/systemPrompt.ts) + [memdir/](file:///workspace/src/memdir) |
| 改构建/特性开关 | [scripts/build.ts](file:///workspace/scripts/build.ts) + [FEATURES.md](file:///workspace/FEATURES.md) |
| 改终端渲染 | [ink/](file:///workspace/src/ink) |
| 改 IDE 桥/远程 | [bridge/](file:///workspace/src/bridge) + [remote/](file:///workspace/src/remote) + [server/](file:///workspace/src/server) |
| 改后台任务 | [Task.ts](file:///workspace/src/Task.ts) + [tasks.ts](file:///workspace/src/tasks.ts) + [tasks/](file:///workspace/src/tasks) |
| 改全局状态 | [bootstrap/state.ts](file:///workspace/src/bootstrap/state.ts)（谨慎）+ [state/](file:///workspace/src/state) |
