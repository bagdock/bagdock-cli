/**
 * `bagdock validate` — Local pre-submission checks on bagdock.json and bundle.
 *
 * Validates schema, entry point, and bundle size before uploading to
 * the marketplace. Returns structured pass/warn/fail output like `doctor`.
 */

import chalk from 'chalk'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { loadBagdockJson, type BagdockJson, type ProjectType, type ProjectKind } from './config'
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

// App-icon spec (BDOK-678): square PNG/SVG, ≥128px, ≤256KB.
const ICON_MIN_PX = 128
const ICON_MAX_BYTES = 256 * 1024
const PUBLISHER_FIELDS = ['company', 'website', 'supportEmail', 'docsUrl', 'privacyPolicy'] as const

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

  // 9 — App icon (BDOK-678, optional). If declared, the file must be a square
  // PNG/SVG within the size bounds; if not declared, the app renders the
  // initial-tile fallback, so absence is at most a public-app nudge (check 10).
  if (config.icon !== undefined) {
    checks.push(checkIcon(dir, config.icon))
  }

  // 10 — Publisher identity (BDOK-678, optional override). A public app with no
  // publisher block validly inherits its org profile at render time (the CLI
  // cannot see that profile offline), so a missing block is a WARN nudge, never
  // a failure. A present block must be well-formed.
  for (const c of checkPublisher(config)) checks.push(c)

  // 11 — Slug matches linked project (if linked)
  const linked = resolveSlug()
  if (linked && linked !== config.slug) {
    checks.push({ name: 'Project link', status: 'warn', message: `bagdock.json slug "${config.slug}" differs from linked project "${linked}"` })
  }

  return finish(checks)
}

// ============================================================================
// ICON + PUBLISHER CHECKS (BDOK-678)
// ============================================================================

/**
 * Validate the declared app icon: square, PNG or SVG, ≥128px, ≤256KB. Reads
 * image dimensions with zero dependencies — the PNG IHDR header for rasters and
 * the width/height/viewBox attributes for SVG. SVG is vector, so the ≥128px
 * floor is advisory there; a non-square SVG is still flagged.
 */
export function checkIcon(dir: string, iconPath: string): Check {
  if (typeof iconPath !== 'string' || !iconPath.trim()) {
    return { name: 'Icon', status: 'fail', message: '"icon" must be a non-empty path' }
  }
  const abs = join(dir, iconPath)
  if (!existsSync(abs)) {
    return { name: 'Icon', status: 'fail', message: `File not found: ${iconPath}` }
  }

  const size = statSync(abs).size
  if (size > ICON_MAX_BYTES) {
    return { name: 'Icon', status: 'fail', message: `${(size / 1024).toFixed(0)} KB exceeds the ${ICON_MAX_BYTES / 1024} KB limit` }
  }

  const ext = iconPath.toLowerCase().slice(iconPath.lastIndexOf('.'))
  const buf = readFileSync(abs)

  if (ext === '.png' || isPng(buf)) {
    const dims = pngDimensions(buf)
    if (!dims) {
      return { name: 'Icon', status: 'fail', message: `${iconPath} is not a valid PNG` }
    }
    if (dims.width !== dims.height) {
      return { name: 'Icon', status: 'fail', message: `${iconPath} must be square (got ${dims.width}×${dims.height})` }
    }
    if (dims.width < ICON_MIN_PX) {
      return { name: 'Icon', status: 'fail', message: `${iconPath} is ${dims.width}px — must be at least ${ICON_MIN_PX}px` }
    }
    return { name: 'Icon', status: 'pass', message: `${iconPath} (${dims.width}×${dims.height} PNG, ${(size / 1024).toFixed(0)} KB)` }
  }

  if (ext === '.svg' || isSvg(buf)) {
    const dims = svgDimensions(buf.toString('utf-8'))
    if (dims && dims.width > 0 && dims.height > 0) {
      const ratio = dims.width / dims.height
      if (ratio < 0.98 || ratio > 1.02) {
        return { name: 'Icon', status: 'fail', message: `${iconPath} must be square (viewBox/size is ${dims.width}×${dims.height})` }
      }
    }
    return { name: 'Icon', status: 'pass', message: `${iconPath} (SVG, ${(size / 1024).toFixed(0)} KB)` }
  }

  return { name: 'Icon', status: 'fail', message: `${iconPath} must be a PNG or SVG` }
}

/**
 * Validate the optional publisher-identity override. Present fields must be
 * well-formed (http(s) URLs, an email for supportEmail). A public app with no
 * publisher block gets a WARN — its identity inherits the org profile, which the
 * offline CLI cannot confirm, so we nudge rather than block.
 */
export function checkPublisher(config: BagdockJson): Check[] {
  const checks: Check[] = []
  const pub = config.publisher

  if (pub === undefined) {
    if (config.visibility === 'public') {
      checks.push({
        name: 'Publisher',
        status: 'warn',
        message: 'No publisher block — identity will inherit your org profile. Add a "publisher" block to override per app.',
      })
    }
    return checks
  }

  if (typeof pub !== 'object' || Array.isArray(pub)) {
    checks.push({ name: 'Publisher', status: 'fail', message: '"publisher" must be an object of { company?, website?, supportEmail?, docsUrl?, privacyPolicy? }' })
    return checks
  }

  const problems: string[] = []
  const unknown = Object.keys(pub).filter((k) => !PUBLISHER_FIELDS.includes(k as any))
  if (unknown.length) problems.push(`unknown field(s): ${unknown.join(', ')}`)

  for (const [field, val] of Object.entries(pub)) {
    if (val === undefined || val === null) continue
    if (typeof val !== 'string' || !val.trim()) { problems.push(`"${field}" must be a non-empty string`); continue }
    if ((field === 'website' || field === 'docsUrl' || field === 'privacyPolicy') && !isHttpUrl(val)) {
      problems.push(`"${field}" must be an http(s) URL (got "${val}")`)
    }
    if (field === 'supportEmail' && !isEmail(val)) {
      problems.push(`"supportEmail" must be an email address (got "${val}")`)
    }
  }

  if (problems.length) {
    checks.push({ name: 'Publisher', status: 'fail', message: problems.join('; ') })
  } else {
    const provided = PUBLISHER_FIELDS.filter((f) => (pub as any)[f])
    checks.push({ name: 'Publisher', status: 'pass', message: `override: ${provided.join(', ') || '(empty)'}` })
  }
  return checks
}

function isPng(buf: Buffer): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return buf.length >= 8 && sig.every((b, i) => buf[i] === b)
}

/** PNG width/height live big-endian in the IHDR chunk at byte offsets 16 and 20. */
function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!isPng(buf) || buf.length < 24) return null
  // Bytes 12–15 must spell "IHDR" for the dimensions to be at 16/20.
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function isSvg(buf: Buffer): boolean {
  const head = buf.toString('utf-8', 0, Math.min(buf.length, 512)).trimStart()
  return head.startsWith('<?xml') ? head.includes('<svg') : head.startsWith('<svg')
}

/** Prefer explicit width/height; fall back to the viewBox's w/h for aspect. */
function svgDimensions(text: string): { width: number; height: number } | null {
  const w = text.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i)
  const h = text.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i)
  if (w && h) return { width: parseFloat(w[1]), height: parseFloat(h[1]) }
  const vb = text.match(/\bviewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i)
  if (vb) return { width: parseFloat(vb[1]), height: parseFloat(vb[2]) }
  return null
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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
