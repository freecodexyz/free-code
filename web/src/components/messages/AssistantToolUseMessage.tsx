// Borrowed from src/components/messages/AssistantToolUseMessage.tsx
//
// Looks up the tool in the Web registry (getAllBaseTools + findToolByName)
// and delegates rendering to tool.renderToolUseMessage(input). If the tool
// is missing or returns null/undefined, falls back to a default collapsible
// card showing the JSON input. When `inProgress` is true (the block id is
// in inProgressToolUseIDs), the card uses the --progress variant and shows
// a spinner via the shared <Spinner> component (cc-spinner class).

import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { findToolByName } from '../../Tool.js'
import { Spinner } from '../Spinner.js'
import { getAllBaseTools } from '../../tools.js'
import type { ToolUseBlock } from '../../types/index.js'

type Props = {
  block: ToolUseBlock
  inProgress?: boolean
  containerWidth?: number
}

const INPUT_PRE_STYLE: CSSProperties = {
  margin: 0,
  padding: 'var(--spacer-8) var(--spacer-12)',
  fontFamily: 'var(--code-terminal-font-family)',
  fontSize: 'var(--code-terminal-font-size)',
  lineHeight: 'var(--code-terminal-line-height)',
  color: 'var(--code-text)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowX: 'auto',
}

export function AssistantToolUseMessage({
  block,
  inProgress,
  containerWidth,
}: Props): ReactNode {
  const [expanded, setExpanded] = useState(false)

  const tool = useMemo(
    () => findToolByName(getAllBaseTools(), block.name),
    [block.name],
  )

  const rendered = useMemo(
    () => tool?.renderToolUseMessage?.(block.input),
    [tool, block.input],
  )

  const blockClass = inProgress
    ? 'cc-tool-block cc-tool-block--progress'
    : 'cc-tool-block cc-tool-block--done'

  const cardStyle: CSSProperties = {
    marginBottom: 'var(--spacer-4)',
    maxWidth: containerWidth ? `${containerWidth}px` : '92%',
  }

  // Tool provided a custom render → use it directly inside the styled card.
  if (rendered !== undefined && rendered !== null) {
    return (
      <div className={blockClass} style={cardStyle}>
        {rendered}
      </div>
    )
  }

  // Default fallback card: header (tool name + status) + collapsible JSON input.
  return (
    <div className={blockClass} style={cardStyle}>
      <div
        className="cc-tool-block__header"
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
      >
        <span className="cc-tool-block__label">{block.name}</span>
        <span
          className={`cc-tool-block__status ${
            inProgress
              ? 'cc-tool-block__status--progress'
              : 'cc-tool-block__status--done'
          }`}
        >
          {inProgress ? <Spinner /> : '✓'}
        </span>
      </div>
      {expanded ? (
        <pre style={INPUT_PRE_STYLE}>{JSON.stringify(block.input, null, 2)}</pre>
      ) : null}
    </div>
  )
}
