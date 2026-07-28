// Borrowed from src/tools/FileEditTool/FileEditTool.ts + prompt.ts —
// the Web port edits files in the IndexedDB-backed virtual file system
// via vfs.editFile (which enforces uniqueness unless replace_all is set,
// mirroring cc's contract). cc requires a prior Read and errors on stale
// files; the Web VFS is single-writer so that check is dropped. The
// uniqueness/replace_all semantics and result messages mirror cc's.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const FILE_EDIT_TOOL_NAME = 'Edit'

export const DESCRIPTION = 'Performs exact string replacements in files.'

// Borrowed from cc's getEditToolDescription — the Web VFS has no Read-
// before-Edit requirement (no external concurrent editors), so the pre-read
// instruction is dropped.
export const PROMPT = `Performs exact string replacements in files.

Usage:
- When editing text, ensure you preserve the exact indentation (tabs/spaces) as it appears in the file.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`

export type FileEditInput = {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

export type FileEditOutput = {
  filePath: string
  replaced: number
}

export const FileEditTool = buildTool({
  name: FILE_EDIT_TOOL_NAME,
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
        description: 'The absolute path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'The text to replace',
      },
      new_string: {
        type: 'string',
        description: 'The text to replace it with (must be different from old_string)',
      },
      replace_all: {
        type: 'boolean',
        description:
          'Replace all occurrences of old_string. Useful for renaming a variable across the file.',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => false,
  isDestructive: () => false,
  validateInput(input: FileEditInput): ValidationResult {
    if (!input.file_path || input.file_path.trim() === '') {
      return { result: false, message: 'file_path is required' }
    }
    if (input.old_string === input.new_string) {
      return {
        result: false,
        message: 'new_string must be different from old_string',
      }
    }
    return { result: true }
  },
  async call(input: FileEditInput, context: ToolUseContext): Promise<FileEditOutput> {
    const vfs = context.virtualFs
    if (!vfs) {
      throw new Error('Virtual file system is not available.')
    }
    const existing = await vfs.readFile(input.file_path)
    if (!existing) {
      throw new Error(`File does not exist: ${input.file_path}`)
    }
    const { content } = existing
    // Count occurrences up front so we can branch on replace_all semantics
    // (vfs.editFile already enforces uniqueness when replace_all is false,
    // but we replicate cc's error messages here for parity).
    const occurrences = content.split(input.old_string).length - 1
    if (occurrences === 0) {
      throw new Error(
        `String to replace not found in file.\nString: ${input.old_string}`,
      )
    }
    if (occurrences > 1 && !input.replace_all) {
      throw new Error(
        `Found ${occurrences} matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.\nString: ${input.old_string}`,
      )
    }
    const result = await vfs.editFile(
      input.file_path,
      input.old_string,
      input.new_string,
    )
    if (!result.ok) {
      throw new Error(result.error ?? 'Edit failed')
    }
    return {
      filePath: input.file_path,
      replaced: input.replace_all ? occurrences : 1,
    }
  },
  renderToolUseMessage(input: FileEditInput): ReactNode {
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
        <span style={{ color: 'var(--icon-secondary)' }}>📝</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
          {input.file_path}
        </span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: FileEditOutput,
    toolUseId: string,
  ): ToolResultBlock {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `The file ${output.filePath} has been updated successfully.`,
    }
  },
} satisfies ToolDef<FileEditInput, FileEditOutput>)
