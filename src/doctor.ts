/**
 * `bagdock doctor` — Run environment diagnostics.
 *
 * Checks: CLI version, auth status, project config, AI agent detection.
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir, platform } from 'os'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { getAuthSource } from './auth'
import { loadBagdockJson, CONFIG_DIR } from './config'
import { isJsonMode, outputSuccess } from './output'

interface Check {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

const ICON = { pass: chalk.green('✔'), warn: chalk.yellow('!'), fail: chalk.red('✘') }

function maskKey(key: string): string {
  if (key.length <= 12) return key.slice(0, 4) + '...'
  return key.slice(0, 8) + '...' + key.slice(-4)
}

function getLocalVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function checkVersion(): Promise<Check> {
  const local = getLocalVersion()

  try {
    const res = await fetch('https://registry.npmjs.org/@bagdock/cli/latest', {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as { version: string }
      if (data.version === local) {
        return { name: 'CLI Version', status: 'pass', message: `v${local} (latest)` }
      }
      return { name: 'CLI Version', status: 'warn', message: `v${local} (update available: v${data.version})` }
    }
  } catch {}

  return { name: 'CLI Version', status: 'pass', message: `v${local} (registry unreachable)` }
}

function checkAuth(): Check {
  const { token, source } = getAuthSource()
  if (!token) {
    return { name: 'API Key', status: 'fail', message: 'No API key found. Run `bagdock login` or set BAGDOCK_API_KEY.' }
  }
  return { name: 'API Key', status: 'pass', message: `${maskKey(token)} (source: ${source})` }
}

function checkProjectConfig(): Check {
  const config = loadBagdockJson(process.cwd())
  if (!config) {
    return { name: 'Project Config', status: 'warn', message: 'No bagdock.json found in current directory' }
  }

  const issues: string[] = []
  if (!config.slug) issues.push('missing slug')
  if (!config.type) issues.push('missing type')
  if (!config.main) issues.push('missing main')

  if (issues.length) {
    return { name: 'Project Config', status: 'warn', message: `bagdock.json has issues: ${issues.join(', ')}` }
  }

  return { name: 'Project Config', status: 'pass', message: `${config.slug} (${config.type}/${config.kind ?? config.category})` }
}

function checkAgents(): Check {
  const detected: string[] = []
  const home = homedir()

  if (existsSync(join(home, '.cursor'))) detected.push('Cursor')
  if (existsSync(join(home, '.windsurf'))) detected.push('Windsurf')
  if (existsSync(join(home, 'clawd', 'skills')) || existsSync(join(home, '.codex'))) detected.push('OpenClaw/Codex')

  const p = platform()
  if (p === 'darwin' && existsSync(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'))) {
    detected.push('Claude Desktop')
  } else if (p === 'win32' && existsSync(join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json'))) {
    detected.push('Claude Desktop')
  } else if (p === 'linux' && existsSync(join(home, '.config', 'Claude', 'claude_desktop_config.json'))) {
    detected.push('Claude Desktop')
  }

  if (existsSync(join(process.cwd(), '.vscode', 'mcp.json'))) detected.push('VS Code')

  if (!detected.length) {
    return { name: 'AI Agents', status: 'pass', message: 'None detected' }
  }

  return { name: 'AI Agents', status: 'pass', message: `Detected: ${detected.join(', ')}` }
}

export async function doctor() {
  const checks: Check[] = []

  if (isJsonMode()) {
    checks.push(await checkVersion())
    checks.push(checkAuth())
    checks.push(checkProjectConfig())
    checks.push(checkAgents())

    const ok = checks.every(c => c.status !== 'fail')
    outputSuccess({ ok, checks })
    return
  }

  console.log(chalk.bold('\n  Bagdock Doctor\n'))

  // Version check
  process.stdout.write('  Checking CLI version...')
  const versionCheck = await checkVersion()
  checks.push(versionCheck)
  process.stdout.write(`\r  ${ICON[versionCheck.status]} ${versionCheck.name}: ${versionCheck.message}\n`)

  // Auth check
  const authCheck = checkAuth()
  checks.push(authCheck)
  console.log(`  ${ICON[authCheck.status]} ${authCheck.name}: ${authCheck.message}`)

  // Project config check
  const configCheck = checkProjectConfig()
  checks.push(configCheck)
  console.log(`  ${ICON[configCheck.status]} ${configCheck.name}: ${configCheck.message}`)

  // Agent check
  const agentCheck = checkAgents()
  checks.push(agentCheck)
  console.log(`  ${ICON[agentCheck.status]} ${agentCheck.name}: ${agentCheck.message}`)

  console.log()

  const hasFail = checks.some(c => c.status === 'fail')
  if (hasFail) process.exit(1)
}
