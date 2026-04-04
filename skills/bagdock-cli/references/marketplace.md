# Marketplace Submission Lifecycle

The Bagdock marketplace uses a reviewed submission model. Developers submit, Bagdock reviews, then approves or rejects. `bagdock publish` is intentionally not a CLI command — final publication is handled by Bagdock staff.

## Workflow

1. `bagdock validate` — Run local checks before uploading
2. `bagdock submit` — Upload bundle and request review (draft -> submitted)
3. `bagdock submission list` — View all submissions
4. `bagdock submission status <id>` — Check review progress
5. `bagdock submission withdraw <id>` — Cancel before approval (submitted -> draft)

## Commands

### `bagdock validate`

Local-only checks — no API call needed. Validates:

- `bagdock.json` exists and parses
- Required fields present (name, slug, version, type, category, main)
- Type is `edge` or `app`
- Entry point file exists
- Bundle size under 10 MB

```bash
bagdock validate
bagdock validate --json
```

Exit code 0 = pass/warn, 1 = fail.

### `bagdock submission list`

```bash
bagdock submission list --app my-adapter
bagdock submission list --json
```

### `bagdock submission status <id>`

```bash
bagdock submission status iadpv_abc123 --json
```

Returns: app name, version, review_status, type, visibility, change_reason, submitted_by, date.

### `bagdock submission withdraw <id>`

```bash
bagdock submission withdraw iadpv_abc123
```

Only works when `review_status` is `submitted`. Returns the app to `draft` status so you can make changes and re-submit.

## Status Values

| Status | Meaning |
|--------|---------|
| `draft` | Not yet submitted |
| `submitted` | Under review |
| `approved` | Cleared for production |
| `rejected` | Changes requested |

## API Endpoints

- `POST /v1/developer/apps/:slug/submit` — Submit
- `GET /v1/developer/apps/:slug/submissions` — List
- `GET /v1/developer/apps/:slug/submissions/:id` — Detail
- `POST /v1/developer/apps/:slug/submissions/:id/withdraw` — Withdraw
