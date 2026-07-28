// Borrowed from src/components/Markdown.tsx
//
// Adapted from the Claude Code (cc) Ink-based Markdown renderer to the Web
// (DOM) context. Preserves cc's key performance and safety patterns:
//   - Module-level token LRU cache keyed by hashContent (500-entry limit)
//   - marked.lexer() parsing — cache the token array, not rendered HTML
//   - React components per token type (no dangerouslySetInnerHTML for prose)
//   - Async syntax highlighting via React.lazy + dynamic import('highlight.js'),
//     wrapped in <Suspense> so raw code shows while hljs loads
import { marked, type MarkedToken, type Token, type Tokens } from 'marked'
import {
  Fragment,
  Suspense,
  lazy,
  useMemo,
  type CSSProperties,
  type Key,
  type ReactNode,
} from 'react'

type MarkdownProps = {
  children: string
  className?: string
}

// ---------------------------------------------------------------------------
// hashContent — simple deterministic string hash (borrowed from cc utils/hash).
// Used as the cache key so full content strings aren't retained as Map keys.
// ---------------------------------------------------------------------------
function hashContent(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0
  }
  return String(h)
}

// ---------------------------------------------------------------------------
// Module-level token cache — marked.lexer is the hot cost on remounts.
// useMemo doesn't survive unmount→remount, so scrolling back to a previously
// rendered message would re-parse. Messages are immutable; same content → same
// tokens. Keyed by hash to avoid retaining full content strings.
// ---------------------------------------------------------------------------
const TOKEN_CACHE_MAX = 500
const tokenCache = new Map<string, ReturnType<typeof marked.lexer>>()

// Characters that indicate markdown syntax. If none are present, skip the
// marked.lexer call entirely and render as a single paragraph. One regex pass
// instead of many includes() scans. (Borrowed from cc.)
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /
function hasMarkdownSyntax(s: string): boolean {
  // Sample first 500 chars — if markdown exists it's usually early.
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s)
}

function cachedLexer(content: string): Token[] {
  // Fast path: plain text with no markdown syntax → single paragraph token.
  if (!hasMarkdownSyntax(content)) {
    return [
      {
        type: 'paragraph',
        raw: content,
        text: content,
        tokens: [{ type: 'text', raw: content, text: content }],
      } as Token,
    ]
  }
  const key = hashContent(content)
  const hit = tokenCache.get(key)
  if (hit) {
    // LRU: promote to most-recently-used (borrowed from cc). Without this the
    // eviction below is pure FIFO and would evict the very item being viewed.
    tokenCache.delete(key)
    tokenCache.set(key, hit)
    return hit
  }
  const tokens = marked.lexer(content)
  tokenCache.set(key, tokens)
  if (tokenCache.size > TOKEN_CACHE_MAX) {
    // FIFO eviction of oldest entry — Map preserves insertion order.
    for (const k of tokenCache.keys()) {
      tokenCache.delete(k)
      break
    }
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Async syntax highlighting — MarkdownCode.
//
// React.lazy + dynamic import('highlight.js') defers loading the (large) hljs
// bundle until the first code block renders. The Suspense fallback shows the
// raw code in a <pre><code> so content is visible immediately. Once hljs
// loads, the highlighted HTML is injected via dangerouslySetInnerHTML — safe
// because hljs escapes the source. Falls back to plain <pre><code> on error.
// ---------------------------------------------------------------------------
const LazyHighlightedCode = lazy(async () => {
  const hljsModule = await import('highlight.js')
  const hljs = hljsModule.default
  return {
    default: function HighlightedCode({
      code,
      lang,
    }: {
      code: string
      lang: string | undefined
    }) {
      // marked code fences may carry extra info after the language
      // (e.g. "ts:5" for line numbers); take the first token as the lang.
      const langName = lang ? lang.split(/[\s:]/)[0] : undefined
      const highlighted = useMemo<string | null>(() => {
        try {
          if (langName && hljs.getLanguage(langName)) {
            return hljs.highlight(code, { language: langName }).value
          }
          return hljs.highlightAuto(code).value
        } catch {
          return null
        }
      }, [code, langName])

      if (highlighted === null) {
        return (
          <pre>
            <code>{code}</code>
          </pre>
        )
      }
      return (
        <pre>
          <code
            className={langName ? `language-${langName}` : undefined}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )
    },
  }
})

function MarkdownCode({ code, lang }: { code: string; lang?: string }) {
  return (
    <Suspense
      fallback={
        <pre>
          <code>{code}</code>
        </pre>
      }
    >
      <LazyHighlightedCode code={code} lang={lang} />
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const INLINE_CODE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(127, 127, 127, 0.15)',
  padding: '0.15em 0.35em',
  borderRadius: '3px',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: '0.9em',
}

const TABLE_STYLE: CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  margin: '0.5em 0',
}

const CELL_BORDER = '1px solid rgba(127, 127, 127, 0.35)'

// ---------------------------------------------------------------------------
// MarkdownTable — co-located table renderer (borrowed from cc MarkdownTable).
// Renders inside an overflow-x:auto wrapper so wide tables scroll horizontally.
// ---------------------------------------------------------------------------
function MarkdownTable({ token }: { token: Tokens.Table }): ReactNode {
  const alignStyle = (
    align: 'center' | 'left' | 'right' | null | undefined,
  ): CSSProperties => {
    if (align === 'center') return { textAlign: 'center' }
    if (align === 'left') return { textAlign: 'left' }
    if (align === 'right') return { textAlign: 'right' }
    return {}
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            {token.header.map((cell, i) => (
              <th
                key={i}
                style={{ ...alignStyle(token.align[i]), border: CELL_BORDER, padding: '0.4em 0.6em' }}
              >
                {renderTokens(cell.tokens, `th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{ ...alignStyle(token.align[c]), border: CELL_BORDER, padding: '0.4em 0.6em' }}
                >
                  {renderTokens(cell.tokens, `td-${r}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Token → React rendering.
//
// renderToken handles every marked token type (both block and inline) by
// dispatching on token.type and emitting the corresponding DOM element.
// React escapes text content by default, so plain text tokens are XSS-safe;
// dangerouslySetInnerHTML is used ONLY for hljs output above.
// ---------------------------------------------------------------------------
function renderToken(token: MarkedToken, key: Key): ReactNode {
  switch (token.type) {
    case 'heading': {
      const depth = Math.min(Math.max(token.depth, 1), 6)
      const Tag = `h${depth}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return <Tag key={key}>{renderTokens(token.tokens, key)}</Tag>
    }
    case 'paragraph':
      return <p key={key}>{renderTokens(token.tokens, key)}</p>
    case 'code':
      return <MarkdownCode key={key} code={token.text} lang={token.lang} />
    case 'blockquote':
      return (
        <blockquote key={key} style={{ borderLeft: '3px solid rgba(127,127,127,0.4)', margin: '0.5em 0', padding: '0 1em', color: 'inherit' }}>
          {renderTokens(token.tokens, key)}
        </blockquote>
      )
    case 'table':
      return <MarkdownTable key={key} token={token} />
    case 'hr':
      return <hr key={key} style={{ border: 'none', borderTop: '1px solid rgba(127,127,127,0.3)', margin: '1em 0' }} />
    case 'list': {
      const ListTag: 'ol' | 'ul' = token.ordered ? 'ol' : 'ul'
      const start = token.ordered && typeof token.start === 'number' ? token.start : undefined
      return (
        <ListTag key={key} start={start} style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>
          {token.items.map((item, i) => (
            <li
              key={`${key}-li-${i}`}
              style={item.task ? { listStyle: 'none', marginLeft: '-1em' } : undefined}
            >
              {renderTokens(item.tokens, `${key}-li-${i}`)}
            </li>
          ))}
        </ListTag>
      )
    }
    case 'space':
      return null
    case 'html':
      // Raw HTML — render as escaped text (React escapes), never inject.
      return token.block ? (
        <div key={key}>{token.text}</div>
      ) : (
        <span key={key}>{token.text}</span>
      )
    // Inline tokens ----------------------------------------------------------
    case 'text':
      return token.tokens ? (
        <Fragment key={key}>{renderTokens(token.tokens, key)}</Fragment>
      ) : (
        <Fragment key={key}>{token.text}</Fragment>
      )
    case 'strong':
      return <strong key={key}>{renderTokens(token.tokens, key)}</strong>
    case 'em':
      return <em key={key}>{renderTokens(token.tokens, key)}</em>
    case 'del':
      return <del key={key}>{renderTokens(token.tokens, key)}</del>
    case 'codespan':
      return (
        <code key={key} style={INLINE_CODE_STYLE}>
          {token.text}
        </code>
      )
    case 'link':
      return (
        <a
          key={key}
          href={token.href}
          title={token.title ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {renderTokens(token.tokens, key)}
        </a>
      )
    case 'image':
      return (
        <img
          key={key}
          src={token.href}
          alt={token.text}
          title={token.title ?? undefined}
          loading="lazy"
        />
      )
    case 'br':
      return <br key={key} />
    case 'escape':
      // token.text is the unescaped literal character; React re-escapes it.
      return <Fragment key={key}>{token.text}</Fragment>
    case 'checkbox':
      return <input key={key} type="checkbox" checked={token.checked} disabled />
    case 'list_item':
      // Defensive: a list_item rendered outside a <list> (e.g. extensions).
      return <Fragment key={key}>{renderTokens(token.tokens, key)}</Fragment>
    case 'def':
      // Link reference definition — not rendered as content.
      return null
    default:
      return null
  }
}

function renderTokens(tokens: Token[] | undefined, keyPrefix: Key): ReactNode {
  if (!tokens || tokens.length === 0) return null
  return tokens.map((token, i) => renderToken(token as MarkedToken, `${keyPrefix}-${i}`))
}

// ---------------------------------------------------------------------------
// MarkdownBody — does the parsing (cachedLexer) + token rendering and wraps in
// a styled container (padding, font). Borrowed from cc MarkdownBody.
// ---------------------------------------------------------------------------
const BODY_STYLE: CSSProperties = {
  padding: '1rem',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: '14px',
  lineHeight: 1.6,
  color: 'inherit',
  wordBreak: 'break-word',
}

export function MarkdownBody({ children, className }: MarkdownProps): ReactNode {
  const tokens = useMemo(() => cachedLexer(children), [children])
  return (
    <div className={className} style={BODY_STYLE}>
      {renderTokens(tokens, 'md')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Markdown — main entry (default export). Parses + renders markdown safely.
// ---------------------------------------------------------------------------
export function Markdown(props: MarkdownProps): ReactNode {
  return <MarkdownBody {...props} />
}

// MarkdownWithHighlight — alias that always uses syntax highlighting.
// (MarkdownCode always lazy-loads highlight.js, so Markdown already highlights.)
export { Markdown as MarkdownWithHighlight }

export default Markdown
