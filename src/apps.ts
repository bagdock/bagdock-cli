/**
 * `bagdock apps` — List and inspect deployed apps and edges.
 */

import chalk from 'chalk'
import { apiFetch } from './api'
import { isJsonMode, outputSuccess, outputError, outputList, status } from './output'

export async function appsList() {
  status('Fetching apps...')

  const res = await apiFetch('/api/v1/developer/apps')

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const result = await res.json() as { data: any[] }

  if (isJsonMode()) {
    outputList('app', result.data, false)
  } else {
    if (!result.data.length) {
      console.log(chalk.yellow('\n  No apps found. Create one with'), chalk.cyan('bagdock init'), '\n')
      return
    }
    console.log()
    for (const app of result.data) {
      const status = app.is_active ? chalk.green('active') : chalk.dim('inactive')
      const review = app.review_status ? chalk.dim(`[${app.review_status}]`) : ''
      console.log(`  ${chalk.bold(app.name)} ${chalk.dim(`(${app.slug})`)} ${status} ${review}`)
      console.log(`    ${chalk.dim('Type:')} ${app.type}/${app.category}  ${chalk.dim('Version:')} ${app.version}`)
      if (app.worker_url) {
        console.log(`    ${chalk.dim('URL:')} ${app.worker_url}`)
      }
      console.log()
    }
  }
}

export async function appsGet(slug: string) {
  status(`Fetching app ${slug}...`)

  const res = await apiFetch(`/api/v1/developer/apps/${slug}`)

  if (!res.ok) {
    if (res.status === 404) {
      outputError('NOT_FOUND', `App "${slug}" not found`)
    }
    const err = await res.json().catch(() => ({ error: { message: res.statusText } })) as any
    outputError(err.error?.code || 'API_ERROR', err.error?.message || `HTTP ${res.status}`)
  }

  const result = await res.json() as { data: any }
  const app = result.data

  if (isJsonMode()) {
    outputSuccess(app)
  } else {
    console.log()
    console.log(`  ${chalk.bold(app.name)} ${chalk.dim(`(${app.slug})`)}`)
    console.log(`  ${chalk.dim('ID:')}           ${app.id}`)
    console.log(`  ${chalk.dim('Type:')}         ${app.type}`)
    console.log(`  ${chalk.dim('Category:')}     ${app.category}`)
    console.log(`  ${chalk.dim('Kind:')}         ${app.kind ?? '-'}`)
    console.log(`  ${chalk.dim('Version:')}      ${app.version}`)
    console.log(`  ${chalk.dim('Visibility:')}   ${app.visibility}`)
    console.log(`  ${chalk.dim('Maintainer:')}   ${app.maintainer}`)
    console.log(`  ${chalk.dim('Review:')}       ${app.review_status ?? 'draft'}`)
    console.log(`  ${chalk.dim('Active:')}       ${app.is_active ? 'yes' : 'no'}`)
    if (app.worker_url) {
      console.log(`  ${chalk.dim('Worker URL:')}   ${app.worker_url}`)
    }
    console.log(`  ${chalk.dim('Created:')}      ${app.created_at}`)
    console.log(`  ${chalk.dim('Updated:')}      ${app.updated_at}`)
    console.log()
  }
}
