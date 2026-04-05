/**
 * API Key Management — create, list, delete operator API keys.
 */

import chalk from 'chalk'
import { apiFetch, apiFetchJson } from './api'
import { isJsonMode, outputSuccess, outputError, outputList, status, success } from './output'

export async function keysCreate(opts: {
  name: string
  type?: string
  category?: string
  environment?: string
  scopes?: string[]
}) {
  status('Creating API key...')

  const res = await apiFetchJson('/api/v1/operator/api-keys', 'POST', {
    name: opts.name,
    key_type: opts.type || 'secret',
    key_category: opts.category || 'standard',
    environment: opts.environment || 'live',
    scopes: opts.scopes || [],
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const data = await res.json() as any

  if (isJsonMode()) {
    outputSuccess(data)
  } else {
    console.log(chalk.green('\n  API key created successfully!\n'))
    console.log(`  ${chalk.bold('Name:')}         ${data.name}`)
    console.log(`  ${chalk.bold('Key:')}          ${chalk.yellow(data.key)}`)
    console.log(`  ${chalk.bold('ID:')}           ${data.id}`)
    console.log(`  ${chalk.bold('Environment:')}  ${data.environment}`)
    console.log(`  ${chalk.bold('Type:')}         ${data.key_type}`)
    console.log(`  ${chalk.bold('Category:')}     ${data.key_category}`)
    if (data.scopes?.length) {
      console.log(`  ${chalk.bold('Scopes:')}       ${data.scopes.join(', ')}`)
    }
    console.log()
    console.log(chalk.yellow('  Save this key — it will not be shown again.'))
    console.log()
  }
}

export async function keysList(opts: { environment?: string }) {
  status('Fetching API keys...')

  let path = '/api/v1/operator/api-keys'
  if (opts.environment) path += `?environment=${opts.environment}`

  const res = await apiFetch(path)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const result = await res.json() as { data: any[]; has_more: boolean }

  if (isJsonMode()) {
    outputList('api_key', result.data, result.has_more)
  } else {
    if (!result.data.length) {
      console.log(chalk.yellow('\n  No API keys found.\n'))
      return
    }
    console.log()
    for (const key of result.data) {
      const usedAt = key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'never'
      console.log(`  ${chalk.bold(key.name)}`)
      console.log(`    ${chalk.dim('Prefix:')} ${key.key_prefix}...  ${chalk.dim('Env:')} ${key.environment}  ${chalk.dim('Last used:')} ${usedAt}`)
      console.log(`    ${chalk.dim('ID:')} ${key.id}  ${chalk.dim('Category:')} ${key.key_category}`)
      console.log()
    }
  }
}

export async function keysDelete(id: string, opts: { yes?: boolean; reason?: string }) {
  if (!opts.yes && !process.stdout.isTTY) {
    outputError('CONFIRMATION_REQUIRED', 'Pass --yes to confirm deletion in non-interactive mode.')
  }

  status(`Revoking API key ${id}...`)

  const res = await apiFetchJson(`/api/v1/operator/api-keys/${id}`, 'DELETE', {
    reason: opts.reason,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  if (isJsonMode()) {
    outputSuccess({ id, status: 'revoked' })
  } else {
    success(`\n  API key ${id} revoked.\n`)
  }
}
