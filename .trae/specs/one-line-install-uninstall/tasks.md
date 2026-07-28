# Tasks

- [x] Task 1: 重写 install.sh 为一行安装脚本
  - [x] SubTask 1.1: 保留现有安装逻辑，确保 `curl -fsSL ... | bash` 可直接执行
  - [x] SubTask 1.2: 安装完成后写入清单文件 `~/.claude/install-manifest.txt`
  - [x] SubTask 1.3: 重复安装时检测已存在目录，执行 `git pull --ff-only` 更新
  - [x] SubTask 1.4: 安装成功后输出简洁的下一步指引

- [x] Task 2: 创建 uninstall.sh 一行卸载脚本
  - [x] SubTask 2.1: 创建 `uninstall.sh`，支持 `curl -fsSL ... | bash` 一行执行
  - [x] SubTask 2.2: 读取安装清单文件，按清单删除已安装的文件和目录
  - [x] SubTask 2.3: 交互式确认是否删除用户数据
  - [x] SubTask 2.4: 支持 `--purge` 和 `--keep-data` 非交互标志
  - [x] SubTask 2.5: 删除完成后输出已删除内容摘要

- [x] Task 3: 重写 install.ps1 为一行安装脚本
  - [x] SubTask 3.1: 确保支持 `irm ... | iex` 一行执行
  - [x] SubTask 3.2: 安装完成后写入清单文件 `%LOCALAPPDATA%\free-code\install-manifest.txt`
  - [x] SubTask 3.3: 重复安装时检测已存在目录，更新而非报错
  - [x] SubTask 3.4: PowerShell 2.0 兼容（Win7）

- [x] Task 4: 创建 uninstall.ps1 一行卸载脚本
  - [x] SubTask 4.1: 创建 `uninstall.ps1`，支持 `irm ... | iex` 一行执行
  - [x] SubTask 4.2: 读取安装清单文件，按清单删除
  - [x] SubTask 4.3: 交互式确认是否删除用户数据
  - [x] SubTask 4.4: 支持 `-Purge` 和 `-KeepData` 非交互标志
  - [x] SubTask 4.5: 从用户 PATH 环境变量中移除安装目录
  - [x] SubTask 4.6: PowerShell 2.0 兼容（Win7）

- [x] Task 5: 验证安装与卸载流程
  - [x] SubTask 5.1: `bash -n install.sh` 和 `bash -n uninstall.sh` 语法检查通过
  - [x] SubTask 5.2: install.sh 中 `write_manifest()` 函数正确写入清单文件
  - [x] SubTask 5.3: uninstall.sh 支持 `--purge` 和 `--keep-data` 标志
  - [x] SubTask 5.4: 四个脚本文件均存在（install.sh、uninstall.sh、install.ps1、uninstall.ps1）
  - [x] SubTask 5.5: 构建仍通过 `bun run scripts/build.ts --dev`

# Task Dependencies

- Task 2 依赖 Task 1（卸载脚本需读取安装清单格式）
- Task 4 依赖 Task 3（卸载脚本需读取安装清单格式）
- Task 5 依赖 Task 1-4
- 可并行：Task 1 + Task 3（Unix 和 Windows 安装脚本无依赖）
