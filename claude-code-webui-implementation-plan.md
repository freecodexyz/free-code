# Claude Code Web UI 实施方案（仅 IDE 工作区）

## 概述

将 `/workspace` 仓库（Claude Code CLI 源码快照）改造为基于设计稿的可运行 Web 项目，**仅实现 IDE 工作区页面**。设计稿位于 `/tmp/webui-design/claude-code-webui/`。

## 当前状态分析

### 仓库现状
- **类型**：Bun CLI 项目（React + Ink 终端渲染），非 Web 应用
- **构建**：Bun + TypeScript，无 Web 打包工具
- **运行时**：依赖 `bun:bundle`、`child_process`、`ink` 等终端 API
- **CSS**：无 CSS 文件，样式通过 Ink 内联处理
- **结论**：现有代码无法直接在浏览器运行，需新建 Web 层

### 设计稿资源（仅 workspace.html）
- **1 个 HTML 页面**：`workspace.html`（IDE 工作区，105KB）
- **CSS 体系**：TRAE Design Library dark-only token（~400 个 CSS 变量）+ 23 个 `ds-*` 组件样式
- **SVG 图标**：`assets/icons/`（~80 个）+ `assets/claude-icons/`（~40 个）
- **JS 交互**：slash 命令面板、tab 切换、面板折叠（已有基础实现）

### 可借鉴的源码模式（详细分析）

经过对源码的深入阅读，以下模式可直接借鉴到 Web 实现：

#### 1. 状态管理 — `src/state/AppState.tsx` + `src/state/AppStateStore.ts`
- **模式**：`createStore(initialState, onChange)` + `useSyncExternalStore` + selector
- **借鉴点**：Web 版工作区状态（sidebar 展开/折叠、chat panel 显隐、active tab、消息列表等）可用同样模式
- **具体代码**：`AppStoreContext` + `AppStateProvider` + `useAppState(selector)` + `useSetAppState()`
- **迁移方式**：去掉 `bun:bundle` 依赖，保留 `createStore` + `useSyncExternalStore` 模式

#### 2. 消息渲染 — `src/components/Message.tsx` + `src/components/messages/`
- **模式**：按消息类型分发渲染（`AssistantTextMessage`、`UserTextMessage`、`AssistantToolUseMessage`）
- **借鉴点**：Web 版聊天面板的消息列表可复用同样的消息类型分发逻辑
- **具体代码**：`Message` 组件根据 `message.type` 分发到不同子组件
- **迁移方式**：将 Ink 的 `<Box>/<Text>` 替换为 HTML `<div>/<span>`，保留消息类型判断逻辑

#### 3. Markdown 渲染 — `src/components/Markdown.tsx`
- **模式**：`marked.lexer()` 解析 + 缓存 + 自定义渲染
- **借鉴点**：Web 版可直接使用 `marked` 库（已在依赖中），保留 token 缓存优化
- **迁移方式**：将 Ink 渲染替换为 `dangerouslySetInnerHTML` 或 React 组件渲染

#### 4. 代码高亮 — `src/components/HighlightedCode.tsx`
- **模式**：`cli-highlight` + `highlight.js` 语法高亮
- **借鉴点**：Web 版编辑器区域的代码高亮可直接使用 `highlight.js`（已在依赖中）
- **迁移方式**：使用 `highlight.js` 的 Web API（`hljs.highlight()`）

#### 5. 文本输入 — `src/components/TextInput.tsx` + `src/hooks/useTextInput.ts`
- **模式**：受控输入 + 键盘事件映射 + 历史记录
- **借鉴点**：Web 版 Composer 输入框可复用 `useTextInput` 的键盘处理逻辑（上下键历史、Enter 提交等）
- **迁移方式**：将 Ink 的 `useInput` 替换为 DOM `onKeyDown`，保留输入状态管理

#### 6. 虚拟滚动 — `src/components/VirtualMessageList.tsx` + `src/hooks/useVirtualScroll.ts`
- **模式**：虚拟滚动优化长消息列表
- **借鉴点**：Web 版聊天消息列表可借鉴虚拟滚动思路
- **迁移方式**：使用 CSS `overflow-y: auto` + `IntersectionObserver` 或简单滚动

#### 7. 状态栏 — `src/components/StatusLine.tsx`
- **模式**：debounce 更新 + ref 缓存 + memo 优化
- **借鉴点**：Web 版状态栏可借鉴 debounce + memo 模式
- **迁移方式**：将 Ink `<Box>/<Text>` 替换为 HTML，保留 debounce 逻辑

#### 8. Spinner — `src/components/Spinner.tsx`
- **模式**：CSS 动画 spinner
- **借鉴点**：Web 版工具调用进度 spinner 可直接用 CSS animation
- **迁移方式**：设计稿已有 `cc-spinner` CSS 类，直接使用

#### 9. Tab 切换 — `src/components/TagTabs.tsx`
- **模式**：selectedIndex + 可见窗口计算
- **借鉴点**：Web 版的 Chat/Plan tab、Verbose/Normal/Summary tab 可借鉴
- **迁移方式**：简化为 `useState(activeIndex)` + onClick 切换

#### 10. 全屏布局 — `src/components/FullscreenLayout.tsx`
- **模式**：scrollable + bottom + overlay + modal 四层布局
- **借鉴点**：Web 版工作区的 Grid 布局可借鉴此分层思路
- **迁移方式**：用 CSS Grid 替代 Ink 的 flex 布局

---

## 实施计划

### 阶段 1：项目脚手架

**目标**：在仓库中创建独立的 `web/` 子项目

#### 1.1 目录结构

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
    ├── App.tsx               # 根组件
    ├── styles/
    │   ├── tokens.css        # TRAE Design Token
    │   ├── components.css    # ds-* 组件样式
    │   └── global.css        # 全局重置
    ├── state/
    │   ├── WorkspaceState.ts # 工作区状态（借鉴 AppState 模式）
    │   └── store.ts          # createStore（借鉴源码 store.ts）
    ├── components/
    │   ├── Titlebar.tsx      # 标题栏
    │   ├── ActivityRail.tsx  # 活动栏
    │   ├── Sidebar.tsx       # 侧边栏 + FileTree
    │   ├── EditorArea.tsx    # 编辑器区域 + EditorTabs
    │   ├── ChatPanel.tsx     # 聊天面板
    │   ├── StatusBar.tsx     # 状态栏
    │   ├── SlashCommandPanel.tsx  # Slash 命令面板
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

#### 1.2 技术选型

| 项目 | 选择 | 理由 |
|------|------|------|
| 构建工具 | Vite | 快速 HMR，原生 TS/JSX |
| 样式 | 纯 CSS（TRAE token + ds-*） | 设计稿已有完整 CSS |
| 图标 | `<img src>` 引用 SVG | 设计稿已提供所有 SVG |
| 状态 | React Context + useSyncExternalStore | 借鉴源码 AppState 模式 |
| Markdown | marked（已有依赖） | 借鉴源码 Markdown.tsx |
| 代码高亮 | highlight.js（已有依赖） | 借鉴源码 HighlightedCode.tsx |

#### 1.3 依赖

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
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

### 阶段 2：CSS 基础设施

#### 2.1 提取 Token CSS → `web/src/styles/tokens.css`

从 `workspace.html` 的 `<style id="theme-vars">` 提取 `:root` 变量（约 400 个），包含：
- radius / spacers / font / body / heading / code token
- bg / bg-brand / text / text-brand / icon / icon-brand / border token
- accent / status / brand / special token

#### 2.2 提取组件 CSS → `web/src/styles/components.css`

从 `workspace.html` 的 `<style id="component-vars">` 提取 23 个 `ds-*` 组件样式，包括：
- `ds-activityrail` — 活动栏
- `ds-wbtitlebar` — 标题栏
- `ds-editortabs` / `ds-editortab` — 编辑器标签
- `ds-filetree` — 文件树
- `ds-composer` — 输入框
- `ds-statusbar` — 状态栏
- `ds-tabs` / `ds-tab` — 标签切换
- `ds-avatar` — 头像
- `ds-btn` — 按钮
- `ds-kbd` — 快捷键标签
- 其他表单/菜单/对话框组件

同时提取 `cc-*` 工作区专属样式：
- `.cc-workbench` — Grid 布局
- `.cc-titlebar` / `.cc-activity-rail` / `.cc-sidebar` / `.cc-editor-area` / `.cc-chat-panel` / `.cc-statusbar`
- `.cc-msg` — 消息气泡
- `.cc-tool-block` — 工具调用块
- `.cc-slash-panel` — Slash 命令面板
- `.cc-spinner` — 加载动画
- `.cc-chat-composer` / `.cc-chat-header` / `.cc-chat-messages`

#### 2.3 全局 CSS → `web/src/styles/global.css`

- CSS 重置（box-sizing, margin, padding）
- 字体 fallback（SF Pro Text → system-ui, JetBrains Mono → monospace）
- body 基础样式（bg: `var(--bg-base-default)`, color: `var(--text-default)`）
- 滚动条样式（dark theme）
- 代码行号样式

### 阶段 3：状态管理（借鉴源码模式）

#### 3.1 Store 模式 → `web/src/state/store.ts`

借鉴 `src/state/AppState.tsx` 的 `createStore` + `useSyncExternalStore` 模式：

```typescript
// 借鉴 src/state/AppState.tsx 的 AppStoreContext + useAppState 模式
type WorkspaceState = {
  sidebarOpen: boolean
  chatPanelOpen: boolean
  activeRailItem: 'files' | 'search' | 'git' | 'terminal'
  activeChatTab: 'chat' | 'plan'
  activeViewMode: 'verbose' | 'normal' | 'summary'
  slashCommandOpen: boolean
  slashCommandFilter: string
  messages: ChatMessage[]
  // ...
}
```

#### 3.2 状态 Hook → `web/src/hooks/useWorkspaceState.ts`

借鉴 `useAppState(selector)` + `useSetAppState()` 模式。

### 阶段 4：组件实现

#### 4.1 Titlebar → `web/src/components/Titlebar.tsx`

从设计稿 HTML 结构转换：
- Traffic lights（3 个 `ds-wbtitlebar__light` 圆点）
- CC logo（`<img src="assets/icons/logo.svg">`）
- Project selector（"my-project" 下拉）
- View mode tabs（Verbose/Normal/Summary — 借鉴 `TagTabs.tsx` 的 selectedIndex 模式）
- Sidebar/Panel toggle 按钮
- Avatar（`ds-avatar`）

#### 4.2 ActivityRail → `web/src/components/ActivityRail.tsx`

从设计稿 HTML 结构转换：
- 4 个功能按钮（Files/Search/Git/Terminal）— `ds-activityrail__btn`
- Spacer + Divider
- 2 个导航按钮（Sessions/Settings）— `ds-activityrail__btn`
- Active 指示器（绿色竖条 `is-active`）

#### 4.3 Sidebar → `web/src/components/Sidebar.tsx`

从设计稿 HTML 结构转换：
- Explorer 标题
- FileTree（`ds-filetree` + `ds-filetree__row`，含 depth 缩进、chevron、icon、label）

#### 4.4 EditorArea → `web/src/components/EditorArea.tsx`

从设计稿 HTML 结构转换：
- EditorTabs（`ds-editortabs` + `ds-editortab`，含 icon + 文件名 + close 按钮）
- 代码内容（带行号 + 语法高亮 — 借鉴 `HighlightedCode.tsx` 使用 `highlight.js`）

#### 4.5 ChatPanel → `web/src/components/ChatPanel.tsx`

从设计稿 HTML 结构转换：
- Chat header（Claude 标识 + Chat/Plan tabs + collapse 按钮）
- 消息列表（`cc-chat-messages`）
  - 用户消息（`cc-msg--user`）
  - 助手消息（`cc-msg--assistant`）— 借鉴 `AssistantTextMessage.tsx`
  - 工具调用块（`cc-tool-block`）— done/progress 状态
- Composer（`ds-composer` + textarea + toolbar）
- Slash 命令面板（`cc-slash-panel`）

#### 4.6 StatusBar → `web/src/components/StatusBar.tsx`

从设计稿 HTML 结构转换：
- Git branch + sync status dot
- Error/warning count
- Cursor position + encoding + language

#### 4.7 Message → `web/src/components/Message.tsx`

借鉴 `src/components/Message.tsx` 的消息类型分发模式：
- `type: 'user'` → 用户消息气泡
- `type: 'assistant'` → 助手消息（含 Markdown 渲染）
- `type: 'tool-use'` → 工具调用块（done/progress）

#### 4.8 Markdown → `web/src/components/Markdown.tsx`

借鉴 `src/components/Markdown.tsx` 的 `marked.lexer()` + 缓存模式：
- 使用 `marked` 解析 Markdown
- 代码块使用 `highlight.js` 高亮
- 保留 token 缓存优化

#### 4.9 Spinner → `web/src/components/Spinner.tsx`

使用设计稿的 `cc-spinner` CSS 动画（旋转圆环），无需借鉴源码的终端 spinner。

#### 4.10 SlashCommandPanel → `web/src/components/SlashCommandPanel.tsx`

从设计稿 HTML 结构转换：
- 搜索框 + 命令列表
- 键盘导航（上下键 + Enter 选择 — 借鉴 `useTextInput.ts` 的键盘映射模式）

### 阶段 5：交互功能

| 交互 | 实现方式 | 借鉴源码 |
|------|----------|----------|
| Sidebar 折叠/展开 | `useWorkspaceState(s => s.sidebarOpen)` + CSS Grid `grid-template-columns` 切换 | `AppState` 的 selector 模式 |
| Chat Panel 折叠/展开 | `useWorkspaceState(s => s.chatPanelOpen)` + CSS Grid 切换 | 同上 |
| Activity Rail 按钮切换 | `useWorkspaceState(s => s.activeRailItem)` + `is-active` class | `TagTabs` 的 selectedIndex |
| Slash 命令面板 | textarea `onInput` 检测 `/` + `useSlashCommand` hook | `useTextInput` 的键盘映射 |
| Tab 切换 | `useState(activeTab)` + `is-active` class | `TagTabs` 的 selectedIndex |
| 消息 hover | CSS `:hover` + `translateY(-1px)` | — |
| 工具调用状态 | `cc-tool-block--done` / `cc-tool-block--progress` class | `Spinner` 的状态切换 |

### 阶段 6：多端适配

| 断点 | 适配策略 |
|------|----------|
| ≥1280px | 完整 4 列 IDE 布局 |
| 1024-1279px | 隐藏 sidebar，chat panel 可折叠 |
| 768-1023px | 隐藏 sidebar + chat，仅编辑器 |
| <768px | 移动端：垂直堆叠，底部 tab 导航 |

关键适配点：
- Sidebar/Chat 面板通过 CSS media query + JS toggle 控制
- 触摸适配：按钮/开关最小 44px 触摸区域
- Composer 输入框在移动端全宽

### 阶段 7：验证

1. `cd web && npm install && npm run dev` — Vite dev server 启动
2. 浏览器访问 `http://localhost:5173/` — Workspace 页面正常渲染
3. 点击 sidebar toggle — 面板折叠/展开
4. 点击 chat panel toggle — 面板折叠/展开
5. 输入 `/` — Slash 命令面板弹出
6. 切换 Chat/Plan tab — 正常切换
7. 缩放浏览器窗口 — 响应式布局适配
8. 检查 CSS 变量 — 无硬编码颜色值

---

## 关键决策

1. **独立 web/ 目录**：不修改原 CLI 代码
2. **纯 CSS 方案**：设计稿已有完整 CSS，直接提取复用
3. **Vite 构建**：零配置支持 TSX + CSS
4. **状态管理借鉴源码**：`createStore` + `useSyncExternalStore` 模式
5. **消息渲染借鉴源码**：类型分发 + Markdown + 代码高亮
6. **仅实现 IDE 工作区**：不做 Sessions/Settings 页面

## 假设

- 设计稿 `workspace.html` 中的 CSS 和结构即为最终视觉标准
- 不需要连接真实后端 API（纯前端展示）
- 不需要暗/亮主题切换（设计稿为 dark-only）
- 字体使用 web-safe fallback

## 文件变更清单

### 新建文件（~20 个）

| 文件 | 说明 | 借鉴源码 |
|------|------|----------|
| `web/index.html` | SPA 入口 | — |
| `web/package.json` | 依赖 | — |
| `web/vite.config.ts` | Vite 配置 | — |
| `web/tsconfig.json` | TS 配置 | — |
| `web/src/main.tsx` | React 入口 | — |
| `web/src/App.tsx` | 根组件 | `src/components/App.tsx` 的 Provider 模式 |
| `web/src/styles/tokens.css` | TRAE Token | 从 workspace.html 提取 |
| `web/src/styles/components.css` | ds-* 组件 + cc-* 样式 | 从 workspace.html 提取 |
| `web/src/styles/global.css` | 全局样式 | — |
| `web/src/state/store.ts` | createStore | `src/state/AppState.tsx` |
| `web/src/state/WorkspaceState.ts` | 工作区状态 | `src/state/AppStateStore.ts` |
| `web/src/components/Titlebar.tsx` | 标题栏 | — |
| `web/src/components/ActivityRail.tsx` | 活动栏 | — |
| `web/src/components/Sidebar.tsx` | 侧边栏 | — |
| `web/src/components/EditorArea.tsx` | 编辑器 | `src/components/HighlightedCode.tsx` |
| `web/src/components/ChatPanel.tsx` | 聊天面板 | `src/components/Message.tsx` |
| `web/src/components/StatusBar.tsx` | 状态栏 | `src/components/StatusLine.tsx` |
| `web/src/components/SlashCommandPanel.tsx` | 命令面板 | `src/hooks/useTextInput.ts` |
| `web/src/components/Message.tsx` | 消息 | `src/components/Message.tsx` + `messages/` |
| `web/src/components/Markdown.tsx` | Markdown | `src/components/Markdown.tsx` |
| `web/src/components/Spinner.tsx` | 加载动画 | — |
| `web/src/hooks/useWorkspaceState.ts` | 状态 hook | `src/state/AppState.tsx` |
| `web/src/hooks/usePanelToggle.ts` | 面板切换 | — |
| `web/src/hooks/useSlashCommand.ts` | 命令 hook | `src/hooks/useTextInput.ts` |
| `web/src/types/index.ts` | 类型定义 | `src/types/message.ts` |

### 复制的资源文件

| 源 | 目标 |
|----|------|
| `/tmp/webui-design/claude-code-webui/assets/icons/*` | `web/public/assets/icons/` |
| `/tmp/webui-design/claude-code-webui/assets/claude-icons/*` | `web/public/assets/claude-icons/` |

### 不修改的文件

原仓库所有文件保持不变。
