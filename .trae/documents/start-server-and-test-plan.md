# 启动服务器并本地测试 — 实施计划

## 概述

Vite 开发服务器已在 `http://localhost:5173` 上运行（PID 9595），返回 HTTP 200。需要使用 `webapp-testing` 技能（基于 Playwright）对 3 个页面进行视觉验证和交互测试。

## 当前状态分析

- **开发服务器**：已运行，端口 5173，HTTP 200 ✅
- **Playwright Python 模块**：已安装 ✅
- **Playwright 浏览器**：未安装 ❌（`__dirlock` 文件存在，之前安装停滞）
- **项目构建**：`tsc --noEmit` 通过，`vite build` 成功 ✅
- **3 个页面**：Workspace（`/`）、Sessions（`/sessions`）、Settings（`/settings`）✅

## 实施步骤

### 步骤 1：清理并安装 Playwright Chromium 浏览器

- 删除 `/root/.cache/ms-playwright/__dirlock`（解除之前的停滞锁）
- 运行 `python3 -m playwright install chromium` 下载 Chromium 浏览器
- 验证浏览器已安装到 `/root/.cache/ms-playwright/`

### 步骤 2：编写测试脚本

创建 `/tmp/test_webapp.py` Playwright 测试脚本，包含：

1. **Workspace 页面测试**（`/`）：
   - 访问 `http://localhost:5173/`
   - 等待 `networkidle`
   - 截图保存到 `/tmp/workspace.png`
   - 验证关键元素存在：`.ds-wbtitlebar`、`.ds-activityrail`、`.cc-sidebar`、`.cc-editor-area`、`.cc-chat-panel`、`.ds-statusbar`
   - 测试交互：点击 sidebar toggle 按钮，验证 sidebar 隐藏/显示
   - 测试交互：点击 Activity Rail 按钮，验证 active 状态切换

2. **Sessions 页面测试**（`/sessions`）：
   - 访问 `http://localhost:5173/sessions`
   - 截图保存到 `/tmp/sessions.png`
   - 验证 `.ds-pagehead`、`.ds-tabs`、`.ds-card` 存在
   - 测试交互：点击 Tab 切换
   - 测试交互：点击 "New Session" 按钮，验证 Modal 弹出

3. **Settings 页面测试**（`/settings`）：
   - 访问 `http://localhost:5173/settings`
   - 截图保存到 `/tmp/settings.png`
   - 验证 `.ds-navlist`、`.ds-settingrow` 存在
   - 测试交互：点击 Nav 项切换
   - 测试交互：点击 Switch 开关

4. **响应式测试**：
   - 设置视口 1024x768，截图 Workspace
   - 设置视口 375x812（移动端），截图 Workspace

### 步骤 3：运行测试

- 使用 `webapp-testing` 技能的 `with_server.py` 辅助脚本（服务器已运行，可跳过服务器管理）
- 直接运行 `python3 /tmp/test_webapp.py`
- 检查截图输出
- 如果有运行时错误，修复后重新测试

### 步骤 4：查看截图并验证

- 读取 3 个页面截图，确认视觉效果与设计稿一致
- 读取响应式截图，确认多端适配正常
- 如发现问题，记录并修复

## 关键约束

- 服务器已在运行，不需要重新启动
- 使用 `webapp-testing` 技能提供的 Playwright 方案
- 测试脚本放在 `/tmp/` 目录，不污染项目
- 截图保存到 `/tmp/` 目录

## 假设与决策

- 浏览器使用 Chromium headless 模式
- 视口默认 1440x900（desktop）
- 测试不使用 `with_server.py`（因为服务器已在运行）
- 如果 Playwright Chromium 下载失败，回退到 `agent-browser` 方案

## 验证步骤

1. Playwright Chromium 安装成功
2. 测试脚本无错误运行完成
3. 3 个页面截图生成
4. 关键 DOM 元素验证通过
5. 交互功能验证通过
6. 响应式截图生成
