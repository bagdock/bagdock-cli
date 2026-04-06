/**
 * `bagdock submit` — Submit the current app for Bagdock marketplace review.
 *
 * Public integrations must be approved before they can be deployed to production.
 * This command transitions the app's review_status from 'draft' to 'submitted'.
 *
 * Once submitted, the Bagdock team reviews the integration and either approves
 * or rejects it. On approval the developer can run `bagdock deploy --production`.
 */

import chalk from 'chalk'
import { loadBagdockJson, getApiBase } from './config'
import { getAuthToken } from './auth'

export async function submit() {
  const config = loadBagdockJson(process.cwd())

  if (!config) {
    console.error(chalk.red('No bagdock.json found. Run'), chalk.cyan('bagdock init'), chalk.red('first.'))
    process.exit(1)
  }

  const token = getAuthToken()
  if (!token) {
    console.error(chalk.red('Not authenticated. Run'), chalk.cyan('bagdock login'), chalk.red('or set BAGDOCK_API_KEY.'))
    process.exit(1)
  }

  console.log(chalk.cyan(`\nSubmitting ${chalk.bold(config.slug)} for marketplace review...\n`))

  try {
    const res = await fetch(`${getApiBase()}/api/v1/developer/apps/${config.slug}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 404) {
        console.error(chalk.red('  App not found.'), 'Make sure you have created it with', chalk.cyan('bagdock deploy'), 'first.')
      } else {
        console.error(chalk.red(`  Submit failed (${res.status}):`), body.slice(0, 300))
      }
      process.exit(1)
    }

    console.log(chalk.green('  Submitted for review!'))
    console.log()
    console.log(`  The Bagdock team will review ${chalk.bold(config.slug)} and notify you`)
    console.log(`  when it's approved. Once approved, you can deploy to production:`)
    console.log()
    console.log(`    ${chalk.cyan('bagdock deploy --production')}`)
    console.log()
  } catch (err: any) {
    console.error(chalk.red('  Submit failed:'), err.message)
    process.exit(1)
  }
}
