# Tasks

## 阶段一：动态获取模型列表（后端能力）

- [x] Task 1: 在 chatClient.ts 实现 fetchModels 函数
  - [x] SubTask 1.1: 在 `web/src/services/chatClient.ts` 新增并导出 `fetchModels(provider: Provider): Promise<string[]>` 函数
  - [x] SubTask 1.2: `apiType === 'anthropic'` 时发送 `GET {baseURL}/v1/models`，header 含 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`
  - [x] SubTask 1.3: `apiType === 'openai'` 时发送 `GET {baseURL}/models`，header 含 `Authorization: Bearer {apiKey}`
  - [x] SubTask 1.4: 解析返回 JSON 的 `data[].id` 字段，提取模型 ID 列表返回
  - [x] SubTask 1.5: 非 2xx 响应时抛出 `Error`，消息含状态码和响应文本；网络错误抛出 `Error`

## 阶段二：ProvidersSection 集成获取模型按钮

- [x] Task 2: 在 ProvidersSection 的 ProviderForm 新增"获取模型列表"按钮
  - [x] SubTask 2.1: 在 `web/src/components/settings/ProvidersSection.tsx` 的 `ProviderForm` 组件新增 `fetching` 本地 state 和 `fetchError` 本地 state
  - [x] SubTask 2.2: 在 Models 字段下方新增"获取模型列表"按钮，调用 `fetchModels(provider)`
  - [x] SubTask 2.3: 按钮仅在 `apiKey` 和 `baseURL` 均非空时启用，否则 `disabled` 且 `title` 提示"请先填写 Base URL 和 API Key"
  - [x] SubTask 2.4: 点击后 `fetching=true`，拉取成功后合并去重（已有 modelsText + 新拉取的列表），更新 `modelsText`，显示拉取数量提示
  - [x] SubTask 2.5: 拉取失败时设置 `fetchError`，在按钮下方显示错误提示（不阻塞保存）
  - [x] SubTask 2.6: `fetching` 时按钮显示 loading 文本"拉取中…"并禁用

## 阶段三：清理假文件与占位数据

- [x] Task 3: 删除遗留测试脚本
  - [x] SubTask 3.1: 删除 `web/test_webapp.py` 文件
- [x] Task 4: 清理 EditorArea 假代码
  - [x] SubTask 4.1: 删除 `web/src/components/workbench/EditorArea.tsx` 中的 `SAMPLE_CODE_LINES` 常量和 `TAB_ICONS` 假映射
  - [x] SubTask 4.2: 编辑器区内容改为空状态提示"未打开文件"（保留组件布局骨架）
- [x] Task 5: 清理 Sidebar 假文件树
  - [x] SubTask 5.1: 删除 `web/src/components/workbench/Sidebar.tsx` 中的 `FILE_TREE` 常量
  - [x] SubTask 5.2: 文件树区域改为空状态提示"暂无文件"（保留布局骨架）
- [x] Task 6: 清理 Titlebar 与 StatusBar 假数据
  - [x] SubTask 6.1: 删除 `web/src/components/workbench/Titlebar.tsx` 中硬编码的 `my-project`，改为占位文本"未选择项目"
  - [x] SubTask 6.2: 删除 `web/src/components/workbench/StatusBar.tsx` 中全部硬编码假状态值，改为显示空状态或移除假值（保留布局骨架）
- [x] Task 7: 清理 types/index.ts 的 editorTabs
  - [x] SubTask 7.1: 修改 `web/src/types/index.ts` 的 `getDefaultWorkspaceState().editorTabs` 为空数组 `[]`

## 阶段四：UI 中文化

- [x] Task 8: 中文化 workbench 区组件
  - [x] SubTask 8.1: 中文化 `web/src/components/workbench/ChatPanel.tsx`（CHAT_TABS label、title 属性、Sending/Send message）
  - [x] SubTask 8.2: 中文化 `web/src/components/workbench/ActivityRail.tsx`（RAIL_ITEMS label、title 属性）
  - [x] SubTask 8.3: 中文化 `web/src/components/workbench/Titlebar.tsx`（View 模式 label、Toggle 提示）
  - [x] SubTask 8.4: 中文化 `web/src/components/workbench/StatusBar.tsx`（如保留则中文化文案）
- [x] Task 9: 中文化 settings 区组件
  - [x] SubTask 9.1: 中文化 `web/src/components/settings/SettingsNav.tsx`（NAV_GROUPS 全部分组标题与导航项 label）
  - [x] SubTask 9.2: 中文化 `web/src/components/settings/SettingsContent.tsx`（所有 section 标题、字段 label、描述、按钮文案、空状态）
  - [x] SubTask 9.3: 中文化 `web/src/components/settings/ProvidersSection.tsx`（label、按钮、alert、confirm、空状态）
- [x] Task 10: 中文化 sessions 区与页面
  - [x] SubTask 10.1: 中文化 `web/src/components/sessions/NewSessionModal.tsx`（标题、label、placeholder、按钮、空状态 option）
  - [x] SubTask 10.2: 中文化 `web/src/pages/Sessions.tsx`（TABS label、标题、副标题、按钮、formatRelativeTime、空状态）
  - [x] SubTask 10.3: 中文化 `web/src/pages/Settings.tsx`（标题、副标题、按钮）
- [x] Task 11: 中文化 commands 与 hooks 错误提示
  - [x] SubTask 11.1: 中文化 `web/src/commands/help.tsx`（标题、按钮、描述）
  - [x] SubTask 11.2: 中文化 `web/src/commands/model.tsx`（标题、按钮、描述）
  - [x] SubTask 11.3: 中文化 `web/src/commands/cost.tsx`（标题、按钮、行 label、描述）
  - [x] SubTask 11.4: 中文化 `web/src/commands/status.tsx`（标题、按钮、行 label、描述）
  - [x] SubTask 11.5: 中文化 `web/src/commands/clear.ts`（反馈消息）
  - [x] SubTask 11.6: 中文化 `web/src/commands/compact.ts`（描述，prompt 内容保留英文因为是发给模型的）
  - [x] SubTask 11.7: 中文化 `web/src/hooks/useChat.ts` 的 4 条错误提示消息

## 阶段五：构建验证

- [x] Task 12: 构建与验证
  - [x] SubTask 12.1: 执行 `cd /workspace/web && bun run build` 确认 tsc + vite build 通过
  - [x] SubTask 12.2: 确认 `web/test_webapp.py` 已删除
  - [x] SubTask 12.3: 确认 `SAMPLE_CODE_LINES`、`FILE_TREE`、硬编码 `my-project`、假 editorTabs 均已移除
  - [x] SubTask 12.4: 确认 `fetchModels` 函数存在且被 ProvidersSection 调用
  - [x] SubTask 12.5: 确认 UI 文案无残留英文（技术专有名词除外）

# Task Dependencies

- Task 2 依赖 Task 1（fetchModels 函数）
- Task 4-7 相互独立，可并行
- Task 8-11 相互独立，可并行
- Task 12 依赖 Task 1-11（最终验证）
- 可并行：Task 1、Task 3、Task 4、Task 5、Task 6、Task 7（无相互依赖）
- 可并行：Task 8、Task 9、Task 10、Task 11（中文化任务互不依赖）
