// Borrowed from src/tools/FileWriteTool/FileWriteTool.ts + prompt.ts —
// the Web port writes to the IndexedDB-backed virtual file system instead
// of the host filesystem. cc requires a prior Read (via readFileState) and
// errors if the file was modified since read; the Web VFS is single-writer
// (no external editors), so that staleness check is dropped. The create vs
// update distinction and the result messages mirror cc's contract.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const FILE_WRITE_TOOL_NAME = 'Write'

export const DESCRIPTION = 'Write a file to the local filesystem.'

// Borrowed from cc's getWriteToolDescription — the Web VFS has no Read-
// before-Write requirement (no external concurrent editors), so the
// pre-read instruction is dropped.
export const PROMPT = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- Prefer the Edit tool for modifying existing files — it only sends the diff. Only use this tool to create new files or for complete rewrites.
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.`

export type FileWriteInput = {
  file_path: string
  content: string
}

export type FileWriteOutput = {
  type: 'create' | 'update'
  filePath: string
  content: string
}

export const FileWriteTool = buildTool({
  name: FILE_WRITE_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to write (must be absolute, not relative)',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['file_path', 'content'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => false,
  isDestructive: () => true,
  validateInput(input: FileWriteInput): ValidationResult {
    if (!input.file_path || input.file_path.trim() === '') {
      return { result: false, message: 'file_path is required' }
    }
    if (typeof input.content !== 'string') {
      return { result: false, message: 'content must be a string' }
    }
    return { result: true }
  },
  async call(input: FileWriteInput, context: ToolUseContext): Promise<FileWriteOutput> {
    const vfs = context.virtualFs
    if (!vfs) {
      throw new Error('Virtual file system is not available.')
    }
    // Determine create vs update by checking existence (mirrors cc's branch).
    const existing = await vfs.readFile(input.file_path)
    await vfs.writeFile(input.file_path, input.content)
    return {
      type: existing ? 'update' : 'create',
      filePath: input.file_path,
      content: input.content,
    }
  },
  renderToolUseMessage(input: FileWriteInput): ReactNode {
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
        <span style={{ color: 'var(--icon-secondary)' }}>✏️</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
          {input.file_path}
        </span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: FileWriteOutput,
    toolUseId: string,
  ): ToolResultBlock {
    if (output.type === 'create') {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `File created successfully at: ${output.filePath}`,
      }
    }
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `The file ${output.filePath} has been updated successfully.`,
    }
  },
} satisfies ToolDef<FileWriteInput, FileWriteOutput>)
