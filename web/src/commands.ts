// Borrowed from src/commands.ts — registry with lazy loading.
// cc memoizes command loading (skills/plugins/builtins). The Web project has
// only builtin commands, so we cache the static list on first access. Mirrors
// cc's getCommands()/findCommand()/builtInCommandNames surface.

import type { Command } from './types/command.js'
import { helpCommand } from './commands/help.js'
import { clearCommand } from './commands/clear.js'
import { compactCommand } from './commands/compact.js'
import { modelCommand } from './commands/model.js'
import { costCommand } from './commands/cost.js'
import { statusCommand } from './commands/status.js'
import { initCommand } from './commands/init.js'
import { reviewCommand } from './commands/review.js'

let cached: Command[] | null = null

export function getCommands(): Command[] {
  if (cached) return cached
  cached = [
    helpCommand,
    clearCommand,
    compactCommand,
    modelCommand,
    costCommand,
    statusCommand,
    initCommand,
    reviewCommand,
  ]
  return cached
}

export function findCommandByName(name: string): Command | undefined {
  return getCommands().find(c => c.name === name)
}

export function getSlashCommandsForUI(): Array<{
  name: string
  description: string
  argumentHint?: string
}> {
  return getCommands()
    .filter(c => c.isVisible?.() !== false)
    .map(c => ({
      name: c.name,
      description: c.description,
      argumentHint: c.argumentHint,
    }))
}
