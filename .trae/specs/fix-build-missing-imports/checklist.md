# Checklist

## 缺失导入 stub
- [x] `src/cli/bg.ts` 存在并导出 psHandler, logsHandler, attachHandler, killHandler, handleBgFlag
- [x] `src/cli/handlers/templateJobs.ts` 存在并导出 templatesMain
- [x] stub 函数在运行时被调用时抛出描述性错误（因为 feature flag 关闭时不应被调用）

## 构建验证
- [x] `bun run scripts/build.ts --dev` 构建成功（7253 modules）
- [x] `./cli-dev --version` 正常输出版本号
