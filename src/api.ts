/**
 * Shared API fetch helper — attaches auth, environment, and operator context
 * headers to every request automatically.
 *
 * Resolution priority:
 *   Auth:        --api-key > BAGDOCK_API_KEY > BAGDOCK_TOKEN > credentials.json
 *   Environment: --env flag > link.json > profile > 'live'
 *   Operator:    BAGDOCK_OPERATOR > profile
 */

import { getApiBase, resolveEnvironment, resolveOperatorSlug, getEnvironmentOverride, resolveLinkEnvironment } from './config'
import { getAuthToken } from './auth'
import { outputError } from './output'

/**
 * Full environment resolution chain:
 *   --env flag > link.json environment > profile environment > 'live'
 */
function resolveFullEnvironment(): 'live' | 'test' {
  const flagOverride = getEnvironmentOverride()
  if (flagOverride) return flagOverride
  const linkEnv = resolveLinkEnvironment()
  if (linkEnv) return linkEnv
  return resolveEnvironment()
}

/**
 * Make an authenticated API request with operator context headers.
 *
 * @param path  API path starting with `/api/v1/...`
 * @param init  Standard RequestInit overrides
 * @returns     Fetch Response
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  if (!token) {
    outputError('auth_error', 'Not authenticated. Run bagdock login or set BAGDOCK_API_KEY.')
    process.exit(1)
  }

  const env = resolveFullEnvironment()
  const opSlug = resolveOperatorSlug()

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('X-Environment', env)
  if (opSlug) headers.set('X-Operator-Slug', opSlug)

  return fetch(`${getApiBase()}${path}`, { ...init, headers })
}

/**
 * Convenience: authenticated JSON POST/PUT/PATCH with body serialisation.
 */
export async function apiFetchJson(path: string, method: string, body: unknown): Promise<Response> {
  return apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
