// Borrowed from src/hooks/useCanUseTool.tsx — Web port of cc's tool-permission
// confirmation flow. cc drives an Ink <Box> permission dialog and resolves a
// Promise<PermissionDecision> sourced from hasPermissionsToUseTool (with
// classifier/swarm/coordinator fast-paths). The Web port keeps the same core
// contract — show a card, await a user Allow/Deny choice, resolve a
// Promise<boolean> — but renders a DOM card driven by WorkspaceState's
// `elicitation` field and consults the Tool's own checkPermissions boolean.
//
// Auto-approve rules mirror cc's permission modes:
// - bypass      → always allow (cc "yolo")
// - auto-accept → read-only & non-destructive tools run without a prompt;
//   destructive tools still prompt (security tradeoff — default to asking)
// - plan        → only read-only tools may run
// - default     → always ask the user

import { useCallback, type FC } from 'react'
import type { Tool } from '../Tool.js'
import { useWorkspaceState, useSetWorkspaceState } from '../state/WorkspaceState.js'

export type ElicitationState = {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  resolve: (allowed: boolean) => void
}

export type UseCanUseToolResult = {
  canUseTool: (tool: Tool, input: unknown, toolUseId: string) => Promise<boolean>
  ElicitationCard: FC
}

// Module-level singleton — borrowed pattern from cc's toolPermissionContext
// (cc uses a single permission-promise queue per QueryEngine; Web has a single
// conversation per page, so a module-level singleton is simpler).
//
// IMPORTANT: this MUST live at module scope, not in a useRef. useChat and
// ChatPanel each call useCanUseTool() and would otherwise get separate
// pendingRef instances — when ChatPanel's ElicitationCard.answer() button
// fires, it would read from its OWN (null) ref and the Promise parked by
// useChat.canUseTool() would never resolve. A single module-level slot
// guarantees the answer reaches the parked resolver regardless of which
// hook instance the user interacts with.
let pendingElicitation: ElicitationState | null = null

export function useCanUseTool(): UseCanUseToolResult {
  const setState = useSetWorkspaceState()
  const permissionMode = useWorkspaceState(s => s.permissionMode ?? 'default')

  const canUseTool = useCallback(
    async (tool: Tool, input: unknown, toolUseId: string): Promise<boolean> => {
      // Auto-approve everything when permission mode is bypass (cc "yolo").
      if (permissionMode === 'bypass') return true

      // Auto-approve read-only tools in auto-accept mode without a UI prompt.
      if (permissionMode === 'auto-accept' && tool.isReadOnly?.()) return true

      // Consult the tool's own permission policy. A hard `false` denies
      // regardless of mode; `true`/`undefined` falls through to mode rules.
      const allowed = await tool.checkPermissions?.(input as never)
      if (allowed === false) return false

      // Plan mode: only read-only tools may run.
      if (permissionMode === 'plan') return tool.isReadOnly?.() ?? false

      // Auto-accept mode: auto-approve non-destructive tools; destructive
      // tools still prompt the user (security tradeoff — default to asking).
      if (permissionMode === 'auto-accept') {
        if (!tool.isDestructive?.()) return true
        // destructive → fall through to elicitation prompt below
      }

      // default mode (and auto-accept destructive): prompt the user via the
      // elicitation card and resolve when they click Allow / Deny.
      return new Promise<boolean>(resolve => {
        pendingElicitation = {
          toolUseId,
          toolName: tool.name,
          input: input as Record<string, unknown>,
          resolve,
        }
        setState(prev => ({
          ...prev,
          elicitation: {
            toolUseId,
            toolName: tool.name,
            input: input as Record<string, unknown>,
          },
        }))
      })
    },
    [permissionMode, setState],
  )

  const answer = useCallback(
    (allowed: boolean) => {
      const pending = pendingElicitation
      pendingElicitation = null
      setState(prev => ({ ...prev, elicitation: null }))
      pending?.resolve(allowed)
    },
    [setState],
  )

  // Renders the active elicitation card. Reads `elicitation` from state so it
  // only paints while a permission request is pending; the Allow/Deny buttons
  // resolve the parked Promise via `answer`.
  const ElicitationCard: FC = () => {
    const elicitation = useWorkspaceState(s => s.elicitation)
    if (!elicitation) return null
    return (
      <div
        className="elicitation-card"
        style={{
          border: '1px solid var(--border-default, #ddd)',
          borderRadius: 8,
          padding: 'var(--spacer-12, 12px)',
          margin: 'var(--spacer-8, 8px) 0',
          background: 'var(--bg-elevated-default, #f9f9f9)',
        }}
      >
        <div style={{ fontWeight: 'var(--font-weight-medium, 500)', marginBottom: 8 }}>
          🔧 Tool permission request: <code>{elicitation.toolName}</code>
        </div>
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-secondary, #666)' }}>
            Input
          </summary>
          <pre
            style={{
              background: 'var(--bg-base-default, #f0f0f0)',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(elicitation.input ?? {}, null, 2)}
          </pre>
        </details>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="ds-btn ds-btn--secondary"
            type="button"
            onClick={() => answer(false)}
          >
            Deny
          </button>
          <button
            className="ds-btn ds-btn--brand"
            type="button"
            onClick={() => answer(true)}
          >
            Allow
          </button>
        </div>
      </div>
    )
  }

  return { canUseTool, ElicitationCard }
}
