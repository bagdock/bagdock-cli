/**
 * CLI configuration — credential storage, API base URLs, and bagdock.json spec.
 */

import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// ============================================================================
// PATHS
// ============================================================================

const CONFIG_DIR = join(homedir(), '.bagdock')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

export const API_BASE = process.env.BAGDOCK_API_URL ?? 'https://api.bagdock.com'
export const DASHBOARD_BASE = process.env.BAGDOCK_DASHBOARD_URL ?? 'https://dashboard.bagdock.com'

// ============================================================================
// CREDENTIALS
// ============================================================================

export interface Credentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  operatorId?: string
  email?: string
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

export function loadCredentials(): Credentials | null {
  try {
    if (!existsSync(CREDENTIALS_FILE)) return null
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8')
    return JSON.parse(raw) as Credentials
  } catch {
    return null
  }
}

export function saveCredentials(creds: Credentials) {
  ensureConfigDir()
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 })
}

export function clearCredentials() {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      writeFileSync(CREDENTIALS_FILE, '{}', { mode: 0o600 })
    }
  } catch {
    // ignore
  }
}

// ============================================================================
// BAGDOCK.JSON SPEC
// ============================================================================

export type ProjectType = 'edge' | 'app'

export type ProjectKind =
  | 'adapter'        // backend: API integration (access control, IoT, payments, etc.)
  | 'comms'          // backend: communications provider (SMS, voice, telephony)
  | 'webhook'        // backend: inbound webhook handler
  | 'ui-extension'   // frontend: strict component contract (drawer/panel per entity type)
  | 'microfrontend'  // frontend: full-page app proxied into the dashboard

export interface BagdockJson {
  /** Display name shown in the marketplace */
  name: string
  /** Unique project slug (kebab-case) */
  slug: string
  /** Semantic version */
  version: string
  /** Deployment target: edge (backend worker) or app (UI extension) */
  type: ProjectType
  /** Specific kind within the type */
  kind?: ProjectKind
  /** Marketplace category */
  category: string
  maintainer: 'bagdock' | 'vendor' | 'operator'
  visibility: 'public' | 'private'
  /** Entry point relative to project root */
  main: string
  /** Cloudflare Worker compatibility date */
  compatibilityDate?: string
  /** Environment variable declarations (names only — values come from Infisical / CF secrets) */
  env?: Record<string, { description?: string; required?: boolean }>
  /** Wrangler overrides for local dev (merged into auto-generated wrangler.toml) */
  wrangler?: Record<string, unknown>
}

export function loadBagdockJson(dir: string): BagdockJson | null {
  const file = join(dir, 'bagdock.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as BagdockJson
  } catch {
    return null
  }
}
