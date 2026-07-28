// Borrowed from src/components/messages/SystemTextMessage.tsx
//
// Renders a system message via <Markdown> inside a muted, left-bordered
// container. cc renders system messages with <Text dimColor>; the Web port
// approximates that with the --text-tertiary token and a subtle left border
// so system messages are visually distinct from assistant/user bubbles.

import type { CSSProperties, ReactNode } from 'react'
import type { Message } from '../../types/index.js'
import { Markdown } from '../Markdown.js'

type Props = {
  message: Message
}

const SYSTEM_STYLE: CSSProperties = {
  color: 'var(--text-tertiary)',
  fontStyle: 'italic',
  padding: 'var(--spacer-4) var(--spacer-12)',
  borderLeft: '2px solid var(--border-neutral-l1)',
  marginLeft: 'var(--spacer-8)',
  fontSize: 'var(--body-sm-font-size)',
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

export function SystemTextMessage({ message }: Props): ReactNode {
  const text = extractText(message.content)
  return (
    <div style={SYSTEM_STYLE}>
      <Markdown>{text}</Markdown>
    </div>
  )
}
