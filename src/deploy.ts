/**
 * `bagdock deploy` — Build locally and deploy via the Bagdock API.
 *
 * The developer never needs Cloudflare credentials. The flow:
 *   1. Load bagdock.json
 *   2. Bundle the Worker entry point with bun build / esbuild
 *   3. Upload the compiled JS to POST /developer/apps/:slug/deploy
 *   4. The API enforces governance and uploads to CF Workers for Platforms
 *
 * Environments & URL scheme:
 *   preview:    {slug}-{hash}.pre.bdok.dev  (ephemeral, per-deploy)
 *   staging:    {slug}.pre.bdok.dev         (stable pre-production)
 *   production: {slug}.bdok.dev             (requires review for public integrations)
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { createInterface } from 'readline'
import chalk from 'chalk'
import { loadBagdockJson, getApiBase } from './config'
import { getAuthToken } from './auth'

interface DeployOptions {
  env?: string
  preview?: boolean
  production?: boolean
  yes?: boolean
}

export async function deploy(opts: DeployOptions) {
  const cwd = process.cwd()
  const config = loadBagdockJson(cwd)

  if (!config) {
    console.error(chalk.red('No bagdock.json found. Run'), chalk.cyan('bagdock init'), chalk.red('first.'))
    process.exit(1)
  }

  const token = getAuthToken()
  if (!token) {
    console.error(chalk.red('Not authenticated. Run'), chalk.cyan('bagdock login'), chalk.red('or set BAGDOCK_API_KEY.'))
    process.exit(1)
  }

  // Resolve environment from flags
  let environment = opts.env ?? 'staging'
  if (opts.preview) environment = 'preview'
  if (opts.production) environment = 'production'

  if (!['preview', 'staging', 'production'].includes(environment)) {
    console.error(chalk.red(`Invalid environment: ${environment}`))
    console.error('Valid environments: preview, staging, production')
    process.exit(1)
  }

  // Production confirmation prompt (skip with --yes)
  if (environment === 'production' && !opts.yes) {
    console.log(chalk.yellow(`\n  You are about to deploy ${chalk.bold(config.slug)}@${config.version} to ${chalk.bold('production')}.`))
    if (config.visibility === 'public') {
      console.log(chalk.yellow('  This is a public integration — it must be approved by Bagdock.'))
    }
    const confirmed = await confirm('  Continue? [y/N] ')
    if (!confirmed) {
      console.log(chalk.dim('  Aborted.'))
      process.exit(0)
    }
  }

  const envLabel = environment === 'preview'
    ? chalk.magenta('preview')
    : environment === 'production'
      ? chalk.red('production')
      : chalk.blue('staging')

  console.log(chalk.cyan(`\nDeploying ${config.slug}@${config.version} → ${envLabel}\n`))

  // 1. Build the Worker bundle
  const outDir = join(cwd, '.bagdock')
  const outFile = join(outDir, 'worker.mjs')
  console.log(chalk.dim('  Building worker bundle...'))

  execSync(`mkdir -p ${outDir}`, { cwd })

  try {
    execSync(
      `bun build ${config.main} --outfile ${outFile} --target browser --format esm --minify`,
      { cwd, stdio: 'pipe' },
    )
    console.log(chalk.green('  Bundle built'))
  } catch {
    try {
      execSync(
        `npx esbuild ${config.main} --bundle --outfile=${outFile} --format=esm --minify --platform=neutral`,
        { cwd, stdio: 'pipe' },
      )
      console.log(chalk.green('  Bundle built (esbuild)'))
    } catch (err: any) {
      console.error(chalk.red('  Build failed. Ensure bun or esbuild is available.'))
      console.error(chalk.dim(`  ${err.message?.slice(0, 200)}`))
      process.exit(1)
    }
  }

  if (!existsSync(outFile)) {
    console.error(chalk.red('  Build output not found at'), outFile)
    process.exit(1)
  }

  const scriptContent = readFileSync(outFile)
  const sizeKb = (scriptContent.length / 1024).toFixed(1)
  console.log(chalk.dim(`  Bundle size: ${sizeKb} KB`))

  // 2. Upload to Bagdock API
  console.log(chalk.dim('  Uploading to Bagdock platform...'))

  const formData = new FormData()
  formData.append(
    'script',
    new Blob([scriptContent], { type: 'application/javascript+module' }),
    'worker.mjs',
  )
  formData.append('metadata', JSON.stringify({
    version: config.version,
    environment,
    compatibilityDate: config.compatibilityDate ?? '2024-09-23',
    ...(config.kv ? { kv: config.kv } : {}),
    ...(config.webhooks ? { webhooks: config.webhooks } : {}),
    ...(config.inputs ? { inputs: config.inputs } : {}),
    ...(config.displays ? { displays: config.displays } : {}),
    // BDOK-678: publisher identity override + marketplace description. The icon
    // ships as a separate `icon` file part below. Only non-preview deploys
    // persist these server-side.
    ...(config.description ? { description: config.description } : {}),
    ...(config.publisher ? { publisher: config.publisher } : {}),
  }))

  // App icon (BDOK-678): ship the bytes so the platform can host it and mirror a
  // stable icon_url. `bagdock validate` has already checked it is a square
  // PNG/SVG within the size cap; a missing file is skipped (validate warns).
  if (config.icon) {
    const iconPath = join(cwd, config.icon)
    if (existsSync(iconPath)) {
      const iconBytes = readFileSync(iconPath)
      const ext = config.icon.toLowerCase().slice(config.icon.lastIndexOf('.'))
      const iconType = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'application/octet-stream'
      formData.append('icon', new Blob([iconBytes], { type: iconType }), `icon${ext}`)
    } else {
      console.log(chalk.yellow(`  Icon not found at ${config.icon}, skipping upload.`))
    }
  }

  try {
    const res = await fetch(`${getApiBase()}/api/v1/developer/apps/${config.slug}/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    // Handle governance rejection
    if (res.status === 403) {
      const body = await res.json() as { error: string; message?: string; review_status?: string; code?: string }
      console.error(chalk.red('\n  Deploy blocked by governance policy\n'))
      if (body.code === 'REVIEW_REQUIRED') {
        console.error(chalk.yellow(`  ${body.message}`))
        console.error()
        console.error(`  To submit for review, run: ${chalk.cyan('bagdock submit')}`)
        console.error(`  To deploy to staging instead: ${chalk.cyan('bagdock deploy')}`)
      } else {
        console.error(`  ${body.error}`)
      }
      process.exit(1)
    }

    if (!res.ok) {
      const body = await res.text()
      console.error(chalk.red(`  Deploy failed (${res.status}):`), body.slice(0, 300))
      process.exit(1)
    }

    const result = await res.json() as {
      data: {
        versionId: string
        version: string
        environment: string
        workerUrl: string
        namespace: string
        previewHash?: string
        publisher_warning?: string
        secrets_warning?: string
      }
    }

    console.log(chalk.green('\n  Deploy successful!\n'))
    console.log(`  Version:     ${chalk.bold(result.data.version)}`)
    console.log(`  Environment: ${chalk.bold(result.data.environment)}`)
    console.log(`  Worker URL:  ${chalk.cyan(result.data.workerUrl)}`)
    if (result.data.previewHash) {
      console.log(`  Preview ID:  ${chalk.dim(result.data.previewHash)}`)
    }
    console.log(`  Namespace:   ${chalk.dim(result.data.namespace)}`)

    if (result.data.secrets_warning) {
      console.log(chalk.yellow(`\n  ⚠ ${result.data.secrets_warning}`))
    }
    if (result.data.publisher_warning) {
      console.log(chalk.yellow(`\n  ⚠ ${result.data.publisher_warning}`))
    }

    if (environment === 'preview') {
      console.log(chalk.dim('\n  This is an ephemeral preview deploy. It will not replace the stable staging URL.'))
    }
  } catch (err: any) {
    console.error(chalk.red('  Deploy failed:'), err.message)
    process.exit(1)
  }
}

function confirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}
