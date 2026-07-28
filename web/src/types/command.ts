// Borrowed from src/types/command.ts — cc-borrowed command union types for the
// Web UI (simplified: no Node/Ink/ToolUseContext deps). Each command is one of
// three kinds:
//   - prompt       expands into a user prompt sent to the model
//   - local        runs a side-effect (e.g. clear messages) with no UI
//   - local-jsx    renders a React element (e.g. a modal card)

import type React from 'react'

export type CommandBase = {
  type: 'prompt' | 'local' | 'local-jsx'
  name: string // e.g. 'help' (without leading /)
  description: string
  isEnabled?: () => boolean
  isVisible?: () => boolean
  userFacingName?(): string // display name e.g. '/help'
  argumentHint?: string
  placeholder?: string
}

export type PromptCommand = CommandBase & {
  type: 'prompt'
  prompt: string | ((args: string) => string | Promise<string>)
}

export type LocalCommand = CommandBase & {
  type: 'local'
  call: (args: string, context: LocalCommandContext) => void | Promise<void>
}

export type LocalJSXCommandContext = {
  setMessages: (updater: (prev: any[]) => any[]) => void
  abortController: AbortController | null
  // Add other context fields as needed
}

export type LocalJSXCommandOnDone = (result?: unknown) => void

export type LocalJSXCommand = CommandBase & {
  type: 'local-jsx'
  call: (
    args: string,
    context: LocalJSXCommandContext,
    onDone: LocalJSXCommandOnDone,
  ) => React.ReactElement
}

export type Command = PromptCommand | LocalCommand | LocalJSXCommand

export type LocalCommandContext = {
  setMessages: (updater: (prev: any[]) => any[]) => void
  clearMessages: () => void
  abortController: AbortController | null
}

export const builtInCommandNames = [
  'help',
  'clear',
  'compact',
  'model',
  'cost',
  'status',
  'init',
  'review',
] as const

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/')
}

export function parseSlashCommand(input: string): { name: string; args: string } {
  const trimmed = input.trim().replace(/^\//, '')
  const spaceIdx = trimmed.search(/\s/)
  if (spaceIdx === -1) return { name: trimmed, args: '' }
  return {
    name: trimmed.slice(0, spaceIdx),
    args: trimmed.slice(spaceIdx + 1).trim(),
  }
}
