# Checklist

## 动态获取模型列表
- [x] `web/src/services/chatClient.ts` 导出 `fetchModels(provider: Provider): Promise<string[]>` 函数
- [x] `apiType === 'anthropic'` 时发送 `GET {baseURL}/v1/models`，header 含 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`
- [x] `apiType === 'openai'` 时发送 `GET {baseURL}/models`，header 含 `Authorization: Bearer {apiKey}`
- [x] 解析返回 JSON 的 `data[].id` 字段，提取模型 ID 列表
- [x] 非 2xx 响应或网络错误时抛出含状态码和错误文本的 Error
- [x] `ProvidersSection.tsx` 的 ProviderForm 新增"获取模型列表"按钮
- [x] 按钮仅在 apiKey 和 baseURL 均非空时启用，否则 disabled 且 title 提示"请先填写 Base URL 和 API Key"
- [x] 点击后显示 loading 状态，拉取成功后合并去重填充 modelsText
- [x] 拉取失败显示错误提示，不阻塞保存，modelsText 保持不变
- [x] fetching 时按钮显示"拉取中…"并禁用

## 清理假文件
- [x] `web/test_webapp.py` 文件已删除
- [x] `web/src/components/workbench/EditorArea.tsx` 无 `SAMPLE_CODE_LINES` 常量
- [x] `web/src/components/workbench/EditorArea.tsx` 无 `TAB_ICONS` 假映射
- [x] 编辑器区显示空状态提示"未打开文件"
- [x] `web/src/components/workbench/Sidebar.tsx` 无 `FILE_TREE` 常量
- [x] 侧边栏文件树区域显示空状态提示"暂无文件"
- [x] `web/src/components/workbench/Titlebar.tsx` 无硬编码 `my-project`
- [x] 标题栏显示占位文本"未选择项目"或留空
- [x] `web/src/components/workbench/StatusBar.tsx` 无硬编码假状态值（分支、错误数、光标位置等）
- [x] `web/src/types/index.ts` 的 `getDefaultWorkspaceState().editorTabs` 为空数组 `[]`

## UI 中文化 — workbench 区
- [x] `ChatPanel.tsx` 的 CHAT_TABS label 为中文（如"对话"/"计划"）
- [x] `ChatPanel.tsx` 的 title 属性为中文（如"折叠面板""发送中…""发送消息"）
- [x] `ActivityRail.tsx` 的 RAIL_ITEMS label 为中文（如"文件""搜索""Git""终端"）
- [x] `ActivityRail.tsx` 的 title 属性为中文（如"会话""设置"）
- [x] `Titlebar.tsx` 的 View 模式 label 为中文（如"详细""普通""摘要"）
- [x] `Titlebar.tsx` 的 Toggle 提示为中文（如"切换侧栏""切换面板"）
- [x] `StatusBar.tsx`（如保留）文案为中文

## UI 中文化 — settings 区
- [x] `SettingsNav.tsx` 的 NAV_GROUPS 分组标题为中文（通用/提供商/模型/权限/外观/快捷键/数据）
- [x] `SettingsNav.tsx` 的导航项 label 为中文
- [x] `SettingsContent.tsx` 的所有 section 标题为中文（基础设置/默认模型/上下文窗口等）
- [x] `SettingsContent.tsx` 的字段 label 与描述为中文
- [x] `SettingsContent.tsx` 的按钮文案为中文（导出/清除历史/立即检查/打开等）
- [x] `SettingsContent.tsx` 的下拉选项为中文（如 7 天/30 天/永久）
- [x] `ProvidersSection.tsx` 的 label 为中文（名称/API 类型/Base URL/API Key/模型）
- [x] `ProvidersSection.tsx` 的按钮为中文（编辑/删除/取消/保存/添加提供商/获取模型列表）
- [x] `ProvidersSection.tsx` 的 alert 标题与描述为中文（安全提示）
- [x] `ProvidersSection.tsx` 的 confirm 文案为中文
- [x] `ProvidersSection.tsx` 的空状态为中文（"暂无已配置的提供商"）

## UI 中文化 — sessions 区与页面
- [x] `NewSessionModal.tsx` 的标题为中文（"新建会话"）
- [x] `NewSessionModal.tsx` 的 label 为中文（项目路径/提供商/模型/权限模式）
- [x] `NewSessionModal.tsx` 的 placeholder 为中文
- [x] `NewSessionModal.tsx` 的按钮为中文（取消/创建）
- [x] `NewSessionModal.tsx` 的空状态 option 为中文（"暂无已配置的提供商"/"暂无可用模型"）
- [x] `NewSessionModal.tsx` 的 PERMISSION_LABELS 为中文（默认/计划/自动接受/绕过权限）
- [x] `Sessions.tsx` 的 TABS label 为中文（活跃/历史/已归档）
- [x] `Sessions.tsx` 的标题与副标题为中文
- [x] `Sessions.tsx` 的按钮为中文（工作区/新建会话）
- [x] `Sessions.tsx` 的 formatRelativeTime 输出为中文（刚刚/X 分钟前/X 小时前/X 天前）
- [x] `Sessions.tsx` 的空状态为中文
- [x] `Settings.tsx` 的标题与副标题为中文
- [x] `Settings.tsx` 的按钮为中文（返回工作区/会话）

## UI 中文化 — commands 与 hooks
- [x] `commands/help.tsx` 文案为中文（可用命令/关闭等）
- [x] `commands/model.tsx` 文案为中文（选择模型/取消/设置 AI 模型等）
- [x] `commands/cost.tsx` 文案为中文（会话成本/输入 token/输出 token/缓存读取等）
- [x] `commands/status.tsx` 文案为中文（状态/会话 ID/提供商/模型/消息数/最近活动/进行中的工具等）
- [x] `commands/clear.ts` 反馈消息为中文（"已清空对话"）
- [x] `commands/compact.ts` 描述为中文（prompt 内容保留英文）
- [x] `useChat.ts` 的 4 条错误提示为中文

## 构建验证
- [x] `cd /workspace/web && bun run build` 通过（tsc + vite build 无错误）
- [x] `web/test_webapp.py` 已删除
- [x] 全局搜索 `SAMPLE_CODE_LINES` 在 src 中无残留
- [x] 全局搜索 `FILE_TREE` 在 src 中无残留
- [x] 全局搜索 `my-project` 在 src 中无硬编码残留（注释中提及可保留）
- [x] 全局搜索 `jwt.ts`/`middleware.ts`/`session.ts` 在 `getDefaultWorkspaceState` 中无残留
- [x] `fetchModels` 函数在 chatClient.ts 中存在且被 ProvidersSection 调用
- [x] UI 文案无残留英文（技术专有名词 API Key/Base URL/Provider/Model/Token 除外）
