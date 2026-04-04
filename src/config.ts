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

export interface Credentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  operatorId?: string
  email?: string
}

interface ProfileStore {
  activeProfile: string
  profiles: Record<string, Credentials>
}

let profileOverride: string | undefined

export function setProfileOverride(name: string) {
  profileOverride = name
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

export function listProfiles(): Array<{ name: string; email?: string; operatorId?: string; active: boolean }> {
  const store = loadStore()
  return Object.entries(store.profiles).map(([name, creds]) => ({
    name,
    email: creds.email,
    operatorId: creds.operatorId,
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
