/**
 * `bagdock open` — Open the current project in the Bagdock dashboard.
 */

import chalk from 'chalk'
import openBrowser from 'open'
import { DASHBOARD_BASE } from './config'
import { isJsonMode, outputSuccess, status } from './output'
import { requireSlug } from './link'

export async function open(slugArg?: string) {
  const slug = requireSlug(slugArg)
  const url = `${DASHBOARD_BASE}/developer/apps/${slug}`

  if (isJsonMode()) {
    outputSuccess({ url, slug })
    return
  }

  status(`Opening ${url}`)
  await openBrowser(url)
  console.log(chalk.green('Opened'), chalk.cyan(url))
}
