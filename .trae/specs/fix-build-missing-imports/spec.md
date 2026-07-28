# 修复构建缺失导入 Spec

## Why

`bun build` 即使在死代码分支（`feature('BG_SESSIONS')` 返回 false）中也会解析所有 `import()` 调用的依赖，导致 `src/cli/bg.js` 和 `src/cli/handlers/templateJobs.js` 两个缺失文件引发构建失败。需要为这些缺失文件创建 stub 以通过构建。

## What Changes

- 创建 `src/cli/bg.ts` stub 文件
- 创建 `src/cli/handlers/templateJobs.ts` stub 文件

## Impact

- Affected specs: 无
- Affected code: 仅新增 stub 文件，不修改现有代码

## ADDED Requirements

### Requirement: 缺失导入 stub 文件
系统 SHALL 为所有被 `feature()` 门控但缺失的动态导入目标提供 stub 文件，确保 `bun build` 可以解析所有依赖路径。

#### Scenario: 构建通过
- **WHEN** 执行 `bun run scripts/build.ts --dev`
- **THEN** 构建成功完成，输出 `./cli-dev` 二进制文件

#### Scenario: 运行时安全
- **WHEN** feature flag 未启用（如 `BG_SESSIONS` 为 false）
- **THEN** stub 代码永远不会被执行，不影响 CLI 正常功能

## MODIFIED Requirements

无

## REMOVED Requirements

无
