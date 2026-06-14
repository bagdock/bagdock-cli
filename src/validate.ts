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

  // 6 — Webhook declarations (optional)
  if (config.webhooks !== undefined) {
    if (!Array.isArray(config.webhooks)) {
      checks.push({ name: 'Webhooks', status: 'fail', message: '"webhooks" must be an array of { name, path, description? }' })
    } else {
      const problems: string[] = []
      const seen = new Set<string>()
      config.webhooks.forEach((wh, i) => {
        if (!wh || typeof wh !== 'object') { problems.push(`#${i} is not an object`); return }
        if (!wh.name) problems.push(`#${i} missing "name"`)
        if (!wh.path) problems.push(`#${i} missing "path"`)
        else if (!wh.path.startsWith('/')) problems.push(`"${wh.name ?? i}" path must start with "/" (got "${wh.path}")`)
        if (wh.name && seen.has(wh.name)) problems.push(`duplicate name "${wh.name}"`)
        if (wh.name) seen.add(wh.name)
      })
      if (problems.length) {
        checks.push({ name: 'Webhooks', status: 'fail', message: problems.join('; ') })
      } else {
        checks.push({ name: 'Webhooks', status: 'pass', message: `${config.webhooks.length} declared` })
      }
    }
  }

  // 7 — Install inputs (optional)
  if (config.inputs !== undefined) {
    if (!Array.isArray(config.inputs)) {
      checks.push({ name: 'Inputs', status: 'fail', message: '"inputs" must be an array of { key, label, type, required }' })
    } else {
      const problems: string[] = []
      const seen = new Set<string>()
      config.inputs.forEach((inp, i) => {
        if (!inp || typeof inp !== 'object') { problems.push(`#${i} is not an object`); return }
        const id = typeof inp.key === 'string' && inp.key ? inp.key : `#${i}`
        if (typeof inp.key !== 'string' || !inp.key.trim()) problems.push(`${id} "key" must be a non-empty string`)
        if (typeof inp.label !== 'string' || !inp.label.trim()) problems.push(`${id} "label" must be a non-empty string`)
        if (inp.type !== 'text' && inp.type !== 'password') problems.push(`${id} type must be "text" or "password" (got "${inp.type}")`)
        if (typeof inp.required !== 'boolean') problems.push(`${id} "required" must be a boolean`)
        if (inp.help !== undefined && typeof inp.help !== 'string') problems.push(`${id} "help" must be a string`)
        if (inp.placeholder !== undefined && typeof inp.placeholder !== 'string') problems.push(`${id} "placeholder" must be a string`)
        if (typeof inp.key === 'string' && inp.key) {
          if (seen.has(inp.key)) problems.push(`duplicate key "${inp.key}"`)
          seen.add(inp.key)
        }
      })
      if (problems.length) {
        checks.push({ name: 'Inputs', status: 'fail', message: problems.join('; ') })
      } else {
        checks.push({ name: 'Inputs', status: 'pass', message: `${config.inputs.length} declared` })
      }
    }
  }

  // 8 — Display fields (optional)
  if (config.displays !== undefined) {
    if (!Array.isArray(config.displays)) {
      checks.push({ name: 'Displays', status: 'fail', message: '"displays" must be an array of { label, value|template, copyable? }' })
    } else {
      const problems: string[] = []
      config.displays.forEach((d, i) => {
        if (!d || typeof d !== 'object') { problems.push(`#${i} is not an object`); return }
        const id = typeof d.label === 'string' && d.label ? `"${d.label}"` : `#${i}`
        if (typeof d.label !== 'string' || !d.label.trim()) problems.push(`${id} "label" must be a non-empty string`)
        if (d.value === undefined && d.template === undefined) problems.push(`${id} needs "value" or "template"`)
        if (d.value !== undefined && typeof d.value !== 'string') problems.push(`${id} "value" must be a string`)
        if (d.template !== undefined && typeof d.template !== 'string') problems.push(`${id} "template" must be a string`)
        if (d.copyable !== undefined && typeof d.copyable !== 'boolean') problems.push(`${id} "copyable" must be a boolean`)
      })
      if (problems.length) {
        checks.push({ name: 'Displays', status: 'fail', message: problems.join('; ') })
      } else {
        checks.push({ name: 'Displays', status: 'pass', message: `${config.displays.length} declared` })
      }
    }
  }

  // 9 — Slug matches linked project (if linked)
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
