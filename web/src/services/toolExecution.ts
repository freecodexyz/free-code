// Borrowed from src/services/tools/toolExecution.ts — the Web port's
// executeToolUse() mirrors cc's single-tool execution flow:
//   findToolByName → isEnabled → validateInput → checkPermissions → call →
//   mapToolResultToToolResultBlockParam
//
// cc's toolExecution.ts wraps this in a larger pipeline that also runs
// preToolUse hooks, emits telemetry spans, persists oversized results to disk,
// and routes through the canUseTool permission UI. The Web port drops all of
// that (no hooks/telemetry/disk persistence in the browser) and keeps the
// core flow + error handling. checkPermissions in cc returns a structured
// PermissionResult (`{behavior:'allow'|'ask'|'deny', ...}`); the Web port's
// ToolUseContext.checkPermissions returns a simple boolean (`true` = allow)
// because the permission UI (useCanUseTool) is a Phase 8 concern and the
// spec says to keep toolExecution focused on the synchronous happy path.
//
// The function returns a ToolResultBlock (the cc ToolResultBlockParam shape)
// directly so the chatClient can append it as the next user message's content.

import type { Tool, ToolUseContext } from '../Tool.js'
import type { ToolUseBlock, ToolResultBlock } from '../types/index.js'
import { findToolByName } from '../Tool.js'

/**
 * Borrowed from cc's performToolUse() / executeToolUse(). Runs the full
 * tool-use lifecycle for a single tool_use block and returns the
 * ToolResultBlock that should be sent back to the model.
 *
 * Error cases (mirroring cc):
 * - Tool not found → is_error: true, lists available tools
 * - Tool disabled → is_error: true
 * - validateInput fails → is_error: true, surfaces the validation message
 * - checkPermissions denies → is_error: true, surfaces a denied message
 * - call() throws → is_error: true, surfaces the error message
 *
 * On success, calls tool.mapToolResultToToolResultBlockParam() (or the
 * TOOL_DEFAULTS fallback that JSON.stringifies the output).
 */
export async function executeToolUse(
  toolUse: ToolUseBlock,
  tools: Tool[],
  context: ToolUseContext,
): Promise<ToolResultBlock> {
  const tool = findToolByName(tools, toolUse.name)
  if (!tool) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Tool "${toolUse.name}" is not defined. Available tools: ${tools
        .map(t => t.name)
        .join(', ')}`,
      is_error: true,
    }
  }

  if (!tool.isEnabled?.()) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Tool "${toolUse.name}" is not available in the current mode.`,
      is_error: true,
    }
  }

  const validation = tool.validateInput?.(toolUse.input)
  if (validation && validation.result === false) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: validation.message,
      is_error: true,
    }
  }

  // checkPermissions: cc returns a structured PermissionResult; the Web port's
  // tools return a boolean (true = allow). Phase 8's useCanUseTool hook will
  // gate the call() invocation itself; here we only honor the tool's own
  // static permission check.
  const permitted = tool.checkPermissions
    ? await tool.checkPermissions(toolUse.input)
    : true
  if (!permitted) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Permission denied for tool "${toolUse.name}".`,
      is_error: true,
    }
  }

  try {
    const output = await tool.call(toolUse.input, context)
    return (
      tool.mapToolResultToToolResultBlockParam?.(output, toolUse.id) ?? {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: typeof output === 'string' ? output : JSON.stringify(output),
      }
    )
  } catch (e) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      is_error: true,
    }
  }
}
