// Borrowed from src/tools/TodoWriteTool/TodoWriteTool.ts + prompt.ts —
// the Web port mirrors cc's todo management contract (input schema +
// prompt) but stores todos in the Web WorkspaceState instead of cc's
// AppStateStore, and renders a styled card via inline styles + CSS
// variables (the Web port has no .ds-* component classes). The Web
// Todo type (types/index.ts) lacks cc's `activeForm` field, so we accept
// it in the input schema (to mirror cc's contract for the model) but
// only persist the Web Todo fields when storing via setTodos.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext, type ValidationResult } from '../Tool.js'
import type { ToolResultBlock, Todo } from '../types/index.js'

export const TODO_WRITE_TOOL_NAME = 'TodoWrite'

export const DESCRIPTION =
  'Update the todo list for the current session. To be used proactively and often to track progress and pending tasks. Make sure that at least one task is in_progress at all times. Always provide both content (imperative) and activeForm (present continuous) for each task.'

// Borrowed verbatim from src/tools/TodoWriteTool/prompt.ts PROMPT — the
// model-facing guidance on when to use the todo list. Kept intact so the
// Web port's behavior matches cc's.
export const PROMPT = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Exactly ONE task must be in_progress at any time (not less, not more)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.
`

// Borrowed from cc's TodoListSchema (zod) — transcribed to JSONSchema so the
// Web port (no zod dependency) can send the same shape to the API.
const todoItemSchema: JSONSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'string',
      description: 'The imperative form of the task (e.g., "Run tests")',
    },
    activeForm: {
      type: 'string',
      description:
        'The present continuous form of the task shown during execution (e.g., "Running tests")',
    },
    status: {
      type: 'string',
      enum: ['pending', 'in_progress', 'completed'],
      description: 'The current state of the task',
    },
    priority: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'The priority of the task',
    },
  },
  required: ['content', 'status'],
  additionalProperties: false,
}

export type TodoWriteInput = {
  todos: Array<{
    content: string
    activeForm?: string
    status: 'pending' | 'in_progress' | 'completed'
    priority?: 'high' | 'medium' | 'low'
  }>
}

export type TodoWriteOutput = {
  oldTodos: Todo[]
  newTodos: Todo[]
}

// Borrowed from cc's renderToolUseMessage — cc returns null (the todo list is
// rendered elsewhere in the UI from appState.todos). The Web port mirrors this
// by returning a compact card so the transcript shows what was written, since
// the Web UI surfaces todos in a side panel that is not always visible inline.
export const TodoWriteTool = buildTool({
  name: TODO_WRITE_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: todoItemSchema,
        description: 'The updated todo list',
      },
    },
    required: ['todos'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => false,
  isConcurrencySafe: false,
  validateInput(input: TodoWriteInput): ValidationResult {
    const { todos } = input
    if (!Array.isArray(todos)) {
      return { result: false, message: 'todos must be an array' }
    }
    // cc enforces "exactly one in_progress" at the prompt level; the Web port
    // also enforces it structurally so the model gets immediate feedback.
    const inProgress = todos.filter(t => t.status === 'in_progress')
    if (inProgress.length > 1) {
      return {
        result: false,
        message: `Exactly one task must be in_progress at a time, but ${inProgress.length} were in_progress.`,
      }
    }
    return { result: true }
  },
  async call(input: TodoWriteInput, context: ToolUseContext): Promise<TodoWriteOutput> {
    const { todos } = input
    // Normalize to the Web Todo shape: stable ids, default priority. cc assigns
    // ids inside the store; the Web port does the same here so re-renders are
    // stable across calls (a Todo without an id would reset React keys).
    const oldTodos: Todo[] = []
    const newTodos: Todo[] = todos.map(t => ({
      id: crypto.randomUUID(),
      content: t.content,
      status: t.status,
      priority: t.priority ?? 'medium',
    }))
    context.setTodos?.(prev => ({ ...prev, [context.toolUseId]: newTodos }))
    return { oldTodos, newTodos }
  },
  renderToolUseMessage(input: TodoWriteInput): ReactNode {
    const { todos } = input
    if (!todos || todos.length === 0) return null
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacer-4)',
          padding: 'var(--spacer-12)',
          borderRadius: 'var(--radius-8)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--body-sm-font-family)',
          fontSize: 'var(--body-sm-font-size)',
          color: 'var(--color-foreground)',
          marginTop: 'var(--spacer-8)',
        }}
      >
        <span style={{ fontWeight: 'var(--font-weight-strong)' }}>
          Todos ({todos.length})
        </span>
        {todos.map((t, i) => {
          const statusColor =
            t.status === 'completed'
              ? 'var(--status-success-default)'
              : t.status === 'in_progress'
                ? 'var(--status-primary-default)'
                : 'var(--text-tertiary)'
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacer-8)',
              }}
            >
              <span style={{ color: statusColor }}>●</span>
              <span
                style={{
                  textDecoration:
                    t.status === 'completed' ? 'line-through' : 'none',
                  color:
                    t.status === 'completed'
                      ? 'var(--text-tertiary)'
                      : 'var(--color-foreground)',
                }}
              >
                {t.content}
              </span>
            </div>
          )
        })}
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    _output: TodoWriteOutput,
    toolUseId: string,
  ): ToolResultBlock {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content:
        'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable',
    }
  },
} satisfies ToolDef<TodoWriteInput, TodoWriteOutput>)
