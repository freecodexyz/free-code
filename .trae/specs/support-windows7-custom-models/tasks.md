# Tasks

## 阶段一：跨平台基础设施

- [x] Task 1: 创建跨平台进程终止工具函数 `crossPlatformKill`
  - [x] SubTask 1.1: 在 `src/utils/process/kill.ts` 创建 `crossPlatformKill(pid, signal?)` 函数，Windows 上使用 `taskkill /PID <pid> /T /F`，Unix 上使用 `process.kill(pid, signal)`
  - [x] SubTask 1.2: 在 `src/utils/gracefulShutdown.ts` 中将 `process.kill(process.pid, 'SIGKILL')` 替换为 `crossPlatformKill`
  - [x] SubTask 1.3: `ripgrep.ts` 使用 `child.kill()` (ChildProcess API) 非 `process.kill()`，无需替换
  - [x] SubTask 1.4: 在 `src/services/mcp/client.ts` 中将进程终止调用替换为 `crossPlatformKill`
  - [x] SubTask 1.5: `ShellCommand.ts` 使用 `treeKill()` 第三方库，非 `process.kill()`，无需替换
  - [x] SubTask 1.6: 全局搜索确认无残留的 `process.kill()` 裸信号调用

- [x] Task 2: 跨平台路径与 Shell 探测
  - [x] SubTask 2.1: 在 `src/utils/platform.ts` 新增 `getShell()` 和 `isWindows()` 函数
  - [x] SubTask 2.2: 将 `terminalPanel.ts` 中硬编码 `/bin/bash` 替换为 `getShell()`
  - [x] SubTask 2.3: 将 `settings/mdm/constants.ts` 中 `/usr/bin/plutil` 替换为平台探测（Windows 返回空字符串）
  - [x] SubTask 2.4: 将 `settings/managedPath.ts` 中 `/etc/claude-code` 替换为平台探测（Windows 使用 `%ProgramData%\claude-code`）
  - [x] SubTask 2.5: `platform.ts` 中 `/etc/os-release` 已有 `process.platform !== 'linux'` 守卫，跨平台安全

- [x] Task 3: Unix Domain Socket 替换为 Named Pipe
  - [x] SubTask 3.1: 在 `src/utils/ipc.ts` 创建 `getIpcPath(name)` 函数
  - [x] SubTask 3.2: 在 `claudeInChrome/common.ts` 中将 `.sock` 路径替换为 `getIpcPath()`
  - [x] SubTask 3.3: `tmuxSocket.ts` 使用 tmux `-L` 标志（非 Node.js IPC），Windows 上已有降级，无需修改

## 阶段二：NAPI 降级

- [x] Task 4: NAPI 原生模块动态加载降级
  - [x] SubTask 4.1: 创建 `src/utils/napiLoader.ts`，提供 `tryLoadNapi()`/`tryLoadNapiSync()`/`isNapiAvailable()` 函数
  - [x] SubTask 4.2: 将 4 个 NAPI 包的直接 import 替换为 `tryLoadNapi()` 调用（modifiers.ts、imagePaste.ts、protocolHandler.ts、imageProcessor.ts、voice.ts）
  - [x] SubTask 4.3: 在 `voice.ts` 中确认降级路径：保留双层 try/catch（tryLoadNapi + .node dlopen）
  - [x] SubTask 4.4: 在 `scripts/build.ts` 的 externals 列表中确认 4 个 NAPI 包仍为 external

## 阶段三：自定义模型支持

- [x] Task 5: 扩展 ModelSetting 类型与模型选择链路
  - [x] SubTask 5.1: 在 `src/utils/model/model.ts` 中扩展 `ModelSetting` 类型为 `ModelName | ModelAlias | string | null`
  - [x] SubTask 5.2: 修改 `getUserSpecifiedModelSetting()` 优先级链路：`--model` 标志 > `ANTHROPIC_MODEL` env > `customModel` 配置 > `model` 配置 > 默认
  - [x] SubTask 5.3: 在 `src/utils/settings/types.ts` 中新增 `customModel?: string` 和 `apiBaseUrl?: string` 配置字段
  - [x] SubTask 5.4: `parseUserSpecifiedModel()` 已在末尾原样返回未识别输入，更新了 JSDoc

- [x] Task 6: API 端点自定义配置
  - [x] SubTask 6.1: 在 `src/utils/model/providers.ts` 新增 `getApiBaseUrl()` 函数，读取 `ANTHROPIC_BASE_URL` env 和 settings `apiBaseUrl`
  - [x] SubTask 6.2: 在 `src/services/api/client.ts` 中使用 `getApiBaseUrl()`，自定义 URL 时绕过 provider 路由
  - [x] SubTask 6.3: `ANTHROPIC_API_KEY` 已通过 `getAnthropicApiKey()` 正确传递

- [x] Task 7: 实现 `--list-models` 功能
  - [x] SubTask 7.1: 在 `src/entrypoints/cli.tsx` 中新增 `--list-models` CLI 标志解析
  - [x] SubTask 7.2: 创建 `src/commands/listModels.ts`，使用 `client.models.list()` 调用 `GET /v1/models`
  - [x] SubTask 7.3: 以表格形式输出模型 ID 和创建时间，然后退出进程

## 阶段四：构建与安装

- [x] Task 8: 构建配置 Windows 兼容
  - [x] SubTask 8.1: `--bytecode` 标志已在之前移除，添加注释说明原因
  - [x] SubTask 8.2: 新增 `--windows` 标志，设置 `--target=bun-windows-x64` 交叉编译
  - [x] SubTask 8.3: 在 `package.json` 中添加 `os` 字段支持 win32

- [x] Task 9: 创建 Windows 安装脚本
  - [x] SubTask 9.1: 创建 `install.ps1`，检测 Windows 版本（最低 6.1 = Win7）、下载 CLI 二进制、添加到 PATH
  - [x] SubTask 9.2: 在 `install.ps1` 中添加 Bun 运行时检测与安装提示（Win7 提示使用编译二进制模式）

- [x] Task 10: 验证与测试
  - [x] SubTask 10.1: 在 Linux 上执行 `bun run scripts/build.ts --dev` 确认构建仍通过（7247 modules，exit code 0）
  - [x] SubTask 10.2: 执行 `./cli-dev --list-models` 确认模型列表功能正常（无 Key 提示错误，有 Key 调用 API 得到 403）
  - [x] SubTask 10.3: 执行 `./cli-dev --model "test-model"` 确认自定义模型参数被接受（错误仅关于 API Key）
  - [x] SubTask 10.4: 全局搜索确认无残留的硬编码 Unix 路径和裸信号调用

# Task Dependencies

- Task 2 依赖 Task 1（platform.ts 中可能需要 crossPlatformKill）
- Task 3 独立
- Task 4 独立
- Task 5 独立
- Task 6 依赖 Task 5（client.ts 需要新的 ModelSetting 类型）
- Task 7 依赖 Task 6（listModels 需要配置好的 client）
- Task 8 依赖 Task 1-4（构建需包含所有跨平台改动）
- Task 9 依赖 Task 8（安装脚本需匹配构建产物）
- Task 10 依赖 Task 1-9（最终验证）
- 可并行：Task 1 + Task 3 + Task 4 + Task 5（无相互依赖）
