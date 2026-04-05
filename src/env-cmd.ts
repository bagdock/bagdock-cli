/**
 * `bagdock env` — Manage app environment variables via the Bagdock API.
 *
 * Variables are stored in Infisical (platform secret manager) and synced
 * to the Worker's Cloudflare secrets on next deploy.
 */

import chalk from 'chalk'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { loadBagdockJson } from './config'
import { apiFetch, apiFetchJson } from './api'
import { isJsonMode, outputSuccess, outputError, status as logStatus } from './output'
import { requireSlug } from './link'

function requireConfig() {
  const config = loadBagdockJson(process.cwd())
  if (!config) {
    console.error(chalk.red('No bagdock.json found. Run'), chalk.cyan('bagdock init'))
    process.exit(1)
  }
  return config
}

export async function envList() {
  const config = requireConfig()

  try {
    const res = await apiFetch(`/api/v1/developer/apps/${config.slug}/env`)

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
  const config = requireConfig()

  try {
    const res = await apiFetchJson(`/api/v1/developer/apps/${config.slug}/env`, 'PUT', { key, value })

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
  const config = requireConfig()

  try {
    const res = await apiFetch(`/api/v1/developer/apps/${config.slug}/env/${key}`, { method: 'DELETE' })

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

export async function envPull(file?: string) {
  const slug = requireSlug()
  const target = resolve(file ?? '.env.local')

  logStatus(`Pulling env vars for ${slug}...`)

  try {
    const res = await apiFetch(`/api/v1/developer/apps/${slug}/env`)

    if (!res.ok) {
      outputError('api_error', `Failed to pull env vars (${res.status})`)
      process.exit(1)
    }

    const { data } = await res.json() as { data: Array<{ key: string; updatedAt: string }> }

    if (isJsonMode()) {
      outputSuccess({ file: target, keys: data.map((v) => v.key) })
      return
    }

    if (!data?.length) {
      console.log(chalk.yellow('No environment variables set.'))
      return
    }

    const lines = [
      `# Pulled from Bagdock — ${slug}`,
      `# ${new Date().toISOString()}`,
      `# Values are placeholders — the API does not expose secrets.`,
      `# Fill in real values for local development.`,
      '',
      ...data.map((v) => `${v.key}=`),
      '',
    ]

    writeFileSync(target, lines.join('\n'))
    console.log(chalk.green(`Wrote ${data.length} keys to ${target}`))
    console.log(chalk.yellow('Note:'), 'Values are empty — fill them in for local dev.')
  } catch (err: any) {
    console.error(chalk.red('Failed:'), err.message)
    process.exit(1)
  }
}
