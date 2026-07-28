// Stub: DAEMON feature is not enabled in this build.
// This file exists only to satisfy the bundler's import resolution.
export async function runDaemonWorker(_workerId: string): Promise<void> {
  throw new Error('DAEMON feature is not enabled')
}