// Borrowed from src/services/tools/StreamingToolExecutor.ts — accumulate
// input_json_delta fragments as they stream in from the API, then on the
// closing content_block_stop emit a fully-formed ToolUseBlock ready for
// executeToolUse().
//
// cc's StreamingToolExecutor also handles parallel tool_use blocks (multiple
// in-flight at once), tracks per-tool toolUseID → in-progress state, and
// runs the tool.call() concurrently. The Web port keeps the spec's simpler
// contract: a single current tool_use at a time (the API streams them
// sequentially in practice and the chatClient processes them in order).
// The completed-tool list mirrors cc's `completedToolUses` array so the
// chatClient can drain them after the message_stop event.
//
// Why buffer the JSON: the API sends `input_json_delta` as string fragments
// of the JSON-serialized input object. Concatenating and JSON.parse()ing at
// the end matches cc's behavior exactly (cc's StreamingToolExecutor does
// `this.input += jsonDelta` then `JSON.parse(this.input)` on
// content_block_stop). Partial-JSON parse failures are ignored (cc logs and
// drops the tool_use; the Web port returns null so the caller can skip it).

import type { ToolUseBlock } from '../types/index.js'

type CurrentToolUse = {
  id: string
  name: string
  inputBuffer: string
}

export class StreamingToolExecutor {
  // Borrowed from cc's StreamingToolExecutor.currentToolUse — the in-flight
  // tool_use being assembled from input_json_delta fragments. Null when no
  // tool_use is currently streaming.
  private currentToolUse: CurrentToolUse | null = null

  // Borrowed from cc's completedToolUses — fully-assembled ToolUseBlocks
  // waiting to be executed. The chatClient drains these after message_stop.
  private completedToolUses: ToolUseBlock[] = []

  /**
   * Borrowed from cc's handleContentBlockStart when type === 'tool_use'.
   * Begins accumulating input_json_delta for a new tool_use.
   */
  startToolUse(id: string, name: string): void {
    this.currentToolUse = { id, name, inputBuffer: '' }
  }

  /**
   * Borrowed from cc's handleInputJsonDelta — appends the delta string to
   * the current tool_use's input buffer. No-op if no tool_use is in flight
   * (matches cc's silent drop on out-of-order deltas).
   */
  appendInputJsonDelta(delta: string): void {
    if (this.currentToolUse) {
      this.currentToolUse.inputBuffer += delta
    }
  }

  /**
   * Borrowed from cc's handleContentBlockStop for tool_use blocks. Parses
   * the accumulated input buffer into a JSON object and returns the
   * ToolUseBlock. Returns null if no tool_use is in flight or the buffer
   * isn't valid JSON (partial stream — the caller should skip).
   */
  completeToolUse(): ToolUseBlock | null {
    if (!this.currentToolUse) return null
    const { id, name, inputBuffer } = this.currentToolUse
    let input: Record<string, unknown> = {}
    if (inputBuffer) {
      try {
        input = JSON.parse(inputBuffer) as Record<string, unknown>
      } catch {
        // Partial JSON — the stream was interrupted before the closing
        // brace. Drop the tool_use rather than emit a malformed one (the
        // API would reject it on the next request).
        this.currentToolUse = null
        return null
      }
    }
    const toolUse: ToolUseBlock = { type: 'tool_use', id, name, input }
    this.completedToolUses.push(toolUse)
    this.currentToolUse = null
    return toolUse
  }

  /**
   * Borrowed from cc's getCompletedToolUses — returns a copy of the
   * completed tool_use list so the chatClient can iterate without mutating.
   */
  getCompletedToolUses(): ToolUseBlock[] {
    return [...this.completedToolUses]
  }

  /**
   * Whether a tool_use is currently being assembled (used by the chatClient
   * to decide whether to route a delta to appendInputJsonDelta).
   */
  hasPendingToolUse(): boolean {
    return this.currentToolUse !== null
  }

  /**
   * Reset between assistant turns (the next message_start begins a fresh
   * tool-use batch). cc's StreamingToolExecutor is per-turn; the Web port
   * mirrors that so completed tool_uses from a previous turn don't leak in.
   */
  reset(): void {
    this.currentToolUse = null
    this.completedToolUses = []
  }
}
