# Deploy & Apps Reference

## `bagdock deploy`

Builds locally and deploys via the Bagdock API to Cloudflare Workers for Platforms. You never need Cloudflare credentials.

```bash
bagdock deploy                    # staging (default)
bagdock deploy --preview          # ephemeral preview URL
bagdock deploy --production       # live production
bagdock deploy --production --yes # skip confirmation
```

### URL Scheme

| Environment | URL Pattern |
| --- | --- |
| Preview | `{slug}-{hash}.pre.bdok.dev` |
| Staging | `{slug}.pre.bdok.dev` |
| Production | `{slug}.bdok.dev` |

### Governance

- **Private apps**: deploy freely to any environment
- **Public integrations**: production requires `review_status = 'approved'`
- Use `bagdock submit` to request marketplace review

### Deploy Flow

1. Reads `bagdock.json` from current directory
2. Bundles the entry point (`main` field) with Bun
3. Uploads the compiled Worker to `POST /developer/apps/:slug/deploy`
4. The API handles CF Workers for Platforms upload

### Options

| Flag | Description | Default |
| --- | --- | --- |
| `--env <environment>` | Target: `preview`, `staging`, `production` | `staging` |
| `--preview` | Shortcut for `--env preview` | — |
| `--production` | Shortcut for `--env production` | — |
| `-y, --yes` | Skip confirmation prompts | — |

## `bagdock submit`

Submits the current app for Bagdock marketplace review. Required for public integrations before production deploy.

```bash
bagdock submit
```

Transitions `review_status` from `draft` to `submitted`.

## `bagdock init [dir]`

Scaffolds a new project with a `bagdock.json` configuration file.

```bash
bagdock init
bagdock init my-adapter --type edge --kind adapter --category access_control
```

### Options

| Flag | Description |
| --- | --- |
| `-t, --type <type>` | `edge` (backend worker) or `app` (UI extension) |
| `-k, --kind <kind>` | `adapter`, `comms`, `webhook`, `ui-extension`, `microfrontend` |
| `-c, --category <cat>` | Marketplace category |
| `-s, --slug <slug>` | Unique project slug (kebab-case) |
| `-n, --name <name>` | Display name |

## `bagdock.json` Spec

```json
{
  "name": "My Adapter",
  "slug": "my-adapter",
  "version": "1.0.0",
  "type": "edge",
  "kind": "adapter",
  "category": "access_control",
  "maintainer": "operator",
  "visibility": "private",
  "main": "src/index.ts",
  "compatibilityDate": "2024-09-23",
  "env": {
    "VENDOR_API_KEY": { "description": "API key for vendor", "required": true }
  }
}
```
