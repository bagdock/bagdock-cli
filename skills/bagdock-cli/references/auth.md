# Authentication Reference

## `bagdock login`

Starts an OAuth2 Device Authorization Grant (RFC 8628) flow:

1. CLI requests a device code from the Bagdock API
2. Opens the operator dashboard's device authorization page
3. Displays a user code (e.g., `ABCD-1234`)
4. Polls the token endpoint until the user approves
5. Stores an HS256 JWT in `~/.bagdock/credentials.json`

Sessions expire after 8 hours.

```bash
bagdock login
```

## `bagdock logout`

Clears stored credentials from `~/.bagdock/credentials.json`.

```bash
bagdock logout
```

## `bagdock whoami`

Shows the currently authenticated user. Uses the auth priority chain (see SKILL.md).

```bash
bagdock whoami
```

JSON output:

```json
{
  "email": "dev@example.com",
  "operator_id": "opreg_abc123",
  "name": "Developer Name"
}
```

## `bagdock keys create`

Creates a new API key. The raw key is shown **once** — save it immediately.

```bash
bagdock keys create --name "Production CI" --environment live
bagdock keys create --name "Test key" --environment test --category restricted --scopes units:read contacts:read
```

Options:

| Flag | Description | Default |
| --- | --- | --- |
| `--name <name>` | Key name (required) | — |
| `--type <type>` | `secret` or `publishable` | `secret` |
| `--category <cat>` | `standard`, `restricted`, `personal` | `standard` |
| `--environment <env>` | `live` or `test` | `live` |
| `--scopes <scopes...>` | Permission scopes | `[]` (full access for standard) |

Key prefixes follow the Stripe convention:

| Prefix | Meaning |
| --- | --- |
| `sk_live_` | Secret, live environment |
| `sk_test_` | Secret, test environment |
| `pk_live_` | Publishable, live |
| `pk_test_` | Publishable, test |
| `rk_live_` | Restricted, live |
| `rk_test_` | Restricted, test |
| `sk_personal_` | Personal key |

## `bagdock keys list`

Lists all active API keys (prefix + metadata only, never the raw key).

```bash
bagdock keys list
bagdock keys list --environment test --json
```

## `bagdock keys delete <id>`

Revokes an API key (soft-delete). Requires `--yes` in non-interactive mode.

```bash
bagdock keys delete ak_abc123 --yes --reason "Rotating keys"
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `BAGDOCK_API_KEY` | API key for all requests (overrides login) |
| `BAGDOCK_TOKEN` | M2M JWT for service-to-service auth |
| `BAGDOCK_API_URL` | Override API base URL (default: `https://api.bagdock.com`) |
| `BAGDOCK_DASHBOARD_URL` | Override dashboard URL (default: `https://dashboard.bagdock.com`) |

## Credential Storage

Credentials are stored at `~/.bagdock/credentials.json` with `0600` permissions (owner-only read/write). The directory is created with `0700` permissions.

```json
{
  "accessToken": "<HS256 JWT>",
  "expiresAt": 1700000000000,
  "email": "dev@example.com",
  "operatorId": "opreg_abc123"
}
```
