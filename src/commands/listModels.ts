import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '../utils/auth.js'
import { getApiBaseUrl } from '../utils/model/providers.js'

/**
 * Fetches and displays the list of available models from the configured API endpoint.
 * Calls GET /v1/models on the current base URL (custom or default Anthropic).
 */
export async function listModelsAndExit(): Promise<void> {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.error(
      'Error: ANTHROPIC_API_KEY is not set. Set it to list available models.',
    )
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }

  const baseURL = getApiBaseUrl()
  const client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  try {
    // Collect all models across pages (matches pattern in modelCapabilities.ts)
    const models: Anthropic.ModelInfo[] = []
    for await (const entry of client.models.list()) {
      models.push(entry)
    }

    // Sort models by ID
    models.sort((a, b) => a.id.localeCompare(b.id))

    if (models.length === 0) {
      // biome-ignore lint/suspicious/noConsole: intentional console output
      console.log('No models available.')
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(0)
    }

    // Calculate column widths
    const idWidth =
      Math.max(...models.map(m => m.id.length), 'Model ID'.length) + 2
    const createdWidth = 'Created'.length + 2
    const separator = '-'.repeat(idWidth + createdWidth + 4)

    // Print table header
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log('Available Models:')
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log(separator)
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log(`${'Model ID'.padEnd(idWidth)}  ${'Created'.padEnd(createdWidth)}`)
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log(separator)

    // Print each model
    for (const model of models) {
      // created_at is an RFC 3339 datetime string
      const created = model.created_at
        ? new Date(model.created_at).toISOString().split('T')[0]
        : 'N/A'
      // biome-ignore lint/suspicious/noConsole: intentional console output
      console.log(`${model.id.padEnd(idWidth)}  ${created.padEnd(createdWidth)}`)
    }

    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log(separator)
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.log(`Total: ${models.length} model(s)`)

    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.error(`Error fetching models: ${message}`)
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1)
  }
}
