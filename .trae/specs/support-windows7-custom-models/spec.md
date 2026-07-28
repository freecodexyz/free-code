# Windows 7 兼容与自定义模型支持 Spec

## Why

当前 free-code CLI 依赖大量 Unix 专属 API（Unix 信号、Unix domain socket、硬编码 `/bin/bash` 路径等）和 Bun 1.3+ 运行时（要求 Windows 10+），无法在 Windows 7 上运行。同时模型选择仅支持内置的 Anthropic 模型别名，用户无法配置第三方 OpenAI 兼容端点或获取可用模型列表。本变更使 CLI 可在 Windows 7 上运行，并支持自定义模型配置与模型列表获取。

## What Changes

### Windows 7 兼容性
- 将所有 Unix 信号（SIGTERM/SIGKILL/SIGHUP）替换为跨平台进程终止方案
- 将 Unix domain socket 替换为 Windows named pipe（`\\.\pipe\` 前缀）
- 将硬编码 Unix 路径（`/bin/bash`、`/usr/bin/plutil`、`/etc/claude-code`、`/etc/os-release`）替换为平台探测逻辑
- 为 NAPI 原生模块（audio-capture-napi、image-processor-napi、modifiers-napi、url-handler-napi）提供 Windows 7 安全的降级路径
- 新增 `install.ps1` Windows 安装脚本（现有 `install.sh` 仅支持 Darwin/Linux）
- **BREAKING**: `--bytecode` 构建标志在 Windows 上移除（Bun 不支持 ESM bytecode）

### 自定义模型支持
- 扩展 `ModelSetting` 类型以支持任意字符串模型名（含 OpenAI 兼容端点）
- 新增 `ANTHROPIC_BASE_URL` 环境变量支持自定义 API 端点
- 新增 `--list-models` CLI 标志，调用 `/v1/models` 端点获取可用模型列表
- 新增 `--model` 标志接受任意字符串（当前仅接受预定义别名）
- 新增配置文件字段 `customModel` 和 `apiBaseUrl`

## Impact

- Affected specs: 无（首个 spec）
- Affected code:
  - `src/utils/model/model.ts` — 模型选择链路、ModelSetting 类型
  - `src/services/api/client.ts` — API 客户端 baseURL/apiKey 传递
  - `src/services/api/providers.ts` — Provider 路由
  - `src/utils/shell/gracefulShutdown.ts` — 进程终止
  - `src/utils/ripgrep.ts` — ripgrep 进程管理
  - `src/utils/platform.ts` — 平台检测
  - `src/tools/BashTool/` — Shell 命令执行
  - `src/entrypoints/cli.tsx` — CLI 入口与参数解析
  - `scripts/build.ts` — 构建配置
  - `package.json` — engines 字段

## ADDED Requirements

### Requirement: Windows 7 平台支持
系统 SHALL 在 Windows 7 SP1 上正常运行，不依赖 Windows 10+ 专属 API。

#### Scenario: Windows 7 上启动 CLI
- **WHEN** 用户在 Windows 7 SP1 上执行 `cli-dev.exe`
- **THEN** CLI 正常启动并显示交互式提示符，不因平台检测失败而崩溃

#### Scenario: 进程终止跨平台
- **WHEN** CLI 在 Windows 上需要终止子进程
- **THEN** 使用 `taskkill /PID <pid> /T /F` 或 `process.kill(pid)` 替代 SIGKILL/SIGTERM

#### Scenario: Shell 命令执行
- **WHEN** 用户在 Windows 上执行 BashTool
- **THEN** 系统使用 `cmd.exe /c` 或检测到的 PowerShell 执行命令，而非 `/bin/bash`

### Requirement: 自定义模型配置
系统 SHALL 支持通过环境变量、CLI 标志和配置文件指定任意模型名称和 API 端点。

#### Scenario: 通过环境变量配置自定义端点
- **WHEN** 用户设置 `ANTHROPIC_BASE_URL=https://api.example.com` 和 `ANTHROPIC_API_KEY=sk-xxx`
- **THEN** 所有 API 请求发送到 `https://api.example.com`，使用指定 API Key

#### Scenario: 通过 CLI 标志指定自定义模型
- **WHEN** 用户执行 `cli-dev --model "deepseek-chat"`
- **THEN** 系统使用 `deepseek-chat` 作为模型名称发送 API 请求

#### Scenario: 通过配置文件持久化自定义模型
- **WHEN** 配置文件包含 `{"customModel": "gpt-4o", "apiBaseUrl": "https://api.openai.com/v1"}`
- **THEN** 系统使用该模型和端点，且优先级低于 CLI 标志和环境变量

### Requirement: 模型列表获取
系统 SHALL 提供 `--list-models` 标志，调用 API 端点的 `/v1/models` 接口获取并展示可用模型列表。

#### Scenario: 列出可用模型
- **WHEN** 用户执行 `cli-dev --list-models`
- **THEN** 系统调用当前配置端点的 `GET /v1/models`，以表格形式展示模型 ID、创建时间

#### Scenario: 自定义端点的模型列表
- **WHEN** 用户设置 `ANTHROPIC_BASE_URL` 后执行 `cli-dev --list-models`
- **THEN** 系统调用自定义端点的 `/v1/models` 接口

### Requirement: Windows 安装脚本
系统 SHALL 提供 `install.ps1` PowerShell 脚本用于 Windows 环境安装。

#### Scenario: Windows 安装
- **WHEN** 用户在 PowerShell 中执行 `.\install.ps1`
- **THEN** 脚本检测 Windows 版本、下载 CLI 二进制、添加到 PATH

## MODIFIED Requirements

### Requirement: 模型选择优先级
模型选择优先级修改为（从高到低）：
1. `--model` CLI 标志（接受任意字符串）
2. `ANTHROPIC_MODEL` 环境变量
3. 配置文件 `customModel` 字段
4. 配置文件 `model` 字段（原有，仅接受预定义别名）
5. 默认模型

### Requirement: API 端点配置优先级
API 端点优先级（从高到低）：
1. `ANTHROPIC_BASE_URL` 环境变量
2. 配置文件 `apiBaseUrl` 字段
3. 默认 `https://api.anthropic.com`

### Requirement: 构建配置
构建脚本 SHALL 在 Windows 目标上自动移除 `--bytecode` 标志，并保留 `--format esm`。

## REMOVED Requirements

### Requirement: Unix 信号强制依赖
**Reason**: Windows 不支持 SIGTERM/SIGKILL/SIGHUP 信号语义，需替换为跨平台方案
**Migration**: 所有信号终止调用替换为 `crossPlatformKill(pid)` 工具函数，内部按平台分发

### Requirement: NAPI 原生模块硬依赖
**Reason**: 4 个 NAPI 包（audio-capture-napi 等）无 Windows 7 构建，且 voice.ts 明确注释 "Windows has no supported fallback"
**Migration**: 将 NAPI 导入改为动态 `try/catch` 加载，失败时静默降级（语音、图像处理等功能不可用但 CLI 正常运行）
