# Web UI 中文化、动态获取模型列表与清理假文件 Spec

## Why

当前 Web UI（`/workspace/web/`）存在三个问题：
1. **界面几乎全英文**：除 `ChatPanel.tsx:201` 一处 placeholder 外，所有按钮、标题、label、提示、错误信息均为英文，与用户"设置我要中文"的需求不符。
2. **模型列表纯手动输入**：`ProvidersSection.tsx` 配置 Provider 时，`models` 字段是逗号分隔的文本输入，用户需手动粘贴模型名。Anthropic 和 OpenAI 均提供 `GET /v1/models` 列表端点，应支持一键拉取，降低配置门槛。
3. **workbench 区存在大量硬编码假文件**：`EditorArea.tsx`（假示例代码 `SAMPLE_CODE_LINES` + 假 tab 图标映射）、`Sidebar.tsx`（假文件树 `FILE_TREE`）、`Titlebar.tsx`（假项目名 `my-project`）、`StatusBar.tsx`（全假状态栏）、`types/index.ts` 的 `editorTabs`（3 个假文件名 `jwt.ts`/`middleware.ts`/`session.ts`）。这些是占位演示数据，无真实数据源支撑。

## What Changes

### UI 中文化
- 将 `web/src/` 下所有面向用户的英文 UI 文案改为中文（按钮 label、标题、placeholder、提示、错误信息、空状态、confirm 文案、命令渲染文案等）
- 保留技术术语英文（如 `API Key`、`Base URL`、`Provider`、`Model`、`Token` 等专有名词）
- 代码注释、变量名、类型名保持英文（仅改用户可见文案）

### 动态获取模型列表
- 在 `chatClient.ts` 新增 `fetchModels(provider): Promise<string[]>` 函数：
  - `apiType === 'anthropic'` → `GET {baseURL}/v1/models`，header `x-api-key` + `anthropic-version: 2023-06-01`
  - `apiType === 'openai'` → `GET {baseURL}/models`，header `Authorization: Bearer {apiKey}`
  - 解析返回的 `data[].id` 提取模型 ID 列表
  - 错误时抛出含状态码和错误文本的 Error
- 在 `ProvidersSection.tsx` 的 `ProviderForm` 新增 "获取模型列表" 按钮：
  - 仅当 `apiKey` 和 `baseURL` 均非空时可点击
  - 点击后显示 loading 状态，拉取成功后填充 `modelsText`（合并已有 + 新拉取的去重）
  - 拉取失败显示错误提示（不阻塞保存）
  - 拉取后用户仍可手动编辑 `modelsText` 再保存

### 清理假文件
- **删除 `web/test_webapp.py`**：遗留的 Playwright 手动测试脚本，不被任何构建/CI 引用
- **清理 `EditorArea.tsx` 的假代码**：删除 `SAMPLE_CODE_LINES` 常量和 `TAB_ICONS` 假映射；编辑器区改为空状态提示（"未打开文件"）
- **清理 `Sidebar.tsx` 的假文件树**：删除 `FILE_TREE` 常量；侧边栏改为空状态提示（"暂无文件"）
- **清理 `Titlebar.tsx` 的假项目名**：删除硬编码 `my-project`；项目选择器改为显示当前工作区路径或占位文本
- **清理 `StatusBar.tsx` 的假状态**：删除全部硬编码假状态值；状态栏改为显示真实可获取的信息（或暂不显示假数据，保留布局骨架）
- **清理 `types/index.ts` 的 `editorTabs`**：`getDefaultWorkspaceState().editorTabs` 改为空数组 `[]`

## Impact

- Affected specs: `webui-port-cc-features`（已完成，本变更在其基础上做 UI 文案和假数据清理，不改动 cc 借鉴的核心架构）
- Affected code:
  - `web/src/services/chatClient.ts` — 新增 `fetchModels()` 导出
  - `web/src/components/settings/ProvidersSection.tsx` — 新增 "获取模型列表" 按钮 + 中文化
  - `web/src/components/workbench/ChatPanel.tsx` — 中文化
  - `web/src/components/workbench/ModelSelector.tsx` — 中文化（如有 label）
  - `web/src/components/workbench/EditorArea.tsx` — 删除假代码，改为空状态
  - `web/src/components/workbench/Sidebar.tsx` — 删除假文件树，改为空状态
  - `web/src/components/workbench/Titlebar.tsx` — 删除假项目名
  - `web/src/components/workbench/StatusBar.tsx` — 删除假状态
  - `web/src/components/workbench/ActivityRail.tsx` — 中文化
  - `web/src/components/settings/SettingsContent.tsx` — 中文化
  - `web/src/components/settings/SettingsNav.tsx` — 中文化
  - `web/src/components/sessions/NewSessionModal.tsx` — 中文化
  - `web/src/pages/Sessions.tsx` — 中文化
  - `web/src/pages/Settings.tsx` — 中文化
  - `web/src/commands/*.tsx` — 中文化（help、model、cost、status、init、review、clear、compact）
  - `web/src/hooks/useChat.ts` — 中文化错误提示
  - `web/src/types/index.ts` — `editorTabs` 改为 `[]`
  - `web/test_webapp.py` — **删除**

## ADDED Requirements

### Requirement: 动态获取模型列表
系统 SHALL 在 Provider 配置表单中提供"获取模型列表"按钮，调用 Provider 的 API 拉取可用模型列表并填充到 models 字段。

#### Scenario: 成功拉取 Anthropic 模型列表
- **WHEN** 用户在 ProviderForm 中已填写 baseURL 和 apiKey（apiType=anthropic），点击"获取模型列表"
- **THEN** 按钮显示 loading 状态，发送 `GET {baseURL}/v1/models`（header: `x-api-key` + `anthropic-version: 2023-06-01`）
- **AND** 解析返回 JSON 的 `data[].id` 字段，合并到现有 models（去重），填充到 modelsText 输入框
- **AND** loading 结束，显示拉取到的模型数量

#### Scenario: 成功拉取 OpenAI 模型列表
- **WHEN** 用户在 ProviderForm 中已填写 baseURL 和 apiKey（apiType=openai），点击"获取模型列表"
- **THEN** 发送 `GET {baseURL}/models`（header: `Authorization: Bearer {apiKey}`）
- **AND** 解析返回 JSON 的 `data[].id` 字段，合并去重后填充到 modelsText

#### Scenario: 缺少 baseURL 或 apiKey
- **WHEN** baseURL 或 apiKey 为空时
- **THEN** "获取模型列表"按钮禁用，title 提示"请先填写 Base URL 和 API Key"

#### Scenario: 拉取失败
- **WHEN** API 返回非 2xx 或网络错误
- **THEN** 在按钮下方显示错误提示（含状态码和错误文本），不阻塞表单保存
- **AND** modelsText 保持不变（不覆盖用户已输入的内容）

### Requirement: UI 中文化
系统 SHALL 将所有面向用户的 UI 文案显示为中文。

#### Scenario: 中文界面
- **WHEN** 用户打开应用的任何页面（Workspace / Sessions / Settings）
- **THEN** 所有按钮 label、标题、副标题、placeholder、空状态提示、confirm 文案、错误信息均显示为中文
- **AND** 技术专有名词（API Key、Base URL、Provider、Model、Token 等）保留英文

### Requirement: 清理假文件与占位数据
系统 SHALL 移除 workbench 区所有硬编码的占位/示例假数据，改为空状态提示。

#### Scenario: 编辑器区无假代码
- **WHEN** 用户打开 Workspace
- **THEN** EditorArea 不显示 `SAMPLE_CODE_LINES` 假代码，改为空状态提示"未打开文件"
- **AND** editorTabs 为空数组，不显示 `jwt.ts`/`middleware.ts`/`session.ts` 假标签

#### Scenario: 侧边栏无假文件树
- **WHEN** 用户打开 Workspace
- **THEN** Sidebar 不显示 `FILE_TREE` 假目录树，改为空状态提示"暂无文件"

#### Scenario: 标题栏无假项目名
- **WHEN** 用户打开 Workspace
- **THEN** Titlebar 不显示硬编码 `my-project`，改为占位文本或留空

#### Scenario: 状态栏无假状态
- **WHEN** 用户打开 Workspace
- **THEN** StatusBar 不显示硬编码假分支/错误数/光标位置，改为显示空状态或移除假值

## MODIFIED Requirements

### Requirement: ProvidersSection 表单
`ProvidersSection.tsx` 的 ProviderForm SHALL 在 Models 字段旁新增"获取模型列表"按钮，所有 label 与按钮文案 SHALL 为中文。

### Requirement: getDefaultWorkspaceState 默认值
`getDefaultWorkspaceState().editorTabs` SHALL 返回空数组 `[]`，不再包含 `jwt.ts`/`middleware.ts`/`session.ts` 三个假标签。

## REMOVED Requirements

### Requirement: 硬编码示例代码
**Reason**: `EditorArea.tsx` 的 `SAMPLE_CODE_LINES` 是写死的示例 React 代码，永远不与真实文件系统挂钩
**Migration**: 删除常量，编辑器区改为空状态提示

### Requirement: 硬编码文件树
**Reason**: `Sidebar.tsx` 的 `FILE_TREE` 是写死的假目录树，无真实数据源
**Migration**: 删除常量，侧边栏改为空状态提示

### Requirement: 硬编码项目名与状态
**Reason**: `Titlebar.tsx` 的 `my-project` 和 `StatusBar.tsx` 的全假状态值是占位数据
**Migration**: 删除硬编码值，改为占位文本或空状态

### Requirement: 遗留测试脚本
**Reason**: `web/test_webapp.py` 是独立的 Playwright 手动测试脚本，不被构建或 CI 引用
**Migration**: 直接删除文件

## 技术约束与说明

- **CORS**: `fetchModels` 在浏览器直接调用 LLM API 的 models 端点，受与 `streamChat` 相同的 CORS 约束。Anthropic 需 `anthropic-dangerous-direct-browser-access: true` header；OpenAI 官方 API 支持 CORS；第三方兼容端点需自身支持 CORS。
- **模型列表合并**: 拉取的模型与用户已输入的模型合并去重，不覆盖用户手动添加的自定义模型名。
- **中文化范围**: 仅改用户可见的 UI 文案（JSX 文本节点、placeholder、title、aria-label、confirm/alert 参数、错误消息字符串）。代码标识符（变量名、函数名、类型名、CSS 类名）保持英文。
- **空状态**: workbench 区清理后保留组件布局骨架，仅替换内容为空状态提示，不删除组件本身（避免破坏 Workspace 布局）。
