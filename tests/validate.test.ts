import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { checkIcon, checkPublisher } from '../src/validate'
import type { BagdockJson } from '../src/config'

const TEST_DIR = join(tmpdir(), `bagdock-test-validate-${Date.now()}`)

function makePng(w: number, h: number): Buffer {
  const b = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0) // signature
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

function baseConfig(overrides: Partial<BagdockJson> = {}): BagdockJson {
  return {
    name: 'Test App',
    slug: 'test-app',
    version: '1.0.0',
    type: 'edge',
    category: 'utility',
    main: 'index.js',
    ...overrides,
  } as BagdockJson
}

describe('validate — checkIcon', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('passes for a square PNG under the size limit', () => {
    writeFileSync(join(TEST_DIR, 'icon.png'), makePng(256, 256))
    const result = checkIcon(TEST_DIR, 'icon.png')
    expect(result.status).toBe('pass')
  })

  it('fails for a non-square PNG', () => {
    writeFileSync(join(TEST_DIR, 'icon.png'), makePng(256, 128))
    const result = checkIcon(TEST_DIR, 'icon.png')
    expect(result.status).toBe('fail')
    expect(result.message).toMatch(/square/)
  })

  it('fails for a PNG smaller than 128px', () => {
    writeFileSync(join(TEST_DIR, 'icon.png'), makePng(64, 64))
    const result = checkIcon(TEST_DIR, 'icon.png')
    expect(result.status).toBe('fail')
    expect(result.message).toMatch(/128/)
  })

  it('fails for a file exceeding the 256KB limit', () => {
    const oversized = Buffer.concat([makePng(256, 256), Buffer.alloc(300 * 1024)])
    writeFileSync(join(TEST_DIR, 'icon.png'), oversized)
    const result = checkIcon(TEST_DIR, 'icon.png')
    expect(result.status).toBe('fail')
    expect(result.message).toMatch(/KB/)
  })

  it('fails for a missing file', () => {
    const result = checkIcon(TEST_DIR, 'does-not-exist.png')
    expect(result.status).toBe('fail')
    expect(result.message).toMatch(/not found/)
  })

  it('fails for a non-PNG/SVG file', () => {
    writeFileSync(join(TEST_DIR, 'icon.txt'), 'not an image')
    const result = checkIcon(TEST_DIR, 'icon.txt')
    expect(result.status).toBe('fail')
  })

  it('passes for a square SVG with width/height', () => {
    writeFileSync(join(TEST_DIR, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"></svg>')
    const result = checkIcon(TEST_DIR, 'icon.svg')
    expect(result.status).toBe('pass')
  })

  it('fails for a non-square SVG', () => {
    writeFileSync(join(TEST_DIR, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64"></svg>')
    const result = checkIcon(TEST_DIR, 'icon.svg')
    expect(result.status).toBe('fail')
    expect(result.message).toMatch(/square/)
  })

  it('passes for a square SVG defined via viewBox', () => {
    writeFileSync(join(TEST_DIR, 'icon.svg'), '<svg viewBox="0 0 200 200"></svg>')
    const result = checkIcon(TEST_DIR, 'icon.svg')
    expect(result.status).toBe('pass')
  })
})

describe('validate — checkPublisher', () => {
  it('warns when visibility is public and no publisher block is present', () => {
    const checks = checkPublisher(baseConfig({ visibility: 'public' }))
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('warn')
  })

  it('returns no checks when visibility is private and no publisher block is present', () => {
    const checks = checkPublisher(baseConfig({ visibility: 'private' }))
    expect(checks).toEqual([])
  })

  it('passes for a well-formed publisher block', () => {
    const checks = checkPublisher(
      baseConfig({
        visibility: 'public',
        publisher: {
          company: 'Acme',
          website: 'https://acme.com',
          supportEmail: 'help@acme.com',
          docsUrl: 'https://acme.com/docs',
          privacyPolicy: 'https://acme.com/privacy',
        },
      })
    )
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('pass')
  })

  it('fails for a bad website URL', () => {
    const checks = checkPublisher(
      baseConfig({ visibility: 'public', publisher: { company: 'Acme', website: 'acme.com' } })
    )
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('fail')
  })

  it('fails for a bad support email', () => {
    const checks = checkPublisher(
      baseConfig({ visibility: 'public', publisher: { company: 'Acme', supportEmail: 'notanemail' } })
    )
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('fail')
  })

  it('fails for an unknown publisher field', () => {
    const checks = checkPublisher(
      baseConfig({ visibility: 'public', publisher: { foo: 'bar' } as any })
    )
    expect(checks).toHaveLength(1)
    expect(checks[0].status).toBe('fail')
    expect(checks[0].message).toMatch(/unknown/)
  })
})
