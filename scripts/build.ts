import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { globSync } from 'glob'

const pkg = await Bun.file(new URL('../package.json', import.meta.url)).json() as {
  name: string
  version: string
}

const args = process.argv.slice(2)
const compile = args.includes('--compile')
const dev = args.includes('--dev')
// Parse --windows flag for cross-compilation from Linux/macOS to Windows.
// Also detect when the build is already running on Windows.
const windowsTarget =
  args.includes('--windows') || process.platform === 'win32'

const fullExperimentalFeatures = [
  'AGENT_MEMORY_SNAPSHOT',
  'AGENT_TRIGGERS',
  'AGENT_TRIGGERS_REMOTE',
  'AWAY_SUMMARY',
  'BASH_CLASSIFIER',
  'BRIDGE_MODE',
  'BUILTIN_EXPLORE_PLAN_AGENTS',
  'CACHED_MICROCOMPACT',
  'CCR_AUTO_CONNECT',
  'CCR_MIRROR',
  'CCR_REMOTE_SETUP',
  'COMPACTION_REMINDERS',
  'CONNECTOR_TEXT',
  'EXTRACT_MEMORIES',
  'HISTORY_PICKER',
  'HOOK_PROMPTS',
  'KAIROS_BRIEF',
  'KAIROS_CHANNELS',
  'LODESTONE',
  'MCP_RICH_OUTPUT',
  'MESSAGE_ACTIONS',
  'NATIVE_CLIPBOARD_IMAGE',
  'NEW_INIT',
  'POWERSHELL_AUTO_MODE',
  'PROMPT_CACHE_BREAK_DETECTION',
  'QUICK_SEARCH',
  'SHOT_STATS',
  'TEAMMEM',
  'TOKEN_BUDGET',
  'TREE_SITTER_BASH',
  'TREE_SITTER_BASH_SHADOW',
  'ULTRAPLAN',
  'ULTRATHINK',
  'UNATTENDED_RETRY',
  'VERIFICATION_AGENT',
  'VOICE_MODE',
] as const

function runCommand(cmd: string[]): string | null {
  const proc = Bun.spawnSync({
    cmd,
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (proc.exitCode !== 0) {
    return null
  }

  return new TextDecoder().decode(proc.stdout).trim() || null
}

function getDevVersion(baseVersion: string): string {
  const timestamp = new Date().toISOString()
  const date = timestamp.slice(0, 10).replaceAll('-', '')
  const time = timestamp.slice(11, 19).replaceAll(':', '')
  const sha = runCommand(['git', 'rev-parse', '--short=8', 'HEAD']) ?? 'unknown'
  return `${baseVersion}-dev.${date}.t${time}.sha${sha}`
}

function getVersionChangelog(): string {
  return (
    runCommand(['git', 'log', '--format=%h %s', '-20']) ??
    'Local development build'
  )
}

const defaultFeatures = ['VOICE_MODE']
const featureSet = new Set(defaultFeatures)
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (arg === '--feature-set' && args[i + 1]) {
    if (args[i + 1] === 'dev-full') {
      for (const feature of fullExperimentalFeatures) {
        featureSet.add(feature)
      }
    }
    i += 1
    continue
  }
  if (arg === '--feature-set=dev-full') {
    for (const feature of fullExperimentalFeatures) {
      featureSet.add(feature)
    }
    continue
  }
  if (arg === '--feature' && args[i + 1]) {
    featureSet.add(args[i + 1]!)
    i += 1
    continue
  }
  if (arg.startsWith('--feature=')) {
    featureSet.add(arg.slice('--feature='.length))
  }
}
const features = [...featureSet]

// --compile: generate standalone binary (default for --dev)
// without --compile: generate JS bundle (runs with `bun ./cli.js`)
const bundleDir = dev ? './dist-js' : './dist-js'
const outfile = compile
  ? dev
    ? `./dist/cli-dev${windowsTarget ? '.exe' : ''}`
    : `./dist/cli${windowsTarget ? '.exe' : ''}`
  : `${bundleDir}/cli.js`
const buildTime = new Date().toISOString()
const version = dev ? getDevVersion(pkg.version) : pkg.version

const outDir = compile ? dirname(outfile) : bundleDir
if (outDir !== '.') {
  mkdirSync(outDir, { recursive: true })
}

const externals = [
  'audio-capture-napi',
  'image-processor-napi',
  'modifiers-napi',
  'url-handler-napi',
]

const defines = {
  'process.env.USER_TYPE': JSON.stringify('external'),
  'process.env.CLAUDE_CODE_FORCE_FULL_LOGO': JSON.stringify('true'),
  ...(dev
    ? { 'process.env.NODE_ENV': JSON.stringify('development') }
    : {}),
  ...(dev
    ? {
        'process.env.CLAUDE_CODE_EXPERIMENTAL_BUILD': JSON.stringify('true'),
      }
    : {}),
  'process.env.CLAUDE_CODE_VERIFY_PLAN': JSON.stringify('false'),
  'process.env.CCR_FORCE_BUNDLE': JSON.stringify('true'),
  'MACRO.VERSION': JSON.stringify(version),
  'MACRO.BUILD_TIME': JSON.stringify(buildTime),
  'MACRO.PACKAGE_URL': JSON.stringify(pkg.name),
  'MACRO.NATIVE_PACKAGE_URL': 'undefined',
  'MACRO.FEEDBACK_CHANNEL': JSON.stringify('github'),
  'MACRO.ISSUES_EXPLAINER': JSON.stringify(
    'This reconstructed source snapshot does not include Anthropic internal issue routing.',
  ),
  'MACRO.VERSION_CHANGELOG': JSON.stringify(
    dev ? getVersionChangelog() : 'https://github.com/paoloanzn/claude-code',
  ),
} as const

const cmd = [
  'bun',
  'build',
  './src/entrypoints/cli.tsx',
  ...(compile ? ['--compile'] : []),
  '--target',
  windowsTarget ? 'bun-windows-x64' : 'bun',
  '--format',
  'esm',
  ...(compile
    ? ['--outfile', outfile]
    : ['--outdir', outDir]),
  '--minify',
  '--packages',
  'bundle',
  '--conditions',
  'bun',
]

for (const external of externals) {
  cmd.push('--external', external)
}

for (const feature of features) {
  cmd.push(`--feature=${feature}`)
}

for (const [key, value] of Object.entries(defines)) {
  cmd.push('--define', `${key}=${value}`)
}

// Bun 1.2.14 has two issues with bun:bundle:
// 1. In --compile mode: feature() macro is not inlined → "Cannot find package 'bundle'"
// 2. In JS bundle mode: bun:bundle is stripped to "bundle" → "Cannot find package 'bundle'"
// Workaround for both: temporarily replace bun:bundle imports with a polyfill.
// The --feature flags are removed because they target bun:bundle's feature(),
// not the polyfill. DCE is less aggressive as a result, but stub files handle
// any missing dynamic imports.
{
  const featureArrayStr = JSON.stringify(features)
  const polyfillContent = `// Auto-generated polyfill for bun:bundle (build-time workaround for Bun 1.2.14)
const _features = new Set(${featureArrayStr});
export function feature(name) { return _features.has(name); }
`

  const polyfillPath = join(process.cwd(), 'src', '_bundlePolyfill.ts')
  const sourceFiles = globSync('src/**/*.ts', { cwd: process.cwd() })
    .concat(globSync('src/**/*.tsx', { cwd: process.cwd() }))
    .map(f => join(process.cwd(), f))

  const modifiedFiles: Array<{ path: string; original: string }> = []
  for (const filePath of sourceFiles) {
    try {
      const content = readFileSync(filePath, 'utf8')
      if (content.includes('bun:bundle')) {
        const finalContent = content.replace(
          /from\s+['"]bun:bundle['"]/g,
          "from 'src/_bundlePolyfill.js'"
        )
        if (finalContent !== content) {
          writeFileSync(filePath, finalContent)
          modifiedFiles.push({ path: filePath, original: content })
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  writeFileSync(polyfillPath, polyfillContent)

  // Remove --feature flags since we're using the polyfill instead
  const cmdWithoutFeatures = cmd.filter(c => !c.startsWith('--feature='))

  const proc = Bun.spawnSync({
    cmd: cmdWithoutFeatures,
    cwd: process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  // Restore original source files
  for (const { path, original } of modifiedFiles) {
    writeFileSync(path, original)
  }
  try { require('fs').unlinkSync(polyfillPath) } catch {}

  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1)
  }
}

if (compile && existsSync(outfile)) {
  chmodSync(outfile, 0o755)
}

console.log(`Built ${compile ? outfile : outDir + '/'}`)
