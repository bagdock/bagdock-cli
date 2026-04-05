# Bagdock CLI Skill

The `@bagdock/cli` is the developer CLI for building, testing, and deploying apps and edges on the Bagdock self-storage operator platform.

## Installation

```bash
npm install -g @bagdock/cli
```

Or use without installing:

```bash
npx @bagdock/cli <command>
```

## Agent Protocol

When calling the Bagdock CLI from an AI agent, CI/CD pipeline, or non-interactive environment:

1. **JSON output is automatic** in non-TTY. Force it with `--json`.
2. **Errors** go to stderr as `{ "error": { "code": "...", "message": "..." } }`.
3. **Success** data goes to stdout as JSON.
4. **Exit codes**: `0` = success, `1` = error.
5. **Use `--quiet` / `-q`** to suppress all status/progress output (implies `--json`).
6. **Use `--api-key <key>`** to authenticate without `bagdock login` (overrides all other auth).
7. **Use `--yes`** on destructive commands (e.g., `keys delete`) in non-interactive mode.

### Authentication Priority

The CLI resolves credentials in this order:

1. `--api-key <key>` flag (highest priority)
2. `BAGDOCK_API_KEY` environment variable
3. `BAGDOCK_TOKEN` environment variable (M2M JWT)
4. `~/.bagdock/credentials.json` — active profile or `--profile` override (from `bagdock login`)

For CI/CD, set `BAGDOCK_API_KEY` in your environment. For interactive use, run `bagdock login`.

## Global Flags

| Flag | Description |
| --- | --- |
| `--json` | Force JSON output (auto in non-TTY) |
| `-q, --quiet` | Suppress status messages (implies `--json`) |
| `--api-key <key>` | Override auth for this invocation |
| `-p, --profile <name>` | Use a named profile (overrides `BAGDOCK_PROFILE`) |
| `--env <live\|test>` | Override environment for this invocation |
| `-V, --version` | Print version |
| `-h, --help` | Print help |

## Environment Context

All API calls include `X-Environment` and `X-Operator-Slug` headers. Resolution:

- **Environment**: `--env` flag > `.bagdock/link.json` > profile > `BAGDOCK_ENV` > `live`
- **Operator**: `BAGDOCK_OPERATOR` env var > profile stored value

Use `bagdock switch` to select operator and environment interactively, or pass `--env test` to any command.

## Available Commands

| Command | Description |
| --- | --- |
| `login` | Authenticate via OAuth2 device flow (opens browser) |
| `logout` | Clear stored credentials |
| `whoami` | Show current authenticated user |
| `init [dir]` | Scaffold a new project with `bagdock.json` |
| `dev` | Start local dev server |
| `deploy` | Build and deploy to Bagdock platform |
| `submit` | Submit app for marketplace review |
| `env list` | List app environment variables |
| `env set <key> <value>` | Set an environment variable |
| `env remove <key>` | Remove an environment variable |
| `env pull [file]` | Pull remote env var keys to local .env file |
| `keys create` | Create a new API key (raw key shown once) |
| `keys list` | List API keys |
| `keys delete <id>` | Revoke an API key |
| `validate` | Run local pre-submission checks on bagdock.json and bundle |
| `submission list` | List marketplace submission history |
| `submission status <id>` | Fetch detailed review state for a submission |
| `submission withdraw <id>` | Cancel a pending submission |
| `open [slug]` | Open project in Bagdock dashboard |
| `inspect [slug]` | Show deployment details and status |
| `link` | Link directory to a Bagdock app or edge |
| `switch` | Switch operator and environment context (live/test) |
| `doctor` | Run environment diagnostics (version, auth, config, agents) |
| `auth list` | List stored profiles (with operator + env) |
| `auth switch [name]` | Switch active profile |
| `apps list` | List deployed applications |
| `apps get <slug>` | Show details for an application |
| `logs list` | List recent execution logs |
| `logs tail` | Tail live logs |

## Common Patterns

### Deploy to staging

```bash
bagdock deploy
```

### Deploy to production

```bash
bagdock deploy --production
```

### Create an API key for CI/CD

```bash
bagdock keys create --name "GitHub Actions" --environment live --json
```

### Use API key in CI/CD

```bash
BAGDOCK_API_KEY=sk_live_xxx bagdock deploy --production --yes
```

### List keys as JSON (for scripting)

```bash
bagdock keys list --json
```

## Common Mistakes

1. **Forgetting `--yes` in CI/CD** — Destructive commands like `keys delete` require `--yes` in non-interactive environments.
2. **Using wrong environment** — `sk_live_*` keys access production data, `sk_test_*` access sandbox. Match your intent.
3. **Missing `bagdock.json`** — `deploy`, `submit`, and `env` commands require a `bagdock.json` in the current directory. Run `bagdock init` first.
4. **Expired session** — If `whoami` fails, run `bagdock login` again. Sessions expire after 8 hours.

### Validate before submitting

```bash
bagdock validate
bagdock submit
```

### Check submission status

```bash
bagdock submission list --json
bagdock submission status iadpv_xxx
```

### Link a directory and inspect

```bash
bagdock link --slug my-adapter
bagdock inspect
bagdock open
```

### Pull env vars for local dev

```bash
bagdock env pull .env.local
```

## When to Load References

Load specific reference files when the task involves:

- **Authentication, login, or API keys** → `references/auth.md`
- **Deploying, submitting, or managing apps** → `references/deploy.md`
- **Environment variables** → `references/env.md`
- **Local development** → `references/dev.md`
- **Error codes or troubleshooting** → `references/error-codes.md`
- **Marketplace submission lifecycle** → `references/marketplace.md`
- **App management (open, inspect, link)** → `references/app-management.md`
