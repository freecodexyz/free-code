// Borrowed from src/components/messages/AssistantTextMessage.tsx
//
// Renders an assistant text content block via the shared <Markdown> renderer.
// In cc, AssistantTextMessage wraps the text in a styled <Text> + <Markdown>;
// the Web port wraps it in a .cc-msg--assistant bubble so it picks up the
// existing chat-panel styles (left-aligned, hover, padding, radius).

import type { ReactNode } from 'react'
import { Markdown } from '../Markdown.js'

type Props = {
  text: string
}

export function AssistantTextMessage({ text }: Props): ReactNode {
  return (
    <div className="cc-msg cc-msg--assistant">
      <Markdown>{text}</Markdown>
    </div>
  )
}
