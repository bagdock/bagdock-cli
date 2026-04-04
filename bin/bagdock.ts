#!/usr/bin/env node
/**
 * @bagdock/cli — Developer CLI for Bagdock apps and edges.
 *
 * Commands:
 *   login     Authenticate via OAuth2 (opens browser)
 *   logout    Clear stored credentials
 *   whoami    Show current authenticated user
 *   init      Scaffold a new project with bagdock.json
 *   dev       Start local dev server
 *   deploy    Build and deploy to Bagdock platform
 *   env       Manage project environment variables
 */

import { Command } from 'commander'
import { login, logout, whoami } from '../src/auth'
import { init } from '../src/init'

const program = new Command()

program
  .name('bagdock')
  .description('Bagdock developer CLI')
  .version('0.1.0')

// ---------- Auth ----------

program
  .command('login')
  .description('Authenticate with Bagdock (opens browser)')
  .action(login)

program
  .command('logout')
  .description('Clear stored credentials')
  .action(logout)

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(whoami)

// ---------- Scaffold ----------

program
  .command('init [dir]')
  .description('Scaffold a new project with bagdock.json')
  .option('-t, --type <type>', 'Project type (edge, app)')
  .option('-k, --kind <kind>', 'Project kind (adapter, comms, webhook, ui-extension, microfrontend)')
  .option('-c, --category <category>', 'Category')
  .option('-s, --slug <slug>', 'Unique project slug')
  .option('-n, --name <name>', 'Display name')
  .action((dir: string | undefined, opts: Record<string, string>) => init(dir ?? '.', opts))

// ---------- Dev ----------

program
  .command('dev')
  .description('Start local dev server')
  .option('-p, --port <port>', 'Local dev port', '8787')
  .action(async (opts) => {
    const { dev } = await import('../src/dev')
    await dev(opts)
  })

// ---------- Deploy ----------

program
  .command('deploy')
  .description('Build locally and deploy via Bagdock API → CF Workers for Platforms')
  .option('--env <environment>', 'Target environment (preview, staging, production)', 'staging')
  .option('--preview', 'Deploy an ephemeral preview ({slug}-{hash}.pre.bdok.dev)')
  .option('--production', 'Deploy to production ({slug}.bdok.dev)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (opts) => {
    const { deploy } = await import('../src/deploy')
    await deploy(opts)
  })

// ---------- Submit ----------

program
  .command('submit')
  .description('Submit app for Bagdock marketplace review (required for public production deploys)')
  .action(async () => {
    const { submit } = await import('../src/submit')
    await submit()
  })

// ---------- Env ----------

const envCmd = program
  .command('env')
  .description('Manage app environment variables')

envCmd
  .command('list')
  .description('List environment variables for this app')
  .action(async () => {
    const { envList } = await import('../src/env-cmd')
    await envList()
  })

envCmd
  .command('set <key> <value>')
  .description('Set an environment variable')
  .action(async (key: string, value: string) => {
    const { envSet } = await import('../src/env-cmd')
    await envSet(key, value)
  })

envCmd
  .command('remove <key>')
  .description('Remove an environment variable')
  .action(async (key: string) => {
    const { envRemove } = await import('../src/env-cmd')
    await envRemove(key)
  })

program.parse()
