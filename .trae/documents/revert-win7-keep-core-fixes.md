# 计划：放弃 Win7 支持，回退到核心修复

## 当前状态

GitHub 远程仓库 `main` 分支上有 6 个相关提交：

| 提交 | 类型 | 文件 |
|------|------|------|
| `90145ee5` docs: Win7 说明 | Win7 特定 | `build-release.yml` |
| `c12a5b23` ci: zip bundle | Win7 特定 | `build-release.yml` |
| `33319864` docs: Win7 兼容性说明 | Win7 特定 | `build-release.yml` |
| `6db9fdc7` fix: DEFAULT_GRANT_FLAGS | Win7 特定 | `build-release.yml` |
| `f062ad92` ci: CI 工作流 | Win7 特定 | `build-release.yml`（新建） |
| `5c1cf71a` fix: stub 文件 | **核心修复** | `.gitignore`, `src/cli/bg.ts`, `src/cli/handlers/templateJobs.ts` |

## 分析

- `build-release.yml` 从头到尾都是为 Win7/Windows 构建创建的，包含 Win7 下载说明、zip 打包、Win7 兼容性文档
- `5c1cf71a` 是核心修复：stub 文件（`bg.ts`、`templateJobs.ts`）和 `.gitignore` 修复（`cli` → `/cli`），与 Win7 无关
- 放弃 Win7 后，`build-release.yml` 整个文件没有保留价值，直接删除即可

## 执行步骤

1. **按逆序 revert Win7 相关的 5 个提交**
   ```bash
   git revert 90145ee5 --no-edit   # Win7 说明
   git revert c12a5b23 --no-edit   # zip bundle
   git revert 33319864 --no-edit   # Win7 兼容性说明
   git revert 6db9fdc7 --no-edit   # DEFAULT_GRANT_FLAGS 修复（在 build-release.yml 中）
   git revert f062ad92 --no-edit   # 创建 CI 工作流（删除 build-release.yml）
   ```
   这 5 个 revert 合起来的效果：删除 `build-release.yml`，其余文件不变

2. **保留 `5c1cf71a`（核心修复）**
   - `src/cli/bg.ts` — BG_SESSIONS stub
   - `src/cli/handlers/templateJobs.ts` — TEMPLATES stub
   - `.gitignore` — `cli` 改成 `/cli`，修复 `src/cli/` 被误排除的问题

3. **推送**
   ```bash
   git push origin main
   ```

## 验证

- `git log --oneline -5` 显示 5 个 revert 提交
- `build-release.yml` 文件已删除
- `src/cli/bg.ts` 和 `src/cli/handlers/templateJobs.ts` 仍然存在
- `.gitignore` 中 `cli` 已改为 `/cli`