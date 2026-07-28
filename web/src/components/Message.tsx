// Borrowed from src/components/Message.tsx — message role dispatch pattern.
//
// Dispatches a Message to its role-specific sub-component:
//   - user     → UserToolResultMessage (if toolResults present) else UserTextMessage
//   - assistant → AssistantMessageBlock (iterates content blocks)
//   - system   → SystemTextMessage
//
// Props match the spec for Task 11 (Message rendering rewrite):
//   { message: Message; inProgressToolUseIDs?: string[]; containerWidth?: number }
//
// inProgressToolUseIDs and containerWidth are forwarded into the assistant
// branch so individual tool_use cards can show a spinner / size themselves.

import type { ReactNode } from 'react'
import type { Message } from '../types/index.js'
import { AssistantMessageBlock } from './messages/AssistantMessageBlock.js'
import { UserTextMessage } from './messages/UserTextMessage.js'
import { UserToolResultMessage } from './messages/UserToolResultMessage.js'
import { SystemTextMessage } from './messages/SystemTextMessage.js'

type Props = {
  message: Message
  inProgressToolUseIDs?: string[]
  containerWidth?: number
}

export function Message({
  message,
  inProgressToolUseIDs,
  containerWidth,
}: Props): ReactNode {
  switch (message.role) {
    case 'user':
      if (message.toolResults && message.toolResults.length > 0) {
        return <UserToolResultMessage message={message} />
      }
      return <UserTextMessage message={message} />
    case 'assistant':
      return (
        <AssistantMessageBlock
          message={message}
          inProgressToolUseIDs={inProgressToolUseIDs}
          containerWidth={containerWidth}
        />
      )
    case 'system':
      return <SystemTextMessage message={message} />
    default:
      return null
  }
}
