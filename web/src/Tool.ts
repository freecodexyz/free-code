// Borrowed from src/Tool.ts — Tool interface, buildTool, TOOL_DEFAULTS,
// findToolByName, toolMatchesName. The Web port keeps cc's contract so the
// registry, execution flow, and tool definitions mirror the CLI's, but drops
// the cc-specific ToolUseContext fields (readFileState, getAppState, mcpClients,
// abortController is required etc.) that depend on Node/Ink. The Web
// ToolUseContext carries only the fields the Web tools need:
// - messages + setMessages (the running transcript)
// - setTodos (TodoWrite target)
// - setInProgressToolUseIDs (UI busy indicators)
// - toolUseId (current tool_use id)
// - onProgress (streaming progress callbacks)
// - virtualFs (the IndexedDB-backed file system for Read/Write/Edit/Glob/Grep)
//
// `call(input, context)` returns `Promise<O>` directly (the Web port drops
// cc's `{ data: O }` envelope; tools that need to signal a synthesized
// user-side message do so via context.setMessages). mapToolResultToToolResultBlockParam
// receives the bare output `O`.

import type { ReactNode } from 'react'
import type { ToolResultBlock, Message, Todo } from './types/index.js'

// Borrowed from src/Tool.ts — ToolInputJSONSchema. cc defines this as an
// open-ended object keyed by string with a `type: 'object'` discriminator and
// an optional `properties` map. The Web port reuses the same shape so the
// schemas defined per-tool (mirroring cc's zod definitions) serialize
// byte-for-byte to the API. We avoid depending on `json-schema` types
// (not a dependency) by inlining a permissive local type.
export type JSONSchema = {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  description?: string
  enum?: unknown[]
  items?: JSONSchema
  additionalProperties?: boolean
  [key: string]: unknown
}

// Borrowed from src/Tool.ts — ValidationResult. cc adds an `errorCode`
// branch; the Web port keeps only the discriminated `result` + message
// (the spec's executeToolUse only surfaces the message).
export type ValidationResult =
  | { result: true }
  | { result: false; message: string }

// Borrowed from src/Tool.ts — ToolUseContext (simplified for Web).
// Web-only fields:
// - virtualFs: set by the hook when the IndexedDB VFS is ready; file tools
//   return an error when it's missing.
export type ToolUseContext = {
  options: {
    abortController?: AbortController
    readOnlyMode?: boolean
    permissionMode?: 'default' | 'plan' | 'auto-accept' | 'bypass'
  }
  messages: Message[]
  setMessages: (updater: (prev: Message[]) => Message[]) => void
  setTodos?: (
    updater: (prev: Record<string, Todo[]>) => Record<string, Todo[]>,
  ) => void
  setInProgressToolUseIDs?: (updater: (prev: string[]) => string[]) => void
  toolUseId: string
  onProgress?: (message: string) => void
  // Web-only: virtual file system (set by hook when available)
  virtualFs?: import('./services/virtualFs.js').VirtualFs
}

// Borrowed from src/Tool.ts — ToolDef. cc's ToolDef is a large object with
// searchHint/maxResultSizeChars/strict/shouldDefer/getToolUseSummary/etc.
// The Web port keeps the fields the spec calls out: name, description, prompt,
// inputJSONSchema, isEnabled, isReadOnly, isConcurrencySafe, isDestructive,
// checkPermissions, userFacingName, call, renderToolUseMessage,
// renderToolResultMessage, renderToolUseProgressMessage,
// mapToolResultToToolResultBlockParam, validateInput.
export type ToolDef<I, O> = {
  name: string
  description(): Promise<string>
  inputJSONSchema: JSONSchema
  prompt?(): Promise<string>
  isEnabled?: () => boolean
  isReadOnly?: () => boolean
  isConcurrencySafe?: boolean
  isDestructive?: () => boolean
  checkPermissions?(input: I): Promise<boolean>
  userFacingName?(input: I): string
  call(input: I, context: ToolUseContext): Promise<O>
  renderToolUseMessage?(input: I): ReactNode | null
  renderToolResultMessage?(output: O): ReactNode | null
  renderToolUseProgressMessage?(input: I): ReactNode
  mapToolResultToToolResultBlockParam?(output: O, toolUseId: string): ToolResultBlock
  validateInput?(input: I): ValidationResult
}

// Borrowed from src/Tool.ts — Tool generic alias. cc uses Tool<I, O, P> with
// defaults of `any` (its Tool<any, any, any> appears throughout the codebase
// where the input/output are not statically known at the registry layer). The
// Web port drops the unused `P` (permission type) generic since the Web
// ToolUseContext.checkPermissions returns a plain boolean, so getAllBaseTools()
// can return Tool[] without per-element generics. eslint-disable for the `any`
// defaults is intentional — they match cc's contract verbatim.
export type Tool<I = any, O = any> = ToolDef<I, O>

// Borrowed from src/Tool.ts — TOOL_DEFAULTS. cc fills these defaults in
// buildTool() so individual tool definitions can omit any optional field.
// The Web port keeps the same defaults: enabled, not read-only, not
// concurrency-safe, not destructive, allow-by-default permissions,
// no-op render hooks, JSON.stringify fallback for the result block.
export const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isReadOnly: () => false,
  isConcurrencySafe: false,
  isDestructive: () => false,
  checkPermissions: async () => true,
  renderToolUseMessage: () => null,
  renderToolResultMessage: () => null,
  renderToolUseProgressMessage: () => null,
  mapToolResultToToolResultBlockParam: (
    output: unknown,
    toolUseId: string,
  ): ToolResultBlock => ({
    type: 'tool_result',
    tool_use_id: toolUseId,
    content:
      typeof output === 'string' ? output : JSON.stringify(output),
  }),
  validateInput: () => ({ result: true as const }),
}

// Borrowed from src/Tool.ts — buildTool. cc merges TOOL_DEFAULTS with the
// provided def so optional fields are always present at runtime. The Web port
// does the same: a plain spread is enough since TOOL_DEFAULTS only supplies
// optional keys (any key the def provides wins).
export function buildTool<I, O>(
  def: ToolDef<I, O>,
): Tool<I, O> {
  return { ...TOOL_DEFAULTS, ...def }
}

// Borrowed from src/Tool.ts — findToolByName. cc scans the tools array with
// toolMatchesName so MCP-prefixed names (mcp__server__tool) resolve. The Web
// port has no MCP servers, so a strict equality match on `tool.name` suffices.
export function findToolByName(
  tools: Tool[],
  name: string,
): Tool | undefined {
  return tools.find(t => toolMatchesName(t, name))
}

// Borrowed from src/Tool.ts — toolMatchesName. Strict equality for the Web
// port (no MCP prefix stripping needed).
export function toolMatchesName(tool: Tool, name: string): boolean {
  return tool.name === name
}
