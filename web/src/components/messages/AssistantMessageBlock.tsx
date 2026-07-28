// Borrowed from src/components/AssistantMessageBlock.tsx (cc Message.tsx's
// assistant branch)
//
// Iterates the assistant message's content blocks and dispatches each:
//   - text      → <AssistantTextMessage>
//   - tool_use  → <AssistantToolUseMessage> (with inProgress/containerWidth)
//   - tool_result → skipped (assistant content normally doesn't carry these;
//                   user-side tool_results are rendered via UserToolResultMessage)
// If content is a plain string, it is rendered as a single text block.

import { Fragment, type ReactNode } from 'react'
import type { Message } from '../../types/index.js'
import { AssistantTextMessage } from './AssistantTextMessage.js'
import { AssistantToolUseMessage } from './AssistantToolUseMessage.js'

type Props = {
  message: Message
  inProgressToolUseIDs?: string[]
  containerWidth?: number
}

export function AssistantMessageBlock({
  message,
  inProgressToolUseIDs,
  containerWidth,
}: Props): ReactNode {
  const content = message.content

  if (typeof content === 'string') {
    return <AssistantTextMessage text={content} />
  }

  if (!Array.isArray(content) || content.length === 0) {
    return null
  }

  return (
    <Fragment>
      {content.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <AssistantTextMessage key={`text-${i}`} text={block.text} />
          case 'tool_use':
            return (
              <AssistantToolUseMessage
                key={block.id}
                block={block}
                inProgress={inProgressToolUseIDs?.includes(block.id)}
                containerWidth={containerWidth}
              />
            )
          case 'tool_result':
            // Not expected on assistant content; defensively skip.
            return null
          default:
            return null
        }
      })}
    </Fragment>
  )
}
