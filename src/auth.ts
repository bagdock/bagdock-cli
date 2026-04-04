/**
 * OAuth2 Device Authorization Grant (RFC 8628).
 *
 * `bagdock login` requests a device code from the API, opens the browser
 * to the operator dashboard's device authorization page, and polls the
 * token endpoint until the user approves.
 *
 * For headless environments (CI/CD, AI agents) use BAGDOCK_TOKEN env var
 * which is validated as an M2M JWT by the API.
 */

import { saveCredentials, clearCredentials, loadCredentials, API_BASE, DASHBOARD_BASE } from './config'
import chalk from 'chalk'

let apiKeyOverride: string | undefined

export function setApiKeyOverride(key: string) {
  apiKeyOverride = key
}

/**
 * Resolve the auth token from (in priority order):
 *   1. --api-key flag (set via setApiKeyOverride)
 *   2. BAGDOCK_API_KEY env var
 *   3. BAGDOCK_TOKEN env var (M2M JWT)
 *   4. ~/.bagdock/credentials.json
 */
export function getAuthToken(): string | null {
  if (apiKeyOverride) return apiKeyOverride
  if (process.env.BAGDOCK_API_KEY) return process.env.BAGDOCK_API_KEY
  if (process.env.BAGDOCK_TOKEN) return process.env.BAGDOCK_TOKEN
  const creds = loadCredentials()
  return creds?.accessToken ?? null
}

const CLIENT_ID = 'bagdock-cli'
const POLL_INTERVAL_MS = 5_000
const MAX_POLL_DURATION_MS = 300_000 // 5 minutes

export async function login() {
  const existing = loadCredentials()
  if (existing?.accessToken && existing.expiresAt && existing.expiresAt > Date.now()) {
    console.log(chalk.green('Already logged in as'), chalk.bold(existing.email ?? 'unknown'))
    console.log('Run', chalk.cyan('bagdock logout'), 'to sign out first.')
    return
  }

  console.log(chalk.cyan('\nRequesting device authorization...\n'))

  const deviceRes = await fetch(`${API_BASE}/oauth2/device/authorize`, {
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
  await open(device.verification_uri_complete).catch(() => {
    // Browser open failed (headless env) -- user will visit manually
  })

  console.log(chalk.dim('  Waiting for authorization...'))

  const startedAt = Date.now()

  while (Date.now() - startedAt < MAX_POLL_DURATION_MS) {
    await sleep(pollInterval)

    const tokenRes = await fetch(`${API_BASE}/oauth2/token`, {
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
      }

      saveCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
        email: tokens.email,
        operatorId: tokens.operator_id,
      })

      console.log(chalk.green('\n  Logged in successfully!'))
      if (tokens.email) console.log('  Email:', chalk.bold(tokens.email))
      if (tokens.operator_id) console.log('  Operator:', chalk.bold(tokens.operator_id))
      return
    }

    const error = await tokenRes.json().catch(() => ({ error: 'unknown' })) as {
      error: string
      error_description?: string
    }

    if (error.error === 'authorization_pending') {
      continue
    }

    if (error.error === 'slow_down') {
      await sleep(pollInterval)
      continue
    }

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
  console.log(chalk.green('Logged out.'))
}

export async function whoami() {
  const token = getAuthToken()

  if (!token) {
    console.log(chalk.yellow('Not logged in.'), 'Run', chalk.cyan('bagdock login'))
    process.exit(1)
  }

  try {
    const res = await fetch(`${API_BASE}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.log(chalk.red('Session expired or invalid.'), 'Run', chalk.cyan('bagdock login'))
      process.exit(1)
    }

    const user = await res.json() as { email: string; operator_id?: string; name?: string }
    console.log(chalk.green('Logged in as'), chalk.bold(user.email))
    if (user.operator_id) console.log('Operator:', chalk.bold(user.operator_id))
    if (user.name) console.log('Name:', user.name)
  } catch (err: any) {
    console.log(chalk.red('Failed to reach API:'), err.message)
    process.exit(1)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
