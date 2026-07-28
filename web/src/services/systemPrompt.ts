// Borrowed from src/utils/systemPrompt.ts (buildEffectiveSystemPrompt priority
// chain) + src/constants/prompts.ts (getSystemPrompt segmented assembly) +
// src/constants/systemPromptSections.ts (systemPromptSection /
// resolveSystemPromptSections). The Web port collapses the three cc modules
// into one because:
//   - cc's buildEffectiveSystemPrompt threads AgentDefinition / coordinator
//     mode / proactive mode / ToolUseContext through the priority chain; the
//     Web port has none of those, so the chain reduces to a plain
//     override > custom > default > append join over SystemPromptSource[].
//   - cc's getSystemPrompt assembles ~15 sections (intro, system, doing tasks,
//     actions, using your tools, tone, env info, MCP, memory, language,
//     output style, scratchpad, FRC, ...) gated on feature flags and ant
//     builds. The Web port keeps only the sections that matter in a browser:
//     a Web context block (virtual FS + CORS + BashTool-disabled notes) and
//     per-tool descriptions generated from the tools registry.
//   - cc's systemPromptSection is a memoized {name, compute, cacheBreak}
//     record backed by bootstrap/state.ts caches; the Web port has no
//     equivalent cross-turn cache, so systemPromptSection becomes a thin
//     {type,text,priority} → SystemPromptSource mapper and
//     resolveSystemPromptSections just runs buildEffectiveSystemPrompt over
//     the mapped sections.

import { getAllBaseTools } from '../tools.js'

// Borrowed from cc buildEffectiveSystemPrompt — a single source entry in the
// priority chain. `type` selects the tier; `priority` only matters for
// 'default' sources (higher wins, stable sort preserves registration order
// for ties).
export type SystemPromptSource = {
  type: 'override' | 'custom' | 'default' | 'append'
  text: string
  priority?: number // higher = wins for 'default'
}

// Borrowed from cc buildEffectiveSystemPrompt — priority chain:
//   override (REPLACES everything) > custom > default (by priority) > append.
// override short-circuits and returns its text verbatim. Otherwise the
// remaining tiers are each joined with '\n\n' internally and the non-empty
// tiers are concatenated with a '---' separator so callers can tell where one
// tier ends and the next begins.
export function buildEffectiveSystemPrompt(
  sources: SystemPromptSource[],
): string {
  const override = sources.find(s => s.type === 'override')
  if (override) return override.text

  const customs = sources.filter(s => s.type === 'custom')
  const defaults = sources
    .filter(s => s.type === 'default')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const appends = sources.filter(s => s.type === 'append')

  const defaultText = defaults.map(s => s.text).join('\n\n')
  const customText = customs.map(s => s.text).join('\n\n')
  const appendText = appends.map(s => s.text).join('\n\n')

  const parts: string[] = []
  if (defaultText) parts.push(defaultText)
  if (customText) parts.push(customText)
  if (appendText) parts.push(appendText)
  return parts.join('\n\n---\n\n')
}

// Borrowed from cc constants/prompts.ts — Web-specific environment description.
// cc's env section reports cwd / git / platform / shell / OS version pulled
// from node:os; in the browser none of that exists, so this block instead
// documents the Web constraints the model needs to know: the file system is
// IndexedDB-backed (not the real OS), BashTool is disabled, and outbound
// network is subject to CORS.
const WEB_CONTEXT = `You are Claude Code running in a Web UI environment.

## Web Environment
- The user is interacting via a browser-based chat UI.
- File system operations are performed on a virtual file system (IndexedDB-backed), not the real OS.
- BashTool is disabled in the Web environment — shell commands cannot be executed.
- Network requests from the browser are subject to CORS restrictions.

## Tool Usage
- Tools are available via the function-calling API.
- Always prefer the most specific tool for the task (e.g., use FileEdit for edits, not FileWrite).
- For TodoWrite: maintain an up-to-date todo list for multi-step tasks.
- For AskUserQuestion: use this when you need user input on a decision.
- Use WebFetch to fetch URLs and extract their content.

## Tone
- Be concise and direct. Lead with the answer or action.
- Avoid filler words and unnecessary transitions.
- Use markdown for formatting: \`code\` for inline, fenced code blocks for multi-line.
- Reference file paths using clickable links when possible.`

// Borrowed from cc constants/prompts.ts — per-tool descriptions. cc builds the
// "Using your tools" guidance from enabledToolNames + static bullets; the Web
// port instead walks the tools registry and emits each tool's description()
// (and optional prompt()) under a "### <name>" header so the model sees the
// full per-tool contract. description()/prompt() are async (they may read
// files or check env in cc), so Promise.all is used.
async function getToolDescriptions(): Promise<string> {
  const tools = getAllBaseTools()
  const descriptions = await Promise.all(
    tools.map(async tool => {
      const desc = await tool.description()
      const prompt = tool.prompt ? await tool.prompt() : ''
      return `### ${tool.name}\n${desc}${prompt ? '\n\n' + prompt : ''}`
    }),
  )
  return `## Available Tools\n\n${descriptions.join('\n\n')}`
}

// Borrowed from cc getSystemPrompt — assemble all sections. cc returns a
// string[] (one entry per section, for cache-prefix splitting); the Web port
// has no prompt-cache boundary logic, so it returns a single joined string.
// Sections: Web context + tool descriptions (default tier, priority 10) and
// an optional custom user prompt (custom tier).
export async function getSystemPrompt(
  customUserPrompt?: string,
): Promise<string> {
  const toolDescs = await getToolDescriptions()
  const defaultText = [WEB_CONTEXT, toolDescs].join('\n\n---\n\n')
  return buildEffectiveSystemPrompt([
    { type: 'default', text: defaultText, priority: 10 },
    // `as const` on 'custom' prevents the ternary from widening `type` to
    // string (which would make the element unassignable to SystemPromptSource).
    ...(customUserPrompt
      ? [{ type: 'custom' as const, text: customUserPrompt }]
      : []),
  ])
}

// Borrowed from cc constants/systemPromptSections.ts — a section is a
// declarative {type, text, priority?} record that resolves to a
// SystemPromptSource. cc's section is a {name, compute, cacheBreak} record
// backed by a memoization cache; the Web port drops memoization (no
// cross-turn cache) and keeps only the type discriminator + payload.
export type SystemPromptSection =
  | { type: 'override'; text: string }
  | { type: 'custom'; text: string }
  | { type: 'default'; text: string; priority?: number }
  | { type: 'append'; text: string }

// Borrowed from cc systemPromptSection — map a declarative section to a
// SystemPromptSource. The default branch forwards priority so
// buildEffectiveSystemPrompt can sort default-tier sources.
export function systemPromptSection(
  section: SystemPromptSection,
): SystemPromptSource {
  switch (section.type) {
    case 'override':
      return { type: 'override', text: section.text }
    case 'custom':
      return { type: 'custom', text: section.text }
    case 'default':
      return { type: 'default', text: section.text, priority: section.priority }
    case 'append':
      return { type: 'append', text: section.text }
  }
}

// Borrowed from cc resolveSystemPromptSections — resolve a list of sections
// into the final system prompt string. cc returns (string | null)[] (null
// sections are filtered upstream); the Web port's sections never return
// null, so this maps + builds in one pass.
export function resolveSystemPromptSections(
  sections: SystemPromptSection[],
): string {
  return buildEffectiveSystemPrompt(sections.map(systemPromptSection))
}
