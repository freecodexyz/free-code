// Stub for src/cli/bg.ts — BG_SESSIONS feature is disabled in external builds.
export async function psHandler(_args: string[]): Promise<void> {
  throw new Error('BG_SESSIONS feature is not available in this build')
}
export async function logsHandler(_sessionId?: string): Promise<void> {
  throw new Error('BG_SESSIONS feature is not available in this build')
}
export async function attachHandler(_sessionId?: string): Promise<void> {
  throw new Error('BG_SESSIONS feature is not available in this build')
}
export async function killHandler(_sessionId?: string): Promise<void> {
  throw new Error('BG_SESSIONS feature is not available in this build')
}
export async function handleBgFlag(_args: string[]): Promise<void> {
  throw new Error('BG_SESSIONS feature is not available in this build')
}
