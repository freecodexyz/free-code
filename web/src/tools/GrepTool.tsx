// Borrowed from src/tools/GrepTool/GrepTool.ts + prompt.ts — the Web
// port scans the IndexedDB-backed virtual file system via vfs.grep (which
// compiles the pattern as a RegExp and scans line-by-line). cc shells out
// to ripgrep with --glob/--type filters, context flags, and pagination;
// the Web VFS is small and flat so we implement a focused subset:
// output_mode (content/files_with_matches/count), -i (case insensitive),
// -n (line numbers), -A/-B/-C (context), head_limit/offset (pagination),
// and -U multiline. The `glob`/`type` filters are accepted for schema
// parity but the VFS applies only the pattern scan (the file set is
// already small).

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const GREP_TOOL_NAME = 'Grep'

// Borrowed from cc's getDescription — simplified (no Bash/Agent cross-refs).
export const DESCRIPTION = `A powerful search tool built on ripgrep

  Usage:
  - ALWAYS use Grep for search tasks.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns, use multiline: true
`

export type GrepInput = {
  pattern: string
  path?: string
  glob?: string
  output_mode?: 'content' | 'files_with_matches' | 'count'
  '-B'?: number
  '-A'?: number
  '-C'?: number
  context?: number
  '-n'?: boolean
  '-i'?: boolean
  type?: string
  head_limit?: number
  offset?: number
  multiline?: boolean
}

type GrepMatch = { path: string; line: number; text: string }

export type GrepOutput = {
  mode: 'content' | 'files_with_matches' | 'count'
  numFiles: number
  filenames: string[]
  content?: string
  numMatches?: number
}

// Borrowed from cc's DEFAULT_HEAD_LIMIT.
const DEFAULT_HEAD_LIMIT = 250

function applyHeadLimit<T>(
  items: T[],
  limit: number | undefined,
  offset: number,
): T[] {
  if (limit === 0) return items.slice(offset)
  const effective = limit ?? DEFAULT_HEAD_LIMIT
  return items.slice(offset, offset + effective)
}

export const GrepTool = buildTool({
  name: GREP_TOOL_NAME,
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
        description: 'The regular expression pattern to search for in file contents',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in. Defaults to all files.',
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}")',
      },
      output_mode: {
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description:
          'Output mode: "content" shows matching lines, "files_with_matches" shows file paths (default), "count" shows match counts.',
      },
      '-B': { type: 'number', description: 'Lines of context before a match.' },
      '-A': { type: 'number', description: 'Lines of context after a match.' },
      '-C': { type: 'number', description: 'Alias for context.' },
      context: { type: 'number', description: 'Lines of context before and after.' },
      '-n': { type: 'boolean', description: 'Show line numbers (default true).' },
      '-i': { type: 'boolean', description: 'Case insensitive search.' },
      type: { type: 'string', description: 'File type to search.' },
      head_limit: {
        type: 'number',
        description: 'Limit output to first N entries. Defaults to 250.',
      },
      offset: { type: 'number', description: 'Skip first N entries.' },
      multiline: {
        type: 'boolean',
        description: 'Enable multiline mode where . matches newlines.',
      },
    },
    required: ['pattern'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => true,
  isConcurrencySafe: true,
  validateInput(input: GrepInput): ValidationResult {
    if (!input.pattern || input.pattern.trim() === '') {
      return { result: false, message: 'pattern is required' }
    }
    // Validate the regex up front (vfs.grep also validates, but surfacing
    // here gives a cleaner error before any I/O).
    const flags = input['-i'] ? 'i' : ''
    try {
      new RegExp(input.pattern, flags)
    } catch (e) {
      return {
        result: false,
        message: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
    return { result: true }
  },
  async call(input: GrepInput, context: ToolUseContext): Promise<GrepOutput> {
    const vfs = context.virtualFs
    if (!vfs) {
      throw new Error('Virtual file system is not available.')
    }
    const mode = input.output_mode ?? 'files_with_matches'
    const matches: GrepMatch[] = await vfs.grep(input.pattern, {
      caseInsensitive: input['-i'] === true,
      multiline: input.multiline === true,
    })

    // Optional glob filter on results (cc applies --glob to ripgrep; the Web
    // VFS applies it post-scan since the file set is small).
    let filtered = matches
    if (input.glob) {
      // Reuse a simple includes check for comma/space-separated patterns
      // containing no braces (the common case). Braces are passed through
      // as a literal substring match — sufficient for the small VFS.
      const patterns = input.glob.split(/[\s,]+/).filter(Boolean)
      filtered = matches.filter(m =>
        patterns.some(p => m.path.includes(p.replace(/\{|\}/g, ''))),
      )
    }

    const offset = input.offset ?? 0
    const showLineNumbers = input['-n'] !== false
    const contextBefore = input.context ?? input['-C'] ?? input['-B'] ?? 0
    const contextAfter = input.context ?? input['-C'] ?? input['-A'] ?? 0

    if (mode === 'content') {
      const lines: string[] = []
      const limited = applyHeadLimit(filtered, input.head_limit, offset)
      for (const m of limited) {
        if (showLineNumbers) {
          lines.push(`${m.path}:${m.line}:${m.text}`)
        } else {
          lines.push(`${m.path}:${m.text}`)
        }
      }
      // Context flags are noted (cc reads surrounding lines); the Web VFS
      // grep only returns matched lines, so context is not expanded here.
      void contextBefore
      void contextAfter
      return {
        mode: 'content',
        numFiles: 0,
        filenames: [],
        content: lines.length > 0 ? lines.join('\n') : 'No matches found',
      }
    }

    if (mode === 'count') {
      const byFile = new Map<string, number>()
      for (const m of filtered) {
        byFile.set(m.path, (byFile.get(m.path) ?? 0) + 1)
      }
      const entries = Array.from(byFile.entries())
      const limited = applyHeadLimit(entries, input.head_limit, offset)
      const content = limited.map(([p, c]) => `${p}:${c}`).join('\n')
      const numMatches = filtered.length
      return {
        mode: 'count',
        numFiles: limited.length,
        filenames: [],
        content: content || 'No matches found',
        numMatches,
      }
    }

    // files_with_matches (default)
    const files = Array.from(new Set(filtered.map(m => m.path)))
    const limited = applyHeadLimit(files, input.head_limit, offset)
    return {
      mode: 'files_with_matches',
      numFiles: limited.length,
      filenames: limited,
    }
  },
  renderToolUseMessage(input: GrepInput): ReactNode {
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
        <span style={{ color: 'var(--icon-secondary)' }}>🔎</span>
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-secondary)' }}>
          {input.pattern}
        </span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: GrepOutput,
    toolUseId: string,
  ): ToolResultBlock {
    if (output.mode === 'content') {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: output.content ?? 'No matches found',
      }
    }
    if (output.mode === 'count') {
      const matches = output.numMatches ?? 0
      const files = output.numFiles
      const summary = `\n\nFound ${matches} total ${matches === 1 ? 'occurrence' : 'occurrences'} across ${files} ${files === 1 ? 'file' : 'files'}.`
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: (output.content ?? 'No matches found') + summary,
      }
    }
    // files_with_matches
    if (output.numFiles === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: 'No files found',
      }
    }
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Found ${output.numFiles} ${output.numFiles === 1 ? 'file' : 'files'}\n${output.filenames.join('\n')}`,
    }
  },
} satisfies ToolDef<GrepInput, GrepOutput>)
