// Borrowed from src/commands/compact/ — Web adaptation.
// cc compacts the conversation by asking the model to summarize it. Here the
// command is a PromptCommand whose prompt expands into a summarization request
// the model receives (the dispatcher sends it as a user turn).

import type { PromptCommand } from '../types/command.js'

export const compactCommand: PromptCommand = {
  type: 'prompt',
  name: 'compact',
  description: '总结当前对话以释放上下文',
  argumentHint: '[可选的总结说明]',
  userFacingName: () => '/compact',
  prompt: (_args) =>
    'Please summarize our conversation so far. Be concise. Keep the key facts and any open todos.',
}
