/**
 * `bagdock env` — Manage app environment variables via the Bagdock API.
 *
 * Secrets are encrypted and bound to the Worker at deploy time via the
 * CF Workers Secrets API. Values are write-only — they cannot be read back.
 *
 * --target flag uses "target" (not --env) to avoid collision with the `env`
 * command group name and the global --env flag which means live/test environment.
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

function parseTarget(target?: string): Array<'staging' | 'production'> | undefined {
  if (!target) return undefined
  const t = target.toLowerCase()
  if (t === 'staging') return ['staging']
  if (t === 'production') return ['production']
  if (t === 'both') return ['staging', 'production']
  console.error(chalk.red(`Invalid --target: ${target}. Use staging, production, or both.`))
  process.exit(1)
}

export async function envList(opts?: { reconcile?: boolean }) {
  const config = requireConfig()

  try {
    if (opts?.reconcile) {
      logStatus('Reconciling with Cloudflare...')
      const reconcileRes = await apiFetchJson(
        `/api/v1/developer/apps/${config.slug}/env/reconcile`,
        'POST',
        {},
      )
      if (!reconcileRes.ok) {
        console.error(chalk.yellow(`Reconcile failed (${reconcileRes.status}) — showing cached data`))
      }
    }

    const res = await apiFetch(`/api/v1/developer/apps/${config.slug}/env`)

    if (!res.ok) {
      console.error(chalk.red(`Failed to list env vars (${res.status})`))
      process.exit(1)
    }

    const body = await res.json() as {
      data: Array<{ key: string; environments: string[]; updatedAt: string }>
      last_reconciled_at: string | null
    }

    if (isJsonMode()) {
      outputSuccess(body)
      return
    }

    if (!body.data.length) {
      console.log(chalk.yellow('No environment variables set.'))
      console.log('Use', chalk.cyan('bagdock env set <KEY> <VALUE>'), 'to add one.')
      return
    }

    console.log(chalk.bold(`\nEnvironment variables for ${config.slug}:\n`))
    for (const v of body.data) {
      const envLabel = v.environments?.length
        ? chalk.dim(`[${v.environments.join(', ')}]`)
        : chalk.dim('[no target]')
      console.log(`  ${chalk.cyan(v.key)}  ${envLabel}  ${chalk.dim(`updated ${v.updatedAt}`)}`)
    }
    if (body.last_reconciled_at) {
      console.log(chalk.dim(`\nLast synced with Cloudflare: ${body.last_reconciled_at}`))
    }
    console.log()
  } catch (err: any) {
    console.error(chalk.red('Failed to reach API:'), err.message)
    process.exit(1)
  }
}

export async function envSet(key: string, value: string, opts?: { target?: string }) {
  const config = requireConfig()
  const environments = parseTarget(opts?.target)

  try {
    const payload: Record<string, any> = { key, value }
    if (environments) payload.environments = environments

    const res = await apiFetchJson(`/api/v1/developer/apps/${config.slug}/env`, 'PUT', payload)

    if (!res.ok) {
      const body = await res.text()
      console.error(chalk.red(`Failed to set ${key} (${res.status}):`), body.slice(0, 200))
      process.exit(1)
    }

    const result = await res.json() as { status: string; environments?: Record<string, string> }

    if (isJsonMode()) {
      outputSuccess(result)
      return
    }

    if (result.status === 'partial') {
      console.log(chalk.yellow(`Partially set ${key}:`))
      for (const [env, status] of Object.entries(result.environments ?? {})) {
        const icon = status === 'ok' ? chalk.green('✓') : chalk.red('✗')
        console.log(`  ${icon} ${env}: ${status}`)
      }
    } else {
      const targetLabel = environments ? ` (${environments.join(', ')})` : ''
      console.log(chalk.green(`Set ${key}${targetLabel}`))
    }
  } catch (err: any) {
    console.error(chalk.red('Failed:'), err.message)
    process.exit(1)
  }
}

export async function envRemove(key: string, opts?: { target?: string }) {
  const config = requireConfig()

  try {
    const res = await apiFetch(`/api/v1/developer/apps/${config.slug}/env/${key}`, { method: 'DELETE' })

    if (!res.ok) {
      console.error(chalk.red(`Failed to remove ${key} (${res.status})`))
      process.exit(1)
    }

    if (isJsonMode()) {
      const result = await res.json()
      outputSuccess(result)
      return
    }

    console.log(chalk.green(`Removed ${key}`))
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
