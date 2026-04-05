/**
 * `bagdock logs` — View execution logs for deployed apps and edges.
 *
 * Fetches logs from the Bagdock API which proxies CF Workers analytics/logs.
 */

import chalk from 'chalk'
import { loadBagdockJson } from './config'
import { apiFetch } from './api'
import { isJsonMode, outputSuccess, outputError, outputList, status } from './output'

function resolveSlug(slug?: string): string {
  if (slug) return slug
  const config = loadBagdockJson(process.cwd())
  if (config?.slug) return config.slug
  outputError('MISSING_CONFIG', 'No slug specified and no bagdock.json found. Pass --app <slug> or run from a project directory.')
  return '' // unreachable
}

export async function logsList(opts: { app?: string; limit?: string }) {
  const slug = resolveSlug(opts.app)
  const limit = opts.limit || '50'
  status(`Fetching logs for ${slug}...`)

  const res = await apiFetch(`/api/v1/developer/apps/${slug}/logs?limit=${limit}`)

  if (!res.ok) {
    if (res.status === 404) {
      outputError('NOT_FOUND', `App "${slug}" not found or no logs available`)
    }
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const result = await res.json() as { data: any[] }

  if (isJsonMode()) {
    outputList('log_entry', result.data, false)
  } else {
    if (!result.data?.length) {
      console.log(chalk.yellow(`\n  No logs found for ${slug}.\n`))
      return
    }
    console.log()
    for (const entry of result.data) {
      const ts = chalk.dim(new Date(entry.timestamp).toISOString())
      const level = entry.level === 'error' ? chalk.red(entry.level) : chalk.dim(entry.level)
      console.log(`  ${ts} ${level} ${entry.message}`)
    }
    console.log()
  }
}

export async function logsGet(id: string, opts: { app?: string }) {
  const slug = resolveSlug(opts.app)
  status(`Fetching log entry ${id}...`)

  const res = await apiFetch(`/api/v1/developer/apps/${slug}/logs/${id}`)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const data = await res.json()

  if (isJsonMode()) {
    outputSuccess(data)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

export async function logsTail(opts: { app?: string }) {
  const slug = resolveSlug(opts.app)

  if (isJsonMode()) {
    outputError('UNSUPPORTED', 'Log tailing is not supported in JSON mode. Use `logs list` instead.')
  }

  console.log(chalk.cyan(`\n  Tailing logs for ${slug}... (Ctrl+C to stop)\n`))

  let lastTimestamp = new Date().toISOString()

  const poll = async () => {
    try {
      const res = await apiFetch(`/api/v1/developer/apps/${slug}/logs?since=${encodeURIComponent(lastTimestamp)}&limit=100`)
      if (res.ok) {
        const result = await res.json() as { data: any[] }
        for (const entry of result.data || []) {
          const ts = chalk.dim(new Date(entry.timestamp).toISOString())
          const level = entry.level === 'error' ? chalk.red(entry.level) : chalk.dim(entry.level)
          console.log(`  ${ts} ${level} ${entry.message}`)
          lastTimestamp = entry.timestamp
        }
      }
    } catch {
      // Silently retry
    }
  }

  // Poll every 2 seconds
  const interval = setInterval(poll, 2000)
  await poll()

  process.on('SIGINT', () => {
    clearInterval(interval)
    console.log(chalk.dim('\n  Stopped tailing.\n'))
    process.exit(0)
  })

  // Keep alive
  await new Promise(() => {})
}
