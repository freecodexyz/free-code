# 计划：全面了解 free-code 项目并产出 ARCHITECTURE.md

## Summary（摘要）

目标是通读 `/workspace`（free-code —— Anthropic Claude Code CLI 的可构建重构分叉，TypeScript + Bun + React/Ink 终端 UI），产出一份结构化的 `ARCHITECTURE.md`，覆盖用户选定的四个层面：**入口与主循环**、**命令与工具体系**、**服务与子系统**、**构建与运行时**。该文档将作为长期查阅的项目架构总览。

## Current State Analysis（现状分析，基于 Phase 1 实际探索）

### 项目身份
- `package.json`：`name: claude-code-source-snapshot`，`version: 2.1.87`，`private: true`，`type: module`，`packageManager: bun@1.3.11`，`engines.bun >=1.3.11`。`bin` 指向 `./cli`。
- `README.md`：定位为 Claude Code 的「free build」——移除遥测、移除安全提示护栏、解锁实验特性开关；支持 5 个 Provider（Anthropic 直连 / OpenAI Codex / AWS Bedrock / Google Vertex AI / Anthropic Foundry）。
- `CLAUDE.md`：给出高层架构与常用命令。
- `FEATURES.md`：审计了 88 个 `feature('FLAG')` 编译期开关（54 个可干净打包，34 个损坏并附重建笔记）。

### 技术栈（来自 package.json + README）
- 运行时：Bun；语言：TypeScript；终端 UI：React 19 + Ink 6（自带 `src/ink/` 定制实现）；CLI 解析：`@commander-js/extra-typings`；Schema：Zod v4；代码搜索：ripgrep（bundled）；协议：MCP（`@modelcontextprotocol/sdk`）、LSP（`vscode-languageserver-*`）；多 Provider SDK：`@anthropic-ai/sdk`、`@anthropic-ai/bedrock-sdk`、`@anthropic-ai/vertex-sdk`、`@anthropic-ai/foundry-sdk`、`@anthropic-ai/claude-agent-sdk`、`@anthropic-ai/sandbox-runtime`；遥测：OpenTelemetry 全家桶（本分叉已 stub）、GrowthBook（本地评估保留）。

### 实际目录结构（经 Glob 校验，非 README 简述）
顶层 `src/` 含 30+ 子目录。关键已确认存在的子系统目录：
- `src/services/`：`api/`（claude.ts/client.ts/errors.ts/withRetry.ts/filesApi.ts/bootstrap.ts/codex-fetch-adapter.ts 等）、`mcp/`（client.ts/types.ts/config.ts/auth.ts/officialRegistry.ts 等 20+ 文件）、`compact/`（autoCompact.ts/compact.ts/microCompact.ts/cachedMicrocompact.ts 等 15 文件）、`analytics/`（index.ts/growthbook.ts/datadog.ts/sink.ts 等）、`oauth/`（index.ts/client.ts/codex-client.ts 等）、`toolUseSummary/`、`tools/`（toolExecution.ts/toolOrchestration.ts/StreamingToolExecutor.ts）、`plugins/`、`policyLimits/`、`remoteManagedSettings/`、`teamMemorySync/`、`SessionMemory/`、`MagicDocs/`、`tips/`、`settingsSync/`。
- `src/tools/`：每个工具一个目录（AgentTool/BashTool/FileEditTool/FileReadTool/FileWriteTool/GlobTool/GrepTool/WebFetchTool/WebSearchTool/TodoWriteTool/MCPTool/LSPTool/ScheduleCronTool/TeamCreateTool/EnterPlanModeTool/ExitWorktreeTool/ConfigTool/BriefTool/TungstenTool 等），含 `shared/`、`testing/`。
- `src/commands/`：60+ 斜杠命令，每个一个目录带 `index.ts`（compact/mcp/login/config/doctor/skills/tasks/voice/bridge/plan 等）。
- 其它核心目录：`entrypoints/`、`screens/`（REPL.tsx/Doctor.tsx/ResumeConversation.tsx）、`components/`（150+ Ink 组件）、`hooks/`（90+ React hooks）、`ink/`（定制 Ink 渲染器）、`bridge/`、`remote/`、`server/`、`skills/`、`plugins/`、`memdir/`、`state/`、`tasks/`、`keybindings/`、`vim/`、`voice/`、`coordinator/`、`assistant/`、`buddy/`、`upstreamproxy/`、`migrations/`、`query/`、`context/`、`constants/`、`types/`、`utils/`（200+ 工具模块）。

### 关键入口与数据流（已读源码确认）
1. **`src/entrypoints/cli.tsx`**：bootstrap 入口。`--version` 零导入快路径；`feature('DUMP_SYSTEM_PROMPT')`、`--claude-in-chrome-mcp`、`--chrome-native-host`、`feature('CHICAGO_MCP') --computer-use-mcp` 等特殊路径分流；其余动态 `import('../main.tsx')`。
2. **`src/main.tsx`**：Commander.js 解析 CLI 参数；并行预热（MDM 读取、keychain prefetch、`fetchBootstrapData`、`prefetchOfficialMcpUrls`、`prefetchAwsCredentialsAndBedRockInfoIfSafe`、GrowthBook 初始化、policy/remoteManagedSettings 加载）；`init()` → `launchRepl()`（来自 `replLauncher.tsx`）。
3. **`src/screens/REPL.tsx`**：主交互 UI（Ink/React）。组装系统提示（`getSystemPrompt` + `buildEffectiveSystemPrompt` + `getMemoryFiles`）、管理消息列表、权限请求、工具确认、远程/SSH/直连会话、teammate/swarm、cost 阈值、空闲返回等。
4. **`src/QueryEngine.ts`**：协调消息流、工具调用、模型调用；消费 `query()`（来自 `query.ts`）；处理 SDK 消息映射、compact 边界、文件历史快照、scratchpad、usage 累计。
5. **`src/query.ts`**：核心查询循环。流式事件处理、工具结果回填、auto-compact 判定（`services/compact/autoCompact.ts`）、microcompact、reactiveCompact/contextCollapse（feature 门控）、toolUseSummary 生成、错误分类与重试（`services/api/errors.ts` + `withRetry.ts`）。
6. **`src/Tool.ts`**：`Tool`/`Tools`/`ToolUseContext` 类型定义；权限类型集中化以打破循环依赖。
7. **`src/commands.ts` / `src/tools.ts`**：命令/工具注册表，大量 `feature('FLAG')` 与 `process.env.USER_TYPE === 'ant'` 条件 `require` 做 DCE。
8. **`src/bootstrap/state.ts`**：全局可变状态（cwd、projectRoot、cost、turn 计时、session id、hooks、channels 等），注释「DO NOT ADD MORE STATE HERE」。
9. **`src/Task.ts` / `src/tasks.ts`**：后台任务类型（local_bash/local_agent/remote_agent/in_process_teammate/local_workflow/monitor_mcp/dream）与任务生命周期。

### 构建系统（已读 `scripts/build.ts` 全文）
- 入口 `./src/entrypoints/cli.tsx`，`bun build --compile --target bun --format esm --minify --bytecode --packages bundle --conditions bun`。
- `externals`：`@ant/*`、`audio-capture-napi`、`image-processor-napi`、`modifiers-napi`、`url-handler-napi`（Anthropic 内部/原生包不打包）。
- `defines`：`process.env.USER_TYPE='external'`、`MACRO.VERSION/BUILD_TIME/PACKAGE_URL/...`、dev 构建额外注入 `CLAUDE_CODE_EXPERIMENTAL_BUILD`。
- 特性开关：默认仅 `VOICE_MODE`；`--feature-set=dev-full` 注入 35 个实验 flag（`fullExperimentalFeatures` 数组）；`--feature=NAME` 单独追加；每个 flag 经 `--feature=NAME` 传给 bun，由 `bun:bundle` 的 `feature()` 做 DCE。
- 产物：`./cli`（prod）/`./cli-dev`（dev）/`./dist/cli`（compile）。

## Proposed Changes（拟变更）

**唯一产出：新建 `/workspace/ARCHITECTURE.md`**（不改动任何现有源码）。文档结构如下，每节均引用真实文件路径（用 `file:///` 链接）：

### 1. 项目概览
- 身份、定位（free-code 分叉的三类改动：去遥测 / 去安全提示护栏 / 解锁实验 flag）、技术栈表、Provider 矩阵。

### 2. 顶层目录结构
- 基于 Glob 校验的真实树（`src/` 30+ 子目录 + 顶层 `scripts/`、`assets/`），标注每个目录职责一句话。

### 3. 入口与主循环（用户重点①）
- `cli.tsx` 快路径分流 → `main.tsx` Commander 解析与并行预热 → `replLauncher.tsx` → `screens/REPL.tsx` 主 UI → `QueryEngine.ts` → `query.ts` 流式循环。
- 用文字+流程描述「一次用户输入到模型响应+工具执行」的完整数据流，标注系统提示组装（`constants/prompts.ts` + `utils/systemPrompt.ts` + `memdir/`）、权限流（`hooks/useCanUseTool.tsx` + `components/permissions/`）、compact 触发点。
- 全局状态：`bootstrap/state.ts` 的角色与「DO NOT ADD MORE STATE」约束；`state/AppState.tsx` React 状态层。

### 4. 命令与工具体系（用户重点②）
- 注册机制：`commands.ts` / `tools.ts` 的条件 `require` + `feature()`/`USER_TYPE` DCE 模式。
- 命令清单：按类别分组（会话/模型/上下文/MCP/IDE/集成/实验），引用 `src/commands/*/index.ts`。
- 工具清单：核心工具（Bash/FileRead/FileEdit/FileWrite/Glob/Grep/WebFetch/WebSearch/TodoWrite/Agent/MCP/LSP/AskUserQuestion/EnterPlanMode 等）+ feature 门控工具（ScheduleCron/RemoteTrigger/Monitor/PushNotification/SubscribePR/Sleep/REPL/SuggestBackgroundPR 等）。
- `Tool.ts` 类型契约（`Tool`/`Tools`/`ToolUseContext`/`ToolInputJSONSchema`/权限类型集中化）。
- 工具执行编排：`services/tools/toolExecution.ts` + `toolOrchestration.ts` + `StreamingToolExecutor.ts`。
- AgentTool 子系统：`tools/AgentTool/`（built-in agents: explore/plan/generalPurpose/verification/claudeCodeGuide/statuslineSetup，`loadAgentsDir.ts`，`forkSubagent.ts`，`agentMemory.ts`）。

### 5. 服务与子系统（用户重点③）
- `services/api/`：多 Provider 客户端（`claude.ts` 主、`client.ts`、`codex-fetch-adapter.ts`、Bedrock/Vertex/Foundry 路由在 `utils/model/providers.ts`）、重试与错误分类（`withRetry.ts`/`errors.ts`）、usage/cost（`logging.ts`/`usage.ts`）、bootstrap/filesApi/referral。
- `services/mcp/`：MCP 客户端、配置、OAuth、官方注册表、elicitation、channel 权限、InProcess/SdkControl transport。
- `services/compact/`：autoCompact/microCompact/cachedMicrocompact/snipCompact/compactWarning，与 `query.ts` 的衔接。
- `services/analytics/`：GrowthBook 本地评估、firstPartyEventLogger、sink/datadog（本分叉已 stub/不外发）。
- `services/oauth/`：Anthropic + Codex OAuth 流。
- `services/policyLimits/`、`remoteManagedSettings/`、`teamMemorySync/`、`SessionMemory/`、`MagicDocs/`、`tips/`、`tools/`、`plugins/`、`settingsSync/`。
- 其它子系统：`bridge/`（IDE 远控）、`remote/`（RemoteSessionManager/WebSocket）、`server/`（directConnect）、`skills/`+`plugins/`（扩展）、`memdir/`（记忆）、`tasks/`（后台任务）、`keybindings/`+`vim/`（输入）、`voice/`、`coordinator/`+`assistant/`+`buddy/`（feature 门控的实验栈）、`upstreamproxy/`、`migrations/`。

### 6. 构建与运行时（用户重点④）
- `scripts/build.ts` 详解：命令拼装、externals、defines、feature-set 预设、产物路径、`bun:bundle` 的 `feature()` DCE 原理。
- 构建变体表（build / build:dev / build:dev:full / compile）。
- 特性开关体系：`FEATURES.md` 的 88 flag 概览（54 可打包 / 34 损坏），`fullExperimentalFeatures` 35 个清单，运行时 caveat（VOICE_MODE/BRIDGE_MODE/CHICAGO_MCP/TEAMMEM 等）。
- 多 Provider 运行时切换：env 变量矩阵、`utils/model/providers.ts` 路由、模型 ID 映射（Bedrock ARN / Vertex `@latest`）。
- 终端 UI 运行时：定制 `src/ink/`（reconciler/renderer/dom/selection/hit-test）、React 19 + Ink 6、`components/` 与 `hooks/` 协作模式。
- 启动性能：`utils/startupProfiler.ts`、`main.tsx` 顶部的并行预热（MDM/keychain/bootstrap/mcp/policy）。

### 7. 关键约定与陷阱
- `feature()` / `USER_TYPE==='ant'` DCE 模式；`@ant/*` externals 缺失导致部分 flag 运行时不可用。
- 循环依赖处理：`tools.ts` 用 lazy `require` 打断（TeamCreate/SendMessage 等）；`Tool.ts` 集中类型。
- `bootstrap/state.ts` 全局状态约束。
- 本分叉相对上游的三类改动落点（遥测 stub 位置、cyberRisk 注入移除、flag 解锁）。

### 8. 快速导航
- 「我想改 X 应该看哪里」式索引表（入口/命令/工具/API/MCP/compact/UI/构建）。

## Assumptions & Decisions（假设与决策）
- **决策**：只新建 `ARCHITECTURE.md`，不修改任何现有文件，不新增其它文档。
- **决策**：文档语言为中文（与用户一致），代码标识/路径保留英文原样。
- **决策**：所有文件引用用 `file:///workspace/...` 可点击链接，目录用 basename。
- **假设**：执行阶段允许再读取尚未细看的文件（如 `replLauncher.tsx`、`utils/model/providers.ts`、`services/mcp/client.ts`、`services/tools/toolExecution.ts`、若干 tool/command 实现）以补全细节——这些是只读操作。
- **假设**：`src/services/` 下被引用但 Glob 未列出的子目录（如 `permissions/`、`skillSearch/`）若实际不存在，文档中按「feature 门控/缺失」标注，不臆造。
- **范围边界**：不逐文件枚举 200+ utils 与 150+ components，只归类职责并给代表性示例；不重写 README 已有内容（Provider/env 表引用即可）。

## Verification（验证步骤）
1. 文档内每个 `file:///` 链接指向的路径真实存在（执行时用 Glob/Read 抽检 10+ 关键链接）。
2. 目录树章节与 `Glob` 实际结果一致（无臆造子目录）。
3. 数据流章节的函数名/文件名与源码匹配（如 `query()` 在 `query.ts`、`launchRepl` 在 `replLauncher.tsx`、`getSystemPrompt` 在 `constants/prompts.ts`）。
4. 特性开关清单与 `scripts/build.ts` 的 `fullExperimentalFeatures` 数组 + `FEATURES.md` 一致。
5. 文档结构完整覆盖用户选定的四个重点层面。
6. 完成后向用户返回简短总结（不再次调用 NotifyUser）。
