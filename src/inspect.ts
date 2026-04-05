/**
 * `bagdock inspect [slug]` — Show deployment details and status for an app.
 */

import chalk from 'chalk'
import { apiFetch } from './api'
import { isJsonMode, outputSuccess, outputError, status } from './output'
import { requireSlug } from './link'

export async function inspect(slugArg?: string) {
  const slug = requireSlug(slugArg)
  status(`Inspecting ${slug}...`)

  try {
    const res = await apiFetch(`/api/v1/developer/apps/${slug}`)

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
