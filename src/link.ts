/**
 * `bagdock link` — Link the current directory to a Bagdock app or edge.
 *
 * Stores the linked slug in `.bagdock/link.json` so other commands
 * (deploy, env, open, inspect) can resolve the target app without
 * requiring a bagdock.json in every directory.
 */

import chalk from 'chalk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadBagdockJson, API_BASE } from './config'
import { getAuthToken } from './auth'
import { isJsonMode, outputSuccess, outputError, status } from './output'

const LINK_DIR = '.bagdock'
const LINK_FILE = 'link.json'

interface LinkData {
  slug: string
  linkedAt: string
}

export function resolveSlug(): string | null {
  const config = loadBagdockJson(process.cwd())
  if (config?.slug) return config.slug

  const linkPath = join(process.cwd(), LINK_DIR, LINK_FILE)
  if (existsSync(linkPath)) {
    try {
      const data = JSON.parse(readFileSync(linkPath, 'utf-8')) as LinkData
      return data.slug ?? null
    } catch {
      return null
    }
  }
  return null
}

export function requireSlug(slugArg?: string): string {
  const slug = slugArg ?? resolveSlug()
  if (!slug) {
    if (isJsonMode()) {
      outputError('no_project', 'No project found. Pass --slug, add bagdock.json, or run bagdock link.')
    }
    console.error(chalk.red('No project found.'), 'Pass a slug, create bagdock.json, or run', chalk.cyan('bagdock link'))
    process.exit(1)
  }
  return slug
}

export async function link(opts: { slug?: string }) {
  let slug = opts.slug

  if (!slug) {
    const config = loadBagdockJson(process.cwd())
    if (config?.slug) {
      slug = config.slug
      status(`Found bagdock.json — linking to ${slug}`)
    }
  }

  if (!slug && process.stdout.isTTY && !isJsonMode()) {
    const token = getAuthToken()
    if (!token) {
      console.error(chalk.red('Not authenticated.'), 'Run', chalk.cyan('bagdock login'), 'first.')
      process.exit(1)
    }

    status('Fetching your apps...')
    try {
      const res = await fetch(`${API_BASE}/v1/developer/apps`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)

      const { data } = await res.json() as { data: Array<{ slug: string; name: string }> }
      if (!data?.length) {
        console.error(chalk.yellow('No apps found.'), 'Create one with', chalk.cyan('bagdock init'))
        process.exit(1)
      }

      console.log(chalk.bold('\nYour apps:\n'))
      data.forEach((app, i) => console.log(`  ${chalk.cyan(i + 1)} ${app.name} ${chalk.dim(`(${app.slug})`)}`))
      console.log()

      const readline = await import('readline')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise<string>((resolve) => rl.question('Select app number: ', resolve))
      rl.close()

      const idx = parseInt(answer, 10) - 1
      if (isNaN(idx) || idx < 0 || idx >= data.length) {
        console.error(chalk.red('Invalid selection'))
        process.exit(1)
      }
      slug = data[idx].slug
    } catch (err: any) {
      console.error(chalk.red('Failed to fetch apps:'), err.message)
      process.exit(1)
    }
  }

  if (!slug) {
    outputError('missing_slug', 'Slug required. Pass --slug in non-interactive mode.')
    process.exit(1)
  }

  const dir = join(process.cwd(), LINK_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const linkData: LinkData = { slug, linkedAt: new Date().toISOString() }
  writeFileSync(join(dir, LINK_FILE), JSON.stringify(linkData, null, 2))

  if (isJsonMode()) {
    outputSuccess({ slug, path: join(dir, LINK_FILE) })
  } else {
    console.log(chalk.green(`Linked to ${chalk.bold(slug)}`))
    console.log(chalk.dim(`  Stored in ${LINK_DIR}/${LINK_FILE}`))
  }
}
