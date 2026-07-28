import { useCallback } from 'react'
import { useWorkspaceState, useSetWorkspaceState } from '../state/WorkspaceState.js'
import { getSlashCommandsForUI } from '../commands.js'
import type { SlashCommand } from '../types/index.js'

// Borrowed from src/commands.ts getSlashCommandsForUI() — feed the slash panel
// from the command registry instead of the removed hardcoded SLASH_COMMANDS.
// The registry returns bare names ('help'); the panel/insertion expect a
// leading '/', and argumentHint maps onto the SlashCommand.shortcut field.
const AVAILABLE_COMMANDS: SlashCommand[] = getSlashCommandsForUI().map(c => ({
  name: `/${c.name}`,
  description: c.description,
  shortcut: c.argumentHint,
}))

export function useSlashCommand() {
  const slashCommandOpen = useWorkspaceState(s => s.slashCommandOpen)
  const slashCommandFilter = useWorkspaceState(s => s.slashCommandFilter)
  const slashCommandIndex = useWorkspaceState(s => s.slashCommandIndex)
  const setState = useSetWorkspaceState()

  const filteredCommands = AVAILABLE_COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(slashCommandFilter.toLowerCase())
  )

  const openSlashPanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      slashCommandOpen: true,
      slashCommandFilter: '',
      slashCommandIndex: 0,
    }))
  }, [setState])

  const closeSlashPanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      slashCommandOpen: false,
      slashCommandFilter: '',
      slashCommandIndex: 0,
    }))
  }, [setState])

  const updateFilter = useCallback((filter: string) => {
    setState(prev => ({
      ...prev,
      slashCommandFilter: filter,
      slashCommandIndex: 0,
    }))
  }, [setState])

  const navigateUp = useCallback(() => {
    setState(prev => ({
      ...prev,
      slashCommandIndex: Math.max(0, prev.slashCommandIndex - 1),
    }))
  }, [setState])

  const navigateDown = useCallback(() => {
    setState(prev => ({
      ...prev,
      slashCommandIndex: Math.min(filteredCommands.length - 1, prev.slashCommandIndex + 1),
    }))
  }, [setState, filteredCommands.length])

  const selectCommand = useCallback((index?: number) => {
    const idx = index ?? slashCommandIndex
    const cmd = filteredCommands[idx]
    if (cmd) {
      // In a real app, this would execute the command
      closeSlashPanel()
    }
  }, [slashCommandIndex, filteredCommands, closeSlashPanel])

  return {
    slashCommandOpen,
    slashCommandFilter,
    slashCommandIndex,
    filteredCommands,
    openSlashPanel,
    closeSlashPanel,
    updateFilter,
    navigateUp,
    navigateDown,
    selectCommand,
  }
}
