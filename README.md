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

| Command | Description |
|---------|-------------|
| `bagdock login` | Authenticate via Device Authorization Grant (opens browser) |
| `bagdock logout` | Clear stored credentials |
| `bagdock whoami` | Show current authenticated user |
| `bagdock init` | Scaffold a new project with `bagdock.json` |
| `bagdock dev` | Start local dev server |
| `bagdock deploy` | Build and deploy to Bagdock |
| `bagdock env set` | Set an environment variable for your project |
| `bagdock env list` | List environment variables |
| `bagdock submit` | Submit for marketplace review |

## Authentication

The CLI uses the OAuth 2.0 Device Authorization Grant. When you run `bagdock login`, it will:

1. Display a one-time code
2. Open your browser to the Bagdock dashboard
3. Ask you to enter the code and approve access
4. Store credentials locally at `~/.bagdock/credentials.json`

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

## License

MIT — see [LICENSE](LICENSE).
