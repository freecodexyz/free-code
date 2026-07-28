// Borrowed from src/commands/review.ts — Web adaptation.
// cc reviews a pull request via `gh pr`. The Web project has no shell/gh, so
// the command instead expands into a prompt asking the model to review the
// recent code changes in the conversation context.

import type { PromptCommand } from '../types/command.js'

const REVIEW_PROMPT = `Please review the recent code changes (last 5 messages of context). For each change, assess: correctness, security, performance, style. Provide a structured review.`

export const reviewCommand: PromptCommand = {
  type: 'prompt',
  name: 'review',
  description: '审查最近的代码变更',
  userFacingName: () => '/review',
  prompt: REVIEW_PROMPT,
}
