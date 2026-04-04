/**
 * `bagdock env` — Manage app environment variables via the Bagdock API.
 *
 * Variables are stored in Infisical (platform secret manager) and synced
 * to the Worker's Cloudflare secrets on next deploy.
 */

import chalk from 'chalk'
import { loadBagdockJson, API_BASE } from './config'
import { getAuthToken } from './auth'

function requireAuth(): string {
  const token = getAuthToken()
  if (!token) {
    console.error(chalk.red('Not authenticated. Run'), chalk.cyan('bagdock login'), chalk.red('or set BAGDOCK_API_KEY.'))
    process.exit(1)
  }
  return token
}

function requireConfig() {
  const config = loadBagdockJson(process.cwd())
  if (!config) {
    console.error(chalk.red('No bagdock.json found. Run'), chalk.cyan('bagdock init'))
    process.exit(1)
  }
  return config
}

export async function envList() {
  const token = requireAuth()
  const config = requireConfig()

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${config.slug}/env`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.error(chalk.red(`Failed to list env vars (${res.status})`))
      process.exit(1)
    }

    const { data } = await res.json() as { data: Array<{ key: string; updatedAt: string }> }

    if (!data.length) {
      console.log(chalk.yellow('No environment variables set.'))
      console.log('Use', chalk.cyan('bagdock env set <KEY> <VALUE>'), 'to add one.')
      return
    }

    console.log(chalk.bold(`\nEnvironment variables for ${config.slug}:\n`))
    for (const v of data) {
      console.log(`  ${chalk.cyan(v.key)}  ${chalk.dim(`(updated ${v.updatedAt})`)}`)
    }
    console.log()
  } catch (err: any) {
    console.error(chalk.red('Failed to reach API:'), err.message)
    process.exit(1)
  }
}

export async function envSet(key: string, value: string) {
  const token = requireAuth()
  const config = requireConfig()

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${config.slug}/env`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key, value }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(chalk.red(`Failed to set ${key} (${res.status}):`), body.slice(0, 200))
      process.exit(1)
    }

    console.log(chalk.green(`Set ${key}`), chalk.dim('— will take effect on next deploy'))
  } catch (err: any) {
    console.error(chalk.red('Failed:'), err.message)
    process.exit(1)
  }
}

export async function envRemove(key: string) {
  const token = requireAuth()
  const config = requireConfig()

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${config.slug}/env/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.error(chalk.red(`Failed to remove ${key} (${res.status})`))
      process.exit(1)
    }

    console.log(chalk.green(`Removed ${key}`), chalk.dim('— will take effect on next deploy'))
  } catch (err: any) {
    console.error(chalk.red('Failed:'), err.message)
    process.exit(1)
  }
}
