export function isWindows(): boolean {
  return process.platform === 'win32'
}

export function crossPlatformKill(pid: number, signal?: string | number): void {
  try {
    if (isWindows()) {
      // Windows doesn't support Unix signals; use taskkill to terminate the process tree
      Bun.spawnSync({
        cmd: ['taskkill', '/PID', String(pid), '/T', '/F'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
    } else {
      process.kill(pid, signal ?? 'SIGTERM')
    }
  } catch {
    // Process may already be dead — ignore
  }
}
