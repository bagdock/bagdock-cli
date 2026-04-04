# @bagdock/cli

Developer CLI for building, testing, and deploying apps and edges on the Bagdock platform.

## Install

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

## Quick start

```bash
# Authenticate with your Bagdock account
bagdock login

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

## Commands

### Auth

| Command | Description |
|---------|-------------|
| `bagdock login` | Authenticate via Device Authorization Grant (opens browser) |
| `bagdock logout` | Clear stored credentials |
| `bagdock whoami` | Show current authenticated user |

### Development

| Command | Description |
|---------|-------------|
| `bagdock init` | Scaffold a new project with `bagdock.json` |
| `bagdock dev` | Start local dev server |
| `bagdock deploy` | Build and deploy to Bagdock |
| `bagdock submit` | Submit for marketplace review |

### Environment Variables

| Command | Description |
|---------|-------------|
| `bagdock env list` | List environment variables for this app |
| `bagdock env set <key> <value>` | Set an environment variable |
| `bagdock env remove <key>` | Remove an environment variable |

### API Keys

| Command | Description |
|---------|-------------|
| `bagdock keys create` | Create a new API key (raw key shown once) |
| `bagdock keys list` | List API keys (prefix + metadata only) |
| `bagdock keys delete <id>` | Revoke an API key |

### Apps & Logs

| Command | Description |
|---------|-------------|
| `bagdock apps list` | List deployed apps and edges |
| `bagdock apps get <slug>` | Get details for a specific app |
| `bagdock logs list` | List recent execution log entries |
| `bagdock logs tail` | Stream logs in real-time |

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Force JSON output (auto-enabled in non-TTY) |
| `-q, --quiet` | Suppress status messages (implies `--json`) |
| `--api-key <key>` | Override auth for this invocation |
| `-V, --version` | Print version |
| `-h, --help` | Print help |

## Authentication

The CLI resolves credentials in this order:

1. `--api-key <key>` flag (highest priority)
2. `BAGDOCK_API_KEY` environment variable
3. `BAGDOCK_TOKEN` environment variable (M2M JWT)
4. `~/.bagdock/credentials.json` (from `bagdock login`)

### Interactive login

When you run `bagdock login`, the CLI uses the OAuth 2.0 Device Authorization Grant:

1. Displays a one-time code
2. Opens your browser to the Bagdock dashboard
3. Asks you to enter the code and approve access
4. Stores credentials locally at `~/.bagdock/credentials.json`

### CI/CD

For non-interactive environments, create an API key and set it as an environment variable:

```bash
# Create a key for CI
bagdock keys create --name "GitHub Actions" --environment live --json

# Use it in your pipeline
BAGDOCK_API_KEY=sk_live_xxx bagdock deploy --production --yes
```

## API Keys

API keys follow the Stripe-style prefix convention:

| Prefix | Meaning |
|--------|---------|
| `sk_live_` | Secret key, live environment |
| `sk_test_` | Secret key, test/sandbox environment |
| `pk_live_` | Publishable key, live |
| `pk_test_` | Publishable key, test |
| `rk_live_` | Restricted key, live |
| `rk_test_` | Restricted key, test |

The raw key is shown **once** on creation. Only the prefix and metadata are stored and displayed after that.

## Configuration

Each project uses a `bagdock.json` file. All config lives here — no `wrangler.toml` needed. A temporary one is auto-generated for local dev and should be gitignored.

### Edge example

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

### App example

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

## Agent protocol

When piped or run in non-TTY environments (CI/CD, AI agents), the CLI automatically outputs JSON to stdout and errors to stderr. Use `--json` to force this in interactive mode.

```bash
# Structured JSON output for scripting
bagdock keys list --json
bagdock apps list --quiet

# Structured errors go to stderr
bagdock deploy --production --yes 2>errors.json
```

Exit codes: `0` = success, `1` = error.

## License

MIT — see [LICENSE](LICENSE).
