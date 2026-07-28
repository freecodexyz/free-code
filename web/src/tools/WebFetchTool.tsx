// Borrowed from src/tools/WebFetchTool/WebFetchTool.ts + prompt.ts —
// the Web port mirrors cc's url/prompt contract. cc fetches the URL,
// converts HTML to markdown, then runs a secondary model over the content
// with the prompt. The Web port runs in a browser: it fetches the URL via
// the Fetch API and returns the stripped text content (the secondary-model
// summarization is a Phase 8 concern — for now we return the fetched text
// so the model can read it directly). CORS may block some fetches; that
// surfaces as an error tool_result, matching cc's behavior when a fetch
// fails.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const WEB_FETCH_TOOL_NAME = 'WebFetch'

export const DESCRIPTION = `
- Fetches content from a specified URL and processes it using an AI model
- Takes a URL and a prompt as input
- Fetches the URL content, converts HTML to markdown
- Processes the content with the prompt using a small, fast model
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - The prompt should describe what information you want to extract from the page
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large
`

export type WebFetchInput = {
  url: string
  prompt: string
}

export type WebFetchOutput = {
  url: string
  content: string
  truncated: boolean
}

// Borrowed from cc's WebFetchTool — cap the returned content so a huge page
// doesn't blow out the context window. cc uses a token budget; the Web port
// uses a character cap (rough proxy) and marks truncation.
const MAX_CONTENT_CHARS = 20_000

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Minimal HTML → text: strip tags, collapse whitespace. Not a full
// markdown converter (cc uses a dedicated library); sufficient for the
// Web port to surface readable content to the model.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export const WebFetchTool = buildTool({
  name: WEB_FETCH_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      prompt: {
        type: 'string',
        description: 'The prompt describing what information to extract from the page',
      },
    },
    required: ['url', 'prompt'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => true,
  isConcurrencySafe: true,
  validateInput(input: WebFetchInput) {
    if (!isValidHttpUrl(input.url)) {
      return { result: false, message: `Invalid URL: ${input.url}` }
    }
    if (!input.prompt || input.prompt.trim() === '') {
      return { result: false, message: 'A prompt is required.' }
    }
    return { result: true }
  },
  async call(input: WebFetchInput, _context: ToolUseContext): Promise<WebFetchOutput> {
    // cc upgrades http→https; the Web port does the same.
    const url = input.url.replace(/^http:\/\//i, 'https://')
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'follow',
        headers: { Accept: 'text/html,application/xhtml+xml,text/plain,*/*' },
      })
    } catch (e) {
      throw new Error(
        `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    const raw = await response.text()
    const text = contentType.includes('text/html') ? htmlToText(raw) : raw
    const truncated = text.length > MAX_CONTENT_CHARS
    const content = truncated ? text.slice(0, MAX_CONTENT_CHARS) : text
    return { url, content, truncated }
  },
  renderToolUseMessage(input: WebFetchInput): ReactNode {
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
          Fetching {input.url}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{input.prompt}</span>
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: WebFetchOutput,
    toolUseId: string,
  ): ToolResultBlock {
    const truncationNote = output.truncated
      ? '\n\n[Content was truncated due to size.]'
      : ''
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Fetched content from ${output.url}:\n\n${output.content}${truncationNote}`,
    }
  },
} satisfies ToolDef<WebFetchInput, WebFetchOutput>)
