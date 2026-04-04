import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('doctor command', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns structured JSON with ok=true when checks pass', async () => {
    vi.doMock('../src/output', () => ({
      isJsonMode: () => true,
      outputSuccess: vi.fn(),
    }))

    vi.doMock('../src/auth', () => ({
      getAuthSource: () => ({ token: 'sk_live_test123', source: 'env (BAGDOCK_API_KEY)' }),
    }))

    vi.doMock('../src/config', () => ({
      loadBagdockJson: () => ({ slug: 'test-app', type: 'edge', kind: 'adapter', category: 'access' }),
      CONFIG_DIR: '/tmp/test-bagdock',
    }))

    const { doctor } = await import('../src/doctor')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '0.3.0' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await doctor()

    const { outputSuccess } = await import('../src/output')
    expect(outputSuccess).toHaveBeenCalledOnce()
    const result = (outputSuccess as any).mock.calls[0][0]
    expect(result.ok).toBe(true)
    expect(result.checks).toHaveLength(4)
    expect(result.checks.map((c: any) => c.name)).toEqual([
      'CLI Version', 'API Key', 'Project Config', 'AI Agents',
    ])
  })

  it('reports fail when no auth token found', async () => {
    vi.doMock('../src/output', () => ({
      isJsonMode: () => true,
      outputSuccess: vi.fn(),
    }))

    vi.doMock('../src/auth', () => ({
      getAuthSource: () => ({ token: null, source: 'none' }),
    }))

    vi.doMock('../src/config', () => ({
      loadBagdockJson: () => null,
      CONFIG_DIR: '/tmp/test-bagdock',
    }))

    const { doctor } = await import('../src/doctor')

    const mockFetch = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', mockFetch)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await doctor()

    const { outputSuccess } = await import('../src/output')
    const result = (outputSuccess as any).mock.calls[0][0]
    expect(result.ok).toBe(false)
    expect(result.checks.find((c: any) => c.name === 'API Key').status).toBe('fail')
  })
})
