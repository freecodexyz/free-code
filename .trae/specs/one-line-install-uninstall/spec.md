# 一行安装 / 一行卸载 Spec

## Why

当前安装需要手动 clone 仓库、安装依赖、构建、创建软链接，步骤繁琐且无卸载途径。用户数据散落在 `~/.claude/`、`~/.local/bin/`、`~/free-code/` 等多处，卸载时无法干净清除。本变更提供一行 curl 安装和一行 curl 卸载的体验，卸载时彻底清除所有相关文件。

## What Changes

- 重写 `install.sh` 为一行安装脚本：`curl -fsSL ... | bash`
- 新增 `uninstall.sh` 一行卸载脚本：`curl -fsSL ... | bash`
- 重写 `install.ps1` 为一行安装：`irm ... | iex`
- 新增 `uninstall.ps1` 一行卸载脚本
- 安装时记录安装清单文件，卸载时按清单删除

## Impact

- Affected specs: 无（首个关于安装/卸载的 spec）
- Affected code:
  - `install.sh` — 完全重写
  - `install.ps1` — 完全重写
  - `uninstall.sh` — 新建
  - `uninstall.ps1` — 新建

## ADDED Requirements

### Requirement: 一行安装（Unix）
系统 SHALL 提供可通过 `curl -fsSL <url>/install.sh | bash` 一行命令完成的安装体验。

#### Scenario: 首次安装
- **WHEN** 用户执行 `curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/install.sh | bash`
- **THEN** 脚本自动完成：检测环境 → 安装 Bun（如缺失）→ clone 仓库 → 构建二进制 → 创建软链接到 `~/.local/bin/free-code` → 提示 PATH 配置
- **AND** 安装完成后 `free-code` 命令可用

#### Scenario: 重复安装（更新）
- **WHEN** 用户再次执行同一安装命令
- **THEN** 脚本检测到已安装，执行 `git pull` 更新源码并重新构建

### Requirement: 一行安装（Windows）
系统 SHALL 提供可通过 `irm <url>/install.ps1 | iex` 一行命令完成的安装体验。

#### Scenario: Windows 安装
- **WHEN** 用户在 PowerShell 中执行 `irm https://raw.githubusercontent.com/paoloanzn/free-code/main/install.ps1 | iex`
- **THEN** 脚本自动完成：检测 Windows 版本 → 下载/构建二进制 → 安装到 `%LOCALAPPDATA%\free-code` → 添加到用户 PATH

### Requirement: 一行卸载（Unix）
系统 SHALL 提供可通过 `curl -fsSL <url>/uninstall.sh | bash` 一行命令完成的卸载体验，且卸载干净。

#### Scenario: 完整卸载
- **WHEN** 用户执行 `curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/uninstall.sh | bash`
- **THEN** 脚本删除以下所有内容：
  1. `~/free-code/` — 源码和构建目录
  2. `~/.local/bin/free-code` — 软链接
  3. `~/.claude/` — 用户配置、缓存、会话数据（**需用户确认**）
  4. `~/.claude.json` — 全局配置文件（**需用户确认**）
  5. `~/.local/share/claude/` — 本地数据（如存在）
  6. `~/.cache/claude/` — 缓存数据（如存在）
  7. `~/.local/state/claude/` — 状态数据（如存在）

#### Scenario: 卸载时保留用户数据
- **WHEN** 用户执行卸载脚本并选择不删除用户数据
- **THEN** 仅删除二进制、软链接和源码，保留 `~/.claude/` 和 `~/.claude.json`

#### Scenario: 非交互卸载
- **WHEN** 用户执行 `curl -fsSL ... | bash -s -- --purge`
- **THEN** 无需确认，删除所有内容（包括用户数据）
- **WHEN** 用户执行 `curl -fsSL ... | bash -s -- --keep-data`
- **THEN** 无需确认，仅删除二进制和源码，保留用户数据

### Requirement: 一行卸载（Windows）
系统 SHALL 提供可通过 `irm <url>/uninstall.ps1 | iex` 一行命令完成的卸载体验。

#### Scenario: Windows 完整卸载
- **WHEN** 用户执行 `irm https://raw.githubusercontent.com/paoloanzn/free-code/main/uninstall.ps1 | iex`
- **THEN** 脚本删除：安装目录、PATH 条目、用户数据目录（需确认）

### Requirement: 安装清单文件
安装脚本 SHALL 在安装时创建一个清单文件，记录所有安装的文件路径，供卸载时使用。

#### Scenario: 清单文件创建
- **WHEN** 安装脚本完成安装
- **THEN** 在 `~/.claude/install-manifest.txt`（Unix）或 `%LOCALAPPDATA%\free-code\install-manifest.txt`（Windows）中记录所有创建的文件和目录路径

## MODIFIED Requirements

### Requirement: install.sh 安装流程
安装流程修改为：
1. 检测 OS（macOS/Linux）
2. 检测/安装 Bun
3. Clone 仓库到 `~/free-code/`（已存在则 pull 更新）
4. 安装依赖并构建
5. 创建软链接 `~/.local/bin/free-code` → `~/free-code/cli-dev`
6. 写入安装清单文件
7. 输出安装成功信息和下一步指引

### Requirement: install.ps1 安装流程
安装流程修改为：
1. 检测 Windows 版本（≥ 6.1）
2. 下载或构建二进制
3. 安装到 `%LOCALAPPDATA%\free-code\`
4. 添加到用户 PATH
5. 写入安装清单文件
6. 输出安装成功信息

## REMOVED Requirements

无移除的需求。
