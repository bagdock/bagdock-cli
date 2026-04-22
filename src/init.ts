/**
 * `bagdock init` — Scaffold a new project with bagdock.json.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import chalk from 'chalk'
import type { BagdockJson, ProjectType, ProjectKind } from './config'

interface InitOptions {
  type?: string
  kind?: string
  category?: string
  slug?: string
  name?: string
}

const EDGE_KINDS = ['adapter', 'comms', 'webhook'] as const
const APP_KINDS = ['ui-extension', 'microfrontend'] as const

const CATEGORIES: Record<string, string[]> = {
  adapter: ['locks', 'gates', 'intercoms', 'full_access', 'sensors', 'connectivity', 'payment_processing', 'analytics', 'other'],
  comms: ['telephony', 'sms', 'voice'],
  webhook: ['automation', 'other'],
  'ui-extension': ['analytics', 'crm', 'scheduling', 'live_chat', 'other'],
  microfrontend: ['analytics', 'ecommerce', 'other'],
}

export async function init(dir: string, opts: InitOptions) {
  const projectDir = dir || process.cwd()
  const projectName = basename(projectDir)

  if (existsSync(join(projectDir, 'bagdock.json'))) {
    console.log(chalk.yellow('bagdock.json already exists in this directory.'))
    return
  }

  const slug = opts.slug ?? projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const type = (opts.type ?? 'edge') as ProjectType
  const kind = resolveKind(type, opts.kind)
  const categories = CATEGORIES[kind] ?? ['other']
  const category = opts.category ?? categories[0]

  const config: BagdockJson = {
    name: opts.name ?? projectName,
    slug,
    version: '0.1.0',
    type,
    kind,
    category,
    maintainer: 'operator',
    visibility: 'private',
    main: 'src/index.ts',
    compatibilityDate: '2024-09-23',
    env: {
      API_KEY: { description: 'Provider API key', required: true },
    },
  }

  writeFileSync(join(projectDir, 'bagdock.json'), JSON.stringify(config, null, 2))

  const srcDir = join(projectDir, 'src')
  if (!existsSync(srcDir)) {
    mkdirSync(srcDir, { recursive: true })
  }

  const entryFile = join(srcDir, 'index.ts')
  if (!existsSync(entryFile)) {
    const template = selectTemplate(type, kind, slug)
    writeFileSync(entryFile, template)
  }

  if (type === 'edge' && kind === 'comms') {
    const typesFile = join(srcDir, 'types.ts')
    if (!existsSync(typesFile)) {
      writeFileSync(typesFile, COMMS_TYPES_TEMPLATE())
    }
    const verifyFile = join(srcDir, 'verify.ts')
    if (!existsSync(verifyFile)) {
      writeFileSync(verifyFile, COMMS_VERIFY_TEMPLATE())
    }
  }

  const pkgFile = join(projectDir, 'package.json')
  if (!existsSync(pkgFile)) {
    const deps: Record<string, string> = {}
    const devDeps: Record<string, string> = {
      '@cloudflare/workers-types': '^4.20240909.0',
      typescript: '^5.3.3',
    }
    if (type === 'edge' && kind === 'adapter') {
      devDeps['@bagdock/adapter-worker-template'] = 'workspace:*'
    }
    if (type === 'edge' && kind === 'comms') {
      deps['@bagdock/worker-sdk'] = '^0.1.0'
    }

    writeFileSync(pkgFile, JSON.stringify({
      name: slug,
      version: '0.1.0',
      private: true,
      main: 'src/index.ts',
      ...(Object.keys(deps).length ? { dependencies: deps } : {}),
      devDependencies: devDeps,
    }, null, 2))
  }

  const label = type === 'app' ? 'app' : 'edge'
  console.log(chalk.green(`\nInitialised Bagdock ${label} project!\n`))
  console.log('Created:')
  console.log(`  ${chalk.cyan('bagdock.json')}   — project config`)
  console.log(`  ${chalk.cyan('src/index.ts')}  — worker entry point`)
  if (type === 'edge' && kind === 'comms') {
    console.log(`  ${chalk.cyan('src/types.ts')}  — environment bindings`)
    console.log(`  ${chalk.cyan('src/verify.ts')} — webhook verification (customise for your vendor)`)
  }
  console.log()
  console.log('Next steps:')
  console.log(`  1. ${chalk.cyan('bun install')}    — install dependencies`)
  console.log(`  2. ${chalk.cyan('bagdock dev')}    — start local dev server`)
  console.log(`  3. ${chalk.cyan('bagdock deploy')} — deploy to Bagdock platform`)
}

function resolveKind(type: ProjectType, kindOpt?: string): ProjectKind {
  if (kindOpt) return kindOpt as ProjectKind
  return type === 'app' ? 'ui-extension' : 'adapter'
}

// ============================================================================
// TEMPLATES
// ============================================================================

function selectTemplate(type: ProjectType, kind: ProjectKind, slug: string): string {
  if (type === 'app') return APP_TEMPLATE(slug)
  if (kind === 'comms') return COMMS_TEMPLATE(slug)
  if (kind === 'webhook') return WEBHOOK_TEMPLATE(slug)
  return ADAPTER_TEMPLATE(slug)
}

function ADAPTER_TEMPLATE(slug: string) {
  return `import { createAdapterWorker } from '@bagdock/adapter-worker-template'
import type { AdapterWorkerContract, AdapterRequest, ActionResult, HealthResult } from '@bagdock/adapter-worker-template'

class ${toPascalCase(slug)}Adapter implements AdapterWorkerContract {
  async syncAccessPoints(req: AdapterRequest) {
    return { access_points: [] }
  }

  async programCredential(req: AdapterRequest): Promise<ActionResult> {
    return { success: true }
  }

  async revokeCredential(req: AdapterRequest): Promise<ActionResult> {
    return { success: true }
  }

  async openAccessPoint(req: AdapterRequest): Promise<ActionResult> {
    return { success: true }
  }

  async checkHealth(req: AdapterRequest): Promise<HealthResult> {
    return { status: 'healthy', version: '0.1.0', uptime_seconds: 0 }
  }
}

export default createAdapterWorker(new ${toPascalCase(slug)}Adapter())
`
}

function COMMS_TEMPLATE(slug: string) {
  return `import { createCommsWorker } from '@bagdock/worker-sdk'
import type { HandlerContext } from '@bagdock/worker-sdk'
import type { Env } from './types'
import { vendorWebhookVerify } from './verify'

async function handleSmsSend(ctx: HandlerContext<Env>): Promise<Response> {
  const { to, body } = await ctx.request.json() as { to: string; body: string }
  // TODO: call your vendor's SMS API using ctx.env for secrets
  return Response.json({ id: crypto.randomUUID(), status: 'queued', provider: '${slug}', from: '', to })
}

async function handleSmsWebhook(ctx: HandlerContext<Env>): Promise<Response> {
  const payload = await ctx.request.json()
  ctx.logger.info('webhook.sms', { payload })
  return Response.json({ received: true })
}

export default createCommsWorker<Env, readonly ['sms']>({
  version: '0.1.0',
  capabilities: ['sms'],

  async onInstall(ctx) {
    // TODO: provision vendor resources
    ctx.logger.info('lifecycle.install', { operatorId: ctx.operatorId })
    return { installation_state: { provisioned: true } }
  },

  async onUninstall(ctx) {
    // TODO: clean up vendor resources
    ctx.logger.info('lifecycle.uninstall', { operatorId: ctx.operatorId })
  },

  routes: {
    'sms/send': handleSmsSend,
    'webhooks/sms': { handler: handleSmsWebhook, verify: vendorWebhookVerify },
  },
})
`
}

function COMMS_TYPES_TEMPLATE() {
  return `import type { BaseEnv } from '@bagdock/worker-sdk'

export interface Env extends BaseEnv {
  ADAPTER_NAME: string
  PROVIDER_SLUG: string
  API_KEY: string
  WEBHOOK_SECRET: string
  OPERATOR_CONFIG?: KVNamespace
}
`
}

function COMMS_VERIFY_TEMPLATE() {
  return `import { hmacSha256Verify } from '@bagdock/worker-sdk'
import type { VerifyFunction } from '@bagdock/worker-sdk'
import type { Env } from './types'

/**
 * Adapter-local webhook verification.
 *
 * Replace with your vendor's signing method. See the @bagdock/worker-sdk
 * README for examples using vendor SDKs or the ed25519Verify primitive.
 */
export const vendorWebhookVerify: VerifyFunction<Env> = (request, env, rawBody) =>
  hmacSha256Verify({
    signature: request.headers.get('x-webhook-signature'),
    secret: env.WEBHOOK_SECRET,
    signingString: rawBody,
    timestamp: request.headers.get('x-webhook-timestamp'),
  })
`
}

function WEBHOOK_TEMPLATE(slug: string) {
  return `/**
 * ${toPascalCase(slug)} — Webhook handler edge worker.
 *
 * Receives inbound webhooks from external services and dispatches events.
 */

interface Env {
  WEBHOOK_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    const body = await request.json()
    // TODO: validate signature using env.WEBHOOK_SECRET
    // TODO: process webhook payload and dispatch to Bagdock event bus

    return Response.json({ received: true })
  },
}
`
}

function APP_TEMPLATE(slug: string) {
  return `/**
 * ${toPascalCase(slug)} — Bagdock UI extension app.
 *
 * This worker serves as the backend for a UI extension that renders
 * panels, drawers, or cards within the Bagdock operator dashboard.
 *
 * The Bagdock App Bridge calls these endpoints to fetch data and
 * execute actions on behalf of the authenticated operator.
 */

interface Env {
  API_KEY: string
}

interface AppContext {
  operatorId: string
  facilityId?: string
  entityType?: string
  entityId?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\\//, '')

    // Bagdock App Bridge injects operator context via headers
    const ctx: AppContext = {
      operatorId: request.headers.get('x-bagdock-operator-id') ?? '',
      facilityId: request.headers.get('x-bagdock-facility-id') ?? undefined,
      entityType: request.headers.get('x-bagdock-entity-type') ?? undefined,
      entityId: request.headers.get('x-bagdock-entity-id') ?? undefined,
    }

    if (path === 'manifest') {
      return Response.json({
        name: '${slug}',
        version: '0.1.0',
        extensions: [
          {
            type: 'panel',
            target: 'facility.overview',
            title: '${toPascalCase(slug)}',
            dataUrl: '/data',
          },
        ],
      })
    }

    if (path === 'data') {
      return Response.json({
        operator_id: ctx.operatorId,
        facility_id: ctx.facilityId,
        items: [],
      })
    }

    if (path === 'health') {
      return Response.json({ status: 'healthy', version: '0.1.0' })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  },
}
`
}

function toPascalCase(s: string) {
  return s.replace(/(^|-|_)(\w)/g, (_, __, c) => c.toUpperCase())
}
