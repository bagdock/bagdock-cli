# Local Development Reference

## `bagdock dev`

Starts a local development server using Wrangler, mimicking the Cloudflare Workers environment.

```bash
bagdock dev
bagdock dev --port 3000
```

### Options

| Flag | Description | Default |
| --- | --- | --- |
| `-p, --port <port>` | Local dev server port | `8787` |

### How It Works

1. Reads `bagdock.json` from the current directory
2. Generates a temporary `wrangler.toml` from the project config
3. Starts `wrangler dev` with the appropriate settings
4. Hot-reloads on file changes

### Requirements

- Wrangler must be installed (globally or as a dev dependency)
- `bagdock.json` must exist with a valid `main` entry point

### Wrangler Overrides

Add a `wrangler` key to `bagdock.json` to override generated Wrangler config:

```json
{
  "name": "my-adapter",
  "slug": "my-adapter",
  "main": "src/index.ts",
  "wrangler": {
    "kv_namespaces": [
      { "binding": "CACHE", "id": "abc123" }
    ]
  }
}
```
