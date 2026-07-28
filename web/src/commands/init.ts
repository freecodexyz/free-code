// Borrowed from src/commands/init/ — Web adaptation.
// cc analyzes the codebase and writes a CLAUDE.md to the real filesystem. The
// Web project has no fs; the model is asked to analyze the project structure
// and create a project summary file at ./CLAUDE.md via the virtual file system
// tool (Phase 8). This is the OLD_INIT_PROMPT flavor, simplified.

import type { PromptCommand } from '../types/command.js'

const INIT_PROMPT = `Please analyze the project structure and create a project summary file at \`./CLAUDE.md\` with: tech stack, key directories, build/test/lint commands, conventions.`

export const initCommand: PromptCommand = {
  type: 'prompt',
  name: 'init',
  description: '初始化 CLAUDE.md 文件并生成代码库文档',
  userFacingName: () => '/init',
  prompt: INIT_PROMPT,
}
