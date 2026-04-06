/**
 * OAuth2 Device Authorization Grant (RFC 8628) + profile management.
 *
 * `bagdock login` requests a device code from the API, opens the browser
 * to the operator dashboard's device authorization page, and polls the
 * token endpoint until the user approves.
 *
 * For headless environments (CI/CD, AI agents) use BAGDOCK_API_KEY env var.
 */

import {
  saveCredentials, clearCredentials, loadCredentials,
  listProfiles, switchProfile, getActiveProfileName,
  updateProfileContext,
  getApiBase,
} from './config'
import chalk from 'chalk'
import { isJsonMode, outputSuccess, outputError } from './output'

let apiKeyOverride: string | undefined

export function setApiKeyOverride(key: string) {
  apiKeyOverride = key
}

/**
 * Resolve the auth token from (in priority order):
 *   1. --api-key flag (set via setApiKeyOverride)
 *   2. BAGDOCK_API_KEY env var
 *   3. BAGDOCK_TOKEN env var (M2M JWT)
 *   4. ~/.bagdock/credentials.json (active or --profile profile)
 */
export function getAuthToken(): string | null {
  if (apiKeyOverride) return apiKeyOverride
  if (process.env.BAGDOCK_API_KEY) return process.env.BAGDOCK_API_KEY
  if (process.env.BAGDOCK_TOKEN) return process.env.BAGDOCK_TOKEN
  const creds = loadCredentials()
  return creds?.accessToken ?? null
}

/**
 * Returns the source of the resolved auth token for diagnostics.
 */
export function getAuthSource(): { token: string | null; source: string } {
  if (apiKeyOverride) return { token: apiKeyOverride, source: 'flag' }
  if (process.env.BAGDOCK_API_KEY) return { token: process.env.BAGDOCK_API_KEY, source: 'env (BAGDOCK_API_KEY)' }
  if (process.env.BAGDOCK_TOKEN) return { token: process.env.BAGDOCK_TOKEN, source: 'env (BAGDOCK_TOKEN)' }
  const creds = loadCredentials()
  if (creds?.accessToken) return { token: creds.accessToken, source: `config (${getActiveProfileName()})` }
  return { token: null, source: 'none' }
}

const CLIENT_ID = 'bagdock-cli'
const POLL_INTERVAL_MS = 5_000
const MAX_POLL_DURATION_MS = 300_000

export async function login() {
  const existing = loadCredentials()
  if (existing?.accessToken && existing.expiresAt && existing.expiresAt > Date.now()) {
    console.log(chalk.green('Already logged in as'), chalk.bold(existing.email ?? 'unknown'))
    console.log('Run', chalk.cyan('bagdock logout'), 'to sign out first.')
    return
  }

  console.log(chalk.cyan('\nRequesting device authorization...\n'))

  const deviceRes = await fetch(`${getApiBase()}/oauth2/device/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'developer:read developer:write' }),
  })

  if (!deviceRes.ok) {
    const err = await deviceRes.text()
    console.log(chalk.red('Failed to start login:'), err)
    process.exit(1)
  }

  const device = await deviceRes.json() as {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete: string
    expires_in: number
    interval: number
  }

  const pollInterval = (device.interval ?? 5) * 1000

  console.log(`  Visit ${chalk.bold(device.verification_uri)} and enter code:\n`)
  console.log(`    ${chalk.bold.cyan(device.user_code)}\n`)

  const open = (await import('open')).default
  await open(device.verification_uri_complete).catch(() => {})

  console.log(chalk.dim('  Waiting for authorization...'))

  const startedAt = Date.now()

  while (Date.now() - startedAt < MAX_POLL_DURATION_MS) {
    await sleep(pollInterval)

    const tokenRes = await fetch(`${getApiBase()}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID,
        device_code: device.device_code,
      }),
    })

    if (tokenRes.ok) {
      const tokens = await tokenRes.json() as {
        access_token: string
        refresh_token?: string
        expires_in?: number
        email?: string
        operator_id?: string
        operator_slug?: string
      }

      saveCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
        email: tokens.email,
        operatorId: tokens.operator_id,
        operatorSlug: tokens.operator_slug,
        environment: 'live',
      })

      console.log(chalk.green('\n  Logged in successfully!'))
      if (tokens.email) console.log('  Email:', chalk.bold(tokens.email))
      if (tokens.operator_slug) {
        console.log('  Operator:', chalk.bold(tokens.operator_slug))
      } else if (tokens.operator_id) {
        console.log('  Operator ID:', chalk.bold(tokens.operator_id))
      }
      console.log('  Environment:', chalk.bold('live'))
      console.log('  Profile:', chalk.bold(getActiveProfileName()))

      // Post-login: attempt to resolve operator context
      if (!tokens.operator_slug) {
        await resolveOperatorAfterLogin(tokens.access_token)
      } else {
        console.log()
        console.log(chalk.dim('  Tip: run'), chalk.cyan('bagdock switch'), chalk.dim('to change operator or environment.'))
      }

      return
    }

    const error = await tokenRes.json().catch(() => ({ error: 'unknown' })) as {
      error: string
      error_description?: string
    }

    if (error.error === 'authorization_pending') continue
    if (error.error === 'slow_down') { await sleep(pollInterval); continue }

    if (error.error === 'expired_token') {
      console.log(chalk.red('\n  Device code expired. Please try again.'))
      process.exit(1)
    }

    if (error.error === 'access_denied') {
      console.log(chalk.red('\n  Authorization denied.'))
      process.exit(1)
    }

    console.log(chalk.red('\n  Login failed:'), error.error_description ?? error.error)
    process.exit(1)
  }

  console.log(chalk.red('\n  Login timed out. Please try again.'))
  process.exit(1)
}

export async function logout() {
  clearCredentials()
  console.log(chalk.green(`Logged out of profile "${getActiveProfileName()}".`))
}

export async function whoami() {
  const token = getAuthToken()

  if (!token) {
    console.log(chalk.yellow('Not logged in.'), 'Run', chalk.cyan('bagdock login'))
    process.exit(1)
  }

  try {
    const res = await fetch(`${getApiBase()}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.log(chalk.red('Session expired or invalid.'), 'Run', chalk.cyan('bagdock login'))
      process.exit(1)
    }

    const user = await res.json() as { email: string; operator_id?: string; name?: string }

    const creds = loadCredentials()
    if (isJsonMode()) {
      outputSuccess({
        ...user,
        profile: getActiveProfileName(),
        operator_slug: creds?.operatorSlug,
        environment: creds?.environment ?? 'live',
      })
    } else {
      console.log(chalk.green('Logged in as'), chalk.bold(user.email))
      if (creds?.operatorSlug) {
        console.log('Operator:', chalk.bold(creds.operatorSlug))
      } else if (user.operator_id) {
        console.log('Operator ID:', chalk.bold(user.operator_id))
      }
      console.log('Environment:', chalk.bold(creds?.environment ?? 'live'))
      if (user.name) console.log('Name:', user.name)
      console.log('Profile:', chalk.bold(getActiveProfileName()))
    }
  } catch (err: any) {
    console.log(chalk.red('Failed to reach API:'), err.message)
    process.exit(1)
  }
}

export async function authList() {
  const profiles = listProfiles()

  if (isJsonMode()) {
    outputSuccess({ profiles })
    return
  }

  if (!profiles.length) {
    console.log(chalk.yellow('\n  No profiles found.'), 'Run', chalk.cyan('bagdock login'), 'to create one.\n')
    return
  }

  console.log()
  for (const p of profiles) {
    const marker = p.active ? chalk.green('* ') : '  '
    const label = p.active ? chalk.bold(p.name) : p.name
    const email = p.email ? chalk.dim(` (${p.email})`) : ''
    const operator = p.operatorSlug ? chalk.dim(` ${p.operatorSlug}`) : p.operatorId ? chalk.dim(` ${p.operatorId}`) : ''
    const env = p.environment ? chalk.dim(` [${p.environment}]`) : ''
    console.log(`  ${marker}${label}${email}${operator}${env}`)
  }
  console.log()
}

export async function authSwitch(name?: string) {
  const profiles = listProfiles()

  if (!profiles.length) {
    console.log(chalk.yellow('No profiles found.'), 'Run', chalk.cyan('bagdock login'), 'first.')
    process.exit(1)
  }

  if (name) {
    if (switchProfile(name)) {
      if (isJsonMode()) {
        outputSuccess({ active_profile: name })
      } else {
        console.log(chalk.green(`Switched to profile "${name}".`))
      }
    } else {
      outputError('NOT_FOUND', `Profile "${name}" not found. Available: ${profiles.map(p => p.name).join(', ')}`)
    }
    return
  }

  // Non-interactive: require name
  if (!process.stdout.isTTY) {
    outputError('MISSING_PROFILE', 'Pass a profile name in non-interactive mode: bagdock auth switch <name>')
  }

  // Interactive: list and prompt
  console.log(chalk.cyan('\nAvailable profiles:\n'))
  profiles.forEach((p, i) => {
    const marker = p.active ? chalk.green('* ') : '  '
    const email = p.email ? chalk.dim(` (${p.email})`) : ''
    console.log(`  ${marker}${i + 1}. ${p.name}${email}`)
  })

  const readline = await import('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>(resolve => {
    rl.question(chalk.cyan('\n  Enter profile number or name: '), resolve)
  })
  rl.close()

  const idx = parseInt(answer, 10)
  const target = (idx > 0 && idx <= profiles.length)
    ? profiles[idx - 1].name
    : answer.trim()

  if (switchProfile(target)) {
    console.log(chalk.green(`\n  Switched to profile "${target}".\n`))
  } else {
    console.log(chalk.red(`\n  Profile "${target}" not found.\n`))
    process.exit(1)
  }
}

/**
 * After login, try to resolve operator context. If the token has no
 * operator_slug, fetch the user's operators and auto-set if only one.
 */
async function resolveOperatorAfterLogin(accessToken: string) {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/me/operators`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return

    const body = await res.json() as { data: Array<{ id: string; slug: string; name: string }> }
    const operators = body.data ?? []

    if (operators.length === 1) {
      const op = operators[0]
      updateProfileContext(op.id, op.slug, 'live')
      console.log('  Operator:', chalk.bold(`${op.name} (${op.slug})`))
      console.log()
      console.log(chalk.dim('  Tip: run'), chalk.cyan('bagdock switch'), chalk.dim('to change environment to test/sandbox.'))
    } else if (operators.length > 1) {
      console.log()
      console.log(chalk.dim(`  You have access to ${operators.length} operators.`))
      console.log(chalk.dim('  Run'), chalk.cyan('bagdock switch'), chalk.dim('to select one.'))
    }
  } catch {
    // Non-fatal — operator resolution is best-effort
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
