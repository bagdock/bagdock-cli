/**
 * `bagdock open` — Open the current project in the Bagdock dashboard.
 *
 * Builds the URL with operator slug and environment context:
 *   live: /{operatorSlug}/developer/apps/{appSlug}
 *   test: /{operatorSlug}/test/developer/apps/{appSlug}
 */

import chalk from 'chalk'
import openBrowser from 'open'
import { DASHBOARD_BASE, resolveEnvironment, resolveOperatorSlug } from './config'
import { isJsonMode, outputSuccess, outputError, status } from './output'
import { requireSlug } from './link'

export async function open(slugArg?: string) {
  const slug = requireSlug(slugArg)
  const operatorSlug = resolveOperatorSlug()
  const env = resolveEnvironment()

  if (!operatorSlug) {
    outputError('no_operator', 'No operator context. Run bagdock switch or bagdock login to set one.')
    return
  }

  const envSegment = env === 'test' ? '/test' : ''
  const url = `${DASHBOARD_BASE}/${operatorSlug}${envSegment}/developer/apps/${slug}`

  if (isJsonMode()) {
    outputSuccess({ url, slug, operator: operatorSlug, environment: env })
    return
  }

  status(`Opening ${url}`)
  await openBrowser(url)
  console.log(chalk.green('Opened'), chalk.cyan(url))
}
