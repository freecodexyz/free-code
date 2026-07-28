// Borrowed from src/commands/clear/ — Web adaptation.
// cc clears the conversation transcript and session caches. Here we clear the
// current workspace messages (clearMessages) and leave a confirming message so
// the user sees feedback that the conversation was reset.

import type { LocalCommand } from '../types/command.js'

export const clearCommand: LocalCommand = {
  type: 'local',
  name: 'clear',
  description: '清空对话历史并释放上下文',
  userFacingName: () => '/clear',
  call: (_args, context) => {
    context.clearMessages()
    // Leave a single confirming message. setMessages is typed against the
    // migrating message list (any[]), so the object shape is unchecked here on
    // purpose — it matches the current ChatMessage contract (id/type/content/
    // timestamp).
    context.setMessages(() => [
      {
        id: `clear-${Date.now()}`,
        type: 'assistant',
        content: '已清空对话。',
        timestamp: Date.now(),
      },
    ])
  },
}
