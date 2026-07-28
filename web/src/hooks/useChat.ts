// Borrowed from src/QueryEngine.ts — conversation loop for the Web port.
//
// cc's QueryEngine owns the query lifecycle (append user message → build
// system prompt + tools + messages → stream chat → accumulate tokens →
// dispatch tool_use → append tool_result → auto-compact). The Web port
// mirrors that flow inside a React hook so ChatPanel (Task 18) can drive
// it via `send(text)` / `abort()`.
//
// Key differences from cc (per spec Implementation Notes):
// - chatClient already abstracts the Anthropic/OpenAI SSE stream and emits
//   onToolUse ONCE per complete tool_use block (input_json_delta is
//   accumulated internally), so we skip cc's StreamingToolExecutor and call
//   executeToolUse() directly with the complete ToolUseBlock.
// - Tool execution is fire-and-forget: the tool_result is appended as a new
//   user message for the NEXT request, not the current stream (the spec's
//   Web simplification — we don't re-stream after a tool_use completes).
// - WorkspaceState.messages is typed ChatMessage[] (legacy); we cast through
//   `unknown` when reading and via `as any` when writing. Full migration to
//   Message[] is Phase 5+8 work (intentionally not changed here).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message, ToolResultBlock, ToolUseBlock } from '../types/index.js'
import { useSetWorkspaceState, useWorkspaceState } from '../state/WorkspaceState.js'
import { useProviders } from '../state/ProvidersState.js'
import { streamChat, type ToolSchema } from '../services/chatClient.js'
import {
  createAssistantMessage,
  createUserMessage,
  normalizeMessagesForAPI,
  updateUsage,
} from '../services/messageUtils.js'
import { getSystemPrompt } from '../services/systemPrompt.js'
import { autoCompact } from '../services/compact.js'
import { AUTO_COMPACT_THRESHOLD, estimateConversationTokens } from '../services/tokenEstimate.js'
import { executeToolUse } from '../services/toolExecution.js'
import { recordTranscript, replaceLastMessage, writeTranscript } from '../services/sessionStorage.js'
import { getAllBaseTools } from '../tools.js'
import { findToolByName, type Tool, type ToolUseContext } from '../Tool.js'
import { useCanUseTool } from './useCanUseTool.jsx'

export type UseChatResult = {
  send: (text: string) => Promise<void>
  isLoading: boolean
  error: Error | null
  abort: () => void
}

// Borrowed from cc's CanUseToolFn shape — the permission gate signature
// shared by useCanUseTool and this hook's tool execution helper.
type CanUseToolFn = (
  tool: Tool,
  input: unknown,
  toolUseId: string,
) => Promise<boolean>

// Borrowed from cc's setAppState signature — the setState returned by
// useSetWorkspaceState is a (updater: (prev) => next) => void function.
type SetWorkspaceState = ReturnType<typeof useSetWorkspaceState>

export function useChat(): UseChatResult {
  const setState = useSetWorkspaceState()
  const currentProviderId = useWorkspaceState(s => s.currentProviderId)
  const currentModel = useWorkspaceState(s => s.currentModel)
  const currentSessionId = useWorkspaceState(s => s.currentSessionId)
  const permissionMode = useWorkspaceState(s => s.permissionMode)
  const providers = useProviders(s => s.providers)
  const { canUseTool } = useCanUseTool()

  // Borrowed from cc QueryEngine.mutableMessages — a ref that mirrors the
  // store's messages so async stream callbacks (onToken / onToolUse / onDone)
  // read fresh state without stale closures. Hooks can't be called inside
  // callbacks, so we subscribe at the top level and sync into the ref via an
  // effect. The store's `messages` field is typed ChatMessage[] (legacy) but
  // holds Message-shaped objects; cast through `unknown` to read as Message[].
  const messagesRef = useRef<Message[]>([])
  const messagesFromStore = useWorkspaceState(s => s.messages)
  useEffect(() => {
    messagesRef.current = messagesFromStore as unknown as Message[]
  }, [messagesFromStore])

  const abortControllerRef = useRef<AbortController | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const send = useCallback(
    async (text: string): Promise<void> => {
      if (isLoading) return
      if (!currentProviderId || !currentModel) {
        setError(
          new Error(
            '未配置提供商或模型。请在设置 → 提供商中添加。',
          ),
        )
        return
      }
      const provider = providers.find(p => p.id === currentProviderId)
      if (!provider) {
        setError(
          new Error(
            `未找到提供商 "${currentProviderId}"。请在设置 → 提供商中配置。`,
          ),
        )
        return
      }
      if (!provider.apiKey) {
        setError(
          new Error(
            `提供商 "${provider.name}" 未设置 API Key。请在设置 → 提供商中添加。`,
          ),
        )
        return
      }
      if (!currentSessionId) {
        setError(new Error('无活跃会话。请在会话页面创建。'))
        return
      }

      setError(null)
      setIsLoading(true)

      try {
        // 1. Append user message (borrowed from cc's mutableMessages.push +
        //    recordTranscript before entering the query loop).
        const userMessage = createUserMessage(text)
        setState(prev => ({
          ...prev,
          // Cast: WorkspaceState.messages is ChatMessage[] (legacy); we store
          // Message-shaped objects. Full migration is Phase 5+8 work.
          messages: [...prev.messages, userMessage] as never,
        }))
        recordTranscript(currentSessionId, userMessage)

        // 2. Build context — read fresh from ref (avoids stale closure).
        const priorMessages = messagesRef.current
        const systemPrompt = await getSystemPrompt()
        const tools = getAllBaseTools()
        const toolSchemas: ToolSchema[] = await Promise.all(
          tools.map(async t => ({
            name: t.name,
            description: await t.description(),
            input_schema: t.inputJSONSchema,
          })),
        )

        // 3. Create assistant placeholder + setState + record transcript.
        //    createAssistantMessage('') returns content '(no content)'; reset
        //    to '' so onToken accumulates from an empty string.
        const assistantMessage = createAssistantMessage('')
        assistantMessage.content = ''
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage] as never,
        }))
        recordTranscript(currentSessionId, assistantMessage)

        // 4. Stream chat (borrowed from cc's queryModelWithStreaming).
        const sessionId = currentSessionId
        const controller = streamChat(
          {
            provider,
            model: currentModel,
            messages: normalizeMessagesForAPI([...priorMessages, userMessage]),
            systemPrompt,
            tools: toolSchemas,
          },
          {
            onToken: tokenText => {
              // Accumulate text into the assistant message. If content is a
              // string, append; if it's a ContentBlock[] (because a tool_use
              // was already appended), append to the last text block or push
              // a new one (mirrors cc's text_delta accumulation).
              if (typeof assistantMessage.content === 'string') {
                assistantMessage.content = assistantMessage.content + tokenText
              } else {
                const blocks = assistantMessage.content
                const last = blocks[blocks.length - 1]
                if (last && last.type === 'text') {
                  last.text = last.text + tokenText
                } else {
                  blocks.push({ type: 'text', text: tokenText })
                }
              }
              setState(prev => ({
                ...prev,
                messages: prev.messages.map(m =>
                  m.id === assistantMessage.id ? { ...assistantMessage } : m,
                ) as never,
              }))
              replaceLastMessage(sessionId, assistantMessage)
            },
            onToolUse: toolCall => {
              // chatClient emits onToolUse ONCE per complete tool_use block
              // (it accumulates input_json_delta internally for Anthropic and
              // buffers tool_call arguments for OpenAI). Build the ToolUseBlock,
              // append it to the assistant message's content, then execute.
              const toolUseBlock: ToolUseBlock = {
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
              }

              // Append the tool_use block to the assistant message's content
              // array. Convert string content to ContentBlock[] if needed —
              // the API requires tool_use blocks in the assistant content
              // array (not as a parallel field) for the next request's
              // tool_use ↔ tool_result pairing to work.
              if (typeof assistantMessage.content === 'string') {
                const text = assistantMessage.content
                assistantMessage.content = text
                  ? [{ type: 'text', text }, toolUseBlock]
                  : [toolUseBlock]
              } else {
                assistantMessage.content = [...assistantMessage.content, toolUseBlock]
              }
              assistantMessage.toolUses = [
                ...(assistantMessage.toolUses ?? []),
                toolUseBlock,
              ]

              setState(prev => ({
                ...prev,
                messages: prev.messages.map(m =>
                  m.id === assistantMessage.id ? { ...assistantMessage } : m,
                ) as never,
              }))
              replaceLastMessage(sessionId, assistantMessage)

              // Execute the tool (async, fire-and-forget). The model continues
              // streaming in the same response; the tool_result is appended as
              // a new user message for the NEXT request (per spec's Web
              // simplification — we don't re-stream after a tool_use completes).
              const context: ToolUseContext = {
                options: {
                  abortController: abortControllerRef.current ?? undefined,
                  permissionMode,
                },
                messages: messagesRef.current,
                setMessages: updater =>
                  setState(prev => ({
                    ...prev,
                    messages: updater(
                      prev.messages as unknown as Message[],
                    ) as never,
                  })),
                setTodos: updater =>
                  setState(prev => ({ ...prev, todos: updater(prev.todos) })),
                setInProgressToolUseIDs: updater =>
                  setState(prev => ({
                    ...prev,
                    inProgressToolUseIDs: updater(prev.inProgressToolUseIDs),
                  })),
                toolUseId: toolCall.id,
              }

              void runToolUse(
                toolUseBlock,
                tools,
                context,
                canUseTool,
                sessionId,
                setState,
              )
            },
            onUsage: usage => {
              // Borrowed from cc's message_delta usage accumulation.
              assistantMessage.usage = updateUsage(assistantMessage.usage, usage)
            },
            onDone: async () => {
              setIsLoading(false)
              // Auto-compact if the conversation exceeds the token threshold
              // (borrowed from cc's autoCompact hook).
              const finalMessages = messagesRef.current
              const tokenCount = estimateConversationTokens(finalMessages)
              if (tokenCount >= AUTO_COMPACT_THRESHOLD) {
                try {
                  const result = await autoCompact({
                    provider,
                    model: currentModel,
                    messages: finalMessages,
                  })
                  if (result.triggered) {
                    setState(prev => ({
                      ...prev,
                      messages: result.compactedMessages as never,
                    }))
                    // Overwrite session storage with the compacted transcript.
                    writeTranscript(sessionId, result.compactedMessages)
                  }
                } catch (e) {
                  // Compaction failure is non-fatal — keep the un-compacted
                  // transcript and surface the error to the user.
                  setError(e instanceof Error ? e : new Error(String(e)))
                }
              }
            },
            onError: err => {
              setError(err)
              setIsLoading(false)
            },
          },
        )
        abortControllerRef.current = controller
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        setIsLoading(false)
      }
    },
    [
      isLoading,
      currentProviderId,
      currentModel,
      currentSessionId,
      permissionMode,
      providers,
      canUseTool,
      setState,
    ],
  )

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsLoading(false)
  }, [])

  return { send, isLoading, error, abort }
}

/**
 * Run a single tool_use: permission check → execute → append tool_result as
 * a new user message → persist. Borrowed from cc's performToolUse() and the
 * tool_result append in QueryEngine.submitMessage().
 *
 * The tool_result is appended as a new user message (role: 'user',
 * type: 'tool_result') because the Anthropic API expects tool_result blocks
 * to live in the next user turn, paired with the assistant's tool_use.
 */
async function runToolUse(
  toolUse: ToolUseBlock,
  tools: Tool[],
  context: ToolUseContext,
  canUseTool: CanUseToolFn,
  sessionId: string,
  setState: SetWorkspaceState,
): Promise<void> {
  const tool = findToolByName(tools, toolUse.name)

  // Mark the tool as in-progress for UI busy indicators (borrowed from cc's
  // setInProgressToolUseIDs).
  setState(prev => ({
    ...prev,
    inProgressToolUseIDs: [...prev.inProgressToolUseIDs, toolUse.id],
  }))

  let result: ToolResultBlock
  try {
    if (!tool) {
      // Tool not found — let executeToolUse synthesize the error result.
      result = await executeToolUse(toolUse, tools, context)
    } else {
      // Permission check — borrowed from cc's canUseTool gate. If denied,
      // synthesize an is_error tool_result instead of calling the tool.
      const permitted = await canUseTool(tool, toolUse.input, toolUse.id)
      if (!permitted) {
        result = {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Permission denied by user.',
          is_error: true,
        }
      } else {
        result = await executeToolUse(toolUse, tools, context)
      }
    }
  } catch (e) {
    result = {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      is_error: true,
    }
  } finally {
    // Clear the in-progress indicator regardless of outcome.
    setState(prev => ({
      ...prev,
      inProgressToolUseIDs: prev.inProgressToolUseIDs.filter(
        id => id !== toolUse.id,
      ),
    }))
  }

  // Append the tool_result as a new user message (borrowed from cc's
  // tool_result pairing — the next API request needs tool_use → tool_result).
  const toolResultMessage: Message = {
    id: crypto.randomUUID(),
    role: 'user',
    type: 'tool_result',
    content: [result],
    createdAt: Date.now(),
  }

  setState(prev => ({
    ...prev,
    messages: [...prev.messages, toolResultMessage] as never,
  }))
  recordTranscript(sessionId, toolResultMessage)
}
