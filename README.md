```
  ----++                                ----++                    ---+++     
  ---+++                                ---++                     ---++      
 ----+---     -----     ---------  --------++ ------     -----   ----++----- 
 ---------+ --------++----------++--------+++--------+ --------++---++---++++
 ---+++---++ ++++---++---+++---++---+++---++---+++---++---++---++------++++  
----++ ---++--------++---++----++---++ ---++---++ ---+---++     -------++    
----++----+---+++---++---++----++---++----++---++---+++--++ --------+---++   
---------++--------+++--------+++--------++ -------+++ -------++---++----++  
 +++++++++   +++++++++- +++---++   ++++++++    ++++++    ++++++  ++++  ++++  
                     --------+++                                             
                       +++++++                                               
```

# @bagdock/cli

The official CLI for Bagdock. Built for humans, AI agents, and CI/CD pipelines.

## Install

### cURL (macOS / Linux)

```bash
curl -fsSL https://bdok.dev/install.sh | bash
```

### PowerShell (Windows)

```powershell
irm https://bdok.dev/install.ps1 | iex
```

### Homebrew (macOS / Linux)

```bash
brew install bagdock/cli/bagdock
```

### Node.js

```bash
# npm
npm install -g @bagdock/cli

# yarn
yarn global add @bagdock/cli

# pnpm
pnpm add -g @bagdock/cli

# bun
bun add -g @bagdock/cli
```

Or run without installing:

```bash
npx @bagdock/cli --help
bunx @bagdock/cli --help
pnpm dlx @bagdock/cli --help
```

### Agent skills

This CLI ships with an agent skill that teaches AI coding agents (Cursor, Claude Code, Codex, Conductor, etc.) how to use the Bagdock CLI effectively — including non-interactive flags, output formats, and common pitfalls.

To install skills for Bagdock's full platform (API, CLI, adapters) from the central skills repository:

```bash
npx skills add bagdock/bagdock-skills
```

See [bagdock/bagdock-skills](https://github.com/bagdock/bagdock-skills) for all available skills and plugin manifests.

## Local development

Use this when you want to change the CLI and run your build locally.

### Prerequisites

- Node.js 20+
- Bun (for building)

### Setup

Clone the repo:

```bash
git clone https://github.com/bagdock/bagdock-cli.git
cd bagdock-cli
```

Install dependencies:

```bash
bun install
```

Build locally:

```bash
bun run build
```

Output: `./dist/bagdock.js`

### Running the CLI locally

Use the dev script:

```bash
bun run dev -- --version
bun run dev -- doctor
bun run dev -- keys list --json
```

Or run the built JS bundle:

```bash
node dist/bagdock.js --version
```

### Making changes

After editing source files, rebuild:

```bash
bun run build
```

### Running tests

```bash
bun run test
```

## Quick start

```bash
# Authenticate
bagdock login

# Check your environment
bagdock doctor

# Scaffold a new project
bagdock init

# Start local development
bagdock dev

# Deploy to Bagdock
bagdock deploy
```

## What are apps and edges?

**Edges** are backend workers that connect external APIs, handle webhooks, and sync data between platforms.

**Apps** are UI extensions that add screens, panels, and drawers to the Bagdock operator dashboard.

Both deploy to the Bagdock platform via the CLI. You don't need to manage any infrastructure.

## Authentication

The CLI resolves your API key using the following priority chain:

| Priority | Source | How to set |
|----------|--------|-----------|
| 1 (highest) | `--api-key` flag | `bagdock --api-key sk_live_xxx deploy ...` |
| 2 | `BAGDOCK_API_KEY` env var | `export BAGDOCK_API_KEY=sk_live_xxx` |
| 3 | `BAGDOCK_TOKEN` env var | `export BAGDOCK_TOKEN=<jwt>` |
| 4 (lowest) | Config file | `bagdock login` |

If no key is found from any source, the CLI errors with code `auth_error`.

## Environment context

The CLI supports Stripe-style live/test mode switching. Login is universal — you authenticate once, then select which operator and environment to target.

### Operator + environment resolution

| Priority | Source | How to set |
|----------|--------|-----------|
| 1 (highest) | `--env` global flag | `bagdock --env test deploy` |
| 2 | `.bagdock/link.json` | `bagdock link --env test` |
| 3 | Profile stored value | `bagdock switch` |
| 4 (lowest) | Default | `live` |

For operator slug:

| Priority | Source | How to set |
|----------|--------|-----------|
| 1 (highest) | `BAGDOCK_OPERATOR` env var | `export BAGDOCK_OPERATOR=wisestorage` |
| 2 (lowest) | Profile stored value | `bagdock switch` or `bagdock login` |

### Typical workflow

```bash
# Login (universal identity)
bagdock login

# Select operator and environment
bagdock switch

# Or override per-command
bagdock --env test deploy --target staging
bagdock --env live apps list
```

All API requests include `X-Environment` and `X-Operator-Slug` headers, ensuring the backend resolves the correct tenant database.

## Commands

### `bagdock login`

Authenticate by starting an OAuth 2.0 Device Authorization Grant flow. The CLI opens your browser to the Bagdock dashboard where you approve access.

#### Interactive mode (default in terminals)

When run in a terminal, the CLI:

1. Requests a device code from the API
2. Displays a one-time code and opens your browser
3. Waits for you to enter the code and approve
4. Stores credentials at `~/.bagdock/credentials.json`

#### Non-interactive mode (CI, pipes, scripts)

For headless environments, use an API key instead of interactive login:

```bash
export BAGDOCK_API_KEY=sk_live_xxx
bagdock deploy --production --yes
```

#### Output

```bash
# JSON output
bagdock login --json
# => {"success":true,"config_path":"/Users/you/.bagdock/credentials.json","profile":"default"}
```

#### Error codes

| Code | Cause |
|------|-------|
| `auth_error` | Device code request failed |
| `expired_token` | Device code expired before approval |
| `access_denied` | User denied authorization |

---

### `bagdock logout`

Clear stored credentials for the active profile.

```bash
bagdock logout
```

---

### `bagdock whoami`

Show the current authenticated user.

```bash
bagdock whoami
# => Logged in as you@example.com
#    Operator: op_abc123
#    Profile: default
```

JSON output:

```bash
bagdock whoami --json
# => {"email":"you@example.com","operator_id":"op_abc123","profile":"default"}
```

---

### `bagdock doctor`

Run environment diagnostics. Verifies your CLI version, API key, project config, and detects AI agent integrations.

```bash
bagdock doctor
```

#### Checks performed

| Check | Pass | Warn | Fail |
|-------|------|------|------|
| CLI Version | Running latest | Update available or registry unreachable | — |
| API Key | Key found (shows masked key + source) | — | No key found |
| Operator Context | Operator + environment set | No operator selected | — |
| Project Config | Valid `bagdock.json` found | No config or incomplete | — |
| AI Agents | Lists detected agents (or none) | — | — |

The API key is always masked in output (e.g. `sk_live_...xxxx`).

#### Interactive mode

Shows status icons with colored output:

```
  Bagdock Doctor

  ✔ CLI Version: v0.3.0 (latest)
  ✔ API Key: sk_live_...xxxx (source: env)
  ✔ Project Config: smart-entry (edge/adapter)
  ✔ AI Agents: Detected: Cursor, Claude Desktop
```

#### JSON mode

```bash
bagdock doctor --json
```

```json
{
  "ok": true,
  "checks": [
    { "name": "CLI Version", "status": "pass", "message": "v0.3.0 (latest)" },
    { "name": "API Key", "status": "pass", "message": "sk_live_...xxxx (source: env)" },
    { "name": "Project Config", "status": "pass", "message": "smart-entry (edge/adapter)" },
    { "name": "AI Agents", "status": "pass", "message": "Detected: Cursor" }
  ]
}
```

Each check has a `status` of `pass`, `warn`, or `fail`. The top-level `ok` is `false` if any check is `fail`.

#### Detected AI agents

| Agent | Detection method |
|-------|-----------------|
| Cursor | `~/.cursor` directory exists |
| Claude Desktop | Platform-specific config file exists |
| VS Code | `.vscode/mcp.json` in current directory |
| Windsurf | `~/.windsurf` directory exists |
| OpenClaw/Codex | `~/clawd/skills` or `~/.codex` directory exists |

#### Exit code

Exits `0` when all checks pass or warn. Exits `1` if any check fails.

---

### `bagdock switch`

Switch operator and environment context. After login, use this to select which operator (live or sandbox) to target.

```bash
bagdock switch
```

#### Interactive mode

```
? Select operator:
  1. WiseStorage (wisestorage)
  2. Ardran REIT (ardran-reit)
> 1

? Select environment:
  1. Live
  2. Sandbox: crm-integration (default)
  3. Sandbox: access-testing
> 2

Switched to wisestorage [test] (sandbox: crm-integration)
```

#### Non-interactive mode (CI/CD)

```bash
bagdock switch --operator wisestorage --env test
```

#### JSON output

```bash
bagdock switch --operator wisestorage --env live --json
# => {"operator":{"id":"opreg_xxx","slug":"wisestorage","name":"WiseStorage"},"environment":"live"}
```

---

### Switch between profiles

If you work across multiple Bagdock operators, the CLI supports named profiles.

#### List profiles

```bash
bagdock auth list
```

#### Switch active profile

```bash
bagdock auth switch production
```

You can also use the global `--profile` (or `-p`) flag on any command to run it with a specific profile:

```bash
bagdock --profile production deploy --yes
bagdock -p staging keys list
```

---

### `bagdock init [dir]`

Scaffold a new project with a `bagdock.json` config file.

| Flag | Description |
|------|-------------|
| `--type <edge\|app>` | Deployment target |
| `--kind <adapter\|comms\|webhook\|ui-extension\|microfrontend>` | Specific project kind |
| `--category <name>` | Marketplace category |
| `--slug <name>` | Unique project slug (kebab-case) |
| `--name <name>` | Display name |

#### Examples

```bash
# Interactive scaffolding
bagdock init

# Non-interactive
bagdock init --type edge --kind adapter --category access_control --slug smart-entry --name "Smart Entry"
```

---

### `bagdock deploy`

Build and deploy to the Bagdock platform.

| Flag | Description |
|------|-------------|
| `--production` | Deploy to production (default: staging) |
| `--preview` | Create an ephemeral preview deployment |
| `--yes` | Skip confirmation prompts (required in non-TTY) |

#### Examples

```bash
# Deploy to staging
bagdock deploy

# Deploy to production
bagdock deploy --production --yes

# Preview deployment
bagdock deploy --preview --json
```

#### Error codes

| Code | Cause |
|------|-------|
| `auth_error` | Not authenticated |
| `no_config` | No `bagdock.json` found |
| `build_error` | Build failed |
| `deploy_error` | API rejected the deployment |

---

### `bagdock submit`

Submit your app for marketplace review. Transitions `review_status` from `draft` to `submitted`.

```bash
bagdock submit
```

---

### `bagdock validate`

Run local pre-submission checks on `bagdock.json` and your bundle before submitting.

```bash
bagdock validate
```

Checks performed:

| Check | Pass | Warn | Fail |
|-------|------|------|------|
| bagdock.json | Found and parsed | — | Missing or invalid JSON |
| Required fields | All present | — | Missing name, slug, version, type, category, or main |
| Type | Valid type | — | Invalid type value |
| Kind | — | Unknown kind | — |
| Entry point | File exists (shows size) | — | File not found |
| Bundle size | Under 10 MB | Approaching limit (>80%) | Over 10 MB |
| Project link | — | Slug mismatch with linked project | — |

```bash
# JSON output
bagdock validate --json
# => {"ok":true,"checks":[...]}
```

Exit code `0` if all checks pass or warn. Exit code `1` if any check fails.

---

### `bagdock submission list`

List submission history for the current app.

```bash
bagdock submission list
bagdock submission list --app my-adapter --json
```

| Flag | Description |
|------|-------------|
| `--app <slug>` | App slug (defaults to `bagdock.json` or linked project) |

### `bagdock submission status <id>`

Fetch detailed review state for a specific submission.

```bash
bagdock submission status iadpv_abc123
bagdock submission status iadpv_abc123 --json
```

| Flag | Description |
|------|-------------|
| `--app <slug>` | App slug |

### `bagdock submission withdraw <id>`

Cancel a pending submission before approval. Only works when `review_status` is `submitted`.

```bash
bagdock submission withdraw iadpv_abc123
```

| Flag | Description |
|------|-------------|
| `--app <slug>` | App slug |

#### Error codes

| Code | Cause |
|------|-------|
| `not_found` | Submission or app not found |
| `invalid_status` | App is not in `submitted` state |

---

### `bagdock open [slug]`

Open the current project in the Bagdock dashboard.

```bash
bagdock open
bagdock open my-adapter
```

Reads the slug from `bagdock.json`, linked project, or the argument.

---

### `bagdock inspect [slug]`

Show deployment details and status for an app.

```bash
bagdock inspect
bagdock inspect my-adapter --json
```

Displays: name, slug, type, version, review status, worker URL, namespace, timestamps.

---

### `bagdock link`

Link the current directory to a Bagdock app or edge. Other commands use the linked slug as a fallback.

```bash
# Interactive: select from your apps
bagdock link

# Non-interactive
bagdock link --slug my-adapter
```

| Flag | Description |
|------|-------------|
| `--slug <slug>` | Project slug (required in non-interactive mode) |

Stores the link in `.bagdock/link.json` in the current directory.

---

### `bagdock env list`

List environment variables for the current app.

```bash
bagdock env list
bagdock env list --json
```

### `bagdock env set <key> <value>`

Set an environment variable. Takes effect on next deploy.

```bash
bagdock env set VENDOR_API_KEY sk_live_abc123
```

### `bagdock env remove <key>`

Remove an environment variable.

```bash
bagdock env remove VENDOR_API_KEY
```

### `bagdock env pull [file]`

Pull remote env var keys to a local `.env` file for development.

```bash
bagdock env pull
bagdock env pull .env.development
```

The API does not expose secret values. The file is created with keys and empty values — fill them in for local dev.

---

### `bagdock keys create`

Create a new API key. The raw key is shown **once** on creation.

| Flag | Required | Description |
|------|----------|-------------|
| `--name <name>` | Yes | Display name for the key |
| `--environment <live\|test>` | No | Environment (default: `live`) |
| `--type <secret\|publishable>` | No | Key type (default: `secret`) |
| `--category <full_access\|restricted>` | No | Access level (default: `full_access`) |
| `--scopes <scope...>` | No | Permission scopes (for restricted keys) |

#### Examples

```bash
# Create a live secret key
bagdock keys create --name "GitHub Actions" --environment live

# Create a restricted test key
bagdock keys create --name "Read-Only" --environment test --category restricted --scopes units:read contacts:read

# JSON output (capture the raw key)
bagdock keys create --name "CI Deploy" --json
```

#### Output

```json
{
  "id": "ak_abc123",
  "name": "CI Deploy",
  "key": "sk_live_abc123def456...",
  "key_prefix": "sk_live_abc123de",
  "environment": "live",
  "key_type": "secret",
  "created_at": "2026-04-04T12:00:00Z"
}
```

### `bagdock keys list`

List API keys (prefix and metadata only — raw keys are never stored).

| Flag | Description |
|------|-------------|
| `--environment <live\|test>` | Filter by environment |

```bash
bagdock keys list
bagdock keys list --environment live --json
```

### `bagdock keys delete <id>`

Revoke an API key permanently.

| Flag | Description |
|------|-------------|
| `--yes` | Skip confirmation (required in non-TTY) |
| `--reason <text>` | Reason for revocation (optional, recorded) |

```bash
bagdock keys delete ak_abc123 --yes --reason "Key compromised"
```

#### Error codes

| Code | Cause |
|------|-------|
| `auth_error` | Not authenticated |
| `not_found` | Key ID does not exist |
| `forbidden` | Insufficient permissions |

---

### `bagdock apps list`

List deployed apps and edges.

```bash
bagdock apps list
bagdock apps list --json
```

### `bagdock apps get <slug>`

Get details for a specific deployed app.

```bash
bagdock apps get smart-entry
bagdock apps get smart-entry --json
```

---

### `bagdock logs list`

List recent execution log entries.

| Flag | Description |
|------|-------------|
| `--app <slug>` | Filter by app slug |
| `--limit <n>` | Number of entries (default: 50, max: 200) |

```bash
bagdock logs list --app smart-entry --limit 20
```

### `bagdock logs tail`

Stream logs in real-time.

| Flag | Description |
|------|-------------|
| `--app <slug>` | App to stream logs for |

```bash
bagdock logs tail --app smart-entry
```

### `bagdock logs get <id>`

Get a single log entry by ID.

| Flag | Description |
|------|-------------|
| `--app <slug>` | App the log belongs to |

```bash
bagdock logs get log_abc123 --app smart-entry
```

---

## Global options

These flags work on every command and are passed before the subcommand:

```
bagdock [global options] <command> [command options]
```

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key for this invocation (takes highest priority) |
| `-p, --profile <name>` | Profile to use (overrides `BAGDOCK_PROFILE` env var) |
| `--env <live\|test>` | Override environment for this invocation |
| `--json` | Force JSON output even in interactive terminals |
| `-q, --quiet` | Suppress spinners and status output (implies `--json`) |
| `--version` | Print version and exit |
| `--help` | Show help text |

## Output behavior

The CLI has two output modes:

| Mode | When | Stdout | Stderr |
|------|------|--------|--------|
| Interactive | Terminal (TTY) | Formatted text | Spinners, prompts |
| Machine | Piped, CI, or `--json` | JSON | Nothing |

Switching is automatic — pipe to another command and JSON output activates:

```bash
bagdock doctor | jq '.checks[].name'
bagdock keys list | jq '.[].key_prefix'
```

### Error output

Errors always exit with code `1` and output structured JSON to stdout:

```json
{ "error": { "code": "auth_error", "message": "No API key found" } }
```

## API keys

API keys follow a Stripe-style prefix convention:

| Prefix | Meaning |
|--------|---------|
| `sk_live_` | Secret key, live environment |
| `sk_test_` | Secret key, test/sandbox environment |
| `pk_live_` | Publishable key, live |
| `pk_test_` | Publishable key, test |
| `rk_live_` | Restricted key, live |
| `rk_test_` | Restricted key, test |

The raw key is shown **once** on creation. Only the prefix and metadata are stored and displayed after that.

## Agent & CI/CD usage

### CI/CD

Set `BAGDOCK_API_KEY` as an environment variable — no `bagdock login` needed:

```yaml
# GitHub Actions
env:
  BAGDOCK_API_KEY: ${{ secrets.BAGDOCK_API_KEY }}
steps:
  - run: |
      bagdock deploy --production --yes --json
```

### AI agents

Agents calling the CLI as a subprocess automatically get JSON output (non-TTY detection). The contract:

- **Input**: All required flags must be provided (no interactive prompts)
- **Output**: JSON to stdout, nothing to stderr
- **Exit code**: `0` success, `1` error
- **Errors**: Always include `message` and `code` fields

## Configuration

| Item | Path | Notes |
|------|------|-------|
| Config directory | `~/.bagdock/` | Respects `BAGDOCK_INSTALL` |
| Credentials | `~/.bagdock/credentials.json` | `0600` permissions (owner read/write) |
| Active profile | Stored in credentials file | Overridden by `--profile` or `BAGDOCK_PROFILE` |
| Project config | `./bagdock.json` | Per-project, in repo root |

### bagdock.json examples

#### Edge (backend worker)

```json
{
  "name": "noke-lock-adapter",
  "slug": "noke-lock-adapter",
  "type": "edge",
  "kind": "adapter",
  "category": "locks",
  "main": "src/index.ts"
}
```

#### App (UI extension)

```json
{
  "name": "my-dashboard-widget",
  "slug": "my-dashboard-widget",
  "type": "app",
  "kind": "ui-extension",
  "category": "analytics",
  "main": "src/index.ts"
}
```

## License

MIT — see [LICENSE](LICENSE).
