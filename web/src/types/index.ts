// Borrowed from src/types/message.ts, src/utils/model/providers.ts,
// src/types/command.ts — cc-borrowed core types for the Web UI (simplified,
// no Node/Bun/Ink deps). Each borrowed block is annotated with its source.

export type RailItem = 'files' | 'search' | 'git' | 'terminal'
export type ChatTab = 'chat' | 'plan'
export type ViewMode = 'verbose' | 'normal' | 'summary'

export type ChatMessage = {
  id: string
  type: 'user' | 'assistant' | 'tool-use'
  content: string
  toolName?: string
  toolStatus?: 'done' | 'progress' | 'error'
  timestamp: number
}

export type EditorTab = {
  id: string
  name: string
  icon: string
  isActive: boolean
}

export type SlashCommand = {
  name: string
  description: string
  shortcut?: string
}

// Borrowed from src/utils/model/providers.ts (simplified for web)
export type ApiType = 'anthropic' | 'openai'

export type Provider = {
  id: string
  name: string
  apiType: ApiType
  baseURL: string
  apiKey: string
  models: string[]
}

// Borrowed from src/types/message.ts (inferred contract)
export type TextContentBlock = {
  type: 'text'
  text: string
}

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string }>
  is_error?: boolean
}

export type ContentBlock = TextContentBlock | ToolUseBlock | ToolResultBlock

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  type?: 'text' | 'tool_result'  // cc dispatch key (system uses type='text')
  content: string | ContentBlock[]
  // For assistant tool_use: toolUses and toolResults are populated from content blocks
  toolUses?: ToolUseBlock[]
  toolResults?: ToolResultBlock[]
  // metadata
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  costUSD?: number
  createdAt: number
}

export type Todo = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  parentId?: string
}

export type ChatSession = {
  id: string
  title: string
  projectPath: string
  model: string
  providerId: string
  permissionMode: 'default' | 'plan' | 'auto-accept' | 'bypass'
  createdAt: number
  updatedAt: number
  messageCount: number
  status: 'active' | 'completed' | 'idle' | 'error' | 'archived'
}

// Borrowed from src/state/AppStateStore.ts — simplified for Web workspace
// (no fs/replBridge/etc). NOTE: `messages` keeps the legacy ChatMessage[]
// type until the Phase 5 Message.tsx rewrite migrates consumers to the
// cc-borrowed Message type above; the new Message type is ready for that
// migration but the field type is intentionally not changed in Phase 1 to
// avoid breaking Phase 5/8 consumer files that are out of scope here.
export type WorkspaceState = {
  sidebarOpen: boolean
  chatPanelOpen: boolean
  activeRailItem: RailItem
  activeChatTab: ChatTab
  activeViewMode: ViewMode
  slashCommandOpen: boolean
  slashCommandFilter: string
  slashCommandIndex: number
  messages: ChatMessage[]
  editorTabs: EditorTab[]
  activeEditorTab: string | null
  settingsActiveNav: string
  sessionsActiveTab: 'active' | 'history' | 'archived'
  newSessionModalOpen: boolean
  // cc-borrowed AppState fields (Phase 1)
  todos: Record<string, Todo[]>
  inProgressToolUseIDs: string[]
  currentProviderId: string | null
  currentModel: string
  currentSessionId: string | null
  // cc-borrowed permission mode (Task 17). Mirrors ChatSession.permissionMode
  // but lives on WorkspaceState so useCanUseTool can read it without a session.
  permissionMode: 'default' | 'plan' | 'auto-accept' | 'bypass'
  // cc-borrowed from AppStateStore: tool permission context object that holds
  // the current permission mode for tool execution.
  toolPermissionContext: { mode: string } | null
  // cc-borrowed from AppStateStore: tracks file edit history for undo/diff.
  fileHistory: Array<{ path: string; content: string; timestamp: number }>
  // Extended for Task 17: toolName/input let the elicitation card render the
  // request; questions stays optional for the AskUserQuestionTool flow.
  elicitation: {
    toolUseId: string
    toolName?: string
    input?: Record<string, unknown>
    questions?: unknown[]
  } | null
  notifications: Array<{
    id: string
    type: 'info' | 'error' | 'success'
    message: string
    createdAt: number
  }>
}

// Borrowed from src/state/AppStateStore.ts getDefaultAppState() factory pattern.
// messages is now [] (hardcoded fake messages removed); new AppState fields
// are initialized to their empty/default values.
export function getDefaultWorkspaceState(): WorkspaceState {
  return {
    sidebarOpen: true,
    chatPanelOpen: true,
    activeRailItem: 'files',
    activeChatTab: 'chat',
    activeViewMode: 'normal',
    slashCommandOpen: false,
    slashCommandFilter: '',
    slashCommandIndex: 0,
    messages: [],
    editorTabs: [],
    activeEditorTab: '1',
    settingsActiveNav: 'general',
    sessionsActiveTab: 'active',
    newSessionModalOpen: false,
    todos: {},
    inProgressToolUseIDs: [],
    currentProviderId: null,
    currentModel: '',
    currentSessionId: null,
    permissionMode: 'default',
    // cc-borrowed from AppStateStore defaults.
    toolPermissionContext: null,
    fileHistory: [],
    elicitation: null,
    notifications: [],
  }
}

// Borrowed from src/utils/model/providers.ts default config patterns.
// Pre-loaded Provider templates (Anthropic official + OpenAI official);
// apiKey left empty for the user to fill in. Used as the initial state for
// ProvidersState when localStorage has no saved providers.
export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'anthropic-default',
    name: 'Anthropic',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    apiKey: '',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
  {
    id: 'openai-default',
    name: 'OpenAI',
    apiType: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
]
