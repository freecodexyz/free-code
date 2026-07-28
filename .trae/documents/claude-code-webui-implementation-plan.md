# Claude Code Web UI - 项目实施计划

## 概述

将 `/workspace` 仓库（Claude Code CLI 源码快照）改造为基于设计稿的可运行 Web 项目。设计稿包含 3 个页面：主工作区（Workspace）、会话管理（Sessions）、设置（Settings），使用 TRAE Design Library 的 dark-only token 体系和 `ds-*` 组件。实现过程中最大程度借鉴源码模式，不重复造轮子。

---

## 当前状态分析

### 仓库现状
- **类型**：Bun CLI 项目（React + Ink 终端渲染），非 Web 应用
- **构建**：Bun + TypeScript，无 Web 打包工具
- **运行时**：依赖 `bun:bundle`、`child_process`、`ink` 等终端 API
- **CSS**：无 CSS 文件，样式通过 Ink 内联处理
- **结论**：现有代码无法直接在浏览器运行，需新建 Web 层

### 设计稿资源（`/tmp/design-upload/claude-code-webui/`）
- **3 个 HTML 页面**：`workspace.html`、`sessions.html`、`settings.html`
- **CSS 体系**：TRAE Design Library dark-only token（~400 个 CSS 变量）+ 23 个 `ds-*` 组件样式
- **SVG 图标**：`assets/icons/`（~65 个）+ `assets/claude-icons/`（~40 个）
- **JS 交互**：slash 命令面板、tab 切换、面板折叠（已有基础实现）

### 可借鉴的源码模式

| 源码文件 | 模式 | Web 借鉴点 |
|----------|------|------------|
| `src/state/store.ts` | `createStore<T>(initialState, onChange)` + `useSyncExternalStore` | Web 版工作区状态管理 |
| `src/state/AppState.tsx` | `AppStoreContext` + `AppStateProvider` + `useAppState(selector)` | Web 版状态 Provider + Hook |
| `src/components/Message.tsx` | 按 `message.type` 分发渲染（assistant/user/tool_use） | Web 版聊天消息类型分发 |
| `src/components/Markdown.tsx` | `marked.lexer()` + LRU token 缓存 + 快速路径 | Web 版 Markdown 渲染 |
| `src/components/HighlightedCode.tsx` | `highlight.js` 语法高亮 + memo 优化 | Web 版代码高亮 |
| `src/hooks/useTextInput.ts` | 受控输入 + 键盘事件映射 + 历史记录 | Web 版 Composer 输入 |
| `src/components/StatusLine.tsx` | debounce 更新 + ref 缓存 + memo | Web 版状态栏 |
| `src/components/Spinner.tsx` | CSS 动画 spinner | 设计稿已有 `cc-spinner` |
| `src/components/TagTabs.tsx` | selectedIndex + 可见窗口计算 | Web 版 Tab 切换 |

---

## 实施方案

### 核心决策

1. **技术选型**：Vite + React + TypeScript + CSS Variables
   - 保留 Bun 作为包管理器（与仓库一致）
   - 不引入 Tailwind（设计稿中 Tailwind 仅用于少量 reset，实际样式全部用 CSS 变量）

2. **样式方案**：直接复用设计稿的 CSS 变量 + `ds-*` 组件 CSS
   - 从 `workspace.html` 的 `<style id="theme-vars">` 提取 tokens
   - 从 `<style id="component-vars">` 提取 ds-* 组件 + cc-* 工作区样式
   - 图标使用 `<img src>` 引用 SVG（与设计稿一致）

3. **路由方案**：React Router（3 个页面需要导航）

4. **状态管理**：借鉴源码 `createStore` + `useSyncExternalStore` 模式

5. **项目结构**：在 `/workspace` 根目录下创建 `web/` 子目录，不破坏原有 CLI 源码

### 项目结构

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── assets/
│       ├── icons/            # 从设计稿复制
│       └── claude-icons/     # 从设计稿复制
└── src/
    ├── main.tsx              # React 入口
    ├── App.tsx               # 根组件 + 路由
    ├── styles/
    │   ├── tokens.css        # TRAE Design Token（从设计稿提取）
    │   ├── components.css    # ds-* 组件 + cc-* 样式（从设计稿提取）
    │   └── global.css        # 全局重置
    ├── state/
    │   ├── store.ts          # createStore（借鉴 src/state/store.ts）
    │   └── WorkspaceState.ts # 工作区状态（借鉴 AppState 模式）
    ├── pages/
    │   ├── Workspace.tsx     # 主工作区页面
    │   ├── Sessions.tsx      # 会话管理页面
    │   └── Settings.tsx      # 设置页面
    ├── components/
    │   ├── workbench/
    │   │   ├── Titlebar.tsx
    │   │   ├── ActivityRail.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── EditorArea.tsx
    │   │   ├── ChatPanel.tsx
    │   │   ├── StatusBar.tsx
    │   │   └── SlashCommandPanel.tsx
    │   ├── sessions/
    │   │   ├── SessionCard.tsx
    │   │   └── NewSessionModal.tsx
    │   ├── settings/
    │   │   ├── SettingsNav.tsx
    │   │   └── SettingsContent.tsx
    │   ├── Message.tsx       # 消息组件（借鉴源码 Message.tsx）
    │   ├── Markdown.tsx      # Markdown 渲染（借鉴源码 Markdown.tsx）
    │   └── Spinner.tsx       # 加载动画
    ├── hooks/
    │   ├── useWorkspaceState.ts  # 借鉴 useAppState
    │   ├── usePanelToggle.ts     # 面板折叠
    │   └── useSlashCommand.ts    # Slash 命令
    └── types/
        └── index.ts
```

---

## 具体实施步骤

### 步骤 1：初始化 Web 项目 + 复制资源

**操作**：
- 在 `/workspace/web/` 创建 Vite + React + TypeScript 项目
- 配置 `vite.config.ts`、`tsconfig.json`、`package.json`
- 从设计稿复制图标资产到 `web/public/assets/icons/` 和 `web/public/assets/claude-icons/`

**依赖**：
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "marked": "^17.0.0",
    "highlight.js": "^11.11.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

**文件**：
- `/workspace/web/package.json` — 新建
- `/workspace/web/vite.config.ts` — 新建
- `/workspace/web/tsconfig.json` — 新建
- `/workspace/web/index.html` — 新建

### 步骤 2：提取设计系统样式

**操作**：
- 从 `workspace.html` 的 `<style id="theme-vars">` 提取 `:root` 变量 → `tokens.css`
- 从 `workspace.html` 的 `<style id="component-vars">` 提取 ds-* 组件 + cc-* 工作区样式 → `components.css`
- 创建 `global.css`（CSS 重置 + 字体 fallback + body 基础样式 + 滚动条样式）
- **直接从设计稿复制，不做修改**

**文件**：
- `/workspace/web/src/styles/tokens.css` — 从设计稿提取
- `/workspace/web/src/styles/components.css` — 从设计稿提取
- `/workspace/web/src/styles/global.css` — 新建

### 步骤 3：状态管理（借鉴源码模式）

**操作**：
- 将 `src/state/store.ts` 的 `createStore` 模式迁移到 Web（去掉 `bun:bundle` 依赖，保留核心逻辑）
- 创建 `WorkspaceState` 类型定义和默认值
- 创建 `WorkspaceStateProvider` + `useWorkspaceState(selector)` + `useSetWorkspaceState()`

**借鉴源码**：
- `src/state/store.ts` → `web/src/state/store.ts`（直接复用，无终端依赖）
- `src/state/AppState.tsx` → `web/src/state/WorkspaceState.ts`（简化版，仅工作区状态）

**WorkspaceState 类型**：
```typescript
type WorkspaceState = {
  sidebarOpen: boolean
  chatPanelOpen: boolean
  activeRailItem: 'files' | 'search' | 'git' | 'terminal'
  activeChatTab: 'chat' | 'plan'
  activeViewMode: 'verbose' | 'normal' | 'summary'
  slashCommandOpen: boolean
  slashCommandFilter: string
  slashCommandIndex: number
  messages: ChatMessage[]
  editorTabs: EditorTab[]
  activeEditorTab: string | null
}
```

### 步骤 4：搭建应用框架 + 路由

**操作**：
- 创建 React 入口 `main.tsx` 和根组件 `App.tsx`
- 配置 React Router（3 个路由：`/`、`/sessions`、`/settings`）
- 引入全局样式

**文件**：
- `/workspace/web/src/main.tsx` — 新建
- `/workspace/web/src/App.tsx` — 新建

### 步骤 5：实现主工作区页面（Workspace）

**操作**：
- 将 `workspace.html` 的 HTML 结构转化为 React 组件
- 拆分为 7 个子组件
- 实现面板折叠交互、Slash 命令面板交互、Tab 切换

**组件与交互**：

| 组件 | 设计稿 HTML 区域 | 关键交互 | 借鉴源码 |
|------|------------------|----------|----------|
| Titlebar | `.cc-titlebar` | View mode 切换 | `TagTabs` 的 selectedIndex |
| ActivityRail | `.cc-activity-rail` | 按钮切换 sidebar 内容 | `TagTabs` 的 selectedIndex |
| Sidebar | `.cc-sidebar` | 折叠/展开 | `AppState` 的 selector |
| EditorArea | `.cc-editor-area` | Tab 切换/关闭 | `TagTabs` |
| ChatPanel | `.cc-chat-panel` | Chat/Plan tab、消息列表 | `Message.tsx` 消息分发 |
| StatusBar | `.cc-statusbar` | — | `StatusLine` debounce |
| SlashCommandPanel | `.cc-slash-panel` | 键盘导航 | `useTextInput` 键盘映射 |

**文件**：
- `/workspace/web/src/pages/Workspace.tsx`
- `/workspace/web/src/components/workbench/Titlebar.tsx`
- `/workspace/web/src/components/workbench/ActivityRail.tsx`
- `/workspace/web/src/components/workbench/Sidebar.tsx`
- `/workspace/web/src/components/workbench/EditorArea.tsx`
- `/workspace/web/src/components/workbench/ChatPanel.tsx`
- `/workspace/web/src/components/workbench/StatusBar.tsx`
- `/workspace/web/src/components/workbench/SlashCommandPanel.tsx`

### 步骤 6：实现消息 + Markdown 组件

**操作**：
- 借鉴 `src/components/Message.tsx` 的消息类型分发模式
- 借鉴 `src/components/Markdown.tsx` 的 `marked.lexer()` + LRU 缓存模式
- 使用 `highlight.js` Web API 实现代码高亮

**文件**：
- `/workspace/web/src/components/Message.tsx` — 借鉴源码 Message.tsx
- `/workspace/web/src/components/Markdown.tsx` — 借鉴源码 Markdown.tsx
- `/workspace/web/src/components/Spinner.tsx` — 使用设计稿 `cc-spinner` CSS

### 步骤 7：实现会话管理页面（Sessions）

**操作**：
- 将 `sessions.html` 转化为 React 组件
- 统一使用 TRAE dark token（替换 sessions 页面的 Anthropic 品牌色）
- 实现 Tab 切换（Active/History/Archived）、Modal 打开/关闭、卡片交互

**文件**：
- `/workspace/web/src/pages/Sessions.tsx`
- `/workspace/web/src/components/sessions/SessionCard.tsx`
- `/workspace/web/src/components/sessions/NewSessionModal.tsx`

### 步骤 8：实现设置页面（Settings）

**操作**：
- 将 `settings.html` 转化为 React 组件
- 实现 Nav 项切换、Switch 开关、Select 下拉

**文件**：
- `/workspace/web/src/pages/Settings.tsx`
- `/workspace/web/src/components/settings/SettingsNav.tsx`
- `/workspace/web/src/components/settings/SettingsContent.tsx`

### 步骤 9：Hooks + 类型

**操作**：
- 创建 `useWorkspaceState` hook（借鉴 `useAppState`）
- 创建 `usePanelToggle` hook
- 创建 `useSlashCommand` hook（借鉴 `useTextInput` 键盘映射）
- 定义类型（ChatMessage、EditorTab、SlashCommand 等）

**文件**：
- `/workspace/web/src/hooks/useWorkspaceState.ts`
- `/workspace/web/src/hooks/usePanelToggle.ts`
- `/workspace/web/src/hooks/useSlashCommand.ts`
- `/workspace/web/src/types/index.ts`

### 步骤 10：多端适配

**操作**：
- Workspace：响应式 grid（移动端隐藏 sidebar/chat，显示全屏编辑器）
- Sessions：卡片网格响应式（2 列 → 1 列）
- Settings：移动端 nav 折叠为顶部 tabs
- 添加 media query 断点

| 断点 | 适配策略 |
|------|----------|
| ≥1280px | 完整 4 列 IDE 布局 |
| 1024-1279px | 隐藏 sidebar，chat panel 可折叠 |
| 768-1023px | 隐藏 sidebar + chat，仅编辑器 |
| <768px | 移动端：垂直堆叠，底部 tab 导航 |

### 步骤 11：验证 + 启动

**操作**：
- `cd /workspace/web && bun install` 安装依赖
- `bun run dev` 启动开发服务器
- 验证 3 个页面视觉效果与设计稿一致
- 验证交互功能正常
- 验证多端适配

---

## 关键约束

1. **Token 忠诚**：所有颜色/字体/间距使用 `var(--token-name)`，不硬编码
2. **组件复用**：优先使用 `ds-*` 组件 CSS，CC 特有组件用 TRAE token 构建
3. **样式提取**：tokens.css 和 components.css 直接从设计稿复制，保持一致
4. **不破坏原有代码**：Web 项目放在 `web/` 子目录，不影响 CLI 源码
5. **图标复用**：使用设计稿提供的 SVG 图标，不创建新图标
6. **源码借鉴**：store.ts、Message.tsx、Markdown.tsx 等核心模式直接借鉴，不重新发明

---

## 假设与决策

- **设备类型**：desktop-first（IDE 工具），移动端做基本适配
- **Token 体系**：统一使用 TRAE dark-only token（sessions 页面原设计使用不同 token，需适配）
- **不引入 Tailwind**：设计稿中 Tailwind 仅用于少量 reset，实际样式全部用 CSS 变量
- **图标方案**：使用 `<img src>` 引用 SVG（与设计稿一致）
- **状态管理**：借鉴源码 `createStore` + `useSyncExternalStore`，不引入 Redux/Zustand
- **包管理器**：使用 Bun（与仓库一致）
- **不需要连接真实后端 API**：纯前端展示
- **不需要暗/亮主题切换**：设计稿为 dark-only

---

## 文件变更清单

### 新建文件（~25 个）

| 文件 | 说明 | 借鉴源码 |
|------|------|----------|
| `web/index.html` | SPA 入口 | — |
| `web/package.json` | 依赖 | — |
| `web/vite.config.ts` | Vite 配置 | — |
| `web/tsconfig.json` | TS 配置 | — |
| `web/src/main.tsx` | React 入口 | — |
| `web/src/App.tsx` | 根组件 + 路由 | `src/components/App.tsx` 的 Provider 模式 |
| `web/src/styles/tokens.css` | TRAE Token | 从 workspace.html 提取 |
| `web/src/styles/components.css` | ds-* + cc-* 样式 | 从 workspace.html 提取 |
| `web/src/styles/global.css` | 全局样式 | — |
| `web/src/state/store.ts` | createStore | `src/state/store.ts`（直接复用） |
| `web/src/state/WorkspaceState.ts` | 工作区状态 | `src/state/AppState.tsx` |
| `web/src/types/index.ts` | 类型定义 | `src/types/message.ts` |
| `web/src/pages/Workspace.tsx` | 主工作区 | — |
| `web/src/pages/Sessions.tsx` | 会话管理 | — |
| `web/src/pages/Settings.tsx` | 设置 | — |
| `web/src/components/workbench/Titlebar.tsx` | 标题栏 | — |
| `web/src/components/workbench/ActivityRail.tsx` | 活动栏 | — |
| `web/src/components/workbench/Sidebar.tsx` | 侧边栏 | — |
| `web/src/components/workbench/EditorArea.tsx` | 编辑器 | `src/components/HighlightedCode.tsx` |
| `web/src/components/workbench/ChatPanel.tsx` | 聊天面板 | `src/components/Message.tsx` |
| `web/src/components/workbench/StatusBar.tsx` | 状态栏 | `src/components/StatusLine.tsx` |
| `web/src/components/workbench/SlashCommandPanel.tsx` | 命令面板 | `src/hooks/useTextInput.ts` |
| `web/src/components/Message.tsx` | 消息 | `src/components/Message.tsx` |
| `web/src/components/Markdown.tsx` | Markdown | `src/components/Markdown.tsx` |
| `web/src/components/Spinner.tsx` | 加载动画 | — |
| `web/src/components/sessions/SessionCard.tsx` | 会话卡片 | — |
| `web/src/components/sessions/NewSessionModal.tsx` | 新建会话弹窗 | — |
| `web/src/components/settings/SettingsNav.tsx` | 设置导航 | — |
| `web/src/components/settings/SettingsContent.tsx` | 设置内容 | — |
| `web/src/hooks/useWorkspaceState.ts` | 状态 hook | `src/state/AppState.tsx` |
| `web/src/hooks/usePanelToggle.ts` | 面板切换 | — |
| `web/src/hooks/useSlashCommand.ts` | 命令 hook | `src/hooks/useTextInput.ts` |

### 复制的资源文件

| 源 | 目标 |
|----|------|
| `/tmp/design-upload/claude-code-webui/assets/icons/*` | `web/public/assets/icons/` |
| `/tmp/design-upload/claude-code-webui/assets/claude-icons/*` | `web/public/assets/claude-icons/` |

### 不修改的文件

原仓库所有文件保持不变。

---

## 验证步骤

1. `cd /workspace/web && bun install` — 依赖安装成功
2. `bun run dev` — 开发服务器启动成功
3. 访问 `http://localhost:5173/` — Workspace 页面正常显示
4. 访问 `/sessions` — Sessions 页面正常显示
5. 访问 `/settings` — Settings 页面正常显示
6. 面板折叠/展开交互正常
7. Slash 命令面板交互正常
8. Tab 切换、Modal 开关交互正常
9. 响应式布局在不同屏幕宽度下正常
10. 视觉效果与设计稿一致（颜色、字体、间距、组件样式）
