#!/usr/bin/env node
/**
 * @bagdock/cli — Developer CLI for Bagdock apps and edges.
 *
 * Agent Protocol:
 *   - Non-TTY: auto-JSON output to stdout, errors to stderr
 *   - --json: force JSON output
 *   - --quiet / -q: suppress status messages (implies --json)
 *   - --api-key: override auth for this invocation
 *   - Exit 0 = success, 1 = error
 *
 * Commands:
 *   login     Authenticate via OAuth2 (opens browser)
 *   logout    Clear stored credentials
 *   whoami    Show current authenticated user
 *   init      Scaffold a new project with bagdock.json
 *   dev       Start local dev server
 *   deploy    Build and deploy to Bagdock platform
 *   submit    Submit for marketplace review
 *   env       Manage project environment variables
 *   keys      Manage operator API keys
 *   validate  Pre-submission checks on bagdock.json
 *   submission  Marketplace submission lifecycle
 *   open      Open project in dashboard
 *   inspect   Show deployment details
 *   link      Link directory to project
 */

import { Command } from 'commander'
import { login, logout, whoami, setApiKeyOverride, authList, authSwitch } from '../src/auth'
import { init } from '../src/init'
import { setOutputMode } from '../src/output'
import { setProfileOverride } from '../src/config'

const program = new Command()

program
  .name('bagdock')
  .description('Bagdock developer CLI — built for humans, AI agents, and CI/CD pipelines')
  .version('0.4.0')
  .option('--json', 'Force JSON output (auto-enabled in non-TTY)')
  .option('-q, --quiet', 'Suppress status messages (implies --json)')
  .option('--api-key <key>', 'API key to use for this invocation')
  .option('-p, --profile <name>', 'Profile to use (overrides BAGDOCK_PROFILE)')
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = program.opts()
    setOutputMode({ json: opts.json, quiet: opts.quiet })
    if (opts.apiKey) setApiKeyOverride(opts.apiKey)
    if (opts.profile) setProfileOverride(opts.profile)
  })

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

// ---------- Auth (profiles) ----------

const authCmd = program
  .command('auth')
  .description('Manage authentication profiles')

authCmd
  .command('list')
  .description('List all stored profiles')
  .action(authList)

authCmd
  .command('switch [name]')
  .description('Switch active profile')
  .action(async (name?: string) => authSwitch(name))

// ---------- Doctor ----------

program
  .command('doctor')
  .description('Run environment diagnostics')
  .action(async () => {
    const { doctor } = await import('../src/doctor')
    await doctor()
  })

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
  .description('Build locally and deploy via Bagdock API')
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

// ---------- Validate ----------

program
  .command('validate')
  .description('Run local pre-submission checks on bagdock.json and bundle')
  .action(async () => {
    const { validate } = await import('../src/validate')
    await validate()
  })

// ---------- Submission lifecycle ----------

const subCmd = program
  .command('submission')
  .description('Track marketplace submission status')

subCmd
  .command('list')
  .description('List submission history for the current app')
  .option('--app <slug>', 'App slug (defaults to bagdock.json or linked project)')
  .action(async (opts) => {
    const { submissionList } = await import('../src/submission')
    await submissionList(opts)
  })

subCmd
  .command('status <id>')
  .description('Fetch detailed review state for a submission')
  .option('--app <slug>', 'App slug')
  .action(async (id: string, opts) => {
    const { submissionStatus } = await import('../src/submission')
    await submissionStatus(id, opts)
  })

subCmd
  .command('withdraw <id>')
  .description('Cancel a pending submission before approval')
  .option('--app <slug>', 'App slug')
  .action(async (id: string, opts) => {
    const { submissionWithdraw } = await import('../src/submission')
    await submissionWithdraw(id, opts)
  })

// ---------- Open ----------

program
  .command('open [slug]')
  .description('Open project in the Bagdock dashboard')
  .action(async (slug?: string) => {
    const { open } = await import('../src/open')
    await open(slug)
  })

// ---------- Inspect ----------

program
  .command('inspect [slug]')
  .description('Show deployment details and status for an app')
  .action(async (slug?: string) => {
    const { inspect } = await import('../src/inspect')
    await inspect(slug)
  })

// ---------- Link ----------

program
  .command('link')
  .description('Link current directory to a Bagdock app or edge')
  .option('--slug <slug>', 'Project slug (required in non-interactive mode)')
  .action(async (opts) => {
    const { link } = await import('../src/link')
    await link(opts)
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

envCmd
  .command('pull [file]')
  .description('Pull remote env var keys to a local .env file')
  .action(async (file?: string) => {
    const { envPull } = await import('../src/env-cmd')
    await envPull(file)
  })

// ---------- Keys ----------

const keysCmd = program
  .command('keys')
  .description('Manage operator API keys')

keysCmd
  .command('create')
  .description('Create a new API key (raw key shown once)')
  .requiredOption('--name <name>', 'Key name')
  .option('--type <type>', 'Key type (secret, publishable)', 'secret')
  .option('--category <category>', 'Key category (standard, restricted, personal)', 'standard')
  .option('--environment <env>', 'Environment (live, test)', 'live')
  .option('--scopes <scopes...>', 'Permission scopes')
  .action(async (opts) => {
    const { keysCreate } = await import('../src/keys')
    await keysCreate(opts)
  })

keysCmd
  .command('list')
  .description('List API keys')
  .option('--environment <env>', 'Filter by environment (live, test)')
  .action(async (opts) => {
    const { keysList } = await import('../src/keys')
    await keysList(opts)
  })

keysCmd
  .command('delete <id>')
  .description('Revoke an API key')
  .option('-y, --yes', 'Skip confirmation (required in non-TTY)')
  .option('--reason <reason>', 'Revocation reason')
  .action(async (id: string, opts) => {
    const { keysDelete } = await import('../src/keys')
    await keysDelete(id, opts)
  })

// ---------- Apps ----------

const appsCmd = program
  .command('apps')
  .description('List and inspect deployed apps and edges')

appsCmd
  .command('list')
  .description('List all apps for the authenticated operator')
  .action(async () => {
    const { appsList } = await import('../src/apps')
    await appsList()
  })

appsCmd
  .command('get <slug>')
  .description('Get details for a specific app')
  .action(async (slug: string) => {
    const { appsGet } = await import('../src/apps')
    await appsGet(slug)
  })

// ---------- Logs ----------

const logsCmd = program
  .command('logs')
  .description('View execution logs for deployed apps')

logsCmd
  .command('list')
  .description('List recent log entries')
  .option('--app <slug>', 'App slug (defaults to bagdock.json slug)')
  .option('--limit <n>', 'Number of entries', '50')
  .action(async (opts) => {
    const { logsList } = await import('../src/logs')
    await logsList(opts)
  })

logsCmd
  .command('get <id>')
  .description('Get a specific log entry')
  .option('--app <slug>', 'App slug (defaults to bagdock.json slug)')
  .action(async (id: string, opts) => {
    const { logsGet } = await import('../src/logs')
    await logsGet(id, opts)
  })

logsCmd
  .command('tail')
  .description('Stream logs in real-time')
  .option('--app <slug>', 'App slug (defaults to bagdock.json slug)')
  .action(async (opts) => {
    const { logsTail } = await import('../src/logs')
    await logsTail(opts)
  })

program.parse()
