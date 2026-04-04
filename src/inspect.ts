/**
 * `bagdock inspect [slug]` — Show deployment details and status for an app.
 */

import chalk from 'chalk'
import { API_BASE } from './config'
import { getAuthToken } from './auth'
import { isJsonMode, outputSuccess, outputError, status } from './output'
import { requireSlug } from './link'

export async function inspect(slugArg?: string) {
  const token = getAuthToken()
  if (!token) {
    outputError('auth_error', 'Not authenticated. Run bagdock login or set BAGDOCK_API_KEY.')
    process.exit(1)
  }

  const slug = requireSlug(slugArg)
  status(`Inspecting ${slug}...`)

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) outputError('not_found', `App "${slug}" not found.`)
    if (!res.ok) outputError('api_error', `API returned ${res.status}`)

    const { data } = await res.json() as { data: Record<string, any> }

    if (isJsonMode()) {
      outputSuccess(data)
      return
    }

    console.log(chalk.bold(`\n  ${data.name} ${chalk.dim(`(${data.slug})`)}\n`))

    const fields: [string, string | undefined][] = [
      ['ID', data.id],
      ['Type', data.type],
      ['Category', data.category],
      ['Version', data.version],
      ['Maintainer', data.maintainer],
      ['Visibility', data.visibility],
      ['Review Status', data.review_status],
      ['Active', data.is_active ? 'yes' : 'no'],
      ['Worker URL', data.worker_url],
      ['Namespace', data.worker_namespace],
      ['Created', data.created_at ? new Date(data.created_at).toLocaleString() : undefined],
      ['Updated', data.updated_at ? new Date(data.updated_at).toLocaleString() : undefined],
      ['Published', data.published_at ? new Date(data.published_at).toLocaleString() : undefined],
    ]

    for (const [label, value] of fields) {
      if (value !== undefined && value !== null) {
        console.log(`  ${chalk.dim(label.padEnd(16))} ${value}`)
      }
    }
    console.log()
  } catch (err: any) {
    outputError('network_error', err.message)
  }
}
