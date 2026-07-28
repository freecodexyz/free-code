// Borrowed from src/components/messages/UserTextMessage.tsx
//
// Renders a user text message as a right-aligned bubble via <Markdown>.
// Content is normally a string (the user's prompt); if it is an array of
// content blocks, the text blocks are concatenated so Markdown can render
// them as a single bubble. The .cc-msg--user class provides the right-aligned
// bubble styling (defined in global.css).

import type { ReactNode } from 'react'
import type { Message } from '../../types/index.js'
import { Markdown } from '../Markdown.js'

type Props = {
  message: Message
}

function extractText(content: Message['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
  }
  return ''
}

export function UserTextMessage({ message }: Props): ReactNode {
  const text = extractText(message.content)
  return (
    <div className="cc-msg cc-msg--user">
      <Markdown>{text}</Markdown>
    </div>
  )
}
