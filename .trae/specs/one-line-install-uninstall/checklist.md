# Checklist

## 一行安装（Unix）
- [x] `curl -fsSL <url>/install.sh | bash` 可一行完成安装
- [x] 安装后 `free-code --version` 可正常输出（install.sh 保留原有构建和软链接逻辑）
- [x] 安装清单文件 `~/.claude/install-manifest.txt` 已创建
- [x] 清单文件包含：`$HOME/free-code/`、`$HOME/.local/bin/free-code`、`$HOME/.claude/install-manifest.txt`
- [x] 重复安装时自动 `git pull --ff-only` 更新而非报错
- [x] 安装成功后输出简洁指引（运行命令、API key 设置）

## 一行安装（Windows）
- [x] `irm <url>/install.ps1 | iex` 可一行完成安装
- [x] 安装后 `free-code --version` 可正常输出（install.ps1 保留原有下载和 PATH 设置逻辑）
- [x] 安装清单文件 `%LOCALAPPDATA%\free-code\install-manifest.txt` 已创建
- [x] PowerShell 2.0 兼容（Win7）

## 一行卸载（Unix）
- [x] `curl -fsSL <url>/uninstall.sh | bash` 可一行执行
- [x] 交互模式下询问是否删除用户数据
- [x] `--purge` 标志跳过确认删除全部内容
- [x] `--keep-data` 标志跳过确认仅删除二进制和源码
- [x] 卸载后 `~/free-code/` 目录被删除
- [x] 卸载后 `~/.local/bin/free-code` 软链接被删除
- [x] `--purge` 模式下 `~/.claude/` 被删除
- [x] `--purge` 模式下 `~/.claude.json` 被删除
- [x] `--keep-data` 模式下 `~/.claude/` 和 `~/.claude.json` 保留
- [x] 卸载完成后输出已删除内容摘要

## 一行卸载（Windows）
- [x] `irm <url>/uninstall.ps1 | iex` 可一行执行
- [x] 交互模式下询问是否删除用户数据
- [x] `-Purge` 标志跳过确认删除全部
- [x] `-KeepData` 标志跳过确认仅删除二进制
- [x] 卸载后安装目录被删除
- [x] 卸载后 PATH 中安装目录条目被移除
- [x] PowerShell 2.0 兼容（Win7）

## 构建验证
- [x] `bun run scripts/build.ts --dev` 构建通过
