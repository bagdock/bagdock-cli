/**
 * CLI configuration — credential storage with multi-profile support,
 * API base URLs, and bagdock.json spec.
 */

import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// ============================================================================
// PATHS
// ============================================================================

export const CONFIG_DIR = join(homedir(), '.bagdock')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

export const API_BASE = process.env.BAGDOCK_API_URL ?? 'https://api.bagdock.com'
export const DASHBOARD_BASE = process.env.BAGDOCK_DASHBOARD_URL ?? 'https://dashboard.bagdock.com'

// ============================================================================
// CREDENTIALS — multi-profile
// ============================================================================

export type BagdockEnvironment = 'live' | 'test'

export interface Credentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  operatorId?: string
  operatorSlug?: string
  environment?: BagdockEnvironment
  email?: string
}

interface ProfileStore {
  activeProfile: string
  profiles: Record<string, Credentials>
}

let profileOverride: string | undefined
let envOverride: BagdockEnvironment | undefined

export function setProfileOverride(name: string) {
  profileOverride = name
}

export function setEnvironmentOverride(env: BagdockEnvironment) {
  envOverride = env
}

export function getEnvironmentOverride(): BagdockEnvironment | undefined {
  return envOverride
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

function loadStore(): ProfileStore {
  try {
    if (!existsSync(CREDENTIALS_FILE)) {
      return { activeProfile: 'default', profiles: {} }
    }
    const raw = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'))

    // Backwards compat: migrate flat Credentials to profile store
    if (raw.accessToken && !raw.profiles) {
      const migrated: ProfileStore = {
        activeProfile: 'default',
        profiles: { default: raw as Credentials },
      }
      saveStore(migrated)
      return migrated
    }

    return raw as ProfileStore
  } catch {
    return { activeProfile: 'default', profiles: {} }
  }
}

function saveStore(store: ProfileStore) {
  ensureConfigDir()
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 })
}

function resolveProfile(): string {
  if (profileOverride) return profileOverride
  if (process.env.BAGDOCK_PROFILE) return process.env.BAGDOCK_PROFILE
  return loadStore().activeProfile
}

export function loadCredentials(): Credentials | null {
  const store = loadStore()
  const name = resolveProfile()
  return store.profiles[name] ?? null
}

export function saveCredentials(creds: Credentials, profileName?: string) {
  const store = loadStore()
  const name = profileName ?? resolveProfile()
  store.profiles[name] = creds
  if (!store.activeProfile || Object.keys(store.profiles).length === 1) {
    store.activeProfile = name
  }
  saveStore(store)
}

export function clearCredentials() {
  const store = loadStore()
  const name = resolveProfile()
  delete store.profiles[name]
  if (store.activeProfile === name) {
    const remaining = Object.keys(store.profiles)
    store.activeProfile = remaining[0] ?? 'default'
  }
  saveStore(store)
}

export function listProfiles(): Array<{ name: string; email?: string; operatorId?: string; operatorSlug?: string; environment?: BagdockEnvironment; active: boolean }> {
  const store = loadStore()
  return Object.entries(store.profiles).map(([name, creds]) => ({
    name,
    email: creds.email,
    operatorId: creds.operatorId,
    operatorSlug: creds.operatorSlug,
    environment: creds.environment,
    active: name === store.activeProfile,
  }))
}

export function switchProfile(name: string): boolean {
  const store = loadStore()
  if (!store.profiles[name]) return false
  store.activeProfile = name
  saveStore(store)
  return true
}

export function getActiveProfileName(): string {
  return resolveProfile()
}

// ============================================================================
// LINK.JSON READER (kept here to avoid circular deps with api.ts)
// ============================================================================

export function resolveLinkEnvironment(): BagdockEnvironment | undefined {
  try {
    const p = join(process.cwd(), '.bagdock', 'link.json')
    if (!existsSync(p)) return undefined
    const data = JSON.parse(readFileSync(p, 'utf-8'))
    if (data.environment === 'live' || data.environment === 'test') return data.environment
    return undefined
  } catch {
    return undefined
  }
}

// ============================================================================
// CONTEXT RESOLUTION
// ============================================================================

/**
 * Resolve current environment: --env flag > BAGDOCK_ENV > profile > 'live'
 */
export function resolveEnvironment(): BagdockEnvironment {
  if (envOverride) return envOverride
  const envVar = process.env.BAGDOCK_ENV
  if (envVar === 'test' || envVar === 'live') return envVar
  const creds = loadCredentials()
  return creds?.environment ?? 'live'
}

/**
 * Resolve current operator slug: --operator flag > BAGDOCK_OPERATOR > profile
 */
export function resolveOperatorSlug(): string | undefined {
  const envVar = process.env.BAGDOCK_OPERATOR
  if (envVar) return envVar
  const creds = loadCredentials()
  return creds?.operatorSlug
}

/**
 * Update just the operator context on the active profile.
 */
export function updateProfileContext(operatorId: string, operatorSlug: string, environment: BagdockEnvironment) {
  const creds = loadCredentials()
  if (!creds) return
  saveCredentials({
    ...creds,
    operatorId,
    operatorSlug,
    environment,
  })
}

// ============================================================================
// BAGDOCK.JSON SPEC
// ============================================================================

export type ProjectType = 'edge' | 'app'

export type ProjectKind =
  | 'adapter'
  | 'comms'
  | 'webhook'
  | 'ui-extension'
  | 'microfrontend'

export interface BagdockJson {
  name: string
  slug: string
  version: string
  type: ProjectType
  kind?: ProjectKind
  category: string
  maintainer: 'bagdock' | 'vendor' | 'operator'
  visibility: 'public' | 'private'
  main: string
  compatibilityDate?: string
  env?: Record<string, { description?: string; required?: boolean }>
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
