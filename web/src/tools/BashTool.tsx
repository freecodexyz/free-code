// Borrowed from src/tools/BashTool/BashTool.tsx + prompt.ts — the Web port
// has no shell access (browsers cannot spawn processes), so the Bash tool
// is registered for schema/discovery parity (the model is told the tool
// exists and is unavailable) but disabled via isEnabled(): false.
// executeToolUse surfaces the disabled state as an is_error tool_result,
// matching cc's behavior when a tool is not available in the current mode.
// The input schema mirrors cc's (command/timeout/description) so the tool
// listing is structurally identical.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const BASH_TOOL_NAME = 'Bash'

export const DESCRIPTION = `Executes a given bash command and returns its output.

Usage:
- The working directory persists between commands, but shell state does not.
- You can specify an optional timeout in milliseconds.
- When issuing multiple commands, chain dependent commands with '&&'.`

export type BashInput = {
  command: string
  timeout?: number
  description?: string
}

export type BashOutput = {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

// Disabled in the Web port — browsers cannot spawn a shell. Returning
// false here causes executeToolUse to short-circuit with an is_error result
// before call() is ever invoked, so call() is intentionally unreachable.
// It throws defensively in case a future caller bypasses the isEnabled gate.
export const BashTool = buildTool({
  name: BASH_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return DESCRIPTION
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Optional timeout in milliseconds',
      },
      description: {
        type: 'string',
        description:
          'A short description of what this command does (1-2 sentences).',
      },
    },
    required: ['command'],
    additionalProperties: false,
  } as JSONSchema,
  isEnabled: () => false,
  isReadOnly: () => false,
  isDestructive: () => true,
  validateInput(input: BashInput): ValidationResult {
    if (!input.command || input.command.trim() === '') {
      return { result: false, message: 'command is required' }
    }
    return { result: true }
  },
  async call(_input: BashInput, _context: ToolUseContext): Promise<BashOutput> {
    // Unreachable: isEnabled() returns false so executeToolUse never calls
    // here. Throws defensively if bypassed.
    throw new Error(
      'Bash tool is not available in the Web port — browsers cannot spawn a shell.',
    )
  },
  renderToolUseMessage(input: BashInput): ReactNode {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacer-6)',
          padding: 'var(--spacer-8) var(--spacer-12)',
          borderRadius: 'var(--radius-8)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--body-sm-font-family)',
          fontSize: 'var(--body-sm-font-size)',
          color: 'var(--text-tertiary)',
          marginTop: 'var(--spacer-8)',
          opacity: 0.6,
        }}
      >
        <span>🚫</span>
        <span style={{ fontFamily: 'var(--font-family-mono)' }}>
          {input.command}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>(disabled in web)</span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    _output: BashOutput,
    toolUseId: string,
  ): ToolResultBlock {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: 'Bash tool is not available in the Web port.',
      is_error: true,
    }
  },
} satisfies ToolDef<BashInput, BashOutput>)
