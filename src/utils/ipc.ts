import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Returns the IPC path for a given name.
 * On Windows, returns a named pipe path (\\.\pipe\<name>).
 * On Unix, returns a Unix domain socket path in tmpdir.
 */
export function getIpcPath(name: string): string {
  if (process.platform === 'win32') {
    // Windows named pipes use the \\.\pipe\ prefix
    // Sanitize name: remove path separators and special chars
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_')
    return `\\\\.\\pipe\\${sanitized}`
  }
  // Unix domain socket
  return join(tmpdir(), `${name}.sock`)
}

/**
 * Check if the current platform supports Unix domain sockets.
 * Windows uses named pipes instead.
 */
export function isUnixDomainSocket(): boolean {
  return process.platform !== 'win32'
}
