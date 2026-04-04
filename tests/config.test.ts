import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TEST_HOME = join(tmpdir(), `bagdock-test-home-${Date.now()}`)
const CONFIG_DIR = join(TEST_HOME, '.bagdock')
const CREDS_FILE = join(CONFIG_DIR, 'credentials.json')

vi.mock('os', async () => {
  const original = await vi.importActual<typeof import('os')>('os')
  return { ...original, homedir: () => TEST_HOME }
})

describe('config — profile management', () => {
  beforeEach(() => {
    mkdirSync(CONFIG_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true })
    vi.resetModules()
  })

  it('starts with empty profiles', async () => {
    const { listProfiles } = await import('../src/config')
    const profiles = listProfiles()
    expect(profiles).toEqual([])
  })

  it('saves and loads credentials in profile format', async () => {
    const { saveCredentials, loadCredentials, listProfiles } = await import('../src/config')
    saveCredentials({ accessToken: 'tok_abc', email: 'test@example.com' })
    const creds = loadCredentials()
    expect(creds?.accessToken).toBe('tok_abc')
    expect(creds?.email).toBe('test@example.com')
    const profiles = listProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('default')
    expect(profiles[0].active).toBe(true)
  })

  it('migrates flat credentials to profile format', async () => {
    writeFileSync(CREDS_FILE, JSON.stringify({
      accessToken: 'old_token',
      email: 'old@example.com',
    }), { mode: 0o600 })

    const { loadCredentials, listProfiles } = await import('../src/config')
    const creds = loadCredentials()
    expect(creds?.accessToken).toBe('old_token')

    const profiles = listProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('default')

    const raw = JSON.parse(readFileSync(CREDS_FILE, 'utf-8'))
    expect(raw.profiles).toBeDefined()
    expect(raw.activeProfile).toBe('default')
  })

  it('supports multiple profiles', async () => {
    const { saveCredentials, loadCredentials, switchProfile, setProfileOverride, listProfiles } = await import('../src/config')

    saveCredentials({ accessToken: 'tok_a', email: 'a@test.com' }, 'dev')
    saveCredentials({ accessToken: 'tok_b', email: 'b@test.com' }, 'prod')

    const profiles = listProfiles()
    expect(profiles).toHaveLength(2)

    switchProfile('prod')
    const creds = loadCredentials()
    expect(creds?.email).toBe('b@test.com')
  })

  it('clears only active profile credentials', async () => {
    const { saveCredentials, clearCredentials, listProfiles, switchProfile } = await import('../src/config')

    saveCredentials({ accessToken: 'tok_a' }, 'one')
    saveCredentials({ accessToken: 'tok_b' }, 'two')

    switchProfile('one')
    clearCredentials()

    const profiles = listProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('two')
  })
})
