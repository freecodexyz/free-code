// Borrowed from src/tools/GlobTool/GlobTool.ts + prompt.ts — the Web
// port matches file paths against the IndexedDB-backed virtual file
// system via vfs.glob (which uses globToRegExp). cc scans the host
// filesystem and relativizes paths under cwd; the Web VFS is flat (no
// cwd concept), so the `path` parameter is accepted for schema parity
// but the VFS scans all stored files. Results are sorted by modification
// time descending (matches cc's contract).

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const GLOB_TOOL_NAME = 'Glob'

export const DESCRIPTION = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns`

export type GlobInput = {
  pattern: string
  path?: string
}

export type GlobOutput = {
  pattern: string
  filenames: string[]
  numFiles: number
}

export const GlobTool = buildTool({
  name: GLOB_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return DESCRIPTION
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against',
      },
      path: {
        type: 'string',
        description:
          'The directory to search in. If not specified, all files are searched.',
      },
    },
    required: ['pattern'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => true,
  isConcurrencySafe: true,
  validateInput(input: GlobInput): ValidationResult {
    if (!input.pattern || input.pattern.trim() === '') {
      return { result: false, message: 'pattern is required' }
    }
    return { result: true }
  },
  async call(input: GlobInput, context: ToolUseContext): Promise<GlobOutput> {
    const vfs = context.virtualFs
    if (!vfs) {
      throw new Error('Virtual file system is not available.')
    }
    // vfs.glob returns paths sorted by mtime descending.
    const filenames = await vfs.glob(input.pattern)
    return {
      pattern: input.pattern,
      filenames,
      numFiles: filenames.length,
    }
  },
  renderToolUseMessage(input: GlobInput): ReactNode {
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
          color: 'var(--color-foreground)',
          marginTop: 'var(--spacer-8)',
        }}
      >
        <span style={{ color: 'var(--icon-secondary)' }}>🔍</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
          {input.pattern}
        </span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: GlobOutput,
    toolUseId: string,
  ): ToolResultBlock {
    if (output.filenames.length === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: 'No files found',
      }
    }
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output.filenames.join('\n'),
    }
  },
} satisfies ToolDef<GlobInput, GlobOutput>)
