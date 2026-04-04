/**
 * `bagdock submission` — Marketplace submission lifecycle commands.
 *
 * Provides visibility into what happens after `bagdock submit`:
 *   list     — List submission history for the current app
 *   status   — Fetch detailed review state for a specific submission
 *   withdraw — Cancel a pending submission before approval
 */

import chalk from 'chalk'
import { API_BASE } from './config'
import { getAuthToken } from './auth'
import { isJsonMode, outputSuccess, outputError, outputList, status } from './output'
import { requireSlug } from './link'

function requireAuth(): string {
  const token = getAuthToken()
  if (!token) {
    outputError('auth_error', 'Not authenticated. Run bagdock login or set BAGDOCK_API_KEY.')
    process.exit(1)
  }
  return token
}

export async function submissionList(opts: { app?: string }) {
  const token = requireAuth()
  const slug = requireSlug(opts.app)

  status(`Fetching submissions for ${slug}...`)

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${slug}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      outputError('not_found', `App "${slug}" not found or no submissions exist.`)
    }
    if (!res.ok) {
      outputError('api_error', `API returned ${res.status}`)
    }

    const { data } = await res.json() as { data: any[] }

    if (isJsonMode()) {
      outputList('submission', data, false)
      return
    }

    if (!data?.length) {
      console.log(chalk.yellow('No submissions found for this app.'))
      console.log('Submit with', chalk.cyan('bagdock submit'))
      return
    }

    console.log(chalk.bold(`\nSubmissions for ${slug}:\n`))
    console.log(
      `  ${'ID'.padEnd(22)} ${'Version'.padEnd(10)} ${'Reason'.padEnd(30)} ${'Date'}`
    )
    console.log(chalk.dim('  ' + '─'.repeat(80)))

    for (const s of data) {
      console.log(
        `  ${chalk.cyan(s.id.padEnd(22))} ${(s.version ?? '').padEnd(10)} ${(s.change_reason ?? '').slice(0, 30).padEnd(30)} ${chalk.dim(new Date(s.created_at).toLocaleDateString())}`
      )
    }
    console.log()
  } catch (err: any) {
    outputError('network_error', err.message)
  }
}

export async function submissionStatus(id: string, opts: { app?: string }) {
  const token = requireAuth()
  const slug = requireSlug(opts.app)

  status(`Fetching submission ${id}...`)

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${slug}/submissions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      outputError('not_found', `Submission "${id}" not found.`)
    }
    if (!res.ok) {
      outputError('api_error', `API returned ${res.status}`)
    }

    const { data } = await res.json() as { data: any }

    if (isJsonMode()) {
      outputSuccess(data)
      return
    }

    console.log(chalk.bold(`\n  Submission ${chalk.cyan(data.id)}\n`))
    const fields: [string, string][] = [
      ['App', `${data.name} (${data.slug})`],
      ['Version', data.version],
      ['Review Status', data.review_status],
      ['Type', data.type],
      ['Visibility', data.visibility],
      ['Reason', data.change_reason],
      ['Submitted by', data.changed_by],
      ['Date', new Date(data.created_at).toLocaleString()],
    ]

    for (const [label, value] of fields) {
      console.log(`  ${chalk.dim(label.padEnd(16))} ${value ?? chalk.dim('—')}`)
    }
    console.log()
  } catch (err: any) {
    outputError('network_error', err.message)
  }
}

export async function submissionWithdraw(id: string, opts: { app?: string }) {
  const token = requireAuth()
  const slug = requireSlug(opts.app)

  status(`Withdrawing submission ${id}...`)

  try {
    const res = await fetch(`${API_BASE}/v1/developer/apps/${slug}/submissions/${id}/withdraw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      outputError('not_found', `App "${slug}" not found.`)
    }
    if (res.status === 409) {
      const body = await res.json() as { error: string; message: string; code: string }
      outputError(body.code ?? 'invalid_status', body.message)
    }
    if (!res.ok) {
      outputError('api_error', `API returned ${res.status}`)
    }

    const { data } = await res.json() as { data: { id: string; review_status: string } }

    if (isJsonMode()) {
      outputSuccess(data)
      return
    }

    console.log(chalk.green(`Submission withdrawn.`), chalk.dim(`Status is now: ${data.review_status}`))
    console.log('You can re-submit with', chalk.cyan('bagdock submit'))
  } catch (err: any) {
    outputError('network_error', err.message)
  }
}
