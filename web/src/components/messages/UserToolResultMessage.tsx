// Borrowed from src/components/messages/UserToolResultMessage.tsx
//
// Iterates message.toolResults and renders each tool_result block. For each:
//   - looks up the matching tool_use (by tool_use_id) in message.toolUses to
//     recover the tool name
//   - looks up the Tool in the Web registry via findToolByName(getAllBaseTools)
//   - calls tool.renderToolResultMessage(output) and uses the result if non-null
//   - otherwise falls back to a default card showing the result content as text
// Error results (is_error === true) get red border + status-error color via
// inline overrides (the .cc-tool-block--error class is not in global.css).

import {
  Fragment,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { findToolByName } from '../../Tool.js'
import { getAllBaseTools } from '../../tools.js'
import type { Message, ToolResultBlock } from '../../types/index.js'

type Props = {
  message: Message
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

function contentToString(content: ToolResultBlock['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(c => c.text).join('\n')
  }
  return ''
}

export function UserToolResultMessage({ message }: Props): ReactNode {
  const toolResults = message.toolResults
  if (!toolResults || toolResults.length === 0) return null

  const tools = useMemo(() => getAllBaseTools(), [])
  const toolUses = message.toolUses ?? []

  return (
    <Fragment>
      {toolResults.map(result => {
        const toolUse = toolUses.find(u => u.id === result.tool_use_id)
        const toolName = toolUse?.name
        const tool = toolName ? findToolByName(tools, toolName) : undefined
        const output = contentToString(result.content)
        const rendered = tool?.renderToolResultMessage?.(output)
        const isError = result.is_error === true

        const errorStyle: CSSProperties = isError
          ? {
              borderLeftColor: 'var(--status-error-default)',
              background: 'var(--status-error-surface-l1)',
            }
          : {}

        const statusColor = isError
          ? 'var(--status-error-default)'
          : 'var(--status-success-default)'

        return (
          <div
            key={result.tool_use_id}
            className="cc-tool-block cc-tool-block--done"
            style={{ marginBottom: 'var(--spacer-4)', ...errorStyle }}
          >
            <div className="cc-tool-block__header">
              <span className="cc-tool-block__label">
                {toolName ?? 'tool_result'}
              </span>
              <span
                className="cc-tool-block__status"
                style={{ color: statusColor }}
              >
                {isError ? '✕' : '✓'}
              </span>
            </div>
            {rendered !== undefined && rendered !== null ? (
              <div style={{ padding: 'var(--spacer-8) var(--spacer-12)' }}>
                {rendered}
              </div>
            ) : (
              <pre style={INPUT_PRE_STYLE}>{output}</pre>
            )}
          </div>
        )
      })}
    </Fragment>
  )
}
