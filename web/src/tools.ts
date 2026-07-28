// Borrowed from src/tools.ts — the Web port's tool registry. cc uses lazy
// require() for each tool module (so the Bun bundle stays small until a tool
// is actually used); the Web port uses static ESM imports since Vite tree-
// shakes anyway and the tool set is fixed. getAllBaseTools() returns the
// same 9 tools the spec calls out (TodoWrite, AskUserQuestion, WebFetch,
// Read, Write, Edit, Glob, Grep, Bash). Bash is included but disabled via
// isEnabled() so executeToolUse short-circuits it.

import type { Tool } from './Tool.js'
import { AskUserQuestionTool } from './tools/AskUserQuestionTool.js'
import { BashTool } from './tools/BashTool.js'
import { FileEditTool } from './tools/FileEditTool.js'
import { FileReadTool } from './tools/FileReadTool.js'
import { FileWriteTool } from './tools/FileWriteTool.js'
import { GlobTool } from './tools/GlobTool.js'
import { GrepTool } from './tools/GrepTool.js'
import { TodoWriteTool } from './tools/TodoWriteTool.js'
import { WebFetchTool } from './tools/WebFetchTool.js'

// Borrowed from cc's getAllBaseTools — the canonical list of built-in tools
// (no MCP tools in the Web port). Order mirrors cc's registration order so
// the "available tools" error message (from executeToolUse's not-found path)
// is stable and recognizable.
export function getAllBaseTools(): Tool[] {
  return [
    TodoWriteTool,
    AskUserQuestionTool,
    WebFetchTool,
    FileReadTool,
    FileWriteTool,
    FileEditTool,
    GlobTool,
    GrepTool,
    BashTool,
  ]
}
