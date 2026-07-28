// Borrowed conceptually from src/utils/fsOperations.ts + src/utils/glob.ts +
// src/utils/ripgrep.ts — the Web port has no fs/ripgrep, so file tools
// (Read/Write/Edit/Glob/Grep) operate against an in-browser virtual file
// system persisted to IndexedDB (capacity is much larger than localStorage
// and structured clones are supported natively). The VfsFile shape mirrors
// cc's file-state record (path + content + timestamps) so the tool rendering
// and message bodies are directly comparable to the CLI's on-disk model.
//
// Glob → RegExp conversion: a minimal converter handling `*`, `?`, and `**`
// (path-segment-spanning). It is intentionally simple — the Web VFS is small
// (user-uploaded or model-created files), not a full repo, so a full
// picomatch-equivalent is unnecessary.
//
// Grep: compile `new RegExp(pattern, flags)` and scan file content line-by-
// line, mirroring ripgrep's default behavior (single-line, case-sensitive
// unless -i). Multiline mode (`.` matches newlines) is supported via the
// opts.multiline flag, matching cc's GrepTool `-U --multiline-dotall`.

const DB_NAME = 'cc-webui-vfs'
const DB_VERSION = 1
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'path' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Borrowed from cc's VfsFile (inferred from FileStateCache entries). The Web
// VFS stores the full file body as a string (text files only — image/binary
// support is out of scope for the Web port) plus createdAt/updatedAt for
// GlobTool's "sorted by modification time" contract.
export type VfsFile = {
  path: string
  content: string
  createdAt: number
  updatedAt: number
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Borrowed from src/utils/glob.ts — minimal glob → RegExp. Handles the
// subset cc's GlobTool documents: `**` matches across path separators, `*`
// matches within a path segment, `?` matches one char. Anything else is
// escaped literally. Brace expansion (`{ts,tsx}`) is supported via a simple
// pre-pass that expands the first `{...}` group.
export function globToRegExp(pattern: string): RegExp {
  // Expand simple brace groups like {ts,tsx} → (ts|tsx).
  const expanded = expandBraces(pattern)
  let re = ''
  let i = 0
  while (i < expanded.length) {
    const c = expanded[i]!
    if (c === '*') {
      if (expanded[i + 1] === '*') {
        // `**` — match anything including path separators.
        re += '.*'
        i += 2
        // Consume an optional trailing slash so `src/**/foo` matches
        // `src/a/b/foo` (the `**/` collapses).
        if (expanded[i] === '/') i += 1
        continue
      }
      // `*` — match anything except path separator.
      re += '[^/]*'
      i += 1
      continue
    }
    if (c === '?') {
      re += '[^/]'
      i += 1
      continue
    }
    if (/[.+^${}()|[\]\\]/.test(c)) {
      re += '\\' + c
      i += 1
      continue
    }
    re += c
    i += 1
  }
  return new RegExp('^' + re + '$')
}

// Borrowed from picomatch — expand the first `{a,b,c}` group into (a|b|c).
// Nested braces are not supported (the Web VFS glob patterns the model emits
// are simple, e.g. `*.ts`, `src/**/*.tsx`).
function expandBraces(pattern: string): string {
  const start = pattern.indexOf('{')
  if (start === -1) return pattern
  const end = pattern.indexOf('}', start)
  if (end === -1) return pattern
  const group = pattern.slice(start + 1, end)
  const options = group.split(',').map(s => s.trim())
  const replacement = '(' + options.join('|') + ')'
  return (
    pattern.slice(0, start) +
    replacement +
    pattern.slice(end + 1)
  )
}

export type VirtualFs = {
  createFile(path: string, content: string): Promise<void>
  readFile(path: string): Promise<VfsFile | undefined>
  writeFile(path: string, content: string): Promise<void>
  editFile(
    path: string,
    oldString: string,
    newString: string,
  ): Promise<{ ok: boolean; error?: string }>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<VfsFile[]>
  glob(pattern: string): Promise<string[]>
  grep(
    pattern: string,
    opts?: {
      caseInsensitive?: boolean
      multiline?: boolean
    },
  ): Promise<Array<{ path: string; line: number; text: string }>>
}

// Borrowed from src/utils/fsOperations.ts — factory so callers can inject a
// test double (the IndexedDB API is not available in unit tests without
// polyfilling). Production callers should use createVirtualFs() once at app
// boot and pass the instance into ToolUseContext.virtualFs.
export async function createVirtualFs(): Promise<VirtualFs> {
  const db = await openDb()

  // Closures instead of `this` so destructured refs keep working (callers
  // like `const { readFile } = vfs` would otherwise lose binding).
  async function getAll(): Promise<VfsFile[]> {
    const store = tx(db, 'readonly')
    return reqToPromise(store.getAll() as IDBRequest<VfsFile[]>)
  }

  async function readFile(path: string): Promise<VfsFile | undefined> {
    const store = tx(db, 'readonly')
    return reqToPromise(store.get(path) as IDBRequest<VfsFile | undefined>)
  }

  async function writeFile(path: string, content: string): Promise<void> {
    // Preserve createdAt if the file already exists (matches cc's
    // FileWriteTool which only overwrites content, not metadata).
    const existing = await readFile(path)
    const now = Date.now()
    const file: VfsFile = {
      path,
      content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    const store = tx(db, 'readwrite')
    await reqToPromise(store.put(file))
  }

  async function editFile(
    path: string,
    oldString: string,
    newString: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const existing = await readFile(path)
    if (!existing) {
      return { ok: false, error: `File does not exist: ${path}` }
    }
    const { content } = existing
    if (!content.includes(oldString)) {
      return {
        ok: false,
        error: `String to replace not found in file.\nString: ${oldString}`,
      }
    }
    const occurrences = content.split(oldString).length - 1
    if (occurrences > 1) {
      return {
        ok: false,
        error: `Found ${occurrences} matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.\nString: ${oldString}`,
      }
    }
    const updated = content.replace(oldString, newString)
    await writeFile(path, updated)
    return { ok: true }
  }

  async function grep(
    pattern: string,
    opts: { caseInsensitive?: boolean; multiline?: boolean } = {},
  ): Promise<Array<{ path: string; line: number; text: string }>> {
    // Validate the pattern by compiling once up front; ripgrep errors on
    // bad regex before scanning, and the Web port surfaces the same error.
    const flags = opts.caseInsensitive === true ? 'i' : ''
    try {
      new RegExp(pattern, flags)
    } catch (e) {
      throw new Error(
        `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
    const files = await getAll()
    const results: Array<{ path: string; line: number; text: string }> = []
    for (const file of files) {
      const lines = file.content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        // Re-create the regex per line to avoid lastIndex state issues with
        // the global flag (cc's ripgrep scans line-by-line by default).
        const lineRe = new RegExp(pattern, flags)
        if (lineRe.test(line)) {
          results.push({ path: file.path, line: i + 1, text: line })
        }
      }
    }
    return results
  }

  return {
    createFile(path, content) {
      return writeFile(path, content)
    },
    readFile,
    writeFile,
    editFile,
    async deleteFile(path) {
      const store = tx(db, 'readwrite')
      await reqToPromise(store.delete(path))
    },
    listFiles: getAll,
    async glob(pattern) {
      const re = globToRegExp(pattern)
      const files = await getAll()
      // Sort by modification time descending (cc's GlobTool returns most-
      // recently-modified first), then by path for determinism.
      return files
        .filter(f => re.test(f.path))
        .sort(
          (a, b) =>
            b.updatedAt - a.updatedAt || a.path.localeCompare(b.path),
        )
        .map(f => f.path)
    },
    grep,
  }
}
