// Borrowed from src/tools/FileReadTool/FileReadTool.ts + prompt.ts —
// the Web port reads from the IndexedDB-backed virtual file system
// (services/virtualFs.ts) instead of the host filesystem. cc reads
// images/PDFs/notebooks with dedicated codecs; the Web VFS is text-only,
// so those branches are dropped. The cat -n line-number format, offset/
// limit handling, and the empty-file warning mirror cc's contract.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const FILE_READ_TOOL_NAME = 'Read'

export const DESCRIPTION = 'Read a file from the local filesystem.'

// Borrowed from cc's renderPromptTemplate — simplified for the Web VFS (no
// images/PDFs/notebooks, no max-size instruction).
export const PROMPT = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Results are returned using cat -n format, with line numbers starting at 1
- This tool can only read files, not directories.`

// Borrowed from cc's MAX_LINES_TO_READ.
const MAX_LINES_TO_READ = 2000

export type FileReadInput = {
  file_path: string
  offset?: number
  limit?: number
}

export type FileReadOutput = {
  filePath: string
  content: string
  numLines: number
  startLine: number
  totalLines: number
}

// Borrowed from cc's addLineNumbers — format content with cat -n style line
// numbers (right-aligned number + tab + content).
function addLineNumbers(content: string, startLine: number): string {
  const lines = content.split('\n')
  const maxDigits = String(startLine + lines.length - 1).length
  return lines
    .map((line, i) => {
      const n = String(startLine + i)
      const padded = n.padStart(maxDigits, ' ')
      return `${padded}\t${line}`
    })
    .join('\n')
}

export const FileReadTool = buildTool({
  name: FILE_READ_TOOL_NAME,
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
        description: 'The absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description:
          'The line number to start reading from. Only provide if the file is too large to read at once',
      },
      limit: {
        type: 'number',
        description:
          'The number of lines to read. Only provide if the file is too large to read at once.',
      },
    },
    required: ['file_path'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => true,
  isConcurrencySafe: true,
  validateInput(input: FileReadInput): ValidationResult {
    if (!input.file_path || input.file_path.trim() === '') {
      return { result: false, message: 'file_path is required' }
    }
    if (input.offset !== undefined && input.offset < 0) {
      return { result: false, message: 'offset must be non-negative' }
    }
    if (input.limit !== undefined && input.limit <= 0) {
      return { result: false, message: 'limit must be positive' }
    }
    return { result: true }
  },
  async call(input: FileReadInput, context: ToolUseContext): Promise<FileReadOutput> {
    const vfs = context.virtualFs
    if (!vfs) {
      throw new Error('Virtual file system is not available.')
    }
    const file = await vfs.readFile(input.file_path)
    if (!file) {
      throw new Error(`File does not exist: ${input.file_path}`)
    }
    const allLines = file.content.split('\n')
    const totalLines = allLines.length
    // cc is 1-indexed; offset of 0 is treated as "from the start".
    const startLine = input.offset && input.offset > 0 ? input.offset : 1
    const lineOffset = startLine - 1
    const limit = input.limit ?? MAX_LINES_TO_READ
    const selected = allLines.slice(lineOffset, lineOffset + limit)
    const content = selected.join('\n')
    return {
      filePath: input.file_path,
      content,
      numLines: selected.length,
      startLine,
      totalLines,
    }
  },
  renderToolUseMessage(input: FileReadInput): ReactNode {
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
        <span style={{ color: 'var(--icon-secondary)' }}>📖</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
          {input.file_path}
        </span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: FileReadOutput,
    toolUseId: string,
  ): ToolResultBlock {
    // cc emits an empty-file warning when the content is empty.
    if (output.content === '' && output.totalLines === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content:
          '<system-reminder>Warning: the file exists but the contents are empty.</system-reminder>',
      }
    }
    // cc emits an offset-beyond-EOF warning when startLine > totalLines.
    if (output.numLines === 0 && output.totalLines > 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<system-reminder>Warning: the file exists but is shorter than the provided offset (${output.startLine}). The file has ${output.totalLines} lines.</system-reminder>`,
      }
    }
    const formatted = addLineNumbers(output.content, output.startLine)
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: formatted,
    }
  },
} satisfies ToolDef<FileReadInput, FileReadOutput>)
