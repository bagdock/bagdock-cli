# Environment Variables Reference

## `bagdock env list`

Lists environment variable keys (not values) for the current app.

```bash
bagdock env list
```

Requires `bagdock.json` in the current directory (uses the `slug` field).

## `bagdock env set <key> <value>`

Sets an environment variable. Takes effect on the next deploy.

```bash
bagdock env set VENDOR_API_KEY sk_live_xxx
bagdock env set DATABASE_URL "postgres://..."
```

Values are stored in Infisical (platform secret manager) and synced to the Worker's Cloudflare secrets on deploy.

## `bagdock env remove <key>`

Removes an environment variable. Takes effect on the next deploy.

```bash
bagdock env remove VENDOR_API_KEY
```

## Notes

- Environment variables are scoped to the app (by slug)
- Values are never returned by the API — only keys and last-updated timestamps
- Changes take effect on the next `bagdock deploy`, not immediately
- The API endpoint is `PUT /developer/apps/:slug/env` (set) and `DELETE /developer/apps/:slug/env/:key` (remove)
