# Checklist

## 跨平台进程终止
- [x] `src/utils/process/kill.ts` 存在并导出 `crossPlatformKill(pid, signal?)` 函数
- [x] `crossPlatformKill` 在 Windows 上使用 `taskkill /PID <pid> /T /F`，在 Unix 上使用 `process.kill(pid, signal)`
- [x] `gracefulShutdown.ts` 中不再直接调用 `process.kill(pid, 'SIGKILL')`
- [x] `ripgrep.ts` 使用 `child.kill()` (ChildProcess API) 非 `process.kill()`，无需替换
- [x] `services/mcp/client.ts` 中不再直接使用 SIGTERM/SIGKILL（已替换为 `crossPlatformKill`）
- [x] `ShellCommand.ts` 使用 `treeKill()` 第三方库，非 `process.kill()`，无需替换
- [x] 全局搜索 `process.kill(pid, signal)` 仅存在于 `crossPlatformKill` 内部（Unix 分支）

## 跨平台路径与 Shell
- [x] `src/utils/platform.ts` 导出 `getShell()` 和 `isWindows()` 函数
- [x] `getShell()` 在 Windows 上返回 `process.env.COMSPEC`（cmd.exe 路径）
- [x] `terminalPanel.ts` 中不再硬编码 `/bin/bash`（使用 `getShell()`）
- [x] `settings/mdm/constants.ts` 中不再硬编码 `/usr/bin/plutil`（Windows 返回空字符串）
- [x] `settings/managedPath.ts` 中不再硬编码 `/etc/claude-code`（Windows 使用 `%ProgramData%\claude-code`）
- [x] `platform.ts` 中 `/etc/os-release` 已有 `process.platform !== 'linux'` 守卫，跨平台安全

## Unix Domain Socket 替换
- [x] `src/utils/ipc.ts` 存在并导出 `getIpcPath(name)` 函数
- [x] `getIpcPath` 在 Windows 上返回 `\\.\pipe\<name>` 格式
- [x] `claudeInChrome/common.ts` 使用 `getIpcPath()` 而非硬编码 `.sock` 路径
- [x] `tmuxSocket.ts` 使用 tmux `-L` 标志（非 Node.js IPC），Windows 上已有降级

## NAPI 降级
- [x] `src/utils/napiLoader.ts` 存在并导出 `tryLoadNapi()`/`tryLoadNapiSync()`/`isNapiAvailable()` 函数
- [x] 4 个 NAPI 包均通过 `tryLoadNapi()` 动态加载（modifiers.ts、imagePaste.ts、protocolHandler.ts、imageProcessor.ts、voice.ts）
- [x] NAPI 加载失败时 CLI 不崩溃，仅相关功能不可用（双层 try/catch 防护）
- [x] `scripts/build.ts` externals 列表仍包含 4 个 NAPI 包

## 自定义模型配置
- [x] `ModelSetting` 类型扩展为 `ModelName | ModelAlias | string | null`
- [x] `getUserSpecifiedModelSetting()` 优先级：`--model` > `ANTHROPIC_MODEL` env > `customModel` 配置 > `model` 配置 > 默认
- [x] 配置文件支持 `customModel` 字段（`src/utils/settings/types.ts`）
- [x] `parseUserSpecifiedModel()` 接受任意字符串并原样返回（末尾 fallback）
- [x] `--model "test-model"` 被正确接受（错误仅关于 API Key，非模型名）

## API 端点自定义
- [x] `ANTHROPIC_BASE_URL` 环境变量被读取并设置到 client `baseURL`（通过 `getApiBaseUrl()`）
- [x] 配置文件 `apiBaseUrl` 字段被读取并设置到 client `baseURL`
- [x] `ANTHROPIC_API_KEY` 环境变量通过 `getAnthropicApiKey()` 正确传递
- [x] `services/api/providers.ts` 中自定义 baseURL 绕过 provider 路由
- [x] 端点优先级：`ANTHROPIC_BASE_URL` env > `apiBaseUrl` 配置 > 默认（已验证：自定义 URL 得到 "Connection error"，默认 URL 得到 403）

## 模型列表获取
- [x] `--list-models` CLI 标志被正确解析（cli.tsx 中快速路径）
- [x] `src/commands/listModels.ts` 存在并调用 `client.models.list()`（`GET /v1/models`）
- [x] 模型列表以表格形式展示（模型 ID、创建时间）
- [x] `--list-models` 执行后正常退出进程
- [x] 自定义端点下 `--list-models` 调用自定义端点（已验证：`ANTHROPIC_BASE_URL` 改变请求目标）

## 构建与安装
- [x] `--bytecode` 标志已移除（Bun 不支持 ESM bytecode）
- [x] `package.json` `os` 字段包含 win32 支持
- [x] `install.ps1` 存在并检测 Windows 版本（最低 6.1 = Win7）
- [x] `install.ps1` 下载 CLI 二进制并添加到 PATH
- [x] `--windows` 交叉编译标志支持 `--target=bun-windows-x64`
- [x] `bun:bundle` Bug 修复：构建时临时替换为 polyfill，构建后恢复

## 最终验证
- [x] Linux 上 `bun run scripts/build.ts --dev` 构建通过（7247 modules，exit code 0）
- [x] `./cli-dev --version` 正常输出版本号
- [x] `./cli-dev --list-models` 功能正常（无 API Key 时提示错误，有 Key 时调用 API）
- [x] `./cli-dev --model "test-model"` 参数被接受（错误仅关于 API Key）
- [x] 全局搜索无残留硬编码 Unix 路径（`/bin/bash` 仅在 `getShell()` Unix 默认值中）
- [x] 全局搜索无残留裸信号调用（`process.kill(pid, signal)` 仅在 `crossPlatformKill` 内部）
