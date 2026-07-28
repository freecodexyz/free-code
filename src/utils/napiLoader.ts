/**
 * Dynamic NAPI module loader with graceful degradation.
 * On platforms where native modules are unavailable (e.g., Windows 7),
 * returns null instead of crashing.
 */

type NapiModule = Record<string, unknown> | null

const napiCache = new Map<string, NapiModule>()

/**
 * Attempt to load a NAPI module by name.
 * Returns the module if loaded successfully, or null if it fails.
 * Results are cached per module name.
 */
export async function tryLoadNapi<T = NapiModule>(name: string): Promise<T | null> {
  if (napiCache.has(name)) {
    return napiCache.get(name) as T | null
  }
  try {
    const mod = await import(name)
    napiCache.set(name, mod)
    return mod as T
  } catch {
    napiCache.set(name, null)
    return null
  }
}

/**
 * Synchronous version using require().
 * Returns the module if loaded successfully, or null if it fails.
 */
export function tryLoadNapiSync<T = NapiModule>(name: string): T | null {
  if (napiCache.has(name)) {
    return napiCache.get(name) as T | null
  }
  try {
    // Use Bun.require or require for sync loading
    const mod = require(name)
    napiCache.set(name, mod)
    return mod as T
  } catch {
    napiCache.set(name, null)
    return null
  }
}

/**
 * Check if a NAPI module is available without fully loading it.
 */
export function isNapiAvailable(name: string): boolean {
  try {
    require.resolve(name)
    return true
  } catch {
    return false
  }
}
