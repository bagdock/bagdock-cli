/**
 * `bagdock validate` — Local pre-submission checks on bagdock.json and bundle.
 *
 * Validates schema, entry point, and bundle size before uploading to
 * the marketplace. Returns structured pass/warn/fail output like `doctor`.
 */

import chalk from 'chalk'
import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { loadBagdockJson, type ProjectType, type ProjectKind } from './config'
import { isJsonMode, outputSuccess, outputError } from './output'
import { resolveSlug } from './link'

interface Check {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

const VALID_TYPES: ProjectType[] = ['edge', 'app']
const VALID_KINDS: ProjectKind[] = ['adapter', 'comms', 'webhook', 'ui-extension', 'microfrontend']
const MAX_BUNDLE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function validate() {
  const checks: Check[] = []
  const dir = process.cwd()

  // 1 — bagdock.json exists and parses
  const config = loadBagdockJson(dir)
  if (!config) {
    checks.push({ name: 'bagdock.json', status: 'fail', message: 'Not found or invalid JSON' })
    return finish(checks)
  }
  checks.push({ name: 'bagdock.json', status: 'pass', message: 'Found and parsed' })

  // 2 — Required fields
  const required = ['name', 'slug', 'version', 'type', 'category', 'main'] as const
  const missing = required.filter((f) => !(config as any)[f])
  if (missing.length) {
    checks.push({ name: 'Required fields', status: 'fail', message: `Missing: ${missing.join(', ')}` })
  } else {
    checks.push({ name: 'Required fields', status: 'pass', message: 'All present' })
  }

  // 3 — Type/kind values
  if (!VALID_TYPES.includes(config.type as ProjectType)) {
    checks.push({ name: 'Type', status: 'fail', message: `Invalid type "${config.type}". Must be: ${VALID_TYPES.join(', ')}` })
  } else {
    checks.push({ name: 'Type', status: 'pass', message: config.type })
  }

  if (config.kind && !VALID_KINDS.includes(config.kind as ProjectKind)) {
    checks.push({ name: 'Kind', status: 'warn', message: `Unknown kind "${config.kind}". Expected: ${VALID_KINDS.join(', ')}` })
  }

  // 4 — Entry point exists
  const entryPath = join(dir, config.main)
  if (!existsSync(entryPath)) {
    checks.push({ name: 'Entry point', status: 'fail', message: `File not found: ${config.main}` })
  } else {
    const size = statSync(entryPath).size
    checks.push({ name: 'Entry point', status: 'pass', message: `${config.main} (${(size / 1024).toFixed(1)} KB)` })

    // 5 — Bundle size
    if (size > MAX_BUNDLE_BYTES) {
      checks.push({ name: 'Bundle size', status: 'fail', message: `${(size / 1024 / 1024).toFixed(1)} MB exceeds ${MAX_BUNDLE_BYTES / 1024 / 1024} MB limit` })
    } else if (size > MAX_BUNDLE_BYTES * 0.8) {
      checks.push({ name: 'Bundle size', status: 'warn', message: `${(size / 1024 / 1024).toFixed(1)} MB — approaching limit` })
    } else {
      checks.push({ name: 'Bundle size', status: 'pass', message: `${(size / 1024).toFixed(1)} KB` })
    }
  }

  // 6 — Slug matches linked project (if linked)
  const linked = resolveSlug()
  if (linked && linked !== config.slug) {
    checks.push({ name: 'Project link', status: 'warn', message: `bagdock.json slug "${config.slug}" differs from linked project "${linked}"` })
  }

  return finish(checks)
}

function finish(checks: Check[]) {
  const hasFail = checks.some((c) => c.status === 'fail')
  const hasWarn = checks.some((c) => c.status === 'warn')

  if (isJsonMode()) {
    outputSuccess({ ok: !hasFail, checks })
    if (hasFail) process.exit(1)
    return
  }

  console.log(chalk.bold('\n  Bagdock Validate\n'))
  for (const c of checks) {
    const icon = c.status === 'pass' ? chalk.green('✔') : c.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✖')
    console.log(`  ${icon} ${c.name}: ${c.message}`)
  }
  console.log()

  if (hasFail) {
    console.log(chalk.red('  Validation failed. Fix errors before submitting.\n'))
    process.exit(1)
  } else if (hasWarn) {
    console.log(chalk.yellow('  Passed with warnings.\n'))
  } else {
    console.log(chalk.green('  All checks passed. Ready to submit.\n'))
  }
}
